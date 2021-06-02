import identity from '@newdash/newdash/.internal/identity';
import { defaultParser } from '@odata/parser';
import { FieldNameMapper, transformFilterAst, transformQueryAst } from '../../src';
import { DEFAULT_TOP_VALUE } from '../../src/constants';
import { createDBHelper } from '../../src/type/db_helper';


describe('DB Helper Test Suite', () => {
  it('should support converting data query to sql', () => {

    const helper = createDBHelper({ type: 'sqljs' });

    const ast = defaultParser.filter('(A eq 3) and (B eq 4 or B eq 5) and (C ge 3 and D lt 5)');
    const sql = transformFilterAst(ast, identity, helper.mapQueryValue);

    expect(sql).toEqual('(A = 3) AND (B = 4 OR B = 5) AND (C >= 3 AND D < 5)');

  });

  it('should support converting odata query to sql 2', () => {

    const helper = createDBHelper({ type: 'sqljs' });

    const ast = defaultParser.query('$format=json&$select=A,B,C&$top=10&$skip=30&$filter=A eq 1&$orderby=A desc,V asc');
    const { selectedFields, sqlQuery } = transformQueryAst(ast, undefined, helper.mapQueryValue);

    expect(sqlQuery.trim()).toEqual('WHERE A = 1 ORDER BY A DESC, V ASC LIMIT 10 OFFSET 30');
    expect(selectedFields).toEqual(['A', 'B', 'C']);

  });

  it('should visit $count', () => {
    const helper = createDBHelper({ type: 'sqljs' });

    const ast = defaultParser.query('$count=true');
    const { count } = transformQueryAst(ast, undefined, helper.mapQueryValue);
    expect(count).toBeTruthy();
  });

  it('should support converting odata query to sql with name mapper', () => {
    const helper = createDBHelper({ type: 'sqljs' });

    const ast = defaultParser.query('$format=json&$select=A,B,C&$top=10&$skip=30&$filter=A eq 1&$orderby=A desc,V asc');
    const nameMapper: FieldNameMapper = (fieldName) => `table.${fieldName}`;
    const { selectedFields, sqlQuery } = transformQueryAst(ast, nameMapper, helper.mapQueryValue);

    expect(sqlQuery.trim()).toEqual('WHERE table.A = 1 ORDER BY table.A DESC, table.V ASC LIMIT 10 OFFSET 30');
    expect(selectedFields).toEqual(['table.A', 'table.B', 'table.C']);

  });


  it('should support default top value', () => {
    const helper = createDBHelper({ type: 'sqljs' });

    const ast = defaultParser.query('$skip=10');
    const nameMapper: FieldNameMapper = (fieldName) => `table.${fieldName}`;
    const { sqlQuery } = transformQueryAst(ast, nameMapper, helper.mapQueryValue);

    expect(sqlQuery.trim()).toEqual(`LIMIT ${DEFAULT_TOP_VALUE} OFFSET 10`);

  });


  it('should support default offset value', () => {
    const helper = createDBHelper({ type: 'sqljs' });

    const ast = defaultParser.query('$select=a');
    const nameMapper: FieldNameMapper = (fieldName) => `table.${fieldName}`;
    const { sqlQuery } = transformQueryAst(ast, nameMapper, helper.mapQueryValue);

    expect(sqlQuery.trim()).toEqual(`LIMIT ${DEFAULT_TOP_VALUE} OFFSET 0`);

  });

  it('should support $expand($select)', () => {
    const helper = createDBHelper({ type: 'sqljs' });
    const ast = defaultParser.query('$expand=a($select=aName,aDescription)&$select=name,description');
    const nameMapper: FieldNameMapper = (fieldName) => `table.${fieldName}`;
    const { selectedFields } = transformQueryAst(ast, nameMapper, helper.mapQueryValue);
    expect(selectedFields).toEqual(['table.name', 'table.description']);

  });


});
