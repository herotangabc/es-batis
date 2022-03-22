import { parseExpression } from '@babel/parser'
import { DOMParser } from '@xmldom/xmldom'
import { variables } from 'eval-estree-expression'
import dayjs from 'dayjs'
export { escape, format } from 'mysql2'

export type TestFunction = (...data: any[]) => any

export interface ExtentionDataType {
  readonly payload: Record<string, any>
  // readonly meta:{
  //     preIndexName:string
  //     preItemVarName:string
  // }
}

export const parseDocFromString = (xmlstring: string): Document => {
  let level: string = '',
    message: string = ''
  const doc = new DOMParser({
    locator: {},
    errorHandler: (lev, mess) => {
      level = lev
      message = mess
    },
  }).parseFromString(xmlstring)
  if (level == 'error' || level == 'fatalError') {
    throw new Error(message)
  }
  return doc
}

export type ReturnTypeOfAppendSql = [appended: boolean, extentionData: ExtentionDataType | undefined]

export const buildTestFunction = (testExpression: string): [TestFunction, string[]] => {
  try {
    //获取变量列表并去重
    const vars = variables(parseExpression(testExpression))
    return [new Function(...vars, "'use strict';return " + testExpression) as TestFunction, vars]
  } catch (err) {
    throw new Error(`test expression [${testExpression}] has an error:${(err as Error).message}`)
  }
}

export const lazyFreezeClone = (paramValue: any): any => {
  if (
    paramValue == null ||
    typeof paramValue === 'number' ||
    typeof paramValue === 'boolean' ||
    typeof paramValue === 'string' ||
    paramValue instanceof Date
  ) {
    return paramValue
  } else {
    return Object.freeze({ ...paramValue })
  }
}

/**
 *
 * for each trimStrArray trim only once on head/Tail.
 * ex:
 *  for 'abc','def' in trimStrArray,it will only trim at most once of them
 * on head or on tail,if 'abc' is trimmed on head,'def' will not be trimmed even if
 * it happend on the tail of being trimmed by 'abc' string,
 * but it('def') can be trimmed on the head if it happend on head
 *
 * @param source
 * @param trimStrArray all the different string to trim,if word like,trim as word,other simple trim just as is
 * @param headOrTail 1:head,2:tail,3:both
 */
export const trimHeadOrTail = (
  source: string | undefined,
  trimStrArray: string[] | null,
  headOrTail: 1 | 2 | 3
): string | undefined => {
  if (!trimStrArray || !source || !source.trim().length) {
    return source
  }
  let resultString = source
  let result = 0x00 //01:trim happend on head,02:trim happend on tail,03:trim happend on both
  const wordRegex = /^\w+$/i
  for (const v of trimStrArray) {
    //if v is a word like
    if ((result & 0x01 || !(headOrTail & 0x01)) && (result & 0x02 || !(headOrTail & 0x02))) {
      break
    }
    const wordLike = wordRegex.test(v)
    const trimStringUpper = v.toUpperCase()
    const upperResultStr = resultString.toUpperCase()
    let indexTmp
    if (headOrTail & 0x01 && !(result & 0x01)) {
      //head
      if ((indexTmp = upperResultStr.trimStart().indexOf(trimStringUpper)) == 0) {
        const index = upperResultStr.indexOf(trimStringUpper)
        let flg = true
        if (wordLike) {
          if (
            index + trimStringUpper.length < upperResultStr.length &&
            wordRegex.test(upperResultStr.substr(index + trimStringUpper.length, 1))
          ) {
            flg = false
          }
        }
        if (flg) {
          resultString = resultString.substr(0, index) + resultString.substring(index + trimStringUpper.length)
          result |= 0x01
        }
      }
    }
    if (headOrTail & 0x02 && !(result & 0x02)) {
      //tail
      const upperResultStrTrimend = upperResultStr.trimEnd()
      const indexTmp = upperResultStrTrimend.lastIndexOf(trimStringUpper)
      if (indexTmp + trimStringUpper.length == upperResultStrTrimend.length) {
        let flg = true
        if (wordLike) {
          if (indexTmp != 0 && wordRegex.test(upperResultStr.substr(indexTmp - 1, 1))) {
            flg = false
          }
        }
        if (flg) {
          resultString = resultString.substr(0, indexTmp) + resultString.substring(indexTmp + trimStringUpper.length)
          result |= 0x02
        }
      }
    }
  }

  return resultString
}

export const buildParameters = (
  testFuncParams: string[],
  data: any,
  extentionData: ExtentionDataType | undefined
): any[] => {
  const paramArray: any[] = []
  testFuncParams?.forEach((paraName) => {
    if (paraName == '_') {
      //lazy freeze
      paramArray.push(lazyFreezeClone(data))
    } else if (paraName == '$env') {
      paramArray.push(lazyFreezeClone(process.env))
    } else if (paraName == 'escapeMYSQLLike') {
      paramArray.push(escapeMYSQLLike)
    } else if (extentionData?.payload && paraName in extentionData?.payload) {
      paramArray.push(lazyFreezeClone(extentionData?.payload[paraName]))
    } else {
      if (data == null) {
        throw new Error(`tag variable [${paraName}] value can be found since input parameter is falsy`)
      } else {
        paramArray.push(lazyFreezeClone(data[paraName]))
      }
    }
  })
  return paramArray
}

/**
 * suitable for mysql  LIKE sql,for Sql Server,please refer to
 * https://docs.microsoft.com/en-us/sql/t-sql/language-elements/like-transact-sql?view=sql-server-ver15
 * for example
 * <pre>
 *   <select id="findMatterLikeName">
 *       select MATTER_NAME as matterName from INCIDENT_MATTER_MST
 *       <where>
 *       <bind name="matterNameLike" value="escapeMYSQLLike(matterName)">
 *       AND MATTER_NAME LIKE concat('%',#{matterNameLike},'%')
 *       </where>
 *   </select>
 * </pre>
 * @param escapeStr
 * @returns
 */
export function escapeMYSQLLike(escapeStr: string | undefined | null): string {
  if (!escapeStr) {
    return ''
  }
  return escapeStr.replace(/([%_\\])/g, '\\$1')
}

export function parseDateTime(value: string): Date | undefined {
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|(\+|-)\d{2}:?\d{2})?$/.test(value)) {
    const ret = Date.parse(value)
    if (isFinite(ret)) {
      return new Date(ret)
    }
  }
  return undefined
}


/**
 * convert xxxYyyZzz to XXX_YYY_ZZZ
 * @param camelcaseName
 * @returns
 */
export function camelcase2Underline(camelcaseName: string): string {
  if (!camelcaseName) {
    return camelcaseName
  } else if (camelcaseName.indexOf('_') >= 0) {
    return camelcaseName.toUpperCase()
  } else {
    // return camelcaseName.toUpperCase().replace(/(?!\b)([A-Z])/g, (v) => "_" + v);
    return camelcaseName.replace(/\B([A-Z])/g, '_$1').toUpperCase()
  }
}

/**
 * convert XXX_YYY_ZZZ to xxxYyyZzz
 * @param underlineName
 * @returns
 */
export function underline2Camelcase2(underlineName: string): string {
  if (!underlineName) {
    return underlineName
  } else {
    return underlineName.toLowerCase().replace(/(_([a-z]))/g, (v) => v.substring(1, 2).toUpperCase())
  }
}

export function getCurrentTime(): string {
  return dayjs().format('YYYY-MM-DD HH:mm:ss.SSS')
}