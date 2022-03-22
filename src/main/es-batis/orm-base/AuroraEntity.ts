import 'reflect-metadata'
import { camelcase2Underline } from '../utils'
import { SqlCommand, templateManager } from '../mapping'
import type { ColumnType } from './annotation'

export type EntityFieldsType<T extends AuroraEntity = AuroraEntity> =
  | Array<
    Exclude<
      keyof T,
      | 'load'
      | 'save'
      | 'saveIntoDynamo'
      | 'loadForUpdate'
      | 'loadFromDynamo'
      | 'delete'
      | 'loadFromDydb'
      | 'save2Dydb'
      | 'save2DydbWithCondition'
    >
  >
  | undefined

const auroraMeta: Record<string, Record<string, ColumnType> | null> = {}

export abstract class AuroraEntity {
  /**
   * return example:
   * {
   *  xxxxYyyZzzz:{
   * name:'XXXX_YYYY_ZZZ',
   * originName:'xxxxYyyZzzz'
   * ...
   * }
   * }
   *
   */
  #aquireAuroraModel(): Record<string, ColumnType> | undefined {
    const cachedMeta = auroraMeta[this.constructor.name]
    if (cachedMeta || cachedMeta === null) {
      return cachedMeta ?? undefined
    }
    const metaKeys = Reflect.getMetadataKeys(this.constructor.prototype) as string[]
    const idMetaKeys = metaKeys.filter((val: string) => {
      return val.startsWith('column:')
    })
    if (!idMetaKeys?.length) {
      auroraMeta[this.constructor.name] = null
      return undefined
    }
    const columnMeta: Record<string, ColumnType> = {}
    for (const idMetakey of idMetaKeys) {
      const idMetaData = Reflect.getMetadata(idMetakey, this.constructor.prototype) as ColumnType
      const originName = idMetakey.substring('column:'.length)
      idMetaData.name ? undefined : (idMetaData.name = camelcase2Underline(originName))
      columnMeta[originName] = {
        ...idMetaData,
      }
    }
    return (auroraMeta[this.constructor.name] = columnMeta)
  }
  async delete(
    // this: T,
    id: number | string | undefined = undefined,
    transactionId: string | undefined = undefined
  ): Promise<number> {
    // const idd = this.idDescriptor()
    const columnMetasRecorder = this.#aquireAuroraModel()
    if (columnMetasRecorder == undefined) {
      throw new Error(`no IdColumn defined on ${this.constructor.name}`)
    }
    ///FIXME need check the id combination
    const idMetas = Object.entries(columnMetasRecorder).filter(([_k, v]) => v?.idType)
    // .map((v) => v[1])
    this.assertIdValueNotEmpty(idMetas, id)
    const tableName = camelcase2Underline(this.constructor.name)
    const sqlcommand = new SqlCommand()
    sqlcommand.sql = `DELETE FROM ${camelcase2Underline(tableName)} \nWHERE\n ${idMetas
      .map((v) => {
        //paramObj[v[0]] = (this as any)[v[0]]
        return `${v?.[1].name as string}=:${v[0]}`
      })
      .join(' AND\n')}`

    sqlcommand.parameters = this.#buildSqlParamter(idMetas, id)

    const result = await templateManager.execute(sqlcommand, `${tableName}@auto@delete`, transactionId)
    return result.numberOfRecordsUpdated as number
  }
  protected assertIdValueNotEmpty(
    idColumnMetas: [propertyName: string, columnMeta: ColumnType][] | undefined,
    alterParam?: any | undefined,
    skipIncreamentId: boolean = false
  ): void {
    if (!idColumnMetas || !idColumnMetas?.length) {
      throw new Error(`Entity:[${this.constructor.name}]:no id definition found`)
    }
    let allFilled = true
    if (alterParam == null) {
      for (const cm of idColumnMetas) {
        const val = (this as any)[cm[0]]
        if (val == null || val === '') {
          if (skipIncreamentId && cm[1].idType == 'increment') {
            continue
          } else {
            allFilled = false
            break
          }
        }
      }
    } else {
      const idCount = idColumnMetas.length
      for (const cm of idColumnMetas) {
        const val = idCount > 1 ? alterParam[cm[0]] : alterParam
        if (val == null || val === '') {
          allFilled = false
          break
        } else if (!(typeof val == 'number' || typeof val == 'string')) {
          throw new Error(
            `Entity[${this.constructor.name}]:the value type of id:${cm[0]
            } must be string or number,but is ${typeof val}`
          )
        }
      }
    }
    if (!allFilled) {
      throw new Error(`Entity[${this.constructor.name}]:the value(s) of id must be set`)
    }
  }

  /**
   * insert or update
   * @param excludeNullOnSave if not update the column where the value of Entity Property is null/undefined
   * @param transactionId
   * @returns
   */
  async save(
    // this: T,
    excludeNullOnSave: boolean = false,
    transactionId: string | undefined = undefined
  ): Promise<AuroraEntity> {
    const columnMetas = this.#aquireAuroraModel()
    const columnMetaArr = Object.entries(columnMetas ?? {})
    const idMetaArr = columnMetaArr.filter(([_k, v]) => v.idType)
    const isInsert = idMetaArr.length && idMetaArr[0][1].idType == 'increment' && (this as any)[idMetaArr[0][0]] == null
    let increasedIdName: string | undefined = undefined
    if (isInsert) {
      increasedIdName = idMetaArr[0][0]
    }
    this.assertIdValueNotEmpty(idMetaArr, undefined, isInsert as boolean)
    const sqlcommand = new SqlCommand()
    const { propertieNames, clazzName } = this.meta()
    const tableName = camelcase2Underline(clazzName)

    const propertyValuesMap: Record<string, any> = {}
    if (isInsert) {
      const propertieNamesExcludeId = propertieNames.filter((v) => idMetaArr.findIndex((ima) => ima[0] == v) < 0)

      sqlcommand.sql = `INSERT INTO ${tableName} \n(${propertieNamesExcludeId
        .map((v) => camelcase2Underline(v))
        .join(',\n')})\nVALUES(${propertieNamesExcludeId.map((v) => `:${v}`).join(',\n')})`
      for (const propertyName of propertieNamesExcludeId) {
        propertyValuesMap[propertyName] = (this as any)[propertyName] ?? null
      }
    } else {
      let refinedPropertieNames = propertieNames
      if (excludeNullOnSave) {
        refinedPropertieNames = refinedPropertieNames.filter((v) => (this as any)[v] != null)
      }
      sqlcommand.sql = `INSERT INTO ${tableName} \n(${refinedPropertieNames
        .map((v) => camelcase2Underline(v))
        .join(',\n')})\nVALUES(${refinedPropertieNames
          .map((v) => `:${v}`)
          .join(',\n')})\nON DUPLICATE KEY UPDATE\n${refinedPropertieNames
            .filter((v) => idMetaArr.findIndex((ima) => ima[0] == v) < 0)
            .map((v) => `${camelcase2Underline(v)} = :${v}`)
            .join(',\n')}`
      for (const propertyName of refinedPropertieNames) {
        propertyValuesMap[propertyName] = (this as any)[propertyName] ?? null
      }
    }
    sqlcommand.parameters = propertyValuesMap
    const result = await templateManager.execute(sqlcommand, `${tableName}@auto@save`, transactionId)
    if (result.insertId != null && increasedIdName) {
      ; (this as any)[increasedIdName] = result.insertId
    }
    return this
  }

  protected meta(getterOrSetter: 'get' | 'set' = 'get'): {
    propertieNames: string[]
    clazzName: string
  } {
    let propertieNames = Object.keys(this)
    const getters = Object.entries(Object.getOwnPropertyDescriptors((this as any).__proto__))
      .filter(([_k, v]) => typeof v[getterOrSetter] == 'function')
      .map((v) => v[0])
    propertieNames = propertieNames.concat(getters)
    const clazzName = this.constructor.name
    return { propertieNames, clazzName }
  }

  /**
   * load by id
   * @param includes table columns to include,includes all while not set
   * @param id use this value when set,and also will set back to this.id
   * @param transactionId
   * @returns
   */
  async load<T extends AuroraEntity>(
    this: T,
    includes: EntityFieldsType<T> = undefined,
    forupdate: boolean = false,
    id: number | string | Record<string, string | number> | undefined = undefined,
    transactionId: string | undefined = undefined
  ): Promise<AuroraEntity | null> {
    const idMetas = this.#aquireAuroraModel()
    const idMetaArr = Object.entries(idMetas ?? {}).filter(([_k, v]) => v.idType)
    this.assertIdValueNotEmpty(idMetaArr, id)
    const selectOriginColumns: Record<string, string> = {}
    const { propertieNames, clazzName } = this.meta('set')
    const tableName = camelcase2Underline(clazzName)
    if (includes?.length) {
      includes.forEach((v) => {
        if (idMetas![v as string]) {
          selectOriginColumns[v as string] = idMetas![v as string]!.name as string
        } else {
          selectOriginColumns[v as string] = camelcase2Underline(v as string)
        }
      })
    } else {
      propertieNames.forEach((v) => {
        if (idMetas![v as string]) {
          selectOriginColumns[v as string] = idMetas![v as string]!.name as string
        } else {
          selectOriginColumns[v as string] = camelcase2Underline(v as string)
        }
      })
    }

    const sqlcommand = new SqlCommand()
    sqlcommand.sql = `SELECT \n${Object.entries(selectOriginColumns)
      .map(([k, v]) => `${v}${k === v ? '' : ` as ${k}`}`)
      .join(',\n')} \nFROM ${tableName}\n WHERE ${idMetaArr.map(([k, v]) => `${v.name}=:${k}`)}`
    if (forupdate) {
      sqlcommand.sql += ' FOR UPDATE'
    }
    const parameterObj: Record<string, any> = this.#buildSqlParamter<T>(idMetaArr, id)
    sqlcommand.parameters = parameterObj
    const result = await templateManager.execute(sqlcommand, `${tableName}@auto@load`, transactionId)
    if (!result.records?.length) {
      return null
    }
    if (result.records.length > 1) {
      throw new Error(`found more than one(${result.records.length}) records in table [${tableName}] by id:${id}`)
    }
    for (const [key, value] of Object.entries(result.records[0])) {
      ; (this as any)[key] = value
    }
    return this
  }

  #buildSqlParamter<T extends AuroraEntity>(
    idMetaArr: [string, ColumnType][],
    id: string | number | Record<string, string | number> | undefined
  ): any {
    const parameterObj: Record<string, any> = {}
    if (idMetaArr.length == 1) {
      parameterObj[idMetaArr[0][0]] = id == null ? (this as any)[idMetaArr[0][0]] : id
    } else {
      for (const meta of idMetaArr) {
        parameterObj[meta[0]] = id == null ? (this as any)[idMetaArr[0][0]] : (id as any)[idMetaArr[0][0]] //(this as any)[meta[0]]
      }
    }
    return parameterObj
  }

  /**
   * load with lock for update
   * @param this
   * @param includes
   * @param id
   * @param transactionId
   * @returns
   */
  async loadForUpdate<T extends AuroraEntity>(
    this: T,
    includes: EntityFieldsType<typeof this> = undefined,
    id: any = undefined,
    transactionId: string | undefined = undefined
  ): Promise<AuroraEntity | null> {
    return await this.load(includes, true, id, transactionId)
  }
}
