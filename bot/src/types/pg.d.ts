declare module "pg" {
  export interface QueryResult<RowType = any> {
    rows: RowType[];
  }

  export interface PoolClient {
    query<RowType = any>(text: string, params?: readonly unknown[]): Promise<QueryResult<RowType>>;
    release(): void;
  }

  export interface PoolConfig {
    connectionString?: string;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    connect(): Promise<PoolClient>;
  }
}
