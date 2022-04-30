import sqlTemplate, { DaoContext, initDaoContext } from 'es-batis';
import type { CallbackFnType } from 'es-batis/daocontext';
import type { SqlBound } from 'es-batis/mapping'
//fix Encoding not recognized: 'cesu8' (searched as: 'cesu8') issue
//https://stackoverflow.com/questions/46227783/encoding-not-recognized-in-jest-js
//require('mysql2/node_modules/iconv-lite').encodingExists('foo');
import type { FieldPacket, QueryError } from 'mysql2';
let sqlResults: any = null;
let numberOfRecordsUpdated: number | undefined = undefined
let insertId: number | undefined = undefined
class MockDaoContext implements DaoContext {
  initialize(): Promise<void> {
    return Promise.resolve();
  }
  beginTransaction(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }
  executeStatement(sql: string, parameters: any, transactionId: string | undefined, callback: CallbackFnType): void {
    // executeStatement(sql: string, parameters: any, callback: (err: any, rows: any, _fields: any) => void) {
    callback(undefined, { records: sqlResults, numberOfRecordsUpdated, insertId }, undefined)
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


let sqlCreated: string | undefined;
let paramCreated: any


let connection = {
  execute: (sql: string, values: any, callback?: (
    err: QueryError | null,
    result: any,
    fields: FieldPacket[]
  ) => any) => {
    sqlCreated = sql
    paramCreated = values
    if (callback) {
      callback(null, sqlResults, [])
    }
  },
  destroy: () => {

  }
}

beforeAll(async () => {

  const daoContext = new MockDaoContext()
  initDaoContext({ dao: daoContext })
});

afterAll(async () => {
  connection.destroy()
})

test('1. selectList', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC
    "-//mybatis.org//DTD Mapper 3.0//EN"
    "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper
    namespace="wb3101">
    <!-- インシデントナレッジ件数取得 -->
    <select id="selectList"   resultType="String">
        SELECT
            t1.bank_name,
            t1.id
        FROM
            bank AS t1
        WHERE
            t1.id = #{matterSeqno}
        ORDER BY
            t1.updated
    </select>
</mapper>
    `
  sqlResults = [
    {
      bank_name: "bank1",
      id: 1,
    },
    {
      bank_name: "bank2",
      id: 1,
    }
  ]
  const result = await sql.selectList("wb3101.selectList", { matterSeqno: 1 })
  expect(result).not.toBeFalsy()
  expect(result.length).toBe(2)
}, 15000)

test('2. selectOne', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC
    "-//mybatis.org//DTD Mapper 3.0//EN"
    "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper
    namespace="wb3101">

    <select id="selectOne"   >
        SELECT
            t1.bank_name,
            t1.id
        FROM
            bank AS t1
        <where>
          <if test="matterSeqno != null">
            and t1.id = #{matterSeqno}
          </if>
        </where>
        ORDER BY
            t1.updated
    </select>
</mapper>
    `
  sqlResults = [
    {
      bank_name: "bank1",
      id: 1,
    },
    {
      bank_name: "bank2",
      id: 1,
    }
  ]
  let error = new Error(`Result returns more then one record:2`)
  await expect(async () => {
    await sql.selectOne("wb3101.selectOne", { matterSeqno: 1 })
  }).rejects.toThrowError(error)

}, 5000)

test('3. update', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC
    "-//mybatis.org//DTD Mapper 3.0//EN"
    "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper
    namespace="wb3101">

    <update id="update"  >
        update
            bank AS t1
        <set>
        <if test="name != null">
        name = #{name}
        </if>
        <if test="alias != null">
        alias = #{alias}
        </if>
        updated = CURRENT_TIMESTAMP(6)
        <set>
        <where>
          <if test="matterSeqno != null">
            and t1.id = #{matterSeqno}
          </if>
        </where>
        ORDER BY
            t1.updated
    </update>
</mapper>
    `
  numberOfRecordsUpdated = 2

  const result = await sql.update("wb3101.update", { matterSeqno: 1, alias: "bank1_alias" })
  expect(result).toBe(2)

}, 5000)

test('4. insert', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  // public useGeneratedKeys?: boolean;
  // public keyProperty?: string
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC
    "-//mybatis.org//DTD Mapper 3.0//EN"
    "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper
    namespace="wb3101">

    <insert id="insert" useGeneratedKeys='true'   resultType="string">
        insert into
            bank(name,alias,created,updated)
            values(
                'bank001',#{alias},CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)
            )

    </insert>
</mapper>
    `
  numberOfRecordsUpdated = 2
  insertId = 3

  const obj: any = { matterSeqno: 1, alias: "bank1_alias" };
  const result = await sql.insert("wb3101.insert", obj)
  expect(result).toBe(2)
  expect(obj.id).toBe(3)
}, 5000)

test('4. insert2', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  // public useGeneratedKeys?: boolean;
  // public keyProperty?: string
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC
    "-//mybatis.org//DTD Mapper 3.0//EN"
    "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper
    namespace="wb3101">

    <insert id="insert2" useGeneratedKeys='true' keyProperty='matterSeqno'  resultType="string">
        insert into
            bank(name,alias,created,updated)
            values(
                'bank001',#{alias},CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6)
            )

    </insert>
</mapper>
    `
  numberOfRecordsUpdated = 2
  insertId = 3

  const obj: any = { matterSeqno: 1, alias: "bank1_alias" };
  const result = await sql.insert("wb3101.insert2", obj)
  expect(result).toBe(2)
  expect(obj.matterSeqno).toBe(3)
}, 5000)

test('4. delete', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  // public useGeneratedKeys?: boolean;
  // public keyProperty?: string
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC
    "-//mybatis.org//DTD Mapper 3.0//EN"
    "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper
    namespace="wb3101">
    <delete id="delete" >
        delete from
            bank
    </delete>
</mapper>
    `
  numberOfRecordsUpdated = 2

  const obj: any = { matterSeqno: 1, alias: "bank1_alias" };
  const result = await sql.delete("wb3101.delete", obj)
  expect(result).toBe(2)
}, 5000)

test('5. duplicate mapping id test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  // public useGeneratedKeys?: boolean;
  // public keyProperty?: string
  const sql1 = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC
    "-//mybatis.org//DTD Mapper 3.0//EN"
    "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper
    namespace="wb3101">
    <delete id="delete12" >
        delete from
            bank
    </delete>
</mapper>
    `
  numberOfRecordsUpdated = 2

  const obj: any = { matterSeqno: 1, alias: "bank1_alias" };
  const result = await sql1.delete("wb3101.delete12", obj)
  expect(result).toBe(2)

  expect(() => {
    sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC
    "-//mybatis.org//DTD Mapper 3.0//EN"
    "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper
    namespace="wb3101">
    <delete id="delete12" >
        delete from
            bank
    </delete>
</mapper>
    `
  }).toThrowError()

}, 5000)

