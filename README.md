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

A API valida o `.env` ao iniciar (`src/config/env.validation.ts`): se faltar uma variável ou ela estiver errada (ex.: `JWT_SECRET` com menos de 32 caracteres), ela não sobe e lista o que corrigir.

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
- `GET`, `PATCH /users/:id` e `PATCH /users/:id/password` só funcionam no próprio usuário; caso contrário, 403.
- No Swagger, clique em **Authorize** e cole o token.

### Sessão

Cada token carrega a versão (`ver`) dos tokens do usuário no momento do login; a versão atual fica em `users.token_version`. O guard compara as duas a cada requisição. Incrementam a versão (derrubando **todas** as sessões abertas):

- trocar a senha (`PATCH /users/:id/password`);
- `POST /auth/logout`;
- ter a conta desativada.

Nesses casos, e também com token expirado ou inválido, a API responde **401 "Sessão expirada. Faça login novamente."**. **No front: ao receber 401 em qualquer rota, apague o token e volte para a tela de login.** Login de conta desativada responde `403 Conta desativada`.

### CORS

Só os endereços listados em `CORS_ORIGINS` (no `.env`, separados por vírgula) podem chamar a API pelo navegador. Padrão de desenvolvimento: `http://localhost:5173` (Vite) e `http://localhost:8081` (Expo). Em produção, coloque o domínio do front.

### Cadastro

`POST /users` exige `name`, `email`, `date_of_birth`, `cpf`, `phone` e `password`. CPF e telefone aceitam pontuação e são salvos só com dígitos. O CPF é validado pelos dígitos verificadores, é único e **não pode ser alterado** depois.

### Perfis (roles)

Cada usuário tem um `role`: `user` (padrão) ou `admin`. Para restringir uma rota, use `@Roles('admin')`. O `RolesGuard` lê o perfil **do banco** a cada requisição, então promover ou rebaixar alguém vale na hora, sem novo login.

Ninguém vira admin pela API (o campo `role` é recusado no cadastro e no update). Para promover, rode no banco:

```sql
UPDATE users SET role = 'admin' WHERE email = 'fulano@email.com';
```

Rotas exclusivas de admin: `GET /users` (listar todos), `DELETE /users/:id` (remover usuário), `POST /transactions/deposit` (depósito) e a avaliação de desativações (`GET /deactivation-requests`, `PATCH .../approve`, `PATCH .../reject`).

### Desativação de conta

1. O usuário pede: `POST /deactivation-requests` (motivo opcional). Resposta `202` com a mensagem **"Sua solicitação foi recebida. O suporte avaliará a solicitação."** Só pode haver uma pendente por vez (`409`).
2. O usuário acompanha em `GET /deactivation-requests/me` (`pending`, `approved` ou `rejected`).
3. O admin vê a fila em `GET /deactivation-requests?status=pending` e decide:
   - `PATCH /deactivation-requests/:id/approve`: **exige saldo zerado** (`409` caso contrário). A conta fica `deactivated`: as sessões caem, o login passa a responder `403`, ela não recebe transferências (`422`) e o histórico é mantido.
   - `PATCH /deactivation-requests/:id/reject`: a conta continua ativa e o usuário pode pedir de novo.

Cada decisão registra quem avaliou (`reviewed_by`), quando e a observação.

## Saldo e movimentações

```
users 1───1 accounts (balance) 1───N transactions
```

- **Conta:** criada automaticamente no cadastro, com saldo 0. `GET /accounts/me` devolve o saldo.
- **Movimentações** (`transactions`): cada linha é um lançamento em uma conta, com `type` (`entrada` | `saida`), `category` (`deposito` | `transferencia`), `amount` e `balance_after` (saldo logo após o lançamento).
  - `POST /transactions/deposit` (**somente admin**): dinheiro entrando de fora. Gera uma `entrada`.
  - `POST /transactions/transfer`: do usuário logado para outro, identificado por `to_email` **ou** `to_cpf` (nunca os dois). Gera uma `saida` na origem e uma `entrada` no destino.
  - Depósito e transferência para conta desativada são recusados (`422`).
  - `POST /transactions/:id/reverse` (**somente admin**): estorno. Lança o movimento inverso com `category: "estorno"` e `reversal_of` apontando para o original. Estornar qualquer ponta de uma transferência desfaz as duas. Cada lançamento só pode ser estornado uma vez (`409`), estorno não se estorna (`422`) e é preciso saldo na conta que devolve (`422`).
  - `GET /transactions` (extrato, com `limit`/`offset`) e `GET /transactions/:id`.
- **Valores:** `NUMERIC(15,2)` no banco; na API, entram como número (máx. 2 casas, de 0,01 a 1.000.000 por operação) e saem como texto (`"200.00"`).

Garantias:

- Saldo e lançamentos são gravados na mesma transação do banco: ou tudo é aplicado, ou nada.
- O débito só acontece se houver saldo (`422 Saldo insuficiente`), e o banco tem `CHECK (balance >= 0)` como segunda barreira. Transferências simultâneas nunca deixam o saldo negativo.
- As duas contas de uma transferência são travadas sempre na mesma ordem (por id), evitando deadlock.
- **Idempotência:** depósito e transferência exigem o header `Idempotency-Key` (UUID). O front gera um UUID novo por operação e, se precisar reenviar (ex.: a resposta não chegou), manda **a mesma chave**: a API devolve o lançamento original com o header `Idempotent-Replayed: true`, sem mover o dinheiro de novo. A mesma chave com dados diferentes é recusada (`422`). Uma operação que falhou não consome a chave.
- **Auditoria:** cada lançamento guarda quem o executou (`created_by`: o admin no depósito e no estorno, o remetente na transferência) e um `operation_id` comum às pontas da mesma operação. Remoções de usuário ficam em `audit_logs` (quem removeu e os dados do removido). Quem tem operações registradas não pode ser removido; use a desativação.
- Lançamentos são imutáveis (sem rotas de edição ou exclusão). Um usuário com movimentações não pode ser removido (`409`); para encerrar a conta, use a desativação.
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
