# Contas de empresa (CNPJ) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma pessoa, com o seu login, opera a conta pessoal e contas de empresa (CNPJ) das quais é dona ou membro, com convites, conta ativa por requisição e "feita por" nos lançamentos.

**Architecture:** Tabelas `companies`, `company_members`, `company_invites`; `accounts` passa a ter `user_id` OU `company_id`. A conta ativa vem do cabeçalho `X-Account-Id`, resolvida por um pipe injetável (`ResolveActiveAccountPipe`) usado pelo decorator `@ActiveAccount()`, conferindo acesso a cada requisição. No front, um `AccountProvider` guarda a conta ativa e um middleware do `openapi-fetch` envia o cabeçalho.

**Tech Stack:** NestJS 12, Prisma 7.10 (client via `db pull`), PostgreSQL 18, Vitest; React 19, Vite 8, Tailwind 4, TanStack Query 5, react-hook-form + zod, openapi-fetch.

**Spec:** `docs/specs/2026-10-13-contas-de-empresa-design.md` (ler junto com este plano).

## Global Constraints

- Banco: SQL puro em `src/database/migrations/NNN_*.sql`, aplicar com `npm run db:migrate`, gerar client com `npm run db:pull`. Nunca `prisma migrate` nem `@map`.
- Nomes do banco (snake_case) em tudo: Prisma, DTOs, JSON da API.
- Mensagens de erro e textos de tela em português.
- Módulos novos com a CLI do Nest (`npx nest g resource modules/<nome> --no-spec`), dentro de `src/modules`.
- Nenhuma dependência nova.
- Toda rota nova entra na collection `docs/postman/ecofintech-api.postman_collection.json` e no README.
- Front: toda classe de cor com par `dark:`; botões com cursor pointer (regra global já existe); layout largo (container 1680px); sem rolagem horizontal em 390px.
- Tipos do front regenerados com `npm run api:types` (API rodando) sempre que a API mudar.
- Commits com o rodapé `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Mesma `Idempotency-Key` em contas diferentes:** um membro que reaproveita a chave na conta da empresa e na pessoal deve receber 422, nunca o resultado da outra conta. → Teste na Task 3.
2. **Membro removido com a empresa ainda selecionada** (outra aba, sessão antiga): a próxima requisição dá 403 e o front volta para a conta pessoal com aviso, sem tela quebrada. → Testes nas Tasks 2 e 9.
3. **CNPJ com pontuação, espaços e zeros à esquerda** (`" 00.000.000/0001-91 "`): aceito e gravado como `00000000000191`. → Teste na Task 1.
4. **Transferir entre as próprias contas** (empresa → CPF do próprio dono e vice-versa): permitido; só a mesma conta de origem e destino é bloqueada. → Teste na Task 12.
5. **Convidar usuário desativado:** 422 "Usuário desativado", sem criar convite. → Teste na Task 6.

---

## Etapa 1 — Banco e conta ativa

### Task 1: Migrations e validador de CNPJ

**Files:**
- Create: `src/database/migrations/014_create_companies.sql`, `src/database/migrations/015_accounts_company.sql`
- Create: `src/common/validators/cnpj.ts`, `src/common/validators/cnpj.spec.ts`
- Modify: `src/database/schema.prisma` (gerado por `db:pull`)

**Interfaces:**
- Produces: `isValidCnpj(value: string): boolean`, decorator `IsCnpj(options?)`; tabelas `companies`, `company_members`, `company_invites` e enums `company_status`, `company_role`, `company_invite_status` exatamente como na seção 2 da spec; `accounts.company_id`.

- [ ] **Step 1: Testes do validador** em `cnpj.spec.ts`: `isValidCnpj('11222333000181')` e `isValidCnpj('00000000000191')` → `true`; `'11222333000182'` (verificador errado), `'11111111111111'` (repetido), `'1122233300018'` (13 dígitos), `'11.222.333/0001-81'` (com pontuação, o validador recebe só dígitos) → `false`. Teste de DTO: classe com `@OnlyDigits() @IsCnpj() cnpj` validada com `" 00.000.000/0001-91 "` passa e o valor final é `'00000000000191'`.
- [ ] **Step 2:** `npx vitest run src/common/validators/cnpj.spec.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar em `cnpj.ts` no mesmo estilo de `cpf.ts` (pesos `5,4,3,2,9,8,7,6,5,4,3,2` e `6,5,4,3,2,9,8,7,6,5,4,3,2`). `OnlyDigits` precisa também remover espaços (já remove: `\D`).
- [ ] **Step 4:** Mesmo comando → PASS.
- [ ] **Step 5:** Escrever as migrations 014 (três tabelas, enums, índices únicos parciais `company_members(company_id) WHERE role='owner'` e `company_invites(company_id, invited_user_id) WHERE status='pending'`, índice em `company_members(user_id)`) e 015 (SQL da seção 2 da spec). Comentários em português explicando cada regra, como nas migrations existentes.
- [ ] **Step 6:** `npm run db:migrate` → `✔ 014_...` e `✔ 015_...`; `npm run db:pull` → client gerado; `npx tsc --noEmit -p tsconfig.json` mostra os erros esperados de `accounts.user_id` agora opcional (corrigidos na Task 3) — anotar a lista.
- [ ] **Step 7: Commit** `feat(database): companies, members, invites and company accounts`

