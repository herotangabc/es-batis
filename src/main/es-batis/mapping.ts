import dayjs, { isDayjs } from 'dayjs'
import get from 'get-value'
import { underline2Camelcase2 } from './utils'
import { DaoContext } from './daocontext'
import { AuroraEntity } from './orm-base/AuroraEntity'
// import { formatResults } from './rds-result-format'
type formatResults = () =>
  {
    columnMetadata?: any,
    numberOfRecordsUpdated?: number,
    records?: any[],
    updateResults?: any[],
    insertId?: number
  }



import type { ExtentionDataType, ReturnTypeOfAppendSql, TestFunction } from './utils'
import { buildParameters, buildTestFunction, parseDocFromString, trimHeadOrTail } from './utils'

// import { format } from 'mysql2';

enum SqlType {
  select,
  update,
  insert,
  delete,
}

// if(process.env.OPT_ENV == 'local'){
//     //local only
//     // eslint-disable-next-line @typescript-eslint/no-var-requires
//     const {utc,timezone} = require('dayjs/plugin');
//     dayjs.extend(utc);
//     dayjs.extend(timezone);
//     (dayjs as any).tz.setDefault(process.env.TZ);
// }

export class SqlCommand {
  public sqlType?: SqlType
  public sql?: string
  public parameters: Record<string, any>
  public currentParameterSeq: number

  constructor(sqlType?: SqlType | undefined, parameterSeq: number = 0) {
    this.sql = ''
    this.parameters = {}
    this.sqlType = sqlType
    this.currentParameterSeq = parameterSeq
  }
  /**
   * 设置参数值，返回参数名
   * @param value 参数值
   */
  public addParameter(value: unknown): string {
    const parameterName = `p${this.currentParameterSeq++}`
    this.parameters[parameterName] = value ?? null
    return parameterName
  }
}

export class SqlBound {
  public id: string | undefined | null
  public sqlType?: SqlType
  lineNumber?: number
  public childrenTags: SqlBound[]
  public useGeneratedKeys?: boolean
  public keyProperty?: string
  public resultType?: string

  constructor(id: string | undefined | null, sqlType: SqlType | undefined, lineNumber?: number) {
    this.id = id
    this.sqlType = sqlType
    this.childrenTags = []
    this.lineNumber = lineNumber
  }
  public add(noArr: SqlBound): void {
    this.childrenTags.push(noArr)
  }
  public appendSql(sqlcommand: SqlCommand, data?: any, extentionData?: ExtentionDataType): ReturnTypeOfAppendSql {
    let appended = false
    for (const childtag of this.childrenTags) {
      let appendedRtn: boolean
        ;[appendedRtn, extentionData] = childtag.appendSql(sqlcommand, data, extentionData)
      if (appendedRtn) {
        appended = true
        if (!sqlcommand.sql?.endsWith('\n')) {
          sqlcommand.sql += '\n'
        }
      }
    }

    return [appended, extentionData]
  }
}

class SqlBoundString extends SqlBound {
  #text
  constructor(text: string, lineNumber: number) {
    super(undefined, undefined, lineNumber)
    this.#text = text.trim()
  }
  private processexpression(sqlcommand: SqlCommand, data: any, extentionData?: ExtentionDataType) {
    const regex = /(#|\$){([\t\sa-z.A-Z0-9_$]+)}/gi
    const wordRegex = /^[$\w]+\b/
    const sql = this.#text.replace(regex, (str) => {
      const valueFormular = str.substring(2, str.length - 1).trim()
      let paramValue: any = null
      try {
        const varNameArr = wordRegex.exec(valueFormular)
        //最近的scope优先
        if (varNameArr) {
          //解析出表达式中第一个变量
          const varName = varNameArr[0]
          if (varName == '_') {
            paramValue = get({ _: data }, valueFormular, { default: null })
          } else if (varName == '$env') {
            paramValue = get({ $env: process.env }, valueFormular, {
              default: null,
            })
          } else if (extentionData?.payload && varName in extentionData?.payload) {
            paramValue = get(extentionData?.payload, valueFormular, {
              default: null,
            })
          } else {
            paramValue = get(data, valueFormular, { default: null })
          }
        } else {
          throw new Error(`[line:${this.lineNumber}] - injected expression is invalid:${valueFormular}`)
        }
      } catch (err) {
        throw new Error(
          `[line:${this.lineNumber}] - error get value from farmular:[${valueFormular}]:${(err as any).message}`
        )
      }
      if (
        paramValue == null ||
        typeof paramValue === 'number' ||
        typeof paramValue === 'boolean' ||
        typeof paramValue === 'string' ||
        paramValue instanceof Buffer
      ) {
      } else if (paramValue instanceof Date) {
        paramValue = dayjs(paramValue).format('YYYY-MM-DD HH:mm:ss.SSS')
      } else if (isDayjs(paramValue)) {
        paramValue = paramValue.format('YYYY-MM-DD HH:mm:ss.SSS')
      } else {
        throw new Error(
          `[line:${this.lineNumber
          }] - unsupported farmular:[${valueFormular}] result[type:${typeof paramValue}] : ${paramValue}`
        )
      }
      if (str.startsWith('#')) {
        const paramName = sqlcommand.addParameter(paramValue)
        return `:${paramName} /* ${valueFormular} */ `
      } else {
        if (paramValue instanceof Buffer) {
          if (paramValue.byteLength > 64) {
            throw new Error(
              `[line:${this.lineNumber}] - farmular:[${valueFormular}]:inline SQL for type Buffer is supported,but the Buffer length is toooo long,should less than 64,but got ${paramValue.byteLength}.consider binding parameter instead`
            )
          } else {
            return `X'${paramValue.toString('hex')}'`
          }
        } else {
          return paramValue ?? 'NULL'
        }
      }
    })
    return sql
  }

  public appendSql(sqlcommand: SqlCommand, data?: any, extentionData?: ExtentionDataType): ReturnTypeOfAppendSql {
    const sql = this.processexpression(sqlcommand, data, extentionData)
    sqlcommand.sql += sql
    if (!sql.endsWith('\n')) {
      sqlcommand.sql += '\n'
    }
    return [true, extentionData]
  }
}
class SqlBoundTrim extends SqlBound {
  #param: SqlBoundTrimParams

