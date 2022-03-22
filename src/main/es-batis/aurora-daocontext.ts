// import { rdsDataService } from '../aws-sdk'
// import * as uuid from "uuid";
// import type Connection from "mysql2/typings/mysql/lib/Connection";
// import mysql from 'mysql2'
// import { DaoContext } from "./daocontext";

// import init, { InitOptionsReturnType } from 'data-api-client'

// import { /*SecretsManager, */RDSDataService, AWSError } from 'aws-sdk'
// import { preSynthesis, formatResults, ExcuteResponse } from './rds-result-format'

// let secretArn: string = ''

// async function getClusterArnByName(clusterName: string): Promise<RDS.DBClusterMessage> {
//   return new Promise<RDS.DBClusterMessage>((r, j) => {
//     const rds = new RDS();
//     rds.describeDBClusters({ DBClusterIdentifier: clusterName }, (err, data) => {
//       if (err) {
//         j(err)
//       } else {
//         r(data)
//       }
//     })
//   })
// }
// async function getSecretArnByName(secretIdOrName: string): Promise<SecretsManager.DescribeSecretResponse> {
//   return new Promise<SecretsManager.DescribeSecretResponse>((r, j) => {
//     const secretsManager = new SecretsManager();
//     secretsManager.describeSecret({ SecretId: secretIdOrName }, (err, data) => {
//       if (err) {
//         j(err)
//       } else {
//         r(data)
//       }
//     })
//   })
// }


// export default class AuroraDaoContext implements DaoContext {
//   private id: string | undefined;
//   // public loading:boolean|undefined;
//   private dataClient!: RDSDataService
//   private transactionId: string[]
//   // private clusterArn!: string;
//   // private secretArn!: string;
//   private config!: any
//   constructor() {
//     this.id = uuid.v4();
//     this.transactionId = []
//   }
//   async initialize(): Promise<void> {
//     //     if (!clusterArn) {
//     //       const clusterInfo = await getClusterArnByName(process.env.RDS_ARN as string)
//     //       if (clusterInfo?.DBClusters?.[0].EngineMode != 'serverless') {
//     //         throw new Error(`DBCluster Name:${process.env.RDS_NAME} ,only [serverless] RDS type is supported:${clusterInfo?.DBClusters?.[0].EngineMode}
//     // see https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDSDataService.html for help`)
//     //       }
//     // this.clusterArn = process.env.RDS_ARN as string
//     // }
//     // if (!secretArn) {
//     //   const secretInfo = await getSecretArnByName(process.env.SECRET_NAME as string)

//     //   secretArn = secretInfo.ARN as string
//     // }
//     // this.clusterArn = clusterArn
//     // this.secretArn = secretArn
//     this.dataClient = rdsDataService
//     this.config = {
//       secretArn: process.env.SECRET_ARN as string,//secretArn,
//       resourceArn: process.env.RDS_ARN as string,
//       database: process.env.DATABASE as string,

//       // includeResultMetadata: true
//     }
//   }
//   public executeStatement(sql: string, parameters: Record<string, any> | Record<string, any>[], transactionId: string | undefined, callback: (err: any, rows: ReturnType<typeof formatResults> | undefined, transactionId: string | undefined) => void): any {
//     const _indx: number = this.find(transactionId, "excute", false);
//     if (_indx >= 0) {
//       transactionId = this.transactionId[_indx]
//     }
//     let isBatch: boolean, params: any, hydrateColumnNames: boolean, args: any, formatOptions: any;
//     try {
//       const preParam = preSynthesis([sql, parameters], { ...this.config, hydrateColumnNames: true, formatOptions: { deserializeDate: true, treatAsLocalDate: true } })
//       isBatch = preParam.isBatch;
//       params = preParam.params;
//       hydrateColumnNames = preParam.hydrateColumnNames;
//       args = preParam.args;
//       formatOptions = preParam.formatOptions;
//     } catch (_err) {
//       callback(_err, undefined, transactionId);
//       return;
//     }
//     const _callback = (err: AWSError, data: ExcuteResponse) => {
//       if (err) {
//         callback(err, undefined, transactionId)
//       } else {
//         const result = formatResults(data, hydrateColumnNames, args[0].includeResultMetadata, formatOptions)
//         console.log(JSON.stringify(data))
//         callback(undefined, result, transactionId)
//       }
//     }

