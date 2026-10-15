# 🎨 Ecofintech — Web (Frontend)

Interface web da **Ecofintech**: as telas onde o cliente vê o saldo, transfere, acompanha o extrato e o dashboard, e onde o administrador faz depósitos, estornos e aprova encerramentos de conta.

🌐 **No ar:** [ecofintech-web.vercel.app](https://ecofintech-web.vercel.app)

> 📍 Faz parte do monorepo [Ecofintech](../README.md). Este front consome a API que está em [`../api`](../api).

---

## 🚀 Tecnologias Utilizadas

- [React 19](https://react.dev/) + TypeScript
- [Vite](https://vite.dev/) (servidor de desenvolvimento e build)
- [Tailwind CSS 4](https://tailwindcss.com/) (estilização, com tema claro e escuro)
- [TanStack Query](https://tanstack.com/query) (busca e cache dos dados da API)
- [React Router](https://reactrouter.com/) (navegação entre as telas)
- [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) (chamadas à API com tipos gerados)
- [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) (testes)

## 🎨 Estilização

Todo o visual é feito com **Tailwind CSS**: as classes de estilo ficam direto nos componentes, sem arquivos CSS separados para cada tela.

- **Tema claro e escuro:** segue o tema do sistema por padrão, e a escolha do usuário fica salva no navegador. Toda cor tem o seu par `dark:`.
- **Valores com cor e ícone:** entradas em verde e saídas em vermelho/laranja, sempre acompanhadas de um ícone ou selo, para quem não distingue cores também entender.
- **Gráfico próprio** (`CashFlowChart.tsx`), em SVG, com cores testadas para daltonismo.
- **Layout largo** (até 1680px), aproveitando telas grandes, e responsivo para celular.

## 🔧 Funcionalidades

| Rota | O que faz |
|---|---|
| `/login`, `/cadastro` | Entrar e abrir conta (CPF e telefone com máscara e validação) |
| `/esqueci-senha`, `/redefinir-senha` | Recuperar a senha pelo link enviado por e-mail |
| `/` | Saldo (com opção de ocultar), dashboard de entradas e saídas (7, 30 ou 90 dias), atalhos e últimas movimentações |
| `/transferir` | Transferência por e-mail, CPF ou CNPJ: preencher → confirmar → comprovante |
| `/extrato` | Extrato paginado; clicar num lançamento mostra os detalhes e o código |
| `/contas` | Escolher com qual conta operar: a pessoal ou a de uma empresa |
| `/empresa`, `/empresa/nova` | Abrir uma conta de empresa (CNPJ), ver membros e convidar pessoas |
| `/perfil` | Dados pessoais, troca de senha e pedido de encerramento da conta |
| `/admin/usuarios` | 👑 Lista e busca de clientes; remoção |
| `/admin/deposito` | 👑 Depósito por e-mail, CPF ou CNPJ |
| `/admin/lancamentos` | 👑 Todos os lançamentos do sistema, com filtros e atalho para estorno |
| `/admin/estorno` | 👑 Busca um lançamento pelo código e estorna |
| `/admin/desativacoes` | 👑 Fila de pedidos de encerramento: aprovar ou recusar |

👑 = só para administradores.

## 📦 Instalação e Execução

1. **Instale as dependências:**

```bash
cd web
npm install
```

2. **Configure o endereço da API:**

```bash
cp .env.example .env
```

3. **Rode a aplicação** (com a [API](../api) já rodando):

```bash
npm run dev
```

4. **Acesse no navegador:**

```
http://localhost:5173
```

⚠️ **Observação:** a porta 5173 é fixa porque é o endereço liberado no CORS da API (`CORS_ORIGINS`). Se mudar a porta, a API passa a recusar as chamadas.

### Variáveis de Ambiente `.env`

```bash
VITE_API_URL=http://localhost:3000
```

Só variáveis que começam com `VITE_` chegam ao navegador. E como vão para o navegador, **nunca coloque segredos aqui**: qualquer pessoa consegue lê-las.

## 🧠 Como Funciona

### 🔗 Tipos gerados da API

`src/api/schema.d.ts` é gerado a partir da documentação (Swagger) da API:

```bash
npm run api:types   # com a API rodando em localhost:3000
```

O cliente (`src/api/client.ts`) usa esses tipos. Se uma rota ou um campo mudar na API, o TypeScript do front acusa o erro na hora, antes de chegar ao usuário. Todas as chamadas ficam em `src/api/requests.ts`, e os hooks de consulta (TanStack Query) em `src/api/queries.ts`.

### 🔑 Sessão

- O token fica no `sessionStorage`: vale só para a aba aberta e some ao fechá-la.
- **Qualquer 401 da API** (token expirado, senha trocada, logout em outro lugar, conta desativada) apaga o token e volta para o login com o aviso "Sua sessão expirou". Depois de entrar de novo, a pessoa volta para a tela em que estava.
- Trocar a senha encerra a sessão (a API invalida os tokens) e pede para entrar com a nova senha.

### 🏢 Conta ativa

Quem participa de uma empresa escolhe com qual conta quer operar. O id da conta escolhida também fica no `sessionStorage` e vai em toda requisição no cabeçalho `X-Account-Id`. Se a pessoa perder o acesso à empresa, o front volta sozinho para a conta pessoal.

### 🔁 Transferências e depósitos sem duplicidade

Cada operação confirmada gera uma `Idempotency-Key` (UUID). Se a confirmação falhar por problema de rede, o botão **Tentar novamente** reenvia com **a mesma chave**, e a API devolve o resultado original em vez de transferir de novo. Voltar e editar gera uma chave nova, porque já é outra operação. Veja `src/components/ConfirmOperation.tsx`.

### 💵 Dinheiro

A API manda valores como texto (`"200.00"`) para não perder centavos; o front só formata (`formatMoney`) e nunca faz contas com eles. O campo de valor (`MoneyInput`) funciona como nos apps de banco: os dígitos entram pela direita (digitar `1`, `5`, `0` mostra R$ 0,01 → R$ 0,15 → R$ 1,50).

## ☁️ Deploy (Vercel)

| Configuração (Vercel) | Valor |
|---|---|
| **Root Directory** | `web` |
| **Variável** | `VITE_API_URL` = endereço público da API, sem barra no final |

- A `VITE_API_URL` é lida **no build**: se mudar, é preciso fazer um novo deploy.
- O `vercel.json` faz qualquer endereço servir o `index.html`, para o React Router cuidar da rota. Sem isso, abrir direto um link como `/redefinir-senha` (o que chega por e-mail) daria 404.

## 🧪 Scripts

```bash
npm run dev            # servidor de desenvolvimento (http://localhost:5173)
npm run build          # build de produção em dist/
npm run preview        # serve o build localmente
npm test               # testes (Vitest + Testing Library)
npm run typecheck      # checagem de tipos
npm run lint           # oxlint
npm run api:types      # regenera os tipos a partir da API
```

## 📂 Estrutura de Pastas

```
web/src/
├── api/              # Cliente tipado, chamadas à API e hooks do TanStack Query
│   └── schema.d.ts   # Tipos gerados da API (não editar à mão)
├── auth/             # Sessão, conta ativa, contexto de login e proteção de rotas
├── components/       # Layout, gráfico, lista de lançamentos, troca de conta, convites...
│   └── ui/           # Peças básicas: Button, Card, Field, Modal, MoneyInput, Alert...
├── lib/              # Formatação (R$, CPF, CNPJ, datas), validações e tema
├── pages/            # Telas
│   ├── auth/         # Login, cadastro, esqueci e redefinir senha
│   ├── admin/        # Área do administrador
│   ├── company/      # Conta de empresa
│   └── profile/      # Perfil do usuário
├── test/             # Configuração dos testes
├── App.tsx           # Rotas da aplicação
└── main.tsx          # Ponto de entrada do React
```

## 🧩 Pacotes Principais

| Pacote | Descrição |
|---|---|
| **react** / **react-dom** | Biblioteca de interface |
| **react-router** | Rotas e navegação |
| **@tanstack/react-query** | Busca, cache e atualização dos dados da API |
| **openapi-fetch** | Cliente HTTP tipado a partir do Swagger da API |
| **tailwindcss** | Estilização com classes utilitárias |
| **vitest** / **@testing-library/react** | Testes de componentes e funções |

## 👤 Autor

Desenvolvido por **Lucas Assmann**.

---
