# 🧠 Ecofintech — API (Backend)

Back-end da **Ecofintech**, construído com [NestJS](https://nestjs.com/) + TypeScript (modo `strict`). É aqui que mora tudo o que precisa ser **confiável**: quem pode fazer o quê, quanto dinheiro cada conta tem e o registro de cada centavo que entrou ou saiu.

> 📍 Faz parte do monorepo [Ecofintech](../README.md). O front-end que consome esta API está em [`../web`](../web).

---

## 📑 Sumário

- [🚀 Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [📦 Instalação e Execução](#-instalação-e-execução)
- [🗄️ Banco de Dados](#️-banco-de-dados)
- [🔐 Autenticação e Segurança](#-autenticação-e-segurança)
- [👥 Usuários, Perfis e Desativação](#-usuários-perfis-e-desativação)
- [🏢 Contas de Empresa](#-contas-de-empresa)
- [💰 Saldo e Movimentações](#-saldo-e-movimentações)
- [📖 Documentação da API](#-documentação-da-api)
- [☁️ Deploy (Render + Neon)](#️-deploy-render--neon)
- [🧪 Testes e Qualidade](#-testes-e-qualidade)
- [📂 Estrutura de Pastas](#-estrutura-de-pastas)

---

## 🚀 Tecnologias Utilizadas

| Pacote | Para que serve aqui |
|---|---|
| **NestJS** | Framework que organiza a API em módulos (usuários, contas, transações...), com injeção de dependências |
| **PostgreSQL** | Banco de dados relacional: garante transações e regras como "saldo nunca negativo" |
| **Prisma** | Cliente do banco com tipos gerados automaticamente a partir das tabelas |
| **JWT** (`@nestjs/jwt`) | Token de login enviado a cada requisição |
| **class-validator** | Valida os dados de entrada (e-mail válido, CPF válido, valor com no máximo 2 casas...) |
| **Swagger** (`@nestjs/swagger`) | Documentação interativa gerada a partir do código |
| **@nestjs/throttler** | Limite de requisições por IP (contra força bruta) |
| **@nestjs/schedule** | Tarefas agendadas (limpeza diária de chaves antigas) |
| **Nodemailer** | Envio de e-mails (link de "esqueci minha senha") |
| **Vitest** | Testes automatizados |
| **oxlint** + **Prettier** | Padrão de código e formatação |

As senhas são guardadas com **scrypt** (do próprio Node, `node:crypto`), um algoritmo feito para ser lento de propósito e dificultar quem tenta adivinhar senhas.

---

## 📦 Instalação e Execução

### Pré-requisitos

- Node.js 24+
- PostgreSQL

### Passo a passo

1. **Instale as dependências:**

```bash
cd api
npm install
```

2. **Crie o banco** (pelo pgAdmin ou `psql`) e deixe-o em **UTC**:

```sql
CREATE DATABASE ecofintech;
ALTER DATABASE ecofintech SET timezone TO 'UTC';
```

> 🕐 **Por que UTC?** O adaptador do Prisma ignora o fuso das colunas de data. Com o banco no horário de Brasília, toda data lida ou gravada ficaria 3 horas deslocada, sem nenhum erro aparecer. Por isso a API **confere o fuso ao ligar e não sobe** se não estiver em UTC. O horário de Brasília é aplicado só na tela, pelo front.

3. **Crie o arquivo `.env`** na pasta `api/` (veja a tabela abaixo).

4. **Crie as tabelas:**

```bash
npm run db:migrate
```

5. **Rode a API:**

```bash
npm run start:dev      # desenvolvimento (reinicia ao salvar)
npm run build          # gera a versão de produção em dist/
npm run start:prod     # roda a versão de produção
```

6. **Acesse:** a API sobe em `http://localhost:3000` e a documentação em `http://localhost:3000/docs`.

### Variáveis de Ambiente `.env`

A API **valida todas ao iniciar** (`src/config/env.validation.ts`). Se faltar alguma ou estiver errada, ela não sobe e lista exatamente o que corrigir, em vez de quebrar depois, no meio de uma requisição.

| Variável | Para que serve | Exemplo |
|---|---|---|
| `DATABASE_URL` | Conexão com o PostgreSQL | `postgresql://postgres:SENHA@localhost:5432/ecofintech` |
| `JWT_SECRET` | Segredo que assina os tokens (mínimo 32 caracteres, aleatório; nunca reutilize o de dev em produção) | |
| `JWT_EXPIRES_IN` | Validade do token, em segundos (mínimo 60) | `3600` |
| `PORT` | Porta da API (opcional) | `3000` |
| `NODE_ENV` | Ambiente (opcional) | `development` |
| `CORS_ORIGINS` | Endereços do front autorizados, separados por vírgula | `http://localhost:5173` |
| `APP_URL` | Endereço do front, usado nos links dos e-mails (sem barra no final) | `http://localhost:5173` |
| `SMTP_HOST` / `SMTP_PORT` | Servidor de e-mail (sem `SMTP_HOST`, o e-mail é só escrito no terminal) | `localhost` / `1025` |
| `SMTP_USER` / `SMTP_PASS` | Login do servidor de e-mail, se ele exigir | |
| `MAIL_FROM` | Remetente | `Ecofintech <nao-responda@ecofintech.local>` |
| `TRUST_PROXY` | Quantos proxies ficam na frente da API, para o limite de requisições enxergar o IP real (opcional) | `0` em dev, `3` no Render |

### 📬 E-mails em desenvolvimento (Mailpit)

O [Mailpit](https://mailpit.axllent.org) finge ser um servidor de e-mail: tudo o que a API envia aparece numa caixa de entrada local, sem sair para a internet.

```bash
winget install axllent.mailpit   # uma vez
mailpit                          # SMTP na porta 1025, caixa de entrada em http://localhost:8025
```

Em produção, basta apontar `SMTP_*` para um provedor de verdade (Resend, SES...). No Render as portas SMTP padrão (25, 465, 587) são bloqueadas; com o Resend use `smtp.resend.com` na porta `2465`.

---

## 🗄️ Banco de Dados

As **tabelas são escritas em SQL puro** (migrations) e o **código usa o Prisma**, gerado a partir do banco. Assim o banco é a fonte da verdade, e o SQL fica legível para qualquer pessoa, sem precisar conhecer o Prisma.

### Fluxo para mudar o banco

1. Crie uma migration nova em `src/database/migrations/`, numerada em sequência (ex.: `018_create_algo.sql`). **Nunca edite uma que já rodou**: em produção ela não roda de novo.
2. `npm run db:migrate` aplica as pendentes (as já aplicadas ficam registradas na tabela `schema_migrations`). Cada migration roda numa transação: se der erro, nada dela fica aplicado.
3. `npm run db:pull` lê o banco, atualiza `src/database/schema.prisma` e regenera os tipos.

> ⚠️ Não use `prisma migrate` nem edite colunas pelo `schema.prisma`: a fonte da verdade são as migrations SQL.

### Padrão de nomes

Os **nomes do banco são o padrão** em todo o projeto: tabelas e colunas em `snake_case` (`users`, `date_of_birth`), e os mesmos nomes no Prisma (`prisma.users`), nos DTOs e no JSON da API. Não use `@map`/`@@map` para renomear.

### No código

Injete o `PrismaService` (`src/database/prisma.service.ts`) em qualquer service:

```ts
constructor(private readonly prisma: PrismaService) {}

findByEmail(email: string) {
  return this.prisma.users.findUnique({ where: { email } });
}
```

Para operações atômicas (ex.: transferência), use `this.prisma.$transaction(...)`. Para SQL direto, `this.prisma.$queryRaw`.

---

## 🔐 Autenticação e Segurança

### Login com JWT

`POST /auth/login` recebe `email` e `password` e devolve um `access_token`. O front envia esse token em toda requisição, no cabeçalho `Authorization: Bearer <token>`.

- **Toda rota exige token por padrão** (guard global em `src/common/guards/auth.guard.ts`). Para liberar uma rota, use `@Public()`. Hoje são públicas: `GET /`, `POST /users` (cadastro), `POST /auth/login`, `POST /auth/forgot-password` e `POST /auth/reset-password`.
- Para pegar o usuário logado num controller: `@CurrentUser() user: JwtPayload` (`user.sub` é o id).
- `GET /auth/me` devolve os dados do usuário logado.
- No Swagger, clique em **Authorize** e cole o token.

### Sessão

Cada token carrega a **versão** (`ver`) dos tokens do usuário no momento do login; a versão atual fica em `users.token_version`. O guard compara as duas a cada requisição. Incrementam a versão, **derrubando todas as sessões abertas**:

- trocar a senha (`PATCH /users/:id/password`);
- `POST /auth/logout`;
- ter a conta desativada.

Nesses casos, e também com token expirado ou inválido, a API responde **401 "Sessão expirada. Faça login novamente."**. O front, ao receber 401, apaga o token e volta para o login. Login de conta desativada responde `403 Conta desativada`.

### Esqueci minha senha

`POST /auth/forgot-password` envia um link de **uso único, válido por 30 minutos**, e responde a mesma coisa exista ou não o e-mail (assim ninguém descobre quem tem conta). `POST /auth/reset-password` troca a senha com o token do link e encerra todas as sessões. No banco fica só o **hash SHA-256** do token (tabela `password_reset_tokens`): quem ler o banco não consegue usar o link.

### 🛑 Limite de requisições

Para dificultar ataques de força bruta (`@nestjs/throttler`, guard global em `src/app.module.ts`):

- Cada IP pode fazer até **100 requisições por minuto** em qualquer rota.
- As rotas públicas sensíveis (login, cadastro, esqueci e redefinir senha) usam `@AuthThrottle()`: **5 por minuto**.
- Quem passa do limite recebe **429 "Muitas tentativas. Aguarde um minuto e tente de novo."**

A contagem fica na memória do processo: se a API rodar em várias instâncias, cada uma conta separado.

### CORS

Só os endereços listados em `CORS_ORIGINS` podem chamar a API pelo navegador. Isso impede que um site qualquer use a sessão de alguém para chamar a API. Em desenvolvimento: `http://localhost:5173` (Vite). Em produção: o domínio do front.

---

## 👥 Usuários, Perfis e Desativação

### Cadastro

`POST /users` exige `name`, `email`, `date_of_birth`, `cpf`, `phone` e `password`. CPF e telefone aceitam pontuação e são salvos só com dígitos. O CPF é validado pelos dígitos verificadores, é único e **não pode ser alterado** depois.

### Perfis (roles)

Cada usuário tem um `role`: `user` (padrão) ou `admin`. Para restringir uma rota, use `@Roles('admin')`. O `RolesGuard` lê o perfil **do banco** a cada requisição, então promover ou rebaixar alguém vale na hora.

Ninguém vira admin pela API (o campo `role` é recusado no cadastro e na edição). Para promover, rode no banco:

```sql
UPDATE users SET role = 'admin' WHERE email = 'fulano@email.com';
```

Rotas exclusivas de admin: `GET /users`, `DELETE /users/:id`, `POST /transactions/deposit`, `POST /transactions/:id/reverse`, `GET /transactions/all` e a avaliação de desativações (`GET /deactivation-requests`, `PATCH .../approve`, `PATCH .../reject`).

`GET`, `PATCH /users/:id` e `PATCH /users/:id/password` só funcionam no próprio usuário; caso contrário, `403`.

### Desativação de conta

1. O usuário pede: `POST /deactivation-requests` (motivo opcional). Resposta `202`: **"Sua solicitação foi recebida. O suporte avaliará a solicitação."** Só pode haver uma pendente por vez (`409`).
2. O usuário acompanha em `GET /deactivation-requests/me` (`pending`, `approved` ou `rejected`).
3. O admin vê a fila em `GET /deactivation-requests?status=pending` e decide:
   - `PATCH /deactivation-requests/:id/approve`: **exige saldo zerado** (`409` caso contrário). A conta fica `deactivated`: as sessões caem, o login passa a responder `403`, ela não recebe transferências (`422`) e o histórico é mantido.
   - `PATCH /deactivation-requests/:id/reject`: a conta continua ativa e o usuário pode pedir de novo.

Cada decisão registra quem avaliou (`reviewed_by`), quando e a observação. Quem é **dono de uma empresa ativa** não pode pedir a desativação da conta pessoal (`422`), porque a empresa ficaria sem dono.

---

## 🏢 Contas de Empresa

O login é sempre da **pessoa**. Com ele, a pessoa opera a conta pessoal e as contas das empresas (CNPJ) das quais participa.

- **Abrir:** `POST /companies` (`cnpj`, `legal_name` = razão social, `trade_name` = nome fantasia). Quem abre vira o **dono**, e a conta da empresa é criada na hora. CNPJ validado e único (`409` se já cadastrado).
- **Conta ativa:** o front envia o cabeçalho `X-Account-Id` com o id da conta escolhida. Sem ele, vale a conta pessoal. `GET /accounts/me`, `GET /transactions`, `GET /transactions/summary`, `GET /transactions/:id` e `POST /transactions/transfer` usam a conta ativa. O acesso é conferido **a cada requisição**: quem sai ou é removido de uma empresa perde o acesso na hora (`403` "Sem acesso a esta conta").
- **Minhas contas:** `GET /accounts` lista a pessoal e as empresas (com o papel), para a tela de escolha de conta.
- **Papéis:** `owner` (um por empresa) e `member`. Todo membro movimenta a conta; só o dono convida, cancela convites e remove membros.
- **Convites (dono):** `POST /companies/:id/invites` (por `email` ou `cpf` de quem já tem conta), `DELETE /companies/:id/invites/:inviteId`, `DELETE /companies/:id/members/:userId`. `GET /companies/:id/members` mostra os membros (e, para o dono, os convites pendentes).
- **Convites (convidado):** `GET /invites`, `POST /invites/:id/accept`, `POST /invites/:id/decline`. Membro sai com `POST /companies/:id/leave` (o dono não pode sair).
- **Auditoria:** abrir empresa, convidar, cancelar, entrar, remover e sair ficam em `audit_logs` (`company.*`).

Tabelas: `companies`, `company_members` (um único `owner` por empresa, garantido por índice), `company_invites` (um convite pendente por pessoa em cada empresa) e `accounts`, que pertence a uma pessoa (`user_id`) **ou** a uma empresa (`company_id`).

---

## 💰 Saldo e Movimentações

```
users 1───1 accounts (balance) 1───N transactions
```

- **Conta:** criada automaticamente no cadastro, com saldo 0. `GET /accounts/me` devolve o saldo.
- **Movimentações** (`transactions`): cada linha é um lançamento em uma conta, com `type` (`entrada` | `saida`), `category` (`deposito` | `transferencia` | `estorno`), `amount` e `balance_after` (saldo logo após o lançamento).

### Rotas

| Rota | Quem | O que faz |
|---|---|---|
| `POST /transactions/deposit` | admin | Dinheiro entrando de fora. Gera uma `entrada`. |
| `POST /transactions/transfer` | todos | Da conta ativa para outra, por `to_email` ou `to_cpf` (pessoa) **ou** `to_cnpj` (empresa), exatamente um. Gera uma `saida` na origem e uma `entrada` no destino. |
| `POST /transactions/:id/reverse` | admin | Estorno: lança o movimento inverso com `category: "estorno"` e `reversal_of` apontando para o original. |
| `GET /transactions` | todos | Extrato da conta ativa (`limit`/`offset`). |
| `GET /transactions/:id` | todos | Um lançamento. |
| `GET /transactions/summary?days=7\|30\|90` | todos | Dados do dashboard: totais de entradas, saídas e resultado, série por dia (ou por semana em 90 dias) e totais por categoria. Os dias seguem o horário de Brasília. |
| `GET /transactions/all` | admin | Todos os lançamentos do sistema, com o dono da conta em `owner`. Filtros: `search` (nome, e-mail ou CPF), `category`, `type`, `from`/`to` (`AAAA-MM-DD`, horário de Brasília). |

Detalhes:

- Cada lançamento traz `counterparty` (`{ name, email, kind }`; `kind` é `person` ou `company`, e empresa aparece pelo nome fantasia com `email` nulo) e `operator`: o nome de quem fez a operação, preenchido só em transferências **enviadas pela conta de uma empresa** ("feita por Maria").
- Depósito e transferência para conta desativada são recusados (`422`).
- Estornar qualquer ponta de uma transferência desfaz as duas. Cada lançamento só pode ser estornado uma vez (`409`), estorno não se estorna (`422`) e é preciso saldo na conta que devolve (`422`).
- **Valores:** `NUMERIC(15,2)` no banco. Na API, entram como número (máx. 2 casas, de 0,01 a 1.000.000 por operação) e saem como texto (`"200.00"`), para nenhum centavo se perder em arredondamento.

### 🛡️ Garantias

- **Tudo ou nada:** saldo e lançamentos são gravados na mesma transação do banco.
- **Sem saldo negativo:** o débito só acontece se houver saldo (`422 Saldo insuficiente`), e o banco tem `CHECK (balance >= 0)` como segunda barreira. Transferências simultâneas nunca deixam o saldo negativo.
- **Sem travamento:** as duas contas de uma transferência são travadas sempre na mesma ordem (por id), evitando *deadlock* (duas operações cruzadas, A→B e B→A, esperando uma pela outra para sempre).
- **Idempotência:** depósito e transferência exigem o cabeçalho `Idempotency-Key` (UUID). O front gera um UUID novo por operação e, se precisar reenviar (ex.: a resposta não chegou), manda **a mesma chave**: a API devolve o lançamento original com o cabeçalho `Idempotent-Replayed: true`, sem mover o dinheiro de novo. A mesma chave com dados diferentes é recusada (`422`), e uma operação que falhou não consome a chave. As chaves valem **24 horas**: o `IdempotencyCleanupService` apaga as vencidas todo dia às 3h (UTC) e sempre que a API liga (no Render gratuito ela dorme e pode perder o horário).
- **Auditoria:** cada lançamento guarda quem o executou (`created_by`: o admin no depósito e no estorno, o remetente na transferência) e um `operation_id` comum às pontas da mesma operação. Remoções de usuário ficam em `audit_logs`.
- **Imutável:** não existem rotas para editar ou apagar lançamentos. Um usuário com movimentações não pode ser removido (`409`); para encerrar a conta, use a desativação.

O saldo deve **sempre bater com o extrato**. Para conferir no banco:

```sql
SELECT a.id, a.balance,
       COALESCE(SUM(CASE t.type WHEN 'entrada' THEN t.amount ELSE -t.amount END), 0) AS soma_extrato
FROM accounts a LEFT JOIN transactions t ON t.account_id = a.id
GROUP BY a.id, a.balance;
```

---

## 📖 Documentação da API

Com a API rodando:

- **Swagger UI:** http://localhost:3000/docs (em produção: [ecofintech-api.onrender.com/docs](https://ecofintech-api.onrender.com/docs)). Lista todas as rotas, parâmetros e respostas, e permite testar.
- **OpenAPI JSON:** http://localhost:3000/docs-json. Serve para importar no Postman (*Import → Link*) e é de onde o front gera os seus tipos.

**Postman:** a collection com todas as requests, organizadas por pasta e com testes, fica em `docs/postman/ecofintech-api.postman_collection.json`. Importe no Postman (*Import* → arraste o arquivo) e rode **Users → Criar usuário** primeiro: ele salva o id na variável `user_id`, usada pelas outras requests.

A documentação é gerada a partir do código: o plugin `@nestjs/swagger` (em `nest-cli.json`) lê os DTOs e os comentários JSDoc. Para detalhar uma rota, use decorators como `@ApiTags`, `@ApiOperation` e `@ApiOkResponse` (veja `src/app.controller.ts`).

---

## ☁️ Deploy (Render + Neon)

| Configuração (Render) | Valor |
|---|---|
| **Root Directory** | `api` |
| **Build Command** | `npm ci --include=dev && npm run build && npm run db:migrate` |
| **Start Command** | `npm run start:prod` |
| **Health Check Path** | `/` |

- O `--include=dev` é necessário porque, com `NODE_ENV=production`, o `npm ci` pula as devDependencies, e a CLI do Nest (`nest build`) está nelas.
- As migrations rodam **a cada deploy** no banco de produção (as já aplicadas são puladas). Por isso: teste toda migration localmente antes de mandar para o `main`.
- `DATABASE_URL` do Neon com `sslmode=verify-full` (confere o certificado do servidor). O banco precisa estar em UTC.
- Variáveis de produção: as da tabela acima, com `NODE_ENV=production`, `TRUST_PROXY=3` (no Render a requisição passa pela Cloudflare, por um balanceador e por um proxy interno), `CORS_ORIGINS`/`APP_URL` com o endereço do front e, para e-mails de verdade, `SMTP_*` do Resend (porta `2465`).

---

## 🧪 Testes e Qualidade

```bash
npm test               # testes unitários (Vitest)
npm run test:e2e       # testes end-to-end
npm run test:cov       # cobertura
npm run lint           # oxlint
npm run format         # prettier
```

---

## 📂 Estrutura de Pastas

```
api/
├── src/
│   ├── modules/                  # Domínios de negócio (um módulo do Nest cada)
│   │   ├── accounts/             # Contas, saldo e conta ativa (X-Account-Id)
│   │   ├── auth/                 # Login, logout, esqueci/redefinir senha
│   │   ├── companies/            # Contas de empresa, membros e convites (dono)
│   │   ├── deactivation-requests/# Pedidos de encerramento de conta
│   │   ├── invites/              # Convites do lado de quem foi convidado
│   │   ├── mail/                 # Envio de e-mails (SMTP)
│   │   ├── transactions/         # Depósito, transferência, estorno, extrato, resumo
│   │   └── users/                # Cadastro e perfil
│   ├── common/                   # Peças compartilhadas
│   │   ├── decorators/           # @Public(), @Roles(), @CurrentUser(), @ActiveAccount(),
│   │   │                         # @IdempotencyKey(), @AuthThrottle()
│   │   ├── guards/               # AuthGuard (token) e RolesGuard (perfil)
│   │   ├── utils/                # Hash de senha (scrypt)
│   │   └── validators/           # Validação de CPF e CNPJ (dígitos verificadores)
│   ├── config/                   # Validação das variáveis de ambiente
│   ├── database/                 # Tudo do banco
│   │   ├── migrations/           # Migrations em SQL puro (001_..., 002_...)
│   │   ├── migrate.ts            # Script que aplica as migrations pendentes
│   │   ├── schema.prisma         # Gerado por `npm run db:pull` (não editar à mão)
│   │   └── prisma.service.ts     # Cliente do banco para injetar nos services
│   ├── app.module.ts             # Junta todos os módulos e guards globais
│   └── main.ts                   # Ponto de entrada: CORS, validação, Swagger
├── test/                         # Testes end-to-end
└── docs/
    ├── postman/                  # Collection do Postman
    ├── specs/                    # Especificações das funcionalidades
    └── plans/                    # Planos de implementação
```

---

## 👤 Autor

Desenvolvido por **Lucas Assmann**.

---