### Task 2: Conta ativa (`AccountAccessService` + `@ActiveAccount()`)

**Files:**
- Create: `src/modules/accounts/account-access.service.ts`, `src/modules/accounts/account-access.service.spec.ts`
- Create: `src/common/decorators/active-account.decorator.ts` (decorator + pipe)
- Modify: `src/modules/accounts/accounts.module.ts` (provider + export)

**Interfaces:**
- Produces:
  ```ts
  export interface ActiveAccountContext {
    account_id: string;
    kind: 'personal' | 'company';
    company_id: string | null;
    role: company_role | null; // null na conta pessoal
  }
  // AccountAccessService
  resolve(user_id: string, header: string | undefined): Promise<ActiveAccountContext>
  // decorator de parâmetro: lê request.user.sub e request.headers['x-account-id']
  export const ActiveAccount = (): ParameterDecorator
  ```
  `ActiveAccount()` = `createParamDecorator` que devolve `{ user_id, header }` aplicado com `ResolveActiveAccountPipe` (classe `@Injectable()` que injeta `AccountAccessService` e chama `resolve`). `AccountsModule` exporta `AccountAccessService`; módulos que usam o decorator importam `AccountsModule`.

- [ ] **Step 1: Testes** em `account-access.service.spec.ts` (Prisma mockado):
  - sem header → `{ kind: 'personal', account_id: <conta pessoal>, company_id: null, role: null }`;
  - header = id da própria conta pessoal → mesmo resultado;
  - header = conta de empresa `active` onde é `member` → `{ kind: 'company', company_id, role: 'member' }`;
  - conta de empresa onde não é membro (inclui ex-membro removido) → `ForbiddenException` com mensagem `'Sem acesso a esta conta'`;
  - conta de empresa `deactivated` → `ForbiddenException` com a mesma mensagem;
  - header `'abc'` → `BadRequestException`;
  - conta inexistente → `ForbiddenException` (não revela se existe).
- [ ] **Step 2:** `npx vitest run src/modules/accounts/account-access.service.spec.ts` → FAIL.
- [ ] **Step 3:** Implementar `resolve` com uma consulta a `accounts` (por `id` do header, ou por `user_id` sem header) trazendo `user_id`, `company_id`, `companies.status` e o `company_members` do usuário; validar UUID com `isUUID` do class-validator.
- [ ] **Step 4:** Mesmo comando → PASS.
- [ ] **Step 5: Commit** `feat(accounts): resolve active account from X-Account-Id`

### Task 3: Rotas existentes usam a conta ativa

**Files:**
- Modify: `src/modules/accounts/accounts.service.ts`, `accounts.controller.ts`
- Modify: `src/modules/transactions/transactions.controller.ts`, `transactions.service.ts`, `transactions.service.spec.ts`, `transactions.module.ts`
- Modify: `src/modules/users/users.service.ts` (criação de usuário continua criando a conta pessoal — conferir tipos)

