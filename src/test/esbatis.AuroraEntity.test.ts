import sqlTemplate, { DaoContext, initDaoContext, AuroraEntity, DBColumn } from 'es-batis';
import { templateManager, SqlCommand } from 'es-batis/mapping'
import { camelcase2Underline } from 'es-batis/utils'
import type { SqlBound } from 'es-batis/mapping'
//fix Encoding not recognized: 'cesu8' (searched as: 'cesu8') issue
//https://stackoverflow.com/questions/46227783/encoding-not-recognized-in-jest-js
// require('mysql2/node_modules/iconv-lite').encodingExists('foo');
import dotenv from 'dotenv'

import dayjs from 'dayjs'
import { FieldPacket, QueryError } from 'mysql2';
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
dayjs.extend(timezone)
dayjs.extend(utc)
// import mysql  from 'mysql2'

// import type {Connection} from 'mysql2'

let result: { records?: Record<string, any>, numberOfRecordsUpdated?: number } | null = null;
let _sql: string | null = null
let _parameters: any = null;

class SystemMst extends AuroraEntity {
  @DBColumn({ idType: 'uniqueIndex' })
  public systemId!: string | null
  @DBColumn({ idType: 'uniqueIndex' })
  public systemName: string | null = null
}

class CodeMst extends AuroraEntity {
  @DBColumn({ idType: 'uniqueIndex' })
  public code!: string | null
  @DBColumn({ idType: 'uniqueIndex' })
  public name: string | null = null
  public order: number | null = null
}

class MockDaoContext implements DaoContext {
  initialize(): Promise<void> {
    return Promise.resolve();
  }
  beginTransaction(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }
  executeStatement(sql: string, parameters: any, transactionid: string, callback: (err: any, rows: any, _fields: any) => void) {
    _sql = sql
    _parameters = parameters
    callback(undefined, result, [])
  }
  release(): Promise<void> {
    return Promise.resolve();
  }
  commit(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }
  rollback(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }
}

beforeAll(async () => {
  dotenv.config()
  dayjs.tz.setDefault('Etc/UCT')
  // const diff = dayjs.tz('2022-01-01', "UTC").diff(dayjs.tz('2022-01-01', dayjs.tz.guess()))
  // const currentTZ = dayjs.tz.guess()
  // connection = mysql.createConnection({
  //     host: process.env.DB_HOST,
  //     user: process.env.DB_USER,
  //     database: process.env.DB_NAME,
  //     password: process.env.DB_PASSWORD,
  //     charset:'utf8'
  // })
  const dao = new MockDaoContext()
  initDaoContext({ dao })
});

beforeEach(async () => {
  templateManager.clear()
})

afterAll(async () => {
  execute: (sql: string, values: any, callback?: (
    err: QueryError | null,
    result: any,
    fields: FieldPacket[]
  ) => any) => {

  }


  // connection.destroy()
})

test('1. entity composed id test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const systemMst: SystemMst = new SystemMst()
  systemMst.systemId = '123'
  systemMst.systemName = '456'
  result = { records: [] }
  await systemMst.load();
  expect(_sql).toMatchSnapshot()
  expect(_parameters).toMatchSnapshot()
}, 5000)

test('2. entity composed id test with one record', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const systemMst: SystemMst = new SystemMst()
  systemMst.systemId = '123'
  systemMst.systemName = '456'
  result = {
    records: [{
      systemId: '123',
      systemName: '456',
      updateDate: '2022-12-07 12:00:00.235'
    }]
  }
  await systemMst.load();
  expect(_sql).toMatchSnapshot()
  expect(_parameters).toMatchSnapshot()
}, 5000)

test('3. entity load with more than one record throws error', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const systemMst: SystemMst = new SystemMst()
  systemMst.systemId = '123'
  systemMst.systemName = '456'
  result = {
    records: [{
      systemId: '123',
      systemName: '456',
      updateDate: '2022-12-07 12:00:00.235'
    }, {
      systemId: '234',
      systemName: '657',
      updateDate: '2022-12-08 12:00:00.235'
    }]
  }
  let f = async () => {
    await systemMst.load(undefined, ['systemId'], true);
  }
  expect(f).rejects.toThrowError()
}, 5000)

test('4. entity save test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const systemMst: SystemMst = new SystemMst()
  systemMst.systemId = '123'
  systemMst.systemName = '456'
  result = {
    numberOfRecordsUpdated: 1
  }
  await systemMst.save()
  expect(_sql).toMatchSnapshot()
  expect(_parameters).toMatchSnapshot()
}, 5000)

test('5. entity save test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const codeMst: CodeMst = new CodeMst()
  codeMst.code = '123'
  codeMst.name = '456'
  result = {
    numberOfRecordsUpdated: 1
  }
  await codeMst.save()
  expect(_sql).toMatchSnapshot()
  expect(_parameters).toMatchSnapshot()
}, 5000)