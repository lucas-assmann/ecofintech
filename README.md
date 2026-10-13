# Ecofintech Web

Front-end da Ecofintech: React + TypeScript (Vite), Tailwind CSS, TanStack Query e React Router. Consome a [ecofintech-api](../ecofintech-api).

## Requisitos

- Node.js 24+
- A API rodando (por padrão em `http://localhost:3000`)

## Como rodar

```bash
npm install
cp .env.example .env   # VITE_API_URL aponta para a API

npm run dev            # http://localhost:5173
npm run build          # build de produção em dist/
npm run preview        # serve o build
```

A porta 5173 é fixa porque é a origem liberada no CORS da API (`CORS_ORIGINS`). Em produção, coloque o domínio do front nessa variável da API.

## Scripts

```bash
npm test               # testes (Vitest + Testing Library)
npm run typecheck      # checagem de tipos
npm run lint           # oxlint
npm run api:types      # regenera src/api/schema.d.ts a partir do Swagger da API
```

## Telas

| Rota | O que faz |
|---|---|
| `/login`, `/cadastro` | Entrar e abrir conta (CPF e telefone com máscara e validação) |
| `/` | Saldo (com opção de ocultar), atalhos e últimas movimentações |
| `/transferir` | Transferência por e-mail ou CPF: preencher → confirmar → comprovante |
| `/extrato` | Extrato paginado; clicar num lançamento mostra os detalhes e o código |
| `/perfil` | Dados pessoais, troca de senha e solicitação de encerramento da conta |
| `/admin/usuarios` | (admin) Lista e busca de clientes; remoção |
| `/admin/deposito` | (admin) Depósito por e-mail ou CPF |
| `/admin/desativacoes` | (admin) Fila de solicitações: aprovar ou recusar |
| `/admin/estorno` | (admin) Busca um lançamento pelo código e estorna |

## Como funciona

### Tipos gerados da API

`src/api/schema.d.ts` é gerado do Swagger da API (`npm run api:types`, com a API rodando). O cliente (`src/api/client.ts`, com [openapi-fetch](https://openapi-ts.dev/openapi-fetch/)) usa esses tipos: se uma rota ou campo mudar na API, o TypeScript do front acusa. Todas as chamadas ficam em `src/api/requests.ts`.

### Sessão

- O token fica no `sessionStorage` (vale só para a aba e some ao fechá-la).
- **Qualquer 401 da API** (token expirado, senha trocada, logout em outro lugar, conta desativada) apaga o token e volta para o login com o aviso "Sua sessão expirou". Depois de entrar de novo, o usuário volta para a tela em que estava.
- Trocar a senha encerra a sessão (a API invalida os tokens) e pede para entrar com a nova senha.

### Transferências e depósitos sem duplicidade

Cada operação confirmada gera uma `Idempotency-Key` (UUID). Se a confirmação falhar por rede, o botão **Tentar novamente** reenvia com **a mesma chave**: a API devolve o resultado original em vez de transferir de novo. Voltar e editar gera uma chave nova (é outra operação). Veja `src/components/ConfirmOperation.tsx`.

### Dinheiro

A API manda valores como texto (`"200.00"`) para não perder centavos; o front só formata (`formatMoney`). O campo de valor (`MoneyInput`) funciona como em apps de banco: os dígitos entram pela direita.

## Estrutura

```
src/
├── api/          # cliente tipado, chamadas e hooks de consulta (TanStack Query)
├── auth/         # sessão, contexto de autenticação e proteção de rotas
├── components/   # layout, lista de lançamentos, fluxo de operação e ui/ (botões, campos, modal...)
├── lib/          # formatação (R$, CPF, telefone, datas), validação de CPF, regras de formulário
├── pages/        # telas (auth/, profile/, admin/)
└── test/         # configuração dos testes
```