**Interfaces:**
- Consumes: `@ActiveAccount()`, `ActiveAccountContext` (Task 2).
- Produces (assinaturas novas do `TransactionsService`):
  ```ts
  transfer(user_id: string, from_account_id: string, key: string, dto: TransferDto): Promise<OperationResult>
  findAll(account_id: string, query: ListTransactionsQueryDto): Promise<Transaction[]>
  summary(account_id: string, query: SummaryQueryDto): Promise<TransactionSummary>
  findOne(user_id: string, account_id: string, id: string): Promise<Transaction>
  ```
  `AccountsService.findById(account_id: string): Promise<Account>` (substitui `findByUser` na rota `/accounts/me`).
  Todas as rotas acima documentam o cabeçalho no Swagger com `@ApiHeader({ name: 'X-Account-Id', required: false, description: 'Conta ativa (sem ele: conta pessoal)' })`, agrupado num decorator `ApiActiveAccount()` em `active-account.decorator.ts`.

- [ ] **Step 1: Ajustar testes existentes** de `transactions.service.spec.ts` para as novas assinaturas e **adicionar**:
  - `transfer` debita `from_account_id` recebido (não procura a conta do usuário);
  - idempotência entre contas: mesma chave, mesmo `dto`, `from_account_id` diferente → `UnprocessableEntityException` (o hash da requisição inclui `from_account_id`);
  - `findOne` de não-admin filtra por `account_id` recebido.
- [ ] **Step 2:** `npx vitest run src/modules/transactions` → FAIL.
- [ ] **Step 3:** Implementar: controllers passam `account.account_id`; `runIdempotent` recebe `{ ...dto, from_account_id }` como payload; remover usos de `findAccountIdByUser` onde a conta ativa substitui.
- [ ] **Step 4:** `npm test` → todos PASS; `npx tsc --noEmit -p tsconfig.json` sem erros; `npm run lint` sem avisos.
- [ ] **Step 5: Verificação real:** com a API rodando, `GET /accounts/me` e `GET /transactions/summary` sem header respondem como antes (admin123); com `X-Account-Id: <uuid aleatório>` → 403.
- [ ] **Step 6: Commit** `refactor(transactions): operate on the active account`

### Task 4: `GET /accounts`

**Files:**
- Modify: `src/modules/accounts/accounts.controller.ts`, `accounts.service.ts`
- Create: `src/modules/accounts/entities/operable-account.entity.ts`
- Test: `src/modules/accounts/accounts.service.spec.ts` (criar)

**Interfaces:**
- Produces:
  ```ts
  export class OperableAccount {
    id: string;
    kind: 'personal' | 'company';
    name: string;        // nome da pessoa ou nome fantasia
    document: string;    // CPF (11) ou CNPJ (14), só dígitos
    balance: string;     // 2 casas
    role: company_role | null;
    company_id: string | null;
  }
  // AccountsService
  listOperable(user_id: string): Promise<OperableAccount[]>
  ```
- [ ] **Step 1: Teste:** usuário com conta pessoal + empresas "Zeta" (member) e "Alfa" (owner) → `[pessoal, Alfa, Zeta]`, com `role` e `document` corretos; empresa `deactivated` não aparece.
- [ ] **Step 2:** `npx vitest run src/modules/accounts` → FAIL.
- [ ] **Step 3:** Implementar com duas consultas (conta pessoal; `company_members` do usuário com `companies` ativas e suas `accounts`), ordenar empresas por `trade_name` com `localeCompare('pt-BR')`.
- [ ] **Step 4:** Mesmo comando → PASS; `npm run lint` limpo.
- [ ] **Step 5:** Postman: request "Minhas contas" na pasta Accounts com teste de status 200 e `kind` da primeira = `personal`.
- [ ] **Step 6: Commit** `feat(accounts): list operable accounts`

---

## Etapa 2 — Empresas e convites (API)

### Task 5: Abrir empresa — `POST /companies`

**Files:**
- Create (CLI): `npx nest g resource modules/companies --no-spec` (REST, sem CRUD gerado: apagar métodos/DTOs que não serão usados)
- Create: `src/modules/companies/dto/create-company.dto.ts`, `src/modules/companies/companies.service.spec.ts`
- Modify: `src/modules/companies/companies.module.ts` (importa `AccountsModule`)

