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
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    ssl?: boolean | { rejectUnauthorized?: boolean };
  }

  export class Pool {
    constructor(config?: PoolConfig);
    connect(): Promise<PoolClient>;
  }
}