//     //return this.dataClient.query(sql, parameters)
//     // try { // attempt to run the query
//     transactionId ? params.transactionId = transactionId : undefined;
//     // Capture the result for debugging
//     isBatch ? this.dataClient.batchExecuteStatement(params, _callback)
//       : this.dataClient.executeStatement(params, _callback)
//   }

//   public async beginTransaction(): Promise<string | undefined> {
//     return new Promise<string | undefined>((r, j) => {
//       this.dataClient.beginTransaction(this.config as RDSDataService.BeginTransactionRequest, (err, data) => {
//         if (err) {
//           j(err)
//         } else {
//           this.transactionId.push(data.transactionId as string)
//           console.log(`transaction[${data.transactionId}] - begin transaction`)
//           r(data.transactionId)
//         }
//       })
//     })
//   }
//   public async release(): Promise<void> {
//     if (this.transactionId.length > 0) {
//       this.transactionId.forEach(v => {
//         console.error(`transaction[${v}] rollback due to not completed.`)
//         this.rollback(v)
//       })
//       throw new Error(`there's some transactions not handle completed!`)
//     }

//   }

//   public async commit(transactionId: string | undefined = undefined): Promise<string | undefined> {
//     const _indx: number = this.find(transactionId, "commit");
//     transactionId = this.transactionId[_indx]
//     return new Promise<string | undefined>((r, j) => {
//       this.dataClient.commitTransaction({
//         transactionId: transactionId as string,
//         secretArn: this.config.secretArn,
//         resourceArn: this.config.resourceArn,
//       } as RDSDataService.CommitTransactionRequest, (err, data) => {
//         if (err) {
//           //this.transactionId = transactionId
//           j(err)
//         } else {
//           console.log(`transaction[${transactionId}] - commit transaction`)
//           this.transactionId.splice(_indx, 1)
//           r(data.transactionStatus);
//         }
//       });
//     })

//   }
//   private find(transactionId: string | undefined, actionName: 'commit' | 'rollback' | 'excute', required: boolean = true) {
//     if (required && this.transactionId.length === 0) {
//       console.log(`transaction[${transactionId}] - no transaction to ${actionName}.`);
//       return -1;
//     }
//     if (transactionId) {
//       const _indx = this.transactionId.indexOf(transactionId)
//       if (_indx < 0) {
//         console.log(`transaction[${transactionId}] - no transaction to ${actionName}.`);
//       }
//       return _indx
//     } else {
//       return this.transactionId.length - 1;
//     }
//   }

//   public rollback(transactionId: string | undefined = undefined): Promise<string | undefined> {
//     const _indx: number = this.find(transactionId, 'rollback');
//     if (_indx >= 0) {

//       transactionId = this.transactionId[_indx]
//       return new Promise<string | undefined>((r, j) => {
//         this.dataClient.rollbackTransaction({
//           transactionId: transactionId as string,
//           secretArn: this.config.secretArn,
//           resourceArn: this.config.resourceArn,
//         } as RDSDataService.RollbackTransactionRequest, ((err, data) => {
//           this.transactionId.pop()
//           if (err) {
//             j(err)
//           } else {
//             console.log(`transaction[${transactionId}] - rollback transaction`)
//             this.transactionId.splice(_indx, 1)
//             r(data.transactionStatus)
//           }
//         }));
//       })
//     } else {
//       return Promise.resolve(undefined)
//     }
//   }
// }