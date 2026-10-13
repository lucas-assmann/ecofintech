// Aplica, em ordem, os arquivos .sql de ./migrations que ainda não rodaram.
// Os já aplicados ficam registrados na tabela schema_migrations.
// Uso: npm run db:migrate
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const migrationsDir = path.join(import.meta.dirname, 'migrations');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await client.query<{ name: string }>(
    'SELECT name FROM schema_migrations',
  );
  const applied = new Set(rows.map((row) => row.name));

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  const pending = files.filter((file) => !applied.has(file));

  if (pending.length === 0) {
    console.log('Nenhuma migration pendente.');
  }

  for (const file of pending) {
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    // Cada migration roda numa transação: se der erro, nada dela fica aplicado
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [
        file,
      ]);
      await client.query('COMMIT');
      console.log(`✔ ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`✖ ${file}`);
      throw error;
    }
  }
} finally {
  await client.end();
}
