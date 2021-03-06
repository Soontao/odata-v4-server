// @ts-nocheck
import { getUnProxyTarget, inject, InjectContainer, LazyRef, noWrap, required, transient, withType } from '@newdash/inject';
import { forEach } from '@newdash/newdash/forEach';
import { isArray } from '@newdash/newdash/isArray';
import { isEmpty } from '@newdash/newdash/isEmpty';
import { closest } from '@newdash/newdash/string/distance';
import { defaultParser, ODataFilter, ODataMethod, ODataQueryParam, param, QueryOptionsNode as ODataQuery } from '@odata/parser';
import 'reflect-metadata';
import { Connection, DeepPartial, QueryRunner, Repository } from 'typeorm';
import { InjectKey } from '../constants';
import { ODataController } from '../controller';
import * as Edm from '../edm';
import { BadRequestError, MethodNotAllowedError, ResourceNotFoundError, ServerInternalError } from '../error';
import { Literal } from '../literal';
import { createLogger } from '../logger';
import * as odata from '../odata';
import { TransactionContext } from '../transaction';
import { DBHelper } from './db_helper';
import { getODataEntityNavigations, getODataServerType } from './decorators';
import { BaseODataModel, getClassName } from './entity';
import { findHooks, HookContext, HookEvents, HookType } from './hooks';
import { TypedODataServer } from './server';
import { applyValidate } from './validate';
import validate = require('validate.js');


const logger = createLogger('type:service');


/**
 * Typeorm Service (Controller)
 */
export class TypedService<T = any> extends ODataController {

  constructor() { super(); }

  /**
   * get main connection (without transaction)
   */
  protected async _getConnection(): Promise<Connection>;
  /**
   * get transactional connection
   *
   * @param ctx
   */
  protected async _getConnection(@inject(InjectKey.TransactionQueryRunner) qr?: QueryRunner): Promise<Connection> {
    return qr.manager.connection;
  }

  protected async _getEntityManager(@inject(InjectKey.TransactionQueryRunner) qr?: QueryRunner) {
    return qr.manager;
  }

  protected async _getRepository(entityType?: any): Promise<Repository<T>> {
    if (entityType instanceof Promise) {
      throw ServerInternalError('get repository for Promise object, please check server implementation.');
    }
    return (await this._getEntityManager()).getRepository(entityType ?? await this._getEntityType());
  }

  protected async _getService<E extends typeof BaseODataModel = any>(
    @odata.type entityType: E,
    @odata.injectContainer ic: InjectContainer,
    @inject(InjectKey.ServerType) serverType: typeof TypedODataServer
  ): Promise<TypedService<InstanceType<E>>> {
    ic.registerInstance(InjectKey.ODataTypeParameter, entityType, true);
    const service = await serverType.getService(entityType);
    return ic.wrap(service);
  };

  protected async _getEntityType(): any {
    return getUnProxyTarget(this.elementType);
  }

  protected async executeHooks(
    hookType: HookType,
    data?: any,
    key?: any,
    @inject(InjectContainer) ic?: InjectContainer,
    @inject(InjectKey.RequestTransaction) tx?: TransactionContext
  ) {
    const entityType = await this._getEntityType();

    ic = await ic.createSubContainer();

    const ctx: HookContext = {
      hookType,
      key,
      ic,
      txContext: tx,
      entityType
    };

    if (data != undefined) {
      if (isArray(data)) {
        ctx.listData = data;
      } else {
        ctx.data = data;
      }
    }

    ctx.ic.registerInstance(InjectKey.HookContext, ctx);

    if (ctx.hookType == undefined) {
      throw new ServerInternalError('Hook Type must be specify by controller');
    }

    ctx.getService = this._getService.bind(this);

    const isEvent = HookEvents.includes(ctx.hookType);

    if (isEvent) {
      delete ctx.txContext;
    }

    const serverType = getODataServerType(this.constructor);

    const hooks = findHooks(serverType, ctx.entityType, ctx.hookType);

    for (let idx = 0; idx < hooks.length; idx++) {
      const hook = ctx.ic.wrap(hooks[idx]);

      if (isEvent) {
        // is event, just trigger executor but not wait it finished
        // @ts-ignore
        hook.execute().catch(logger); // create transaction context here
      } else {
        // is hook, wait them executed
        // @ts-ignore
        await hook.execute();
      }

    }
  }