**Interfaces:**
- Consumes: `IsCnpj`, `OnlyDigits` (Task 1); `OperableAccount`, `AccountsService.listOperable` (Task 4).
- Produces: `CreateCompanyDto { cnpj: string; legal_name: string; trade_name: string }` (`legal_name`/`trade_name`: `@IsString() @MinLength(2) @MaxLength(120)` com `trim`); `CompaniesService.create(user_id: string, dto: CreateCompanyDto): Promise<OperableAccount>`; helper interno `assertOwner(user_id, company_id)` lançando `ForbiddenException('Só o dono da empresa pode fazer isso')`, usado pelas Tasks 6.

- [ ] **Step 1: Testes:** cria empresa, membro `owner`, conta e `audit_logs` `company.create` dentro de `$transaction`; devolve `OperableAccount` com `role: 'owner'`; CNPJ duplicado (P2002) → `ConflictException('Este CNPJ já está cadastrado')`.
- [ ] **Step 2:** `npx vitest run src/modules/companies` → FAIL.
- [ ] **Step 3:** Implementar service + `POST /companies` (201) com Swagger (`@ApiCreatedResponse({ type: OperableAccount })`, 400, 409).
- [ ] **Step 4:** Mesmo comando → PASS.
- [ ] **Step 5: Commit** `feat(companies): open a company account`

### Task 6: Membros e convites do lado do dono

**Files:**
- Create: `src/modules/companies/dto/create-invite.dto.ts`, `src/modules/companies/entities/company-members.entity.ts`
- Modify: `companies.controller.ts`, `companies.service.ts`, `companies.service.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  CreateInviteDto { email?: string; cpf?: string } // exatamente um (mesma regra do destinatário de transferência)
  CompanyMembers { members: { user_id; name; email; role; created_at }[]; invites: { id; invited_user: { name; email }; created_at }[] }
  // CompaniesService
  listMembers(user_id, company_id): Promise<CompanyMembers>       // GET    /companies/:id/members
  invite(user_id, company_id, dto): Promise<void>                  // POST   /companies/:id/invites (201)
  cancelInvite(user_id, company_id, invite_id): Promise<void>      // DELETE /companies/:id/invites/:inviteId (204)
  removeMember(user_id, company_id, member_id): Promise<void>      // DELETE /companies/:id/members/:userId (204)
  leave(user_id, company_id): Promise<void>                        // POST   /companies/:id/leave (204)
  ```
- [ ] **Step 1: Testes** (um `it` por linha da tabela de erros da spec que toca estas rotas):
  - `listMembers` por não-membro → 403; por membro → `invites: []`; por dono → convites pendentes;
  - `invite`: não-dono → 403; usuário inexistente → 404 `'Usuário não encontrado'`; si mesmo → 422; já membro → 409; convite pendente (P2002) → 409; **usuário desativado → 422 `'Usuário desativado'`**; sucesso grava `audit_logs` `company.invite`;
  - `cancelInvite` não pendente → 404; sucesso → `status: 'canceled'`, `responded_at` e audita `company.invite_cancel`;
  - `removeMember` de si mesmo (dono) → 422; sucesso apaga o membro e audita `company.member_remove`;
  - `leave` pelo dono → 422 `'O dono não pode sair da empresa'`; membro → apaga e audita `company.member_leave`.
- [ ] **Step 2:** `npx vitest run src/modules/companies` → FAIL.
- [ ] **Step 3:** Implementar service e rotas (`ParseUUIDPipe` nos ids, Swagger com todos os códigos de erro).
- [ ] **Step 4:** Mesmo comando → PASS; `npm run lint` limpo.
- [ ] **Step 5: Commit** `feat(companies): members and invites management`

### Task 7: Convites do lado do convidado

**Files:**
- Create (CLI): `npx nest g resource modules/invites --no-spec` (enxugar)
- Create: `src/modules/invites/entities/pending-invite.entity.ts`, `src/modules/invites/invites.service.spec.ts`