  constructor(...param: SqlBoundTrimParams) {
    super(undefined, undefined, param[4])
    this.#param = param
  }
  public appendSql(sqlcommand: SqlCommand, data?: any, extentionData?: ExtentionDataType): ReturnTypeOfAppendSql {
    const [prefix, suffix, prefixOverrides, suffixOverrides] = this.#param
    const trimsqlCommand = new SqlCommand(undefined, sqlcommand.currentParameterSeq)
    let appendedRtn: boolean
      ;[appendedRtn, extentionData] = super.appendSql(trimsqlCommand, data, extentionData)
    if (appendedRtn) {
      //trim the tail if exists
      trimsqlCommand.sql = trimHeadOrTail(trimsqlCommand.sql, suffixOverrides, 2)
      trimsqlCommand.sql = trimHeadOrTail(trimsqlCommand.sql, prefixOverrides, 1)
      if (trimsqlCommand.sql?.trim().length) {
        sqlcommand.sql += ` ${prefix ?? ''}
${trimsqlCommand.sql}${suffix ?? ''}`
        Object.entries(trimsqlCommand.parameters).forEach(([_k, v]: [string, any]) => sqlcommand.addParameter(v))
      } else {
        appendedRtn = false
        delete trimsqlCommand.sql
      }
    }
    return [appendedRtn, extentionData]
  }
}

class SqlBoundWhere extends SqlBoundTrim {
  constructor(lineNumber: number) {
    super('WHERE', null, ['AND', 'OR'], null, lineNumber)
  }
}

class SqlBoundSet extends SqlBoundTrim {
  constructor(lineNumber: number) {
    super('SET', null, null, [','], lineNumber)
  }
}

type SqlBoundTrimParams = [
  prefix: string | null,
  suffix: string | null,
  prefixOverrides: string[] | null,
  suffixOverrides: string[] | null,
  lineNumber: number
]

class SqlBoundChoose extends SqlBound {
  public noOtherwise: SqlBoundOtherwise | undefined

  constructor(lineNumber: number) {
    super(undefined, undefined, lineNumber)
  }

  public appendSql(sqlcommand: SqlCommand, data?: any, extentionData?: ExtentionDataType): ReturnTypeOfAppendSql {
    let appended = false

    for (const tag of this.childrenTags) {
      const res = tag.appendSql(sqlcommand, data, extentionData)
      appended = res[0] || appended
      extentionData = res[1]
      if (appended) {
        break
      }
    }

    return [appended, extentionData]
  }
}

class SqlBoundWhen extends SqlBound {
  #testFunc?: TestFunction
  #testFuncParams?: string[]
  #testExpression?: string

