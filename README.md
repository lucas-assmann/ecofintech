# Ecofintech API

Backend da Ecofintech, construído com [NestJS](https://nestjs.com/) + TypeScript (strict).

## Requisitos

- Node.js 24+
- npm

## Como rodar

```bash
npm install
# crie o arquivo .env na raiz (variáveis abaixo)

npm run start:dev      # desenvolvimento (watch)
npm run build          # build de produção
npm run start:prod     # roda o build
```

A API sobe em `http://localhost:3000`.

Variáveis do `.env` (a API valida todas ao iniciar e avisa o que estiver faltando):

| Variável | Para que serve | Exemplo |
|---|---|---|
| `DATABASE_URL` | Conexão com o PostgreSQL | `postgresql://postgres:SENHA@localhost:5432/ecofintech` |
| `JWT_SECRET` | Segredo que assina os tokens (longo e aleatório; nunca reutilize o de dev em produção) | |
| `JWT_EXPIRES_IN` | Validade do token, em segundos (mínimo 60) | `3600` |
| `PORT` | Porta da API (opcional) | `3000` |
| `NODE_ENV` | Ambiente (opcional) | `development` |
| `CORS_ORIGINS` | Endereços do front autorizados, separados por vírgula | `http://localhost:5173` |
| `APP_URL` | Endereço do front, usado nos links dos e-mails | `http://localhost:5173` |
| `SMTP_HOST` / `SMTP_PORT` | Servidor de e-mail (sem `SMTP_HOST`, o e-mail é só escrito no terminal da API) | `localhost` / `1025` |
| `SMTP_USER` / `SMTP_PASS` | Login do servidor de e-mail, se ele exigir | |
| `MAIL_FROM` | Remetente | `Ecofintech <nao-responda@ecofintech.local>` |
| `TRUST_PROXY` | Quantos proxies ficam na frente da API, para o limite de requisições enxergar o IP real (opcional; `0` em dev) | `1` |

### E-mails em desenvolvimento (Mailpit)

O [Mailpit](https://mailpit.axllent.org) finge ser um servidor de e-mail: tudo o que a API envia aparece numa caixa de entrada local, sem sair para a internet.

```bash
winget install axllent.mailpit   # uma vez
mailpit                          # SMTP na porta 1025, caixa de entrada em http://localhost:8025
```

Em produção, basta apontar `SMTP_*` para um provedor de verdade (Gmail, Resend, SES...). No Render as portas SMTP padrão (25, 465, 587) são bloqueadas; com o Resend use `smtp.resend.com` na porta `2465`.

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

### Limite de requisições

Para dificultar ataques de força bruta (`@nestjs/throttler`, guard global em `src/app.module.ts`):

- Cada IP pode fazer até **100 requisições por minuto** em qualquer rota.
- As rotas públicas sensíveis (`POST /auth/login`, `POST /users`, `POST /auth/forgot-password` e `POST /auth/reset-password`) usam `@AuthThrottle()`: **5 por minuto**.
- Quem passa do limite recebe **429 "Muitas tentativas. Aguarde um minuto e tente de novo."**

A contagem fica na memória do processo: se a API rodar em várias instâncias, cada uma conta separado.

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

**Esqueci minha senha:** `POST /auth/forgot-password` envia um link de uso único (30 minutos) e responde igual exista ou não o e-mail; `POST /auth/reset-password` troca a senha com o token do link e encerra todas as sessões. No banco fica só o hash SHA-256 do token (tabela `password_reset_tokens`).

Rotas exclusivas de admin: `GET /users` (listar todos), `DELETE /users/:id` (remover usuário), `POST /transactions/deposit` (depósito), `POST /transactions/:id/reverse` (estorno), `GET /transactions/all` (todos os lançamentos) e a avaliação de desativações (`GET /deactivation-requests`, `PATCH .../approve`, `PATCH .../reject`).

### Desativação de conta

1. O usuário pede: `POST /deactivation-requests` (motivo opcional). Resposta `202` com a mensagem **"Sua solicitação foi recebida. O suporte avaliará a solicitação."** Só pode haver uma pendente por vez (`409`).
2. O usuário acompanha em `GET /deactivation-requests/me` (`pending`, `approved` ou `rejected`).
3. O admin vê a fila em `GET /deactivation-requests?status=pending` e decide:
   - `PATCH /deactivation-requests/:id/approve`: **exige saldo zerado** (`409` caso contrário). A conta fica `deactivated`: as sessões caem, o login passa a responder `403`, ela não recebe transferências (`422`) e o histórico é mantido.
   - `PATCH /deactivation-requests/:id/reject`: a conta continua ativa e o usuário pode pedir de novo.

Cada decisão registra quem avaliou (`reviewed_by`), quando e a observação.

**Dono de empresa:** quem é dono de uma empresa ativa não pode pedir a desativação da conta pessoal (`422`), porque a empresa ficaria sem dono.

## Contas de empresa

O login é sempre da **pessoa**. Com ele, a pessoa opera a conta pessoal e as contas das empresas (CNPJ) das quais participa.

- **Abrir:** `POST /companies` (`cnpj`, `legal_name` = razão social, `trade_name` = nome fantasia). Quem abre vira o **dono** e a conta da empresa é criada na hora. CNPJ validado e único (`409` se já cadastrado).
- **Conta ativa:** o front envia o cabeçalho `X-Account-Id` com o id da conta escolhida. Sem ele, vale a conta pessoal. `GET /accounts/me`, `GET /transactions`, `GET /transactions/summary`, `GET /transactions/:id` e `POST /transactions/transfer` usam a conta ativa. O acesso é conferido **a cada requisição**: quem sai ou é removido de uma empresa perde o acesso na hora (`403` "Sem acesso a esta conta").
- **Minhas contas:** `GET /accounts` lista a pessoal e as empresas (com o papel), para a tela de escolha de conta.
- **Papéis:** `owner` (um por empresa) e `member`. Todo membro movimenta a conta; só o dono convida, cancela convites e remove membros.
- **Convites (dono):** `POST /companies/:id/invites` (por `email` ou `cpf` de quem já tem conta), `DELETE /companies/:id/invites/:inviteId`, `DELETE /companies/:id/members/:userId`. `GET /companies/:id/members` mostra os membros (e, para o dono, os convites pendentes).
- **Convites (convidado):** `GET /invites`, `POST /invites/:id/accept`, `POST /invites/:id/decline`. Membro sai com `POST /companies/:id/leave` (o dono não pode sair).
- **Auditoria:** abrir empresa, convidar, cancelar, entrar, remover e sair ficam em `audit_logs` (`company.*`).

Tabelas: `companies`, `company_members` (um único `owner` por empresa, garantido por índice), `company_invites` (um convite pendente por pessoa em cada empresa) e `accounts`, que pertence a uma pessoa (`user_id`) **ou** a uma empresa (`company_id`).

## Saldo e movimentações

```
users 1───1 accounts (balance) 1───N transactions
```

- **Conta:** criada automaticamente no cadastro, com saldo 0. `GET /accounts/me` devolve o saldo.
- **Movimentações** (`transactions`): cada linha é um lançamento em uma conta, com `type` (`entrada` | `saida`), `category` (`deposito` | `transferencia`), `amount` e `balance_after` (saldo logo após o lançamento).
  - `POST /transactions/deposit` (**somente admin**): dinheiro entrando de fora. Gera uma `entrada`.
  - `POST /transactions/transfer`: da conta ativa para outra conta, identificada por `to_email` ou `to_cpf` (pessoa) **ou** `to_cnpj` (empresa) — exatamente um. Gera uma `saida` na origem e uma `entrada` no destino. O depósito do admin aceita os mesmos campos.
  - Cada lançamento traz `counterparty` (`{ name, email, kind }`: `kind` é `person` ou `company`; empresa aparece pelo nome fantasia e `email` nulo) e `operator`: o nome de quem fez a operação, preenchido só em transferências **enviadas pela conta de uma empresa** ("feita por Maria").
  - Depósito e transferência para conta desativada são recusados (`422`).
  - `POST /transactions/:id/reverse` (**somente admin**): estorno. Lança o movimento inverso com `category: "estorno"` e `reversal_of` apontando para o original. Estornar qualquer ponta de uma transferência desfaz as duas. Cada lançamento só pode ser estornado uma vez (`409`), estorno não se estorna (`422`) e é preciso saldo na conta que devolve (`422`).
  - `GET /transactions` (extrato, com `limit`/`offset`) e `GET /transactions/:id`.
  - `GET /transactions/summary?days=7|30|90` (padrão 30): resumo do usuário logado para o dashboard. Totais de entradas, saídas e resultado, a série por dia (ou por semana em 90 dias, com os intervalos sem movimentação zerados) e os totais por categoria. Os dias seguem o horário de Brasília.
  - `GET /transactions/all` (**somente admin**): todos os lançamentos do sistema, mais recentes primeiro, com o dono da conta em `owner`. Filtros opcionais: `search` (parte do nome, e-mail ou CPF), `category`, `type`, `from` e `to` (datas `AAAA-MM-DD`, inclusive, no horário de Brasília), além de `limit`/`offset`.
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

## Deploy (Render + Neon)

- **Build command:** `npm ci --include=dev && npm run build && npm run db:migrate`. O `--include=dev` é necessário porque, com `NODE_ENV=production`, o `npm ci` pula as devDependencies, e a CLI do Nest (`nest build`) está nelas.
- **Start command:** `npm run start:prod`. **Health check:** `/`.
- `DATABASE_URL` do Neon com `sslmode=verify-full`. As migrations rodam a cada deploy; as já aplicadas são puladas.
- Variáveis de produção: as da tabela acima, com `NODE_ENV=production`, `TRUST_PROXY`, `CORS_ORIGINS`/`APP_URL` com o endereço do front, e `SMTP_*` do Resend (porta `2465`).

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