**Interfaces:**
- Produces: `PendingInvite { id; company: { id; trade_name; cnpj }; invited_by: { name }; created_at }`; `InvitesService.listPending(user_id)`, `accept(user_id, invite_id)`, `decline(user_id, invite_id)`; rotas `GET /invites`, `POST /invites/:id/accept` (204), `POST /invites/:id/decline` (204).
- [ ] **Step 1: Testes:** `listPending` só `pending` do usuário; `accept` de convite de outra pessoa ou não pendente → 404 `'Convite não encontrado'`; `accept` cria `company_members` `member`, marca `accepted` + `responded_at` e audita `company.member_join` na mesma transação; `decline` marca `declined`.
- [ ] **Step 2:** `npx vitest run src/modules/invites` → FAIL.
- [ ] **Step 3:** Implementar (aceitar usa `updateMany where { id, invited_user_id, status: 'pending' }` e checa `count`, como no reset de senha).
- [ ] **Step 4:** Mesmo comando → PASS.
- [ ] **Step 5: Commit** `feat(invites): accept and decline company invites`

### Task 8: Dono não desativa a conta pessoal + Postman/README da Etapa 2

**Files:**
- Modify: `src/modules/deactivation-requests/deactivation-requests.service.ts`, `.spec.ts`
- Modify: `docs/postman/ecofintech-api.postman_collection.json`, `README.md`

- [ ] **Step 1: Teste:** `create` por dono de empresa `active` → `UnprocessableEntityException` com mensagem `'Você é dono da empresa {trade_name}. Ela não pode ficar sem dono.'`; dono só de empresa `deactivated` → segue o fluxo normal.
- [ ] **Step 2:** `npx vitest run src/modules/deactivation-requests` → FAIL.
- [ ] **Step 3:** Implementar a checagem antes de criar a solicitação.
- [ ] **Step 4:** Mesmo comando → PASS.
- [ ] **Step 5:** Postman: pasta "Companies" (abrir empresa usando um CNPJ gerado no pre-request, membros, convidar o `admin_email`, cancelar) e pasta "Invites" (listar); variáveis `company_id`, `company_account_id`, `invite_id`. README: seção "Contas de empresa" (conceito, `X-Account-Id`, rotas, regras).
- [ ] **Step 6: Verificação real (API):** Maria (nova) abre empresa → convida João (novo) → João lista e aceita → `GET /accounts` do João mostra a empresa como `member` → Maria remove João → `GET /accounts/me` do João com `X-Account-Id` da empresa → 403. Usuários de teste criados e apagados no fim.
- [ ] **Step 7: Commit** `feat(companies): block owner deactivation; docs and Postman`

---

## Etapa 3 — Front de contas

### Task 9: Conta ativa no front

**Files:**
- Create: `src/auth/account.ts` (sessionStorage), `src/auth/AccountProvider.tsx`, `src/auth/account-context.ts`, `src/auth/account.test.ts`
- Modify: `src/api/client.ts` (middleware), `src/main.tsx` ou `App.tsx` (provider), `src/api/requests.ts`, `src/api/queries.ts`, `src/api/schema.d.ts` (`npm run api:types`)

**Interfaces:**
- Produces:
  ```ts
  // account.ts
  getActiveAccountId(): string | null; setActiveAccountId(id: string | null): void
  export const ACCOUNT_REVOKED_EVENT = 'ecofintech:account-revoked'
  // account-context.ts
  useActiveAccount(): { accounts: OperableAccount[]; active: OperableAccount | null; loading: boolean;
                        switchTo(id: string): void; revokedNotice: string | null }
  // requests.ts
  listAccounts(); createCompany(body); listMembers(companyId); invite(companyId, body);
  cancelInvite(companyId, inviteId); removeMember(companyId, userId); leaveCompany(companyId);
  listInvites(); acceptInvite(id); declineInvite(id)
  // queries.ts
  queryKeys.accounts = ['accounts'], queryKeys.invites = ['invites'], queryKeys.members(companyId)
  useAccounts(), useInvites(), useMembers(companyId)
  ```
  Middleware `account` (depois do `auth`): envia `X-Account-Id` quando `getActiveAccountId()` existe; em resposta 403 cujo corpo tem `message === 'Sem acesso a esta conta'` e havia conta ativa → `setActiveAccountId(null)` e dispara `ACCOUNT_REVOKED_EVENT`. `switchTo` grava o id, chama `queryClient.removeQueries()` exceto a chave de `auth/me`, e o provider escuta o evento para voltar à pessoal com `revokedNotice = 'Você não tem mais acesso a essa empresa. Voltamos para a sua conta pessoal.'`. Logout limpa a conta ativa.
