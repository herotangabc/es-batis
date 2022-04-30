import sqlTemplate, { DaoContext, initDaoContext } from 'es-batis';
import { templateManager, SqlCommand } from 'es-batis/mapping'
import type { SqlBound } from 'es-batis/mapping'
//fix Encoding not recognized: 'cesu8' (searched as: 'cesu8') issue
//https://stackoverflow.com/questions/46227783/encoding-not-recognized-in-jest-js
// require('mysql2/node_modules/iconv-lite').encodingExists('foo');
import dotenv from 'dotenv'

import dayjs from 'dayjs'
import { FieldPacket, QueryError } from 'mysql2';
// import utc from 'dayjs/plugin/utc'
// import timezone from 'dayjs/plugin/timezone'

// import mysql  from 'mysql2'

// import type {Connection} from 'mysql2'

let result: any = null;

let sqlCreated: string | undefined;
let paramCreated: any

class MockDaoContext implements DaoContext {
  initialize(): Promise<void> {
    return Promise.resolve();
  }
  beginTransaction(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }
  executeStatement(sql: string, parameters: any, transactionid: string, callback: (err: any, rows: any, _fields: any) => void) {
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

test('1. invalid xml', async () => {
  expect(sqlTemplate).not.toBeUndefined()

  expect(() => {
    const sql1 = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE mapper PUBLIC
        "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
    <xxx
        namespace="wb3101">
    
        <update id="updateBank001"   resultType="string">
            update
                bank AS t1
            set 
                <if test="bank?.name != null">
                    t1.name = #{bank.name}
                </if>
            
        </update>
    </xxx>
        `

  }).toThrowError()
}, 5000)

test('2. one workspace 2 sql', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql1 = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC
    "-//mybatis.org//DTD Mapper 3.0//EN"
    "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper
    namespace="wb3101">

    <update id="updateBank001"   resultType="string">
        update
            bank AS t1
        set 
          <if test="bank?.name != null">
             t1.name = #{bank.name}
          </if>
        
    </update>
</mapper>
    `
  const sql2 = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE mapper PUBLIC
        "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
    <mapper
        namespace="wb3101">
    
        <update id="updateBank002"   resultType="string">
            update
                bank AS t1
            set 
              <if test="bank?.name != null">
                 t1.name = #{bank.name}
              </if>
            
        </update>
    </mapper>
        `
  expect(sql1.getSqlFactory('wb3101.updateBank001')).not.toBeFalsy()
  expect(sql2.getSqlFactory('wb3101.updateBank002')).not.toBeFalsy()

}, 5000)

test('3. update sql with if test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC
    "-//mybatis.org//DTD Mapper 3.0//EN"
    "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper
    namespace="wb3101">

    <update id="updateBank001"   resultType="string">
        update
            bank AS t1
        set 
          <if test="bank?.name != null">
             t1.name = #{bank.name}
          </if>
        
    </update>
</mapper>
    `
  const result = sql.getSqlFactory("wb3101.updateBank001") as SqlBound
  const sqlcommand = new SqlCommand()
  const obj = {
    bank: {
      name: '銀行１'
    }
  }
  result.appendSql(sqlcommand, obj)
  expect(sqlcommand).toMatchSnapshot()

}, 5000)

test('4. update sql with choose when test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper
    namespace="wb3101">

    <update id="updateBank001"   resultType="string">
        update
            bank AS t1
        set <choose>
          <when test="bank?. name != null">
             t1.name = #{bank.name}
          </when>
        </choose>
    </update>
</mapper>
    `
  const result = sql.getSqlFactory("wb3101.updateBank001") as SqlBound
  const sqlcommand = new SqlCommand()
  const obj = {
    bank: {
      name: '銀行１'
    }
  }
  result.appendSql(sqlcommand, obj)
  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('5. update sql with choose when other test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper
    namespace="wb3101">

    <update id="updateBank002"   resultType="string">
        update
            bank AS t1
        set <choose>
          <when test="bank?. name != null">
             t1.name = #{bank.name}
          </when>
          <otherwise>
             t1.name = null
          </otherwise>
        </choose>
    </update>
</mapper>
    `
  const result = sql.getSqlFactory("wb3101.updateBank002") as SqlBound
  const sqlcommand = new SqlCommand()
  const obj = {
    bank: {
      name: '銀行１'
    }
  }
  result.appendSql(sqlcommand, obj)
  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('6. update sql with choose when other test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper
    namespace="wb3101">

    <update id="updateBank002"   resultType="string">
        update
            bank AS t1
        set <choose>
          <when test="bank?. name == null">
             t1.name = #{bank.name}
          </when>
          <otherwise>
             t1.name = null
          </otherwise>
        </choose>
    </update>
</mapper>
    `
  const result = sql.getSqlFactory("wb3101.updateBank002") as SqlBound
  const sqlcommand = new SqlCommand()
  const obj = {
    bank: {
      name: '銀行１'
    }
  }
  result.appendSql(sqlcommand, obj)
  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('7. select sql with foreach test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper
    namespace="wb3101">
    <select id="selectBank001"   resultType="string">
        select * from
            bank AS t1
        <where>
        AND t1.name IN
        <foreach collection="names" item="item" open="(" close=")" separator=",">
            #{item.name}
        </foreach>
        </where>
    </select>
</mapper>
    `
  const result = sql.getSqlFactory("wb3101.selectBank001") as SqlBound
  const sqlcommand = new SqlCommand()
  const obj = {
    names: [{ name: '銀行１' }, { name: '銀行２' }]
  }
  result.appendSql(sqlcommand, obj)

  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('8. select sql with foreach nested test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper
    namespace="wb3101">
    <select id="selectBank001"   resultType="string">
        select * from
            bank AS t1
        <where>
        AND t1.name IN
        <foreach collection="names" item="item" open="(" close=")" separator=",">
          <foreach collection="item.banks" separator="," item="bankname">
          #{ bankname}
          </foreach>
        </foreach>
        </where>
    </select>
</mapper>
    `
  const result = sql.getSqlFactory("wb3101.selectBank001") as SqlBound
  const sqlcommand = new SqlCommand()
  const obj = { names: [{ banks: ['銀行１', '銀行２'] }, { banks: ['銀行３', '銀行４'] }] }

  result.appendSql(sqlcommand, obj)


  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('9. select sql with foreach nested partial empty test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper
    namespace="wb3101">
    <select id="selectBank001"   resultType="string">
        select * from
            bank AS t1
        <where>
        AND t1.name IN
        <foreach collection="names" item="item" open="(" close=")" separator=",">
          <foreach collection="item.banks" separator="," item="bankname">
          #{ bankname}
          </foreach>
        </foreach>
        </where>
    </select>
</mapper>
    `
  const result = sql.getSqlFactory("wb3101.selectBank001") as SqlBound
  const sqlcommand = new SqlCommand()
  const obj = { names: [{ banks: null }, { banks: ['銀行３', '銀行４'] }] }

  result.appendSql(sqlcommand, obj)

  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('10. select sql with foreach nested null test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper
    namespace="wb3101">
    <select id="selectBank001"   resultType="string">
        select * from
            bank AS t1
        <where>
        <if test="names != null">
        AND t1.name IN
        <foreach collection="names" item="item" open="(" close=")" separator=",">
          <foreach collection="item.banks" separator="," item="bankname">
          #{ bankname}
          </foreach>
        </foreach>
        </if>
        </where>
    </select>
</mapper>
    `
  const result = sql.getSqlFactory("wb3101.selectBank001") as SqlBound
  const sqlcommand = new SqlCommand()
  const obj = { names: null }

  result.appendSql(sqlcommand, obj)

  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('11. select sql with otherwise nested foreach test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper
    namespace="wb3101">
    <select id="selectBank011"   resultType="string">
        select * from
            bank AS t1
        <where>
        <if test="names != null">
        AND t1.name IN
        <foreach collection="names" item="item" open="(" close=")" separator=",">
          <foreach collection="item.banks" separator="," item="bankname">
          #{ bankname}
          </foreach>
        </foreach>
        </if>
        <choose>
        <when test="id == 3">
        AND id == 3
        </when>
        <when test="id == 2">
        AND id == 2
        </when>
        <otherwise>
        AND id IN
          <foreach collection="v" item="item" open="(" close=")" separator=",">
             \${ item }
          </foreach>
        </otherwise>
        </choose>
        </where>
    </select>
</mapper>
    `
  const result = sql.getSqlFactory("wb3101.selectBank011") as SqlBound
  const sqlcommand = new SqlCommand()
  const obj = { names: null, id: 1, v: [1, 2] }

  result.appendSql(sqlcommand, obj)

  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('12. select sql with choose error test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper
    namespace="wb3101">
    <select id="selectBank012"   resultType="string">
        select * from
            bank AS t1
        <where>
        <if test="names != null">
        AND t1.name IN
        <foreach collection="names" item="item" open="(" close=")" separator=",">
          <foreach collection="item.banks" separator="," item="bankname">
          #{ bankname}
          </foreach>
        </foreach>
        </if>
        <choose>
        <when test="id == 3">
        AND id == 3
        </when>
        <otherwise>
        AND id IN
          <foreach collection="v" item="item" open="(" close=")" separator=",">
             \${ item }
          </foreach>
        </otherwise>
        <when test="id == 2">
        AND id == 2
        </when>
        </choose>
        </where>
    </select>
</mapper>
    `
  let f = () => {
    return sql.getSqlFactory("wb3101.selectBank012") as SqlBound
  }
  expect(f).toThrowError()
}, 5000)

test('13. select sql with if test has _ $env variable test', async () => {
  process.env['test13'] = 'test13'
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper
    namespace="wb3101">
    <select id="selectBank013"   resultType="string">
        select * from
            bank AS t1
        <where>
        <if test="_ == 'a'">
        ANDname = #{_}
        </if>
        AND type = '\${ $env.test13 }'
        </where>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory("wb3101.selectBank013") as SqlBound
  const sqlcommand = new SqlCommand()
  const obj = 'a'
  factory.appendSql(sqlcommand, obj)

  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('14. select sql with if test and logic test', async () => {
  process.env['test13'] = 'test14'
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper
    namespace="wb3101">
    <select id="selectBank014"   resultType="string">
        select * from
            bank AS t1
        <where>
        <if test="_ !== 'c' && _ !== 'b'">
        AND name = #{_}
        </if>
        <if test="  $env.test13 == null || _ == 'a'">
        AND alias = #{_ }
        </if>
        </where>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory("wb3101.selectBank014") as SqlBound
  const sqlcommand = new SqlCommand()
  const obj = 'a'
  factory.appendSql(sqlcommand, obj)

  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('15. select sql with if under foreach tag with scoped variables test', async () => {
  process.env['test13'] = 'test14'
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper
    namespace="wb3101">
    <select id="selectBank015"   resultType="string">
        select * from
            bank AS t1
        <where>
        AND 
            <foreach collection="names" item='item'  separator="OR">
              <if test="item.name?.startsWith('a')">
              alias = #{item.alias}
              </if>
            </foreach>
        </where>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory("wb3101.selectBank015") as SqlBound
  const sqlcommand = new SqlCommand()
  const obj = {
    names: [
      { name: "aaa", alias: "a1" },
      { name: "baa", alias: "a2" },
      { alias: "c2" },
      { name: "abc", alias: "a3" },
    ]
  }
  factory.appendSql(sqlcommand, obj)

  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('16. select sql with if error test', async () => {
  process.env['test13'] = 'test14'
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper
    namespace="wb3101">
    <select id="selectBank016"   resultType="string">
        select * from
            bank AS t1
        <where>
        AND 
            <foreach collection="names" item='item'  separator="OR">
              <if test="(#$@)">
              alias = #{item.alias}
              </if>
            </foreach>
        </where>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory("wb3101.selectBank016") as SqlBound
  const sqlcommand = new SqlCommand()
  const obj = {
    names: [
      { name: "aaa", alias: "a1" },
      { name: "baa", alias: "a2" },
      { alias: "c2" },
      { name: "abc", alias: "a3" },
    ]
  }
  expect(() => { factory.appendSql(sqlcommand, obj) }).toThrowError()

}, 5000)

test('17. select sql with param not set test', async () => {
  process.env['test13'] = 'test14'
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper
    namespace="wb3101">
    <select id="selectBank017"   resultType="string">
        select * from
            bank AS t1
        <where>
        AND 
            <foreach collection="names" item='item'  separator="OR">
              alias = #{item.alias}
            </foreach>
        </where>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory("wb3101.selectBank017") as SqlBound
  const sqlcommand = new SqlCommand()
  expect(() => { factory.appendSql(sqlcommand) }).toThrowError()

}, 5000)

test('18. select sql without namespace', async () => {
  process.env['test13'] = 'test14'
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper>
    <select id="selectBank018"   resultType="string">
        select * from
            bank AS t1
        <where>
        AND 
            <foreach collection="names" item='item'  separator="OR">
              alias = #{item.alias}
            </foreach>
        </where>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory("selectBank018") as SqlBound
  const sqlcommand = new SqlCommand()
  const obj = {
    names: [
      { name: "aaa", alias: "a1" },
      { name: "baa", alias: "a2" },
      { alias: "c2" },
      { name: "abc", alias: "a3" },
    ]
  }
  factory.appendSql(sqlcommand, obj)

  expect(sqlcommand).toMatchSnapshot()

}, 5000)

test('19. invalid sql id', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper>
    <select id="selectBank019"   resultType="string">
        select * from
            bank AS t1
        <where>
        AND 
            <foreach collection="names" item='item'  separator="OR">
              alias = #{item.alias}
            </foreach>
        </where>
    </select>
</mapper>
    `
  expect(() => { sql.getSqlFactory("..selectBank019") as SqlBound }).toThrowError()
}, 5000)

test('20. namespace not found', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper>
    <select id="selectBank019"   resultType="string">
        select * from
            bank AS t1
        <where>
        AND 
            <foreach collection="names" item='item'  separator="OR">
            <![CDATA[ alias = #{item.alias} ]]>
            </foreach>
        </where>
    </select>
</mapper>
    `
  expect(() => { sql.getSqlFactory("x.selectBank019") as SqlBound }).toThrowError()
}, 5000)

test('21. foreach _ collection test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper>
    <select id="selectBank021"   resultType="string">
        select * from
            bank AS t1
        <where>
        AND 
            <foreach collection="_" item='item'  separator="OR">
            <![CDATA[ alias > #{item.alias} ]]>
            </foreach>
        </where>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory("selectBank021") as SqlBound
  const sqlcommand = new SqlCommand()
  const obj = [
    { name: "aaa", alias: "a1" },
    { name: "baa", alias: "a2" },
    { alias: "c2" },
    { name: "abc", alias: "a3" },
  ]
  factory.appendSql(sqlcommand, obj)
  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('22. empty where test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper>
    <select id="selectBank022"   resultType="string">
        select * from
            bank AS t1
        <where>
        AND 
            <foreach collection="_" item='item'  separator="OR">
            <![CDATA[ alias > #{item.alias} ]]>
            </foreach>
        </where>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory("selectBank022") as SqlBound
  const sqlcommand = new SqlCommand()
  factory.appendSql(sqlcommand, null)
  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('23. bind for escape of exclamation mark test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper>
    <select id="selectBank023"   resultType="string">
        select * from
            bank AS t1
        <where>
        AND 
            <foreach collection="_" item='item'  separator="OR">
            <!-- 使用内置的escapeMYSQLLike函数，对Like语句进行转义处理  -->
            <bind name="aliasLike" value="escapeMYSQLLike(item?.alias)">
            <![CDATA[ alias like concat('%',#{aliasLike},'%') ]]>
            </foreach>
            <if test="aliasLike != null">
            AND ERROR!!!!!
            </if>
        </where>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory("selectBank023") as SqlBound
  const sqlcommand = new SqlCommand()
  factory.appendSql(sqlcommand, [{ alias: "\\' %AND 1 != _2" }, { alias: "\\g AND '" }])
  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('24. bind for escape of exclamation mark test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper>
    <select id="selectBank024"   resultType="string">
        select * from
            bank AS t1
        <where>
            <!-- 不要用这种方法，请用concat传绑定参数的方式  -->
            <bind name="aliasLike" value="alias?.replace(/!/g,'!!').replace(/\\\\/g,'\\\\\\\\').replace(/'/g,'\\\\\\'')"/>
            <bind name="nameLike" value="name?.replace(/!/g,'!!').replace(/\\\\/g,'\\\\\\\\').replace(/'/g,'\\\\\\'')"/>
            <if test="aliasLike != null">
            AND alias LIKE '\${aliasLike}' escape '!'
            </if>
            <bind name='accountMoney' value = "(balance??0) + 1 "/>
            <if test="nameLike != null">
            AND name LIKE '\${aliasLike}' escape '!'
            </if>
            <if test="accountMoney > 0">
            AND balance = #{accountMoney}
            </if>
        </where>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory("selectBank024") as SqlBound
  const sqlcommand = new SqlCommand()
  factory.appendSql(sqlcommand, { alias: "\\' AND 1 != 2", name: "'\\!", balance: 0 })
  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('25. date type in parameter test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper>
    <select id="selectBank025"   resultType="string">
    <!-- date type in parameter test  -->
        select * from
        <![CDATA[
            bank AS t1 ]]>
        <where>
        <![CDATA[ and created > #{created} ]]>
        </where>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory("selectBank025") as SqlBound
  const sqlcommand = new SqlCommand()
  const date = new Date(1635310846448);
  factory.appendSql(sqlcommand, { created: date })
  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('26. dayjs type in parameter test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper>
    <select id="selectBank026"   resultType="string">
    <!-- date type in parameter test  -->
        select * from
        <![CDATA[
            bank AS t1 ]]>
        <where>
        <![CDATA[ and created > #{created} ]]>
        </where>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory("selectBank026") as SqlBound
  const sqlcommand = new SqlCommand()
  const dayjsObj = dayjs(new Date(1635310846448));
  factory.appendSql(sqlcommand, { created: dayjsObj })
  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('27. other unsuported type in parameter test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper>
    <select id="selectBank027"   resultType="string">
    <!-- date type in parameter test  -->
        select * from
        <![CDATA[
            bank AS t1 ]]>
        <where>
        <![CDATA[ and created > #{created} ]]>
        </where>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory("selectBank027") as SqlBound
  const sqlcommand = new SqlCommand()
  const unsuportedObj = {}
  expect(() => {

    factory.appendSql(sqlcommand, { created: unsuportedObj })
  }).toThrowError()

}, 5000)

test('28. empty trim tag test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper>
    <select id="selectBank028"   resultType="string">
    select * from
    <![CDATA[
        bank AS t1 ]]>
        <where>
        <!-- trim  -->
        <trim prefix="(" suffix=")" prefixOverrides="AND|OR" suffixOverrides=",">
        <if test="name != null">
        OR NAME = #{name}
        </if>
        <if test="alias != null">
        OR ALIAS = #{ALIAS} ,
        </if>
        </trim>
        </where>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory("selectBank028") as SqlBound
  const sqlcommand = new SqlCommand()

  factory.appendSql(sqlcommand, {})
  expect(sqlcommand).toMatchSnapshot()

}, 5000)

test('29. trim tag test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper>
    <select id="selectBank029"   resultType="string">
    select * from
    <![CDATA[
        bank AS t1 ]]>
        <where>
        <!-- trim  -->
        <trim prefix="(" suffix=")" prefixOverrides="AND|OR" suffixOverrides=",">
        <if test="name != null">
        OR NAME = #{name}
        </if>
        <if test="alias != null">
        OR ALIAS = #{alias} ,
        </if>
        </trim>
        </where>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory("selectBank029") as SqlBound
  const sqlcommand = new SqlCommand()

  factory.appendSql(sqlcommand, { alias: 'bank001' })
  expect(sqlcommand).toMatchSnapshot()

}, 5000)

test('30. SQL Buffer parameter test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper>
    <select id="selectBank030"   resultType="string">
    select * from
    <![CDATA[
        bank AS t1 ]]>
        <where>
          id =#{id}
        </where>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory("selectBank030") as SqlBound
  const sqlcommand = new SqlCommand()

  const buf = Buffer.alloc(1, '\u0001')
  factory.appendSql(sqlcommand, { id: buf })
  expect(sqlcommand).toMatchSnapshot()

}, 5000)

test('31. Inline SQL Buffer test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper>
    <select id="selectBank030"   resultType="string">
    select * from
    <![CDATA[
        bank AS t1 ]]>
        <where>
          id =\${id}
        </where>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory("selectBank030") as SqlBound
  const sqlcommand = new SqlCommand()

  const buf = Buffer.alloc(64, '\u0001'.repeat(64))
  factory.appendSql(sqlcommand, { id: buf })
  expect(sqlcommand).toMatchSnapshot()

}, 5000)

test('32. Inline SQL Buffer length > 64 test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper>
    <select id="selectBank030"   resultType="string">
    select * from
    <![CDATA[
        bank AS t1 ]]>
        <where>
          id =\${id}
        </where>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory("selectBank030") as SqlBound
  const sqlcommand = new SqlCommand()

  const buf = Buffer.alloc(65, '\u0001'.repeat(65))

  expect(() => {
    factory.appendSql(sqlcommand, { id: buf })
  }).toThrowError(new Error('[line:7] - farmular:[id]:inline SQL for type Buffer is supported,but the Buffer length is toooo long,should less than 64,but got 65.consider binding parameter instead'))
}, 5000)

test('33. include sql test', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper>
    <sql id="sql1">
      <where>
         id =#{id} limit \${limit1}
      </where>
    </sql>
    <select id="selectBank031"   resultType="string">
    select * from
    <![CDATA[
        bank AS t1 ]]>
        <include refid='sql1'>
        <property name="limit1" value="\${limit}"/>
        </include>
    </select>
</mapper>
    `
  let factory = sql.getSqlFactory('selectBank031') as SqlBound
  const sqlcommand = new SqlCommand()

  factory.appendSql(sqlcommand, { id: 22, limit: 10 })
  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('34. include sql test2', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="wb3101">
<select id="selectBank032"   resultType="string">
select * from
<![CDATA[
  bank AS t1 ]]>
  <include refid='sql1'>
  <property name="limit1" value="\${limit}"/>
  </include>
  </select>
  <sql id="sql1">
    <where>
       id =#{id} limit \${limit1}
    </where>
  </sql>
</mapper>
    `
  let factory = sql.getSqlFactory('wb3101.selectBank032') as SqlBound
  const sqlcommand = new SqlCommand()

  factory.appendSql(sqlcommand, { id: 22, limit: 10 })
  expect(sqlcommand).toMatchSnapshot()
}, 5000)

test('35. include sql test3', async () => {
  expect(sqlTemplate).not.toBeUndefined()
  const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="wb3101">
<select id="selectBank033"   resultType="string">
select * from
<![CDATA[
  bank AS t1 ]]>
  <include refid='wb3100.sql1'>
  <property name="limit1" value="\${limit}"/>
  <property name="column" value="id"/>
  </include>
  </select>
</mapper>
    `
  const sqlInclude = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<mapper namespace="wb3100">
  <sql id="sql1">
    <where>
       \${column} =#{id} limit \${limit1}
    </where>
  </sql>
</mapper>
    `
  let factory = sql.getSqlFactory('wb3101.selectBank033') as SqlBound
  const sqlcommand = new SqlCommand()

  factory.appendSql(sqlcommand, { id: 22, limit: 10 })
  expect(sqlcommand).toMatchSnapshot()
}, 5000)

