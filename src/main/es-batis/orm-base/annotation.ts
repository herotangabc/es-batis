/* eslint-disable @typescript-eslint/ban-types */
import 'reflect-metadata'
import { camelcase2Underline } from '../utils'
import { AuroraEntity } from './AuroraEntity'

export type ColumnType = {
  /**
   * 默认驼峰形式
   */
  name?: string
  /**
   * 不指定，则此列不是id
   */
  idType?: 'increment' | 'uniqueIndex'
  /**
   * 不指定，不做自动转换处理
   */
  type?: String | Number | Buffer | Date | BigInt
}

/**
 * for Aurora Mysql DB
 * @param value Aurora IdColumn settings
 * @returns
 */
export function DBColumn(value: ColumnType) {
  return function <T extends AuroraEntity>(target: T, propertyKey: string): void {
    value.name ? undefined : (value.name = camelcase2Underline(propertyKey))
    Reflect.defineMetadata(`column:${propertyKey}`, value, target.constructor.prototype)
  }
}