- [ ] **Step 1: Testes** (`account.test.ts`, com `fetch` mockado como em `client.test.ts`): envia `X-Account-Id` quando há conta ativa e não envia quando não há; 403 `'Sem acesso a esta conta'` limpa a conta ativa e dispara o evento; 403 com outra mensagem não limpa.
- [ ] **Step 2:** `npx vitest run src/auth/account.test.ts` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Mesmo comando → PASS; `npm run typecheck` e `npm run lint` limpos.
- [ ] **Step 5: Commit** `feat(web): active account context and X-Account-Id header`

### Task 10: Escolha de conta, cabeçalho e convites

**Files:**
- Create: `src/pages/AccountsPage.tsx` (`/contas`), `src/components/AccountSwitcher.tsx`, `src/components/InvitesBell.tsx`, `src/components/InviteList.tsx` (usado em `/contas` e no sininho)
- Modify: `src/App.tsx`, `src/components/AppLayout.tsx`, `src/pages/auth/LoginPage.tsx`

**Interfaces:**
- Consumes: Task 9.
- Produces: rota `/contas` (dentro de `RequireAuth`, fora do `AppLayout` ou com layout simples); após login, `LoginPage` navega para `/contas` se `accounts.length > 1 || invites.length > 0`, senão para `state.from ?? '/'`.
- [ ] **Step 1:** `/contas`: cartões (nome, documento formatado, papel "Dono"/"Membro", saldo) — clicar chama `switchTo` e vai para `/`; lista de convites com Aceitar/Recusar (aceitar invalida `accounts` e `invites`); botão "Abrir conta de empresa" → `/empresa/nova`.
- [ ] **Step 2:** `AccountSwitcher` no cabeçalho (nome da conta ativa + selo Pessoal/Empresa; menu com as contas, "Abrir empresa", "Gerenciar empresa" quando empresa ativa); `InvitesBell` com contador e lista; faixa abaixo do cabeçalho com empresa ativa: "Você está operando como {trade_name}" (cores com `dark:`). `revokedNotice` aparece como `Alert` no topo do conteúdo.
- [ ] **Step 3:** `formatCnpj` em `src/lib/format.ts` (`'11222333000181'` → `'11.222.333/0001-81'`) com teste em `format.test.ts`.
- [ ] **Step 4:** `npm test`, `npm run typecheck`, `npm run lint` limpos.
- [ ] **Step 5: Verificação no navegador** (playwright-core + Chrome, como nas sessões anteriores): login de quem tem empresa cai em `/contas`; quem não tem cai em `/`; trocar de conta muda saldo/dashboard sem recarregar; sem rolagem horizontal em 390px; claro e escuro.
- [ ] **Step 6: Commit** `feat(web): account selection, switcher and invites`

### Task 11: Abrir e gerenciar empresa

**Files:**
- Create: `src/pages/company/NewCompanyPage.tsx` (`/empresa/nova`), `src/pages/company/CompanyPage.tsx` (`/empresa`), `src/lib/cnpj.ts` + teste
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: Tasks 9–10; `isValidCnpj` no front espelha o da API (`src/lib/cnpj.ts`, mesmo algoritmo).
- [ ] **Step 1: Testes** de `src/lib/cnpj.ts` com os mesmos casos da Task 1.
- [ ] **Step 2:** `npx vitest run src/lib/cnpj.test.ts` → FAIL; implementar; → PASS.
- [ ] **Step 3:** `NewCompanyPage`: CNPJ com máscara (`formatCnpj` ao digitar), razão social, nome fantasia (react-hook-form + zod); 409 mostrado no formulário; sucesso → `switchTo(nova conta)` e vai para `/`.
- [ ] **Step 4:** `CompanyPage` (só com empresa ativa; senão redireciona para `/`): membros com papel; dono vê convidar (aba E-mail/CPF reaproveitando `RecipientField`), convites pendentes com Cancelar e Remover membro (confirmação em `Modal`); membro vê "Sair da empresa" (confirmação; depois `switchTo(conta pessoal)`).
- [ ] **Step 5:** `npm test`, `typecheck`, `lint` limpos; navegador: fluxo Maria/João completo pela interface.
- [ ] **Step 6: Commit** `feat(web): open and manage company`

