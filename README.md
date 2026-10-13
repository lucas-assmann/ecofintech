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
### Padrão de nomes

Os **nomes do banco são o padrão** em todo o projeto: tabelas e colunas em snake_case (`users`, `date_of_birth`) e os mesmos nomes no Prisma (`prisma.users`), nos DTOs e no JSON da API. Não use `@map`/`@@map` para renomear.

> Não use `prisma migrate` nem edite colunas pelo `schema.prisma`: a fonte da verdade são as migrations SQL.

### No código

Injete o `PrismaService` (`src/database/prisma.service.ts`) em qualquer service:

```ts
constructor(private readonly prisma: PrismaService) {}

findByEmail(email: string) {
  return this.prisma.users.findUnique({ where: { email } });
}
```

Para operações atômicas (ex.: transferência), use `this.prisma.$transaction(...)`. Para SQL direto, `this.prisma.$queryRaw`.
## Autenticação

Login com JWT: `POST /auth/login` recebe `email` e `password` e devolve um `access_token`. Envie-o nas requisições no header `Authorization: Bearer <token>`. O segredo e a validade ficam em `JWT_SECRET` e `JWT_EXPIRES_IN` (segundos) no `.env`.

- **Toda rota exige token por padrão** (guard global em `src/common/guards/auth.guard.ts`). Para liberar uma rota, use `@Public()`. Hoje são públicas: `GET /`, `POST /users` (cadastro) e `POST /auth/login`.
- Para pegar o usuário logado num controller, use `@CurrentUser() user: JwtPayload` (`user.sub` é o id).
- `GET /auth/me` devolve os dados do usuário logado.
- Nas rotas `/users/:id`, o id precisa ser o do usuário logado; caso contrário, 403.
- No Swagger, clique em **Authorize** e cole o token.

### Perfis (roles)

Cada usuário tem um `role`: `user` (padrão) ou `admin`. Para restringir uma rota, use `@Roles('admin')`. O `RolesGuard` lê o perfil **do banco** a cada requisição, então promover ou rebaixar alguém vale na hora, sem novo login.

Ninguém vira admin pela API (o campo `role` é recusado no cadastro e no update). Para promover, rode no banco:

```sql
UPDATE users SET role = 'admin' WHERE email = 'fulano@email.com';
```

Hoje só `GET /users` (listar todos) é exclusiva de admin.

## Saldo e movimentações

```
users 1───1 accounts (balance) 1───N transactions
```

- **Conta:** criada automaticamente no cadastro, com saldo 0. `GET /accounts/me` devolve o saldo.
- **Movimentações** (`transactions`): cada linha é um lançamento em uma conta, com `type` (`entrada` | `saida`), `category` (`deposito` | `transferencia`), `amount` e `balance_after` (saldo logo após o lançamento).
  - `POST /transactions/deposit` (**somente admin**): dinheiro entrando de fora. Gera uma `entrada`.
  - `POST /transactions/transfer`: do usuário logado para outro, pelo e-mail (`to_email`). Gera uma `saida` na origem e uma `entrada` no destino.
  - `GET /transactions` (extrato, com `limit`/`offset`) e `GET /transactions/:id`.
- **Valores:** `NUMERIC(15,2)` no banco; na API, entram como número (máx. 2 casas, de 0,01 a 1.000.000 por operação) e saem como texto (`"200.00"`).

Garantias:

- Saldo e lançamentos são gravados na mesma transação do banco: ou tudo é aplicado, ou nada.
- O débito só acontece se houver saldo (`422 Saldo insuficiente`), e o banco tem `CHECK (balance >= 0)` como segunda barreira. Transferências simultâneas nunca deixam o saldo negativo.
- As duas contas de uma transferência são travadas sempre na mesma ordem (por id), evitando deadlock.
- Lançamentos são imutáveis (sem rotas de edição ou exclusão). Um usuário com movimentações não pode ser removido (`409`).
- O saldo deve sempre bater com o extrato. Para conferir no banco:

```sql
SELECT a.id, a.balance,
       COALESCE(SUM(CASE t.type WHEN 'entrada' THEN t.amount ELSE -t.amount END), 0) AS soma_extrato
FROM accounts a LEFT JOIN transactions t ON t.account_id = a.id
GROUP BY a.id, a.balance;
```

## Documentação da API

Com a API rodando:

- **Swagger UI:** http://localhost:3000/docs — lista todas as rotas, parâmetros e respostas, e permite testar.
- **OpenAPI JSON:** http://localhost:3000/docs-json — use para importar no Postman (*Import → Link*) ou gerar clientes para o front.

**Postman:** a collection com todas as requests, organizadas por pasta e com testes, fica em `docs/postman/ecofintech-api.postman_collection.json`. Importe no Postman (*Import* → arraste o arquivo). Rode **Users → Criar usuário** primeiro: ele salva o id na variável `user_id`, usada pelas outras requests. Ao criar ou alterar rotas, atualize esse arquivo.

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