  constructor(expressionTest: string, lineNumber: number) {
    super(undefined, undefined, lineNumber)
    this.#testExpression = expressionTest
  }
  public appendSql(sqlcommand: SqlCommand, data?: any, extentionData?: ExtentionDataType): ReturnTypeOfAppendSql {
    if (!this.#testFunc) {
      ;[this.#testFunc, this.#testFuncParams] = buildTestFunction(this.#testExpression as string)
    }
    try {
      let result
      const paramArray: any[] = buildParameters(this.#testFuncParams ?? [], data, extentionData)
      result = this.#testFunc.call(undefined, ...paramArray)
      if (result) {
        const [appendedRtn] = super.appendSql(sqlcommand, data, extentionData)
        if (appendedRtn) {
          result = true
          if (!sqlcommand.sql?.endsWith('\n')) {
            sqlcommand.sql += '\n'
          }
        }
      }
      return [result ? true : false, extentionData]
    } catch (err) {
      throw new Error(
        `[line:${this.lineNumber}] - test Expression[${this.#testExpression}] evaluation error:${(err as any).message}`
      )
    }
  }
}

type SqlBoundForEachParams = [
  item: any,
  index: string,
  separator: string,
  opening: string,
  closure: string,
  collectionName: string,
  lineNumber: number
]

class SqlBoundForEach extends SqlBound {
  #param: SqlBoundForEachParams
  constructor(...param: SqlBoundForEachParams) {
    super(undefined, undefined, param[6])
    this.#param = param
  }

  /**
   * 检查item，index变量名是否和前面的冲突
   * @param itemVarName
   * @param indexVarName
   * @param data
   * @param extentionData
   */
  private checkViolete(itemVarName: string, indexVarName: string, data: any, extentionData?: ExtentionDataType): void {
    if (data) {
      if (itemVarName in data) {
        throw new Error(
          `[line:${this.lineNumber}] item variable name:${itemVarName} is already exists in the scope of params.`
        )
      }
      if (indexVarName && indexVarName in data) {
        throw new Error(
          `[line:${this.lineNumber}] index variable name:${itemVarName} is already exists in the scope of params.`
        )
      }
    }
    if (extentionData?.payload) {
      if (itemVarName in extentionData.payload) {
        throw new Error(
          `[line:${this.lineNumber}] item variable name:${itemVarName} is already exists in the scope of up level.`
        )
      }
      if (indexVarName && indexVarName in extentionData.payload) {
        throw new Error(
          `[line:${this.lineNumber}] index variable name:${itemVarName} is already exists in the scope of up level.`
        )
      }
    }
  }

  public appendSql(sqlcommand: SqlCommand, data?: any, extentionData?: ExtentionDataType): ReturnTypeOfAppendSql {
    let collection: any = null
    if (typeof data === 'undefined' && typeof extentionData === 'undefined') {
      throw new Error(`[line:${this.lineNumber}] can't get foreach collection since parameter is not set.`)
    }
    const [itemVarName, indexVarName, separator, opening, closure, collectionName] = this.#param
    if (collectionName == '_') {
      collection = data
    } else {
      //最近的scope优先
      if (extentionData?.payload) {
        collection = get(extentionData.payload, collectionName, {
          default: null,
        })
      }
      if (collection == null) {
        collection = get(data, collectionName, { default: null })
      }
    }
    let appended = false
    if (collection == null) {
      console.warn(`[line:${this.lineNumber}] - collection is null,skip foreach tag`)
      return [appended, extentionData]
    }
    const sqlcommandForEach = new SqlCommand(undefined, sqlcommand.currentParameterSeq)
    if (process.env.OPT_ENV == 'local') this.checkViolete(itemVarName, indexVarName, data, extentionData)
    let extentionDataNew: ExtentionDataType
    if (extentionData?.payload) {
      extentionDataNew = { payload: { ...extentionData.payload } } //lazy clone
    } else {
      //当外层没有foreach
      extentionDataNew = {
        payload: {},
      }
    }
    for (const itemKey in collection) {
      // const expression = this.text;
      extentionDataNew.payload[itemVarName] = collection[itemKey]
      extentionDataNew.payload[indexVarName] = itemKey
      const extentionDataFreeze = Object.freeze(extentionDataNew)
      for (const childTag of this.childrenTags) {
        const [appendedRtn] = childTag.appendSql(sqlcommandForEach, data, extentionDataFreeze)
        if (appendedRtn) {
          sqlcommandForEach.sql = `${sqlcommandForEach.sql} ${separator} `
          appended = true
        }
      }
    }
    if (appended && separator && sqlcommandForEach.sql) {
      sqlcommandForEach.sql = sqlcommandForEach.sql.substring(0, sqlcommandForEach.sql.length - separator.length - 1)
    }
    Object.entries(sqlcommandForEach.parameters).forEach(([_k, v]: [string, any]) => sqlcommand.addParameter(v))
    sqlcommand.sql += `${opening} ${sqlcommandForEach.sql}${closure}`
    return [appended, extentionData]
  }
}

class SqlBoundIf extends SqlBound {
  #testFunc?: TestFunction
  #testFuncParams?: string[]
  #testExpression?: string

  constructor(expressionTest: string, lineNumber?: number) {
    super(undefined, undefined, lineNumber)
    this.#testExpression = expressionTest
  }
  public appendSql(sqlcommand: SqlCommand, data?: any, extentionData?: ExtentionDataType): ReturnTypeOfAppendSql {
    let [testFunc, testFuncParams] = [this.#testFunc, this.#testFuncParams]
    if (!testFunc) {
      ;[testFunc, testFuncParams] = [this.#testFunc, this.#testFuncParams] = buildTestFunction(
        this.#testExpression as string
      )
    }
    try {
      let result
      const paramArray = buildParameters(testFuncParams ?? [], data, extentionData)
      result = testFunc.call(undefined, ...paramArray)
      if (result) {
        let resultRtn: boolean
          ;[resultRtn, extentionData] = super.appendSql(sqlcommand, data, extentionData)
        if (resultRtn) {
          if (!sqlcommand.sql?.endsWith('\n')) {
            sqlcommand.sql += '\n'
          }
          result = true
        }
      }
      return [result, extentionData]
    } catch (err) {
      throw new Error(
        `[line:${this.lineNumber}] - testExpression[${this.#testExpression}] caculate error:${(err as any).message}`
      )
    }
  }
}

class SqlBoundOtherwise extends SqlBound {
  constructor(lineNumber: number) {
    super(undefined, undefined, lineNumber)
  }
}

class SqlBoundBind extends SqlBound {
  #name: string
  #value: string
  #valueFunc?: TestFunction
  #paramNames?: string[]
  constructor(name: string, value: string, lineNumber: number) {
    super(undefined, undefined, lineNumber)
    this.#name = name
    this.#value = value
  }
  public appendSql(sqlcommand: SqlCommand, data?: any, extentionData?: ExtentionDataType): ReturnTypeOfAppendSql {
    let [valFunc, paramNames]: [TestFunction | undefined, string[] | undefined] = [this.#valueFunc, this.#paramNames]
    if (!valFunc) {
      ;[this.#valueFunc, this.#paramNames] = [valFunc, paramNames] = buildTestFunction(this.#value as string)
    }
    // if(process.env.OPT_ENV == 'local'){
    //     if(data && this.#name in data){
    //         throw new Error(`[line:${this.lineNumber}] - name[${this.#name}] already exists under the scoper`)
    //     }
    // }
    try {
      const paramArray = buildParameters(paramNames ?? [], data, extentionData)
      const result = valFunc?.call(undefined, ...paramArray)
      if (!extentionData?.payload) {
        extentionData = Object.freeze({
          payload: {},
        })
      }
      extentionData.payload[this.#name] = result
    } catch (err) {
      throw new Error(
        `[line:${this.lineNumber}] - value Expression[${this.#value}] evaluation error:${(err as any).message}`
      )
    }
    return [false, extentionData]
  }
}

export class TemplateMapManager {
  private mapMapping: Record<string, Mapping>
  private daoContext?: DaoContext
  private types?: Record<string, typeof AuroraEntity>
  constructor() {
    this.mapMapping = {}
  }
  public context(context: DaoContext): TemplateMapManager {
    this.daoContext = context
    return this
  }
  public returnTypes(types: Record<string, typeof AuroraEntity> | undefined): TemplateMapManager {
    this.types = types
    return this
  }
  public clear(): void {
    this.mapMapping = {}
  }
  public add(mappingString: string): TemplateMapManager {
    const doc = parseDocFromString(mappingString)
    const rootName = doc.documentElement.nodeName
    if (rootName != 'mapper') {
      throw new Error(`xml is not a valid mybatis mapping file`)
    }
    const namespace = doc.documentElement.getAttribute('namespace') ?? ''
    let mapping = this.mapMapping[namespace]
    mapping = Mapping.build(doc.documentElement, mapping) //  new Mapping(mappingString)
    this.mapMapping[namespace] = mapping
    return this
  }
  public getSqlFactory(sqlId: string): SqlBound {
    if (!sqlId || !/^[a-z0-9]+(\.[a-z0-9]+)*$/gis.test(sqlId)) {
      throw new Error(`sqlId is not valid:${sqlId}`)
    }
    let nameNamespace, id
    if (sqlId.indexOf('.') > 0) {
      nameNamespace = sqlId.substr(0, sqlId.lastIndexOf('.'))
      id = sqlId.substr(sqlId.lastIndexOf('.') + 1)
    } else {
      nameNamespace = ''
      id = sqlId
    }
    const mapping = this.mapMapping[nameNamespace]
    if (!mapping) {
      throw new Error(`mapping [${sqlId}] is not found`)
    }
    return mapping.getNo(id)
  }

  public async execute(
    sqlcommand: SqlCommand,
    fullname: string,
    transactionId: string | undefined = undefined
  ): Promise<ReturnType<formatResults>> {
    //const connection = await this.connection();
    if (!sqlcommand.sql) {
      throw new Error(`sql is empty.`)
    }
    return new Promise<ReturnType<formatResults>>((resolve, reject) => {
      const startTime = new Date().getTime()
      if (!this.daoContext) {
        reject(new Error(`Unsupported operation for execute ${fullname}: dataSource is not set`))
      }
      this.daoContext?.executeStatement(
        sqlcommand.sql as string,
        sqlcommand.parameters,
        transactionId,
        (err, rows, _transactionId) => {
          const diff = new Date().getTime() - startTime
          if (err) {
            console.error(
              `${_transactionId ? `transaction[${_transactionId}] - ` : ''}${fullname}:${diff}ms - ${err}:\n${sqlcommand.sql
              } \n ${JSON.stringify(sqlcommand.parameters)}`
            )
            reject(err)
          } else {
            console.log(
              `${_transactionId ? `transaction[${_transactionId}] - ` : ''}${fullname} - ${diff}ms:\n${sqlcommand.sql
              } \n ${JSON.stringify(sqlcommand.parameters)}`
            )
            resolve(rows as ReturnType<formatResults>)
          }
        }
      )
    })
  }

  public async insert(fullname: string, object: any, transactionId: string | undefined = undefined): Promise<number> {
    const tag = this.getSqlFactory(fullname)
    if (tag.sqlType != SqlType.insert) {
      throw new Error(`it's not a valid insert mapping.`)
    }
    const sqlcommand = new SqlCommand(tag.sqlType)
    tag.appendSql(sqlcommand, object)
    const result = await this.execute(sqlcommand, fullname, transactionId)
    if (tag.useGeneratedKeys) {
      object[tag.keyProperty || 'id'] = result.insertId
    }
    return result.numberOfRecordsUpdated as number
  }
  public async update(fullname: string, object: any, transactionId: string | undefined = undefined): Promise<number> {
    const tag = this.getSqlFactory(fullname)
    if (tag.sqlType != SqlType.update) {
      throw new Error(`it's not a valid update mapping.`)
    }
    const sqlcommand = new SqlCommand(tag.sqlType)
    tag.appendSql(sqlcommand, object)
    const result = await this.execute(sqlcommand, fullname, transactionId)
    return result.numberOfRecordsUpdated as number
  }
  public async delete(fullname: string, object: any, transactionId: string | undefined = undefined): Promise<number> {
    const factory = this.getSqlFactory(fullname)
    if (factory.sqlType != SqlType.delete) {
      throw new Error(`it's not a valid delete mapping.`)
    }
    const sqlcommand = new SqlCommand(factory.sqlType)
    factory.appendSql(sqlcommand, object)
    const result = await this.execute(sqlcommand, fullname, transactionId)
    return result.numberOfRecordsUpdated as number
  }

  #setValue(obj: any, path: string, value: any): void {
    if (path.indexOf('.') > 0) {
      const ps = path.split('.')
      let subObj: any = obj
      for (let p = 0; p < ps.length; p++) {
        const pName = ps[p]
        if (p < ps.length - 1) {
          subObj = subObj?.[pName] ?? (subObj = subObj[pName] = {})
        } else {
          subObj[pName] = value
        }
      }
    } else {
      obj[path] = value
    }
  }
  public async selectOne<T>(
    fullname: string,
    data?: any,
    toCamelcase: 'ON' | 'OFF' | 'NESTED' | ((record: Record<string, any>) => T) = 'OFF',
    transactionId: string | undefined = undefined
  ): Promise<T | null> {
    const objects = await this.selectList<T>(fullname, data, toCamelcase, transactionId)
    const count = (objects as any[]).length
    if (count == 1) {
      return objects[0]
    } else if (count == 0) {
      return null
    }
    throw new Error(`Result returns more then one record:${count}`)
  }

  /**
   *
   * @param fullname
   * @param data
   * @param toCamelcase false: no auto convert to CamelCase,true,auto convert to CamelCase
   * @param transactionId
   * @returns
   */
  public async selectList<T>(
    fullname: string,
    data: any,
    toCamelcase: 'ON' | 'OFF' | 'NESTED' | ((record: Record<string, any>) => T) = 'OFF',
    transactionId: string | undefined = undefined
  ): Promise<T[]> {
    const tag = this.getSqlFactory(fullname)
    if (tag.sqlType != SqlType.select) {
      throw new Error(`it's not a valid select mapping:${fullname}`)
    }
    let clazz: typeof AuroraEntity | undefined
    //set the resultType and it's not a Class,then throw error
    let clazzInstance: any = null;
    if (tag.resultType) {
      if (tag.resultType == 'String' ||
        tag.resultType == 'Boolean' ||
        tag.resultType == 'Blob' ||
        tag.resultType == 'Number') {
        console.warn(`ignore resultType settings in ${fullname}:only support class inherited from AuroraEntity, but is:${tag.resultType}`)
        //clazz = eval(tag.resultType)
      } else {
        if (!(clazz = this.types?.[tag.resultType]) || !(typeof clazz.constructor == 'function')) {
          throw new Error(`resultType: ${tag.resultType} not found or it's not a Class type:${fullname}`)
        }
        try {
          clazzInstance = new (clazz as any)()
          if (!(clazzInstance instanceof AuroraEntity)) {
            throw new Error(`${tag.resultType} is not a subclass from AuroraEntity`)
          }
        } catch (err) {
          throw new Error(`can't new ${tag.resultType} instance:${err}`)
        }
      }
    }
    const sqlcommand = new SqlCommand(tag.sqlType)
    tag.appendSql(sqlcommand, data)
    const result = await this.execute(sqlcommand, fullname, transactionId)
    if (!result?.records?.length) {
      return [] as T[]
    }
    if (!clazz) {
      if (toCamelcase === 'NESTED') {
        return result.records.map((v) => {
          const classInstance: T = {} as T
          Object.entries(v).forEach(([k, v]) => {
            this.#setValue(classInstance, k, v)
          })
          return classInstance
        })
      } else if (toCamelcase == 'OFF') {
        return result.records
      } else {
        return result.records.map((v) => {
          if (typeof toCamelcase !== 'function') {
            const classInstance: T = {} as T
            Object.entries(v).forEach(([k, v]) => {
              //ON
              ; (classInstance as any)[underline2Camelcase2(k)] = v
            })
            return classInstance
          } else {
            return toCamelcase(v)
          }
        })
      }
    } else {
      return result.records.map((v) => {
        if (typeof toCamelcase !== 'function') {
          const classInstance: T = new (clazz as any)()
          Object.entries(v).forEach(([k, v]) => {
            if (toCamelcase === 'ON') {
              ; (classInstance as any)[underline2Camelcase2(k)] = v
            } else if (toCamelcase === 'OFF') {
              ; (classInstance as any)[k] = v
            }
          })
          return classInstance
        } else {
          return toCamelcase(v)
        }
      })
    }
  }
  // private async connection(): Promise<Connection | undefined> {
  //   return await this.daoContext?.getConnection()
  // }
}

const validLogicTags = ['choose', 'if', 'foreach', 'bind', 'trim', 'set', 'where']

class Mapping {
  #name: string
  // #children: SqlBound[];
  #sqlMappings: Record<string, SqlBound>
  #xmlDoc: Record<string, Element>
  // #isInit = false
  static readonly #validSqlBounds = ['select', 'update', 'insert', 'delete']
  public static build(documentElement: HTMLElement, mapping?: Mapping | null): Mapping {
    try {
      if (!mapping) {
        mapping = new Mapping({}, documentElement.getAttribute('namespace') ?? '')
      }
      for (let i = 0; i < documentElement.childNodes.length; i++) {
        const childNode = documentElement.childNodes.item(i)
        if (childNode.nodeType == childNode.ELEMENT_NODE) {
          if (Mapping.#validSqlBounds.indexOf(childNode.nodeName) < 0) {
            throw new Error(`[line:${(childNode as any).lineNumber}] - invalid tag[${childNode.nodeName}]`)
          }
          const id = (childNode as Element).getAttribute('id')
          if (!id) {
            throw new Error(`[line:${(childNode as any).lineNumber}] - tag[${childNode.nodeName}] must have an id`)
          }
          if (id in mapping.#xmlDoc || id in mapping.#sqlMappings) {
            throw new Error(`mapping[${mapping.#name ? mapping.#name + '.' + id : id}] already exists`)
          }
          mapping.#xmlDoc[id] = childNode as Element
        }
      }
      return mapping
    } catch (err) {
      throw new Error(`error: ${(err as any).message} while build mapping failed from xml:\n${documentElement}`)
    }
  }
  private constructor(xmlDoc: Record<string, Element>, name: string) {
    this.#name = name
    this.#xmlDoc = xmlDoc
    // this.#children = [];
    this.#sqlMappings = {}
  }
  public getName() {
    return this.#name
  }
  private read(sqlNode: Element): SqlBound {
    const id = sqlNode.getAttribute('id')
    const sqlType = (SqlType as any)[sqlNode.nodeName]
    const sqlBoundTarget = new SqlBound(id, sqlType)
    if (sqlType == SqlType.insert) {
      sqlBoundTarget.useGeneratedKeys = sqlNode.getAttribute('useGeneratedKeys') === 'true'
      if (sqlNode.getAttribute('keyProperty')) {
        sqlBoundTarget.keyProperty = sqlNode.getAttribute('keyProperty') as string
      }
    } else if (sqlType == SqlType.select) {
      if (sqlNode.getAttribute('resultType')) {
        sqlBoundTarget.resultType = sqlNode.getAttribute('resultType') as string
      }
    }
    this.readChildTag(sqlNode, sqlBoundTarget)
    return sqlBoundTarget
  }

  private readChildTag(sqlNode: Element, thisTag: SqlBound, validate?: (node: ChildNode) => void): void {
    for (let i = 0; i < sqlNode.childNodes.length; i++) {
      const tag = sqlNode.childNodes.item(i)
      if (
        tag.COMMENT_NODE == tag.nodeType ||
        ((tag.TEXT_NODE == tag.nodeType || tag.nodeType == tag.CDATA_SECTION_NODE) && !tag.textContent?.trim().length)
      ) {
        continue
      }
      if (validate) {
        validate(tag)
      } else {
        if (tag.nodeType == tag.ELEMENT_NODE && validLogicTags.indexOf(tag.nodeName) < 0) {
          throw new Error(
            `[line:${(tag as any).lineNumber}] - tag[${tag.nodeName}] is not recognized inner tag[${sqlNode.nodeName}].`
          )
        }
      }
      if (tag.nodeType == tag.ELEMENT_NODE || tag.nodeType == tag.TEXT_NODE || tag.nodeType == tag.CDATA_SECTION_NODE) {
        if (tag.nodeName == 'if') {
          this.readIf(tag as Element, thisTag)
        } else if ('where' == tag.nodeName) {
          this.readWhere(tag as Element, thisTag)
        } else if ('set' == tag.nodeName) {
          this.readSet(tag as Element, thisTag)
        } else if ('trim' == tag.nodeName) {
          this.readTrim(tag as Element, thisTag)
        } else if (tag.nodeName == 'foreach') {
          this.readForEach(tag as Element, thisTag)
        } else if (tag.nodeName == 'choose') {
          this.readChoose(tag as Element, thisTag)
        } else if (tag.nodeName == 'when') {
          this.readNoWhen(tag as Element, thisTag)
        } else if (tag.nodeName == 'otherwise') {
          this.readNoOtherwise(tag as Element, thisTag)
          //nohead.add(new SqlBoundOtherwise(noson.textContent??""));
        } else if (tag.nodeName == 'bind') {
          this.readBind(tag as Element, thisTag)
          //nohead.add(new SqlBoundOtherwise(noson.textContent??""));
        } else if (tag.TEXT_NODE == tag.nodeType || tag.nodeType == tag.CDATA_SECTION_NODE) {
          const noString = new SqlBoundString(tag.textContent as string, (tag as any).lineNumber)
          thisTag.add(noString)
        }
      }
    }
  }
  private readBind(bindNode: Element, parentTag: SqlBound) {
    const lineNumber = (bindNode as any).lineNumber
    if (bindNode.childNodes.length) {
      throw new Error(`[line:${lineNumber}] - tag[bind] should have no child node.`)
    }
    let name, value
    if (!(name = bindNode.getAttribute('name'))) {
      throw new Error(`[line:${lineNumber}] - tag[bind] name attribute is required and should not empty.`)
    }
    if (!(value = bindNode.getAttribute('value'))) {
      throw new Error(`[line:${lineNumber}] - tag[bind] value attribute is required and should not empty.`)
    }
    const noBind = new SqlBoundBind(name, value, lineNumber)
    parentTag.add(noBind)
  }

  private readWhere(whereNode: Element, parentSqlBound: SqlBound): void {
    const lineNumber = (whereNode as any).lineNumber
    if (whereNode.attributes.length) {
      throw new Error(`[line:${lineNumber}] - tag[where] should have tag attribute.`)
    }
    const noWhere = new SqlBoundWhere(lineNumber)
    this.readChildTag(whereNode, noWhere)
    parentSqlBound.add(noWhere)
  }
  private readSet(setNode: Element, parentSqlBound: SqlBound): void {
    const lineNumber = (setNode as any).lineNumber
    if (setNode.attributes.length) {
      throw new Error(`[line:${lineNumber}] - tag[where] should have no attribute.`)
    }
    const noSet = new SqlBoundSet(lineNumber)
    this.readChildTag(setNode, noSet)
    parentSqlBound.add(noSet)
  }
  private readTrim(trimNode: Element, parentSqlBound: SqlBound): void {
    const lineNumber = (trimNode as any).lineNumber
    const trimAttibutes: SqlBoundTrimParams = [
      trimNode.getAttribute('prefix'),
      trimNode.getAttribute('suffix'),
      trimNode.getAttribute('prefixOverrides') ? (trimNode.getAttribute('prefixOverrides') as string).split('|') : null,
      trimNode.getAttribute('suffixOverrides') ? (trimNode.getAttribute('suffixOverrides') as string).split('|') : null,
      lineNumber,
    ]

    const noTrim = new SqlBoundTrim(...trimAttibutes)
    this.readChildTag(trimNode, noTrim)
    parentSqlBound.add(noTrim)
  }

  private readForEach(forEachNode: Element, parentSqlBound: SqlBound): void {
    const valueSeparador = forEachNode.getAttribute('separator') ?? ''

    const valueAverage = forEachNode.getAttribute('open') ?? ''

    const closingvalue = forEachNode.getAttribute('close') ?? ''
    const valueIndex = forEachNode.getAttribute('index') ?? ''
    const valueCollection = forEachNode.getAttribute('collection') ?? ''

    const valueItem = forEachNode.getAttribute('item') ?? ''
    const tagForeach = new SqlBoundForEach(
      valueItem,
      valueIndex,
      valueSeparador,
      valueAverage,
      closingvalue,
      valueCollection,
      (forEachNode as any).lineNumber
    )
    this.readChildTag(forEachNode, tagForeach)
    parentSqlBound.add(tagForeach)
  }
  private readIf(ifNode: Element, parentSqlBound: SqlBound) {
    const testExpression = ifNode.getAttribute('test')
    const lineNumber = (ifNode as any).lineNumber
    if (!testExpression) {
      throw new Error(`[line:${lineNumber}] - attribute [test] is required and should not empty.`)
    }
    const tagIf = new SqlBoundIf(testExpression, lineNumber)
    this.readChildTag(ifNode, tagIf)
    parentSqlBound.add(tagIf)
  }
  private readChoose(chooseNode: Element, parentSqlBound: SqlBound) {
    const lineNumber = (chooseNode as any).lineNumber
    if (chooseNode.attributes.length) {
      throw new Error(`[line:${lineNumber}] - tag [choose] should have tag attribute.`)
    }
    const chooseTag = new SqlBoundChoose(lineNumber)
    let hasOtherwiseTag = false
    this.readChildTag(chooseNode, chooseTag, (tag) => {
      if (tag.nodeType == tag.ELEMENT_NODE && ['when', 'otherwise'].indexOf(tag.nodeName) < 0) {
        throw new Error(
          `[line:${(tag as any).lineNumber}] - tag[${tag.nodeName}] is not recognized inner tag[${chooseNode.nodeName
          }].`
        )
      }
      if (hasOtherwiseTag) {
        if ('when' == tag.nodeName) {
          throw new Error(`[line:${(tag as any).lineNumber}] - tag[otherwise] should be the last child of tag[choose].`)
        } else {
          throw new Error(
            `[line:${(tag as any).lineNumber}] - tag[otherwise] should appear once at the most inner tag[choose].`
          )
        }
      }

      hasOtherwiseTag = hasOtherwiseTag || (tag.nodeType == tag.ELEMENT_NODE && tag.nodeName == 'otherwise')
    })
    parentSqlBound.add(chooseTag)
  }
  private readNoWhen(whenNode: Element, tagChoose: SqlBound): void {
    // const noWhen[NoWhen][]=[]
    const expressionTest = whenNode.getAttribute('test')
    const lineNumber = (whenNode as any).lineNumber
    if (!expressionTest) {
      throw new Error(`[line:${lineNumber}] - tag [test] attribute in when tag.`)
    }
    const tagwhen = new SqlBoundWhen(expressionTest, lineNumber)
    this.readChildTag(whenNode, tagwhen)
    tagChoose.add(tagwhen)
  }
  private readNoOtherwise(otherwiseNode: Element, tagChoose: SqlBound): void {
    const lineNumber = (otherwiseNode as any).lineNumber
    if (otherwiseNode.attributes.length) {
      throw new Error(`[line:${lineNumber}] - tag[otherwise] should have tag attribute.`)
    }
    const tagOtherwise = new SqlBoundOtherwise(lineNumber)
    this.readChildTag(otherwiseNode, tagOtherwise)
    tagChoose.add(tagOtherwise)
  }
  private init(id: string): void {
    if (this.#sqlMappings[id]) {
      return
    }
    if (!this.#xmlDoc[id]) {
      throw new Error(`sql mapping [${id}] not found.`)
    }
    const tag = this.read(this.#xmlDoc[id])
    this.add(tag)
    delete this.#xmlDoc[id]
  }
  private add(noson: SqlBound) {
    this.#sqlMappings[noson.id as string] = noson
  }

  public getNo(id: string): SqlBound {
    this.init(id)
    const tag = this.#sqlMappings[id]
    if (!tag) {
      throw new Error(`sql [${id}] not found.`)
    }
    return tag
  }
}

export const templateManager = new TemplateMapManager()

export function initContext({
  dao,
  types,
}: {
  dao: DaoContext
  types?: Record<string, typeof AuroraEntity>
}): DaoContext {
  templateManager.context(dao).returnTypes(types)
  return dao
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function sqlTemplate(strings: TemplateStringsArray, ..._value: any): TemplateMapManager {
  templateManager.add(strings[0])
  return templateManager
}
