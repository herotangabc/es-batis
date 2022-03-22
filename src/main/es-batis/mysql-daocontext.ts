// import { SecretsManager } from 'aws-sdk'
import { Connection, createConnection } from 'mysql2'
import * as uuid from 'uuid'
import { CallbackFnType, DaoContext } from './daocontext'

// async function getSecretValueBySecretArn(secretIdOrArn: string): Promise<SecretsManager.GetSecretValueResponse> {
//   return new Promise<SecretsManager.GetSecretValueResponse>((r, j) => {
//     const secretsManager = new SecretsManager()
//     secretsManager.getSecretValue({ SecretId: secretIdOrArn }, (err, data) => {
//       if (err) {
//         j(err)
//       } else {
//         r(data)
//       }
//     })
//   })
// }

type MySQLConnectionInfo = {
  charset?: string
  host: string
  user?: string
  password?: string
  database?: string
  debug?: string
  connectTimeout: number
}


class MySqlDaoContext implements DaoContext {
  private id: string | undefined
  private connection!: Connection
  private secretKeyValue!: Record<string, string> | undefined
  #conectionInfo?: MySQLConnectionInfo
  constructor(conectionInfo?: MySQLConnectionInfo) {
    this.#conectionInfo = conectionInfo;
    this.id = uuid.v4()
  }
  async initialize(): Promise<void> {
    this.connection = createConnection({
      charset: process.env.charset ?? 'utf8',
      host: process.env.host,
      user: process.env.user,
      database: process.env.database,
      password: process.env.password,
      debug: process.env.debug == 'true',
      ...this.#conectionInfo,
      namedPlaceholders: true
    })

    // if (!this.secretKeyValue) {
    //   console.log('SECRET_ARN::::::', process.env.SECRET_ARN)
    //   const secretInfo = await getSecretValueBySecretArn(process.env.SECRET_ARN as string)
    //   console.log('secretInfo::::::', secretInfo)
    //   this.secretKeyValue = JSON.parse(secretInfo?.SecretString as string)
    // }

    // this.connection = createConnection({
    //   // charset: process.env.charset ?? 'utf8',
    //   host: this.secretKeyValue?.host,
    //   user: this.secretKeyValue?.username,
    //   database: process.env.DATABASE,
    //   password: this.secretKeyValue?.password,
    //   // debug: process.env.debug == 'true',
    //   // connectTimeout: 60000, //60 second
    //   // namedPlaceholders: true,
    // })
  }
  public executeStatement(
    sql: string,
    parameters: any,
    transactionId: string | undefined,
    callback: CallbackFnType
  ): void {
    this.connection.execute(sql, parameters, (err, data, fields) => {
      if (err) {
        callback(err, undefined, undefined)
      } else {
        if (Array.isArray(data)) {
          callback(
            err,
            {
              records: data as any[],
            },
            undefined
          )
        } else {
          callback(
            err,
            {
              numberOfRecordsUpdated: data.affectedRows as number,
              insertId: data.insertId as number,
            },
            undefined
          )
        }
      }
    })
  }

  public async beginTransaction(): Promise<string | undefined> {
    return new Promise<string | undefined>((r, j) => {
      this.connection.beginTransaction((err) => {
        if (err) {
          j(err)
        } else {
          r(undefined)
        }
      })
    })
  }
  public async release(): Promise<void> {
    if (this.connection) {
      this.connection.destroy()
    }
  }
  public async commit(): Promise<string | undefined> {
    return new Promise<string | undefined>((r, j) => {
      this.connection.commit((err) => {
        if (err) {
          j(err)
        } else {
          r(undefined)
        }
      })
    })
  }
  public rollback(): Promise<string | undefined> {
    return new Promise<string | undefined>((r, j) => {
      try {
        this.connection.rollback(() => {
          r(undefined)
        })
      } catch (err) {
        j(`${err}`)
      }
    })
  }
}
export default MySqlDaoContext
