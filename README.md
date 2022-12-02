[![Node.js Package](https://github.com/herotangabc/es-batis/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/herotangabc/es-batis/actions/workflows/npm-publish.yml)[![Coverage Status](https://coveralls.io/repos/github/herotangabc/es-batis/badge.svg?branch=refs/tags/0.1.2)](https://coveralls.io/github/herotangabc/es-batis?branch=refs/tags/0.1.2)

---

**mybatis in nodejs,also support Single Table ORM**

---

# 使用例子（也可参考测试代码）sample

```typescript
import sqlTemplate, {
  AuroraEntity,
  DBColumn,
  initDaoContext,
  MySqlDaoContext,
} from 'es-batis'
//更详细的参数请看参数类型申明，现在只支持非连接池的方式（因为用于serverless）
//more info for parameter,please refer to the source,only support none connection pool
const dao = new MySqlDaoContext({
  charset: 'utf8',
  host: 'mysqlhost',
  user: 'user',
  password: 'password',
})
await dao.initialize()
dao = initDaoContext({ dao })

const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE mapper PUBLIC
  "-//mybatis.org//DTD Mapper 3.0//EN"
  "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
  <mapper
  namespace="esbatis.test">

  <select id="selectOne"   >
      SELECT
          t1.bank_name,
          t1.id
      FROM
          bank AS t1
      <where>
        <if test="id != null">
          and t1.id = #{id}
        </if>
      </where>
      ORDER BY
          t1.updated
  </select>
  </mapper>
  `

let sqlResults = await sql.selectOne('esbatis.test.selectOne', { id: 1 })
//example returns:
//sqlResults = {
//   bank_name: 'bank1',
//   id: 1,
// }
```

# es-batis ORM example

table:

```SQL
CREATE TABLE SYSTEM_MST(
	SYSTEM_ID VARCHAR(5) NOT NULL,
	SYSTEM_NAME VARCHAR(128) NOT NULL,
	UNIQUE KEY  SYSTEM_ID_UNIQUE(SYSTEM_ID ASC)
)


```

```typescript
import sqlTemplate, {
  AuroraEntity,
  DBColumn,
  initDaoContext,
  MySqlDaoContext,
} from 'es-batis'

//tsconfig.json:
//"experimentalDecorators": true,
//"emitDecoratorMetadata": true,
class SystemMst extends AuroraEntity {
  @DBColumn({ idType: 'uniqueIndex' })
  public systemId!: string | null
  public systemName: string | null = null
}
const dao = new MySqlDaoContext({
  charset: 'utf8',
  host: 'mysqlhost',
  user: 'user',
  password: 'password',
})
await dao.initialize()
//additional parameter for ORM supporting in dynamic SQL,see the next sample
dao = initDaoContext({ dao, types: { SystemMst } })

let systemMst = new SystemMst()
systemMst.systemId = '0001'
const deletecnt = await systemMst.delete()
//OR
//const deletecnt = await systemMst.delete('0001')
console.log(deletecnt)
let resultSystemMst = await systemMst.load('efg')
if (resultSystemMst) {
  console.log(resultSystemMst.systemName)
}
```

# es-batis Dynamic SQL and ORM

```typescript
import sqlTemplate, {
  AuroraEntity,
  DBColumn,
  initDaoContext,
  MySqlDaoContext,
} from 'es-batis'

class SystemMst extends AuroraEntity {
  @DBColumn({ idType: 'uniqueIndex' })
  public systemId!: string | null
  public systemName: string | null = null
}
const dao = new MySqlDaoContext({
  charset: 'utf8',
  host: 'mysqlhost',
  user: 'user',
  password: 'password',
})
await dao.initialize()
dao = initDaoContext({ dao, types: { SystemMst } })

//initialization at the same way as the previous sample
const sql = sqlTemplate`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC
    "-//mybatis.org//DTD Mapper 3.0//EN"
    "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper
    namespace="esbatis.test">

    <select id="nameLike"   resultType='SystemMst'>
        SELECT
            t1.system_id as systemId,
            t1.system_name as systemName
        FROM
            system_mst AS t1
        <where>
          <if test="name != null">
          <bind name="nameLike" value="escapeMYSQLLike(name)">
          <![CDATA[ and t1.system_name LIKE concat('%',#{nameLike},'%') ]]>
          </if>
        </where>
    </select>
</mapper>
    `
const systems = await sql.selectList('esbatis.test.nameLike', { name: '%_"\'' })
for (const system of systems) {
  system.systemName = '吼吼吼'
  await system.save()
}
```
