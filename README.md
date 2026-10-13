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

PostgreSQL. As **tabelas são escritas em SQL** (migrations) e o **código usa o Prisma**, gerado a partir do banco.

Primeira vez:

1. Crie o banco: `CREATE DATABASE ecofintech;` (pelo pgAdmin ou `psql`).
2. Configure `DATABASE_URL` no `.env`.
3. `npm run db:migrate` para criar as tabelas.
4. `npm run db:pull` para gerar o client do Prisma.

### Fluxo para mudar o banco

1. Crie uma migration SQL nova em `src/database/migrations/`, numerada em sequência (ex.: `003_create_accounts.sql`). Nunca edite uma que já rodou.
2. `npm run db:migrate` aplica as pendentes (as já aplicadas ficam em `schema_migrations`).
3. `npm run db:pull` lê o banco, atualiza `src/database/schema.prisma` e regenera os tipos.
4. No `schema.prisma`, dê nomes camelCase aos models e campos novos com `@@map`/`@map` (ex.: `model Account { ... @@map("accounts") }`). O `db pull` mantém esses nomes nas próximas vezes.

> Não use `prisma migrate` nem edite colunas pelo `schema.prisma`: a fonte da verdade são as migrations SQL.

### No código

Injete o `PrismaService` (`src/database/prisma.service.ts`) em qualquer service:

```ts
constructor(private readonly prisma: PrismaService) {}

findByEmail(email: string) {
  return this.prisma.user.findUnique({ where: { email } });
}
```

Para operações atômicas (ex.: transferência), use `this.prisma.$transaction(...)`. Para SQL direto, `this.prisma.$queryRaw`.
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
├── database/          # Prisma (schema + service), migrations (.sql) e script de migrate
│   └── migrations/
├── app.module.ts
└── main.ts
test/                  # testes e2e
docs/adr/              # Architecture Decision Records
```