  /**
   * transform inbound payload
   *
   * please AVOID run this method for single body multi times
   */
  private async _transformInboundPayload(body: any) {
    const entityType = await this._getEntityType();
    forEach(body, (value: any, key: string) => {
      const type = Edm.getType(entityType, key);

      if (type) {
        if (type === 'Edm.Decimal') {
          body[key] = String(value);
        } else {
          body[key] = Literal.convert(type, value);
        }
      }
    });
  }

  /**
   * apply typeorm transformers, for read only
   *
   * (because the SQL query can not be processed in typeorm lifecycle)
   *
   * @private
   * @internal
   * @ignore
   *
   * @param body
   */
  private async _applyTransforms(body: any) {

    const entityType = await this._getEntityType();
    const conn = await this._getConnection();
    const driver = conn.driver;
    const meta = conn.getMetadata(entityType);
    const columns = meta.columns;

    function applyTransformForItem(item) {
      columns.forEach((colMeta) => {
        const { propertyName, type } = colMeta;
        let value = item[propertyName];
        if (value != undefined) {
          value = driver.prepareHydratedValue(value, colMeta);
          if (type == 'decimal' && typeof value == 'number') {
            // make all decimal value as string
            value = String(value);
          }
          item[propertyName] = value;
        }

      });
    }

    if (isArray(body)) {
      for (let idx = 0; idx < body.length; idx++) {
        const item = body[idx];
        applyTransformForItem(item);
      }
    }
    else {
      applyTransformForItem(body);
    }

  }

  @odata.GET
  async findOne(@odata.key key: any): Promise<T> {
    const entityType = await this._getEntityType();
    if (key != undefined && key != null) {
      // with key
      const repo = await this._getRepository();
      const data = await repo.findOne(key);
      if (isEmpty(data)) {
        throw new ResourceNotFoundError(`Resource not found: ${entityType?.name}[${key}]`);
      }
      await this.executeHooks(HookType.afterLoad, data);
      return data;
    }
    // without key, generally in navigation
    return {};
  }

  @noWrap
  private _columnNameMappingStore: Map<string, string>;

  private async createColumnMapper() {
    const entityType = await this._getEntityType();
    if (this._columnNameMappingStore == undefined) {
      this._columnNameMappingStore = new Map();
      const conn = await this._getConnection();
      const meta = conn.getMetadata(entityType);
      const columns = meta.columns;
      for (let idx = 0; idx < columns.length; idx++) {
        const column = columns[idx];
        this._columnNameMappingStore.set(column.propertyName, column.databaseName);
      }
    }
    return (propName: string) => this._columnNameMappingStore.get(propName);
  }

