# Contas de empresa (CNPJ) — especificação

**Data:** 2026-10-13
**Repositórios:** `ecofintech-api` e `ecofintech-web`
**Fora deste documento:** transferências agendadas e recorrentes (próximo subprojeto, com especificação própria).

## 1. Objetivo

Permitir que uma pessoa, com o seu login pessoal (CPF), opere também contas de empresa (CNPJ).
Uma empresa tem um dono, que convida outras pessoas já cadastradas para participar.
Ao entrar, quem tem empresa escolhe com qual conta vai operar.

### Decisões tomadas

| Tema | Decisão |
|---|---|
| Login | Sempre da pessoa. Empresa não tem login próprio. |
| Abertura de empresa | Na hora, sem aprovação do admin. CNPJ validado (dígitos verificadores) e único no sistema. |
| Empresas por pessoa | Sem limite. |
| Papéis | `owner` (dono, exatamente um por empresa) e `member`. |
| O que o membro pode fazer | Tudo que movimenta a conta (ver saldo, extrato, dashboard, transferir). Só o dono convida, cancela convites e remove membros. |
| Convite | Por e-mail ou CPF de quem já tem cadastro. O convidado aceita ou recusa no app. |
| Quem fez a operação | Lançamentos de saída da conta da empresa mostram a pessoa que fez ("feita por Maria"). Quem recebe vê a empresa (nome fantasia). |
| Pagar uma empresa | Pelo CNPJ. Pagar uma pessoa continua por e-mail ou CPF. |
| Conta ativa na API | Cabeçalho `X-Account-Id` em cada requisição; sem ele, a conta pessoal. Acesso conferido a cada requisição. |

### Fora do escopo (v1)

- Transferir a posse da empresa para outra pessoa.
- Encerrar/desativar a conta da empresa (a coluna `status` existe, mas nenhuma rota a altera nesta versão).
- Permissões diferentes entre membros além de dono/membro.
- Convidar quem ainda não tem cadastro.
- Aprovação de empresas pelo admin.

## 2. Banco de dados

Migrations novas em `src/database/migrations` (SQL puro, depois `npm run db:pull`):

### 014 — `companies`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | UUID | PK, `gen_random_uuid()` |
| `cnpj` | `CHAR(14)` | `UNIQUE`, `CHECK (cnpj ~ '^[0-9]{14}$')` |
| `legal_name` | TEXT | razão social, obrigatória |
| `trade_name` | TEXT | nome fantasia, obrigatório |
| `status` | enum `company_status` (`active`, `deactivated`) | padrão `active` |
| `created_by` | UUID → `users(id)` | quem abriu |
| `created_at`, `updated_at` | TIMESTAMPTZ | padrão `now()` |

### 014 — `company_members`

| Coluna | Tipo | Regras |
|---|---|---|
| `company_id` | UUID → `companies(id)` `ON DELETE CASCADE` | |
| `user_id` | UUID → `users(id)` `ON DELETE CASCADE` | |
| `role` | enum `company_role` (`owner`, `member`) | |
| `created_at` | TIMESTAMPTZ | |

- `PRIMARY KEY (company_id, user_id)` — a mesma pessoa não entra duas vezes.
- `CREATE UNIQUE INDEX ... ON company_members (company_id) WHERE role = 'owner'` — um único dono.
- Índice em `user_id` (listar as empresas de uma pessoa).

### 014 — `company_invites`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | UUID | PK |
| `company_id` | UUID → `companies(id)` `ON DELETE CASCADE` | |
| `invited_user_id` | UUID → `users(id)` `ON DELETE CASCADE` | |
| `invited_by` | UUID → `users(id)` | |
| `status` | enum `company_invite_status` (`pending`, `accepted`, `declined`, `canceled`) | padrão `pending` |
| `created_at` | TIMESTAMPTZ | |
| `responded_at` | TIMESTAMPTZ NULL | quando aceitou, recusou ou foi cancelado |

- `CREATE UNIQUE INDEX ... ON company_invites (company_id, invited_user_id) WHERE status = 'pending'`.

### 015 — `accounts` passa a aceitar empresa

