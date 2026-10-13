import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';
import type { PoolClient, QueryResultRow } from 'pg';

// Por padrão o pg converte DATE em Date do JS à meia-noite no fuso local, o que
// desloca o dia ao virar JSON (ex.: 2000-01-15 vira 2000-01-15T03:00:00Z).
// Mantemos DATE como texto 'YYYY-MM-DD'.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  // Pool reaproveita conexões abertas em vez de abrir uma nova a cada query
  private readonly pool: pg.Pool;

  constructor(config: ConfigService) {
    this.pool = new pg.Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
    });
  }

  /**
   * Executa uma query e devolve as linhas.
   * Sempre passe valores em `params` ($1, $2...), nunca concatenando na string:
   * isso evita SQL injection.
   *
   * @example
   * db.query<User>('SELECT * FROM users WHERE email = $1', [email])
   */
  async query<T extends QueryResultRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const result = await this.pool.query<T>(sql, params);
    return result.rows;
  }

  /**
   * Executa várias queries de forma atômica: ou todas são aplicadas, ou nenhuma.
   * Use `client.query(...)` dentro do callback.
   */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
