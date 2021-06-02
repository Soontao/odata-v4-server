import { identity } from '@newdash/newdash/.internal/identity';
import { QueryOptionsNode as ODataQuery, Token, TokenType, traverseAst, traverseAstDeepFirst, Traverser } from '@odata/parser';
import { DEFAULT_TOP_VALUE } from '../constants';
import { getKeyProperties } from '../edm';
import { NotImplementedError } from '../error';
import { EdmType } from '../literal';
import { ODATA_TYPE } from '../visitor';
import { getODataNavigation } from './decorators';

interface ValueMapper {
  (type: EdmType, raw: string): any
}

/**
 * transformFilterAst to where sql
 *
 * @param node
 */
export const transformFilterAst = (node: Token, nameMapper: FieldNameMapper = identity, valueMapper: ValueMapper): string => {

  // maybe the hidden 'sql' property will pollute the object,
  // but deep copy object will consume too much resource

  const traverser: Traverser = {
    EqualsExpression: (node) => {
      node['sql'] = `${nameMapper(node.value.left.raw)} = ${valueMapper(node.value.right.value, node.value.right.raw)}`;
    },
    NotEqualsExpression: (node) => {
      node['sql'] = `${nameMapper(node.value.left.raw)} != ${valueMapper(node.value.right.value, node.value.right.raw)}`;
    },
    GreaterOrEqualsExpression: (node) => {
      node['sql'] = `${nameMapper(node.value.left.raw)} >= ${valueMapper(node.value.right.value, node.value.right.raw)}`;
    },
    GreaterThanExpression: (node) => {
      node['sql'] = `${nameMapper(node.value.left.raw)} > ${valueMapper(node.value.right.value, node.value.right.raw)}`;
    },
    LesserOrEqualsExpression: (node) => {
      node['sql'] = `${nameMapper(node.value.left.raw)} <= ${valueMapper(node.value.right.value, node.value.right.raw)}`;
    },
    LesserThanExpression: (node) => {
      node['sql'] = `${nameMapper(node.value.left.raw)} < ${valueMapper(node.value.right.value, node.value.right.raw)}`;
    },
    OrExpression: (node) => {
      const { value: { left, right } } = node;
      node['sql'] = `${left['sql']} OR ${right['sql']}`;
    },
    AndExpression: (node) => {
      const { value: { left, right } } = node;
      node['sql'] = `${left['sql']} AND ${right['sql']}`;
    },
    BoolParenExpression: (node) => {
      const { value } = node;
      node['sql'] = `(${value['sql']})`;
    },
    Filter: (node) => {
      node['sql'] = node.value?.sql;
    }
  };

  traverseAstDeepFirst(traverser, node);

  return node['sql'];

};

/**
 * OData Field Mapping
 */
export interface FieldNameMapper {
  (field: string): string
}

export const transformQueryAst = (node: ODataQuery, nameMapper: FieldNameMapper = identity, valueMapper: ValueMapper) => {

  let offset = null;
  let limit = null;
  let where = '';
  let inlineCount = false;

  const orderBy = [];
  const selects = new Set();

  const navSelects = new Set();

  const traverser: Traverser = {
    Top: (node) => {
      limit = parseInt(node?.value?.raw);
    },
    Skip: (node) => {
      offset = parseInt(node?.value?.raw);
    },
    OrderByItem: (node) => {
      switch (node?.value?.direction) {
        case -1:
          orderBy.push(`${nameMapper(node.value?.expr?.raw)} DESC`); break;
        case 1:
          orderBy.push(`${nameMapper(node.value?.expr?.raw)} ASC`); break;
        default:
          break;
      }
    },
    SelectItem: (node) => {
      // only support simple property of entity
      // please raise error on deep path
      selects.add(nameMapper(node.raw));
    },
    InlineCount: (node) => {
      inlineCount = node.value?.raw == 'true';
    },
    Search: () => {
      // not support now
      throw new NotImplementedError('Not implement $search.');
    },
    Filter: (node) => {
      where = transformFilterAst(node, nameMapper, valueMapper);
    }
  };

  node.value?.['options']?.forEach((option: Token) => {
    // ignore $expand inner parameters
    if (option.type !== TokenType.Expand) {
      traverseAst(traverser, option);
    }
    else {
      // force add expand item required fk to selects
      if (ODATA_TYPE in node) {
        const rootType = node[ODATA_TYPE];
        for (const expandItem of option?.value?.items) {
          if (ODATA_TYPE in expandItem) {
            const expandItemPath = expandItem.value?.path?.raw;
            if (expandItemPath !== undefined) {
              const nav = getODataNavigation(rootType, expandItemPath);
              if (nav !== undefined) {
                switch (nav.type) {
                  // add current model's pk to allow the navigation could access the PK
                  case 'OneToMany':
                    navSelects.add(nameMapper(getKeyProperties(rootType)[0]));
                    break;
                  // add current models' fk to allow the navigation could access the FK
                  case 'ManyToOne':
                  case 'OneToOne':
                    if (nav.foreignKey !== undefined) {
                      navSelects.add(nameMapper(nav.foreignKey));
                    }
                    break;
                  default:
                    break;
                }
              }
            }
          }

        }

      }
    }
  });

  const parts = [];

  if (where && where.trim().length > 0) {
    parts.push(`WHERE ${where}`);
  }

  if (orderBy.length > 0) {
    parts.push(`ORDER BY ${orderBy.join(', ')}`);
  }

  if (limit !== null) {
    parts.push(`LIMIT ${limit}`);
  } else {
    parts.push(`LIMIT ${DEFAULT_TOP_VALUE}`);
  }

  if (offset != null) {
    parts.push(`OFFSET ${offset}`);
  } else {
    parts.push(`OFFSET 0`);
  }

  const sqlQuery = parts.length > 0 ? parts.join(' ') : '';

  // if use want to projection table
  if (selects.size > 0) {
    for (const navSelect of navSelects) {
      selects.add(navSelect);
    }
  }

  return { sqlQuery, selectedFields: Array.from(selects), count: inlineCount, where, offset, limit };

};