```sql
ALTER TABLE accounts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE accounts ADD COLUMN company_id UUID UNIQUE REFERENCES companies(id) ON DELETE RESTRICT;
ALTER TABLE accounts ADD CONSTRAINT accounts_owner_check
  CHECK (num_nonnulls(user_id, company_id) = 1);
```

Contas existentes continuam válidas (todas têm `user_id`). `user_id` continua `UNIQUE` (uma conta pessoal por pessoa).

`transactions` não muda: `created_by` já registra quem fez cada lançamento.

## 3. API

### 3.1 Conta ativa

- O front envia `X-Account-Id: <uuid>` em toda requisição autenticada. Ausente → conta pessoal do usuário.
- Um serviço `AccountAccessService.resolve(user_id, header)` devolve a conta ativa:
  `{ account_id, kind: 'personal' | 'company', company_id?, role? }`.
- Acesso permitido se: a conta é a pessoal do usuário **ou** a conta é de uma empresa `active` em que o usuário está em `company_members`.
- Caso contrário: **403** `"Sem acesso a esta conta"`. Header que não é UUID: **400**.
- Um decorator `@ActiveAccount()` entrega o resultado aos controllers (mesmo padrão do `@CurrentUser()`).
- A checagem acontece a cada requisição (não fica no token): remover um membro corta o acesso imediatamente.

### 3.2 Rotas novas

| Rota | Quem | Resposta / regras |
|---|---|---|
| `GET /accounts` | logado | Lista as contas operáveis: `[{ id, kind, name, document, balance, role, company_id }]`. Pessoal primeiro, depois empresas por nome. `name` = nome da pessoa ou nome fantasia; `document` = CPF ou CNPJ; `role` só em empresas. |
| `POST /companies` | logado | Body `{ cnpj, legal_name, trade_name }`. Cria empresa + membro `owner` + conta, numa transação. 400 CNPJ inválido, 409 CNPJ já cadastrado. Devolve a conta criada (formato do `GET /accounts`). |
| `GET /companies/:id/members` | membros | `{ members: [{ user_id, name, email, role, created_at }], invites: [{ id, invited_user: { name, email }, created_at }] }`. `invites` (pendentes) só vem preenchido para o dono; para membros é `[]`. |
| `POST /companies/:id/invites` | dono | Body `{ email }` ou `{ cpf }` (exatamente um). 404 usuário não encontrado, 409 já é membro ou já tem convite pendente, 422 convidar a si mesmo. |
| `DELETE /companies/:id/invites/:inviteId` | dono | Muda para `canceled`. 404 se não estiver pendente. |
| `DELETE /companies/:id/members/:userId` | dono | Remove o membro. 422 se for o próprio dono. |
| `POST /companies/:id/leave` | membro | Sai da empresa. 422 se for o dono. |
| `GET /invites` | logado | Convites pendentes do usuário: `[{ id, company: { id, trade_name, cnpj }, invited_by: { name }, created_at }]`. |
| `POST /invites/:id/accept` | convidado | Cria o membro `member` e marca `accepted` numa transação. 404 se não for dele ou não estiver pendente. |
| `POST /invites/:id/decline` | convidado | Marca `declined`. 404 nas mesmas condições. |

Ações de membros e convites registram em `audit_logs` (`company.create`, `company.invite`, `company.invite_cancel`, `company.member_join`, `company.member_remove`, `company.member_leave`).

### 3.3 Rotas existentes que mudam

- `GET /accounts/me`, `GET /transactions`, `GET /transactions/summary`, `GET /transactions/:id`, `POST /transactions/transfer`: usam a **conta ativa** em vez da conta pessoal. `GET /transactions/:id` para não-admin: só lançamentos da conta ativa.
- `POST /transactions/transfer` e `POST /transactions/deposit`: destinatário por `to_email`, `to_cpf` **ou** `to_cnpj` (exatamente um). Destino de empresa precisa estar `active`. A chave de idempotência continua por usuário.
- `Counterparty` passa a ser `{ name, email: string | null, kind: 'person' | 'company' }` (empresa: nome fantasia, `email` nulo).
- `Transaction` ganha `operator: { name } | null`: preenchido só em lançamentos de **saída** de **contas de empresa** (quem da empresa fez a operação, vindo de `created_by`).
- `AdminTransaction.owner` usa o mesmo formato de `Counterparty`. Busca (`search`) também procura no CNPJ e no nome fantasia.
- `POST /deactivation-requests`: **422** se o usuário é dono de alguma empresa `active` ("Você é dono da empresa X. Ela não pode ficar sem dono.").