  async find(queryString: string): Promise<Array<T>>;
  async find(queryAst: ODataQuery): Promise<Array<T>>;
  async find(queryObject: ODataQueryParam): Promise<Array<T>>;
  async find(filter: ODataFilter): Promise<Array<T>>;
  async find(filterOrQueryStringOrQueryAst?: any): Promise<Array<T>>;
  @odata.GET
  async find(
    @odata.query query,
    @inject(InjectKey.DatabaseHelper) helper: DBHelper
  ) {

    const entityType = await this._getEntityType();
    const conn = await this._getConnection();
    const repo = await this._getRepository();

    let data = [];

    if (query) {

      if (typeof query == 'string') {
        query = defaultParser.query(query);
      }

      if (query instanceof ODataQueryParam) {
        query = defaultParser.query(query.toString());
      }

      if (query instanceof ODataFilter) {
        query = defaultParser.query(param().filter(query).toString());
      }

      // optimize here
      const meta = conn.getMetadata(entityType);
      const schema = meta.schema;
      const tableName = meta.tableName;

      const colNameMapper = await this.createColumnMapper();

      const { queryStatement, countStatement } = helper.buildSQL({
        tableName,
        schema,
        query,
        colNameMapper
      });

      // query all ids firstly
      data = await repo.query(queryStatement);

      // apply transform
      await this._applyTransforms(data);

      // get counts if necessary
      if (countStatement) {
        const countResult = await repo.query(countStatement);
        let [{ TOTAL }] = countResult; // default count column name is 'TOTAL'
        // for mysql, maybe other db driver also will response string
        if (typeof TOTAL == 'string') {
          TOTAL = parseInt(TOTAL);
        }
        data['inlinecount'] = TOTAL;
      }


    } else {

      data = await repo.find();

    }


    if (data.length > 0) {
      await this.executeHooks(HookType.afterLoad, data);
    }

    return data;

  }

  /**
   * deep insert
   *
   * @private
   * @ignore
   * @internal
   * @param parentBody
   * @param ctx
   *
   * @returns require the parent object re-save again
   */
  async _deepInsert(parentBody: any): Promise<T> {
    const entityType = await this._getEntityType();
    const repo = await this._getRepository(entityType);

    const instance = repo.create(parentBody);
    // creation (INSERT only)
    await repo.insert(instance);

    const navigations = getODataEntityNavigations(entityType.prototype);

    const [parentObjectKeyName] = Edm.getKeyProperties(entityType);

    const parentObjectKey = instance[parentObjectKeyName];

    for (const navigationName in navigations) {
      if (Object.prototype.hasOwnProperty.call(navigations, navigationName)) {
        if (Object.prototype.hasOwnProperty.call(parentBody, navigationName)) {

          // if navigation property have value
          const navigationData = parentBody[navigationName];
          const options = navigations[navigationName];
          const deepInsertElementType = options.entity();

          const parentObjectFKName = options.foreignKey;
          const navTargetFKName = options.targetForeignKey;

          if (isEmpty(parentObjectFKName) && isEmpty(navTargetFKName)) {
            throw new ServerInternalError(`fk is not defined on entity ${entityType.name} or ${deepInsertElementType.name}`);
          }
          const service = await this._getService(deepInsertElementType);
          const [navTargetKeyName] = Edm.getKeyProperties(deepInsertElementType);

          switch (options.type) {
            case 'OneToMany':
              if (isArray(navigationData)) {
                parentBody[navigationName] = await Promise.all(
                  navigationData.map((navigationItem) => {
                    navigationItem[navTargetFKName] = parentObjectKey;
                    return service.create(navigationItem);
                  })
                );
              } else {
                // for one-to-many relationship, must provide an array, even only have one record
                throw new ServerInternalError(`navigation property [${navigationName}] must be an array!`);
              }
              break;
            case 'ManyToOne':
              parentBody[navigationName] = await service.create(navigationData);
              await repo.update(parentObjectKey, { [parentObjectFKName]: parentBody[navigationName][navTargetKeyName] });
              break;
            default:

              if (navTargetFKName) {
                navigationData[navTargetFKName] = parentBody[parentObjectKeyName];
              }

              parentBody[navigationName] = await service.create(navigationData);

              if (parentObjectFKName) {
                // save the fk to parent table
                await repo.update(parentObjectKey, { [parentObjectFKName]: parentBody[navigationName][navTargetKeyName] });
              }

              break;
          }
        }

      }
    }

    return instance;

  }