---

## Etapa 4 — Transferência por CNPJ e "feita por"

### Task 12: API — `to_cnpj`, `Counterparty.kind`, `operator`, admin

**Files:**
- Modify: `src/modules/transactions/dto/transfer.dto.ts`, `entities/transaction.entity.ts`, `transactions.service.ts`, `transactions.service.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  TransferDto.to_cnpj?: string            // @OnlyDigits() @IsCnpj(); exatamente um entre to_email, to_cpf, to_cnpj
  Counterparty { name: string; email: string | null; kind: 'person' | 'company' }
  Transaction.operator: { name: string } | null   // só em type 'saida' de conta de empresa
  AdminTransaction.owner: Counterparty
  ```
  Mensagem quando nenhum ou mais de um destinatário: `'Informe o destinatário por to_email, to_cpf ou to_cnpj (apenas um)'`. Busca do admin (`search`) inclui `companies.cnpj` (dígitos) e `companies.trade_name` (insensitive).
- [ ] **Step 1: Testes:** transferência por `to_cnpj` credita a conta da empresa; empresa `deactivated` → 422 `'Conta de destino desativada'`; **empresa → CPF do próprio dono é permitido** e mesma conta de origem/destino → 400; `counterparty` de empresa = `{ name: trade_name, email: null, kind: 'company' }`; `operator` preenchido em `saida` de conta de empresa, `null` em `entrada` e na conta pessoal; depósito por `to_cnpj`; busca do admin por CNPJ com pontuação.
- [ ] **Step 2:** `npx vitest run src/modules/transactions` → FAIL.
- [ ] **Step 3:** Implementar (`transactionSelect` passa a trazer `companies` da conta da contraparte e `users` de `created_by`; `toTransaction` recebe o `kind` da conta ativa).
- [ ] **Step 4:** `npm test` PASS, `lint` limpo.
- [ ] **Step 5:** Postman: "Transferir por CNPJ" e teste de `operator` no extrato da empresa; README: `to_cnpj`, `Counterparty.kind` e `operator`.
- [ ] **Step 6: Commit** `feat(transactions): transfer by CNPJ and operator name`

### Task 13: Front — CNPJ, "De:", "feita por" e admin

**Files:**
- Modify: `src/components/RecipientField.tsx` (modo `'cnpj'`), `src/lib/money-operation.ts`, `src/components/ConfirmOperation.tsx`, `src/components/TransactionList.tsx`, `src/lib/transactions.ts`, `src/pages/admin/AdminTransactionsPage.tsx`, `src/api/schema.d.ts`

- [ ] **Step 1: Testes:** `money-operation` gera `{ to_cnpj: '11222333000181' }` a partir de `'11.222.333/0001-81'` e valida CNPJ inválido; `ConfirmOperation` mostra `De: {nome da conta ativa}` (teste no arquivo existente `ConfirmOperation.test.tsx`).
- [ ] **Step 2:** `npm test` → FAIL; implementar; → PASS.
- [ ] **Step 3:** Extrato/dashboard: lançamentos com `operator` mostram "feita por {nome}" na linha e no modal; admin mostra o dono (empresa ou pessoa) e quem fez.
- [ ] **Step 4:** `typecheck`, `lint`, `build` limpos.
- [ ] **Step 5: Verificação final no navegador** (roteiro da seção 6 da spec, claro e escuro, 390px, cursor pointer). Usuários/empresas de teste apagados no fim.
- [ ] **Step 6: Commit** `feat(web): transfer by CNPJ and operator in statements`