## 4. Front

- **Conta ativa:** guardada em `sessionStorage` (`ecofintech.account`). O middleware do `openapi-fetch` envia `X-Account-Id`. Ao trocar de conta, o cache do TanStack Query é limpo (exceto `auth/me`) para nada de uma conta aparecer na outra.
- **403 "Sem acesso a esta conta"** com uma empresa ativa: volta para a conta pessoal e mostra um aviso.
- **`/contas` (escolha de conta):** aberta logo após o login quando o usuário tem empresa ou convite pendente; senão vai direto para `/`. Cartões com nome, documento, papel e saldo; convites pendentes com Aceitar/Recusar; botão "Abrir conta de empresa".
- **Cabeçalho:** seletor da conta ativa com selo Pessoal/Empresa (trocar de conta, abrir empresa, gerenciar empresa) e sininho com o número de convites. Com empresa ativa, faixa no topo: "Você está operando como {nome fantasia}".
- **`/empresa/nova`:** CNPJ (máscara + validação), razão social, nome fantasia. Ao criar, a nova empresa vira a conta ativa.
- **`/empresa`:** membros e papéis. Dono: convidar (e-mail ou CPF), convites pendentes com cancelar, remover membro. Membro: "Sair da empresa".
- **Transferir:** abas E-mail / CPF / CNPJ; confirmação mostra "De: {conta ativa}".
- **Extrato e dashboard:** mesma tela, dados da conta ativa; lançamentos com `operator` mostram "feita por {nome}".
- **Admin › Lançamentos:** dono da conta pode ser empresa; mostra quem fez a operação.
- Tudo com tema claro/escuro (`dark:`), cursor pointer em botões e layout largo.

## 5. Erros

| Situação | Resposta |
|---|---|
| Conta ativa sem acesso | 403 "Sem acesso a esta conta" |
| `X-Account-Id` não é UUID | 400 |
| CNPJ inválido / já cadastrado | 400 / 409 |
| Convidar membro existente ou com convite pendente | 409 |
| Convidar quem não tem cadastro | 404 "Usuário não encontrado" |
| Convidar a si mesmo | 422 |
| Não-dono convidando, cancelando ou removendo | 403 |
| Dono saindo ou removendo a si mesmo | 422 |
| Aceitar/recusar convite que não é seu ou não está pendente | 404 |
| Dono de empresa ativa pedindo desativação da conta pessoal | 422 |
| Transferir para empresa desativada | 422 "Conta de destino desativada" |

## 6. Testes e validação

- **Unitários (API):** `AccountAccessService` (pessoal, membro, ex-membro, estranho, empresa desativada, header inválido); validador de CNPJ; criação de empresa (transação, 409); convites (só dono, duplicado, aceitar cria membro, recusar, cancelar); remover/sair (dono bloqueado); transferência por CNPJ e `operator` só em saídas de empresa; bloqueio da desativação do dono.
- **Unitários (web):** máscara/validação de CNPJ; middleware envia `X-Account-Id`.
- **API real:** Maria abre a Padaria → convida João → João aceita e transfere pela empresa → extrato da empresa mostra "feita por João" → Maria remove João → próxima requisição dele com a empresa dá 403.
- **Navegador:** o mesmo roteiro pela interface, temas claro e escuro, largura no celular (390px) e cursor pointer.
- Postman e README atualizados.

## 7. Etapas de entrega

Cada etapa termina com o sistema funcionando e testado:

1. **Banco e conta ativa:** migrations 014/015, `AccountAccessService`, `@ActiveAccount()`, rotas existentes usando a conta ativa, `GET /accounts`.
2. **Empresas e convites (API):** rotas da seção 3.2, auditoria, bloqueio de desativação do dono.
3. **Front de contas:** `/contas`, seletor no cabeçalho, faixa de empresa, `/empresa/nova`, `/empresa`, convites.
4. **Transferência e exibição:** `to_cnpj`, `Counterparty` com `kind`, `operator` ("feita por"), aba CNPJ, admin.
