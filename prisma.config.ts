import { defineConfig, env } from 'prisma/config';

// O Prisma 7 não lê o .env sozinho
try {
  process.loadEnvFile();
} catch {
  // sem .env (ex.: em produção as variáveis vêm do ambiente)
}

export default defineConfig({
  schema: 'src/database/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
