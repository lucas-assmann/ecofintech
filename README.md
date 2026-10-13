# Ecofintech API

Backend da Ecofintech, construído com [NestJS](https://nestjs.com/) + TypeScript (strict).

## Requisitos

- Node.js 24+
- npm

## Como rodar

```bash
npm install
cp .env.example .env   # ajuste os valores

npm run start:dev      # desenvolvimento (watch)
npm run build          # build de produção
npm run start:prod     # roda o build
```

A API sobe em `http://localhost:3000`.

## Banco de dados

PostgreSQL acessado com **SQL puro** via [`pg`](https://node-postgres.com/) (sem ORM).

1. Crie o banco: `CREATE DATABASE ecofintech;` (pelo pgAdmin ou `psql`).
2. Configure `DATABASE_URL` no `.env`.
3. Rode as migrations: `npm run db:migrate`.

**Migrations** ficam em `src/database/migrations/` como arquivos `.sql` numerados (`001_...`, `002_...`) e são aplicadas em ordem. As já aplicadas ficam registradas na tabela `schema_migrations`. Nunca edite uma migration que já rodou; crie uma nova.

**No código**, injete o `DatabaseService` (`src/database/database.service.ts`) em qualquer service:

```ts
constructor(private readonly db: DatabaseService) {}

findByEmail(email: string) {
  return this.db.query<User>('SELECT * FROM users WHERE email = $1', [email]);
}
```

Use sempre parâmetros (`$1`, `$2`...) em vez de concatenar valores na string, para evitar SQL injection. Para operações que precisam ser atômicas (ex.: transferência), use `db.transaction(...)`.

## Documentação da API

Com a API rodando:

- **Swagger UI:** http://localhost:3000/docs — lista todas as rotas, parâmetros e respostas, e permite testar.
- **OpenAPI JSON:** http://localhost:3000/docs-json — use para importar no Postman (*Import → Link*) ou gerar clientes para o front.

A documentação é gerada a partir do código: o plugin `@nestjs/swagger` (em `nest-cli.json`) lê os DTOs e os comentários JSDoc automaticamente. Para detalhar uma rota, use decorators como `@ApiTags`, `@ApiOperation` e `@ApiOkResponse` (veja `src/app.controller.ts`).

## Testes e qualidade

```bash
npm test               # testes unitários (Vitest)
npm run test:e2e       # testes end-to-end
npm run test:cov       # cobertura
npm run lint           # oxlint
npm run format         # prettier
```

## Estrutura

```
src/
├── modules/           # domínios de negócio
│   ├── accounts/
│   ├── auth/
│   ├── transactions/
│   └── users/
├── common/            # guards, filters, interceptors, utils
├── config/            # configuração e variáveis de ambiente
├── database/          # conexão, migrations (.sql) e script de migrate
│   └── migrations/
├── app.module.ts
└── main.ts
test/                  # testes e2e
docs/adr/              # Architecture Decision Records
```