  /**
   * deep merge
   * @param parentBody
   * @param entityType
   */
  async _deepMerge(parentBody: any): Promise<boolean> {
    const entityType = await this._getEntityType();
    const navigations = getODataEntityNavigations(entityType.prototype);
    for (const navigationName in navigations) {
      if (Object.prototype.hasOwnProperty.call(navigations, navigationName)) {
        if (Object.prototype.hasOwnProperty.call(parentBody, navigationName)) {
          throw new BadRequestError(`update navigation '${navigationName}' failed, deep merge is not supported.`);
        }
      }
    }
  }

  @odata.POST
  async create(@odata.body body: DeepPartial<T>): Promise<T> {
    await this._validate(body, odata.ODataMethodType.POST); // validate raw payload firstly
    await this._transformInboundPayload(body);

    await this.executeHooks(HookType.beforeCreate, body);

    // deep insert, re-save on-demand
    const instance = await this._deepInsert(body);

    await this.executeHooks(HookType.afterCreate, instance);

    return instance;
  }

  private async _validate(input: any, method: ODataMethod = ODataMethod.POST): Promise<void> {
    const entityType = await this._getEntityType();
    const entityName = getClassName(entityType);

    const msgs = applyValidate(entityType, input, method);

    const columns = Edm.getProperties(entityType);

    // ensure client provide all keys are defined in entity type
    for (const key of Object.keys(input)) {
      if (!columns.includes(key)) {
        msgs.push(`property/navigation '${key}' is not existed on EntityType(${entityName}), did you mean '${closest(key, columns)}'?`);
      }
    }

    if (msgs.length > 0) {
      throw new BadRequestError(`Entity '${entityName}': ${msgs.join(', ')}`);
    }

  }

  // create or overwrite
  @odata.PUT
  async save(@odata.key key, @odata.body body: DeepPartial<T>) {
    const repo = await this._getRepository();
    if (key) {
      const item = await repo.findOne(key);
      // if exist
      if (item) {
        return this.update(key, body);
      }
    }
    return this.create(body);
  }

  // odata patch will not response any content
  @odata.PATCH
  async update(@odata.key key: any, @odata.body body: DeepPartial<T>) {
    await this._validate(body, odata.ODataMethodType.PATCH);
    await this._transformInboundPayload(body);
    const repo = await this._getRepository();
    const instance = body;
    await this.executeHooks(HookType.beforeUpdate, instance, key);
    await repo.update(key, instance);
    await this.executeHooks(HookType.afterUpdate, instance, key);
  }

  // odata delete will not response any content
  @odata.DELETE
  async delete(@odata.key key: any) {
    const repo = await this._getRepository();
    await this.executeHooks(HookType.beforeDelete, undefined, key);
    await repo.delete(key);
    await this.executeHooks(HookType.afterDelete, undefined, key);
  }

}

/**
 * provide odata service instance by entity
 */
export class ODataServiceProvider {

  @transient
  @withType(InjectKey.InjectODataService)
  async provide(
    @noWrap @required @inject(InjectKey.ODataTypedService) entityType,
    @required @inject(InjectKey.ServerType) server: typeof TypedODataServer,
    @noWrap @required @inject(InjectKey.ODataTxContextParameter) tx: TransactionContext
  ) {
    if (entityType instanceof LazyRef) {
      entityType = entityType.getRef();
    }
    const [service] = await server.getServicesWithContext(tx, entityType);
    return service;
  }

}

/**
 * Typeorm Service for view
 */
export class TypedViewService<T = any> extends TypedService<T> {

  async delete(@odata.key key: any) {
    throw new MethodNotAllowedError();
  }

  async update(@odata.key key: any, @odata.body body: DeepPartial<T>) {
    throw new MethodNotAllowedError();
  }

  async create(@odata.body body: DeepPartial<T>): Promise<T> {
    throw new MethodNotAllowedError();
  }

  async findOne(@odata.key key: any) {
    const entityType = this._getEntityType();
    const keys = Edm.getKeyProperties(entityType) || [];
    if (keys.length > 0) {
      return super.findOne(key);
    }
    throw new MethodNotAllowedError(`RETRIEVE is not supported for view entity which key is not defined.`);
  }

}
