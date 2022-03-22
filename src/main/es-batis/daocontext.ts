import { formatResults } from "./rds-result-format";

export type CallbackFnType = (err: any, rows: ReturnType<typeof formatResults> | undefined, transactionId: string | undefined) => void
export interface DaoContext {
  initialize(): Promise<void>;
  beginTransaction(): Promise<string | undefined>;
  release(): Promise<void>;
  executeStatement(sql: string, parameters: any, transactionId: string | undefined, callback: CallbackFnType): void;
  commit(transactionId: string | undefined): Promise<string | undefined>;
  rollback(transactionId: string | undefined): Promise<string | undefined>;
}