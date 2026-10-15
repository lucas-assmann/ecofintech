# 💸 Ecofintech

Uma **fintech completa**, do banco de dados à tela: contas com saldo, transferências por e-mail, CPF ou CNPJ, extrato, dashboard de entradas e saídas, contas de empresa com vários membros e uma área administrativa para depósitos, estornos e aprovação de encerramento de contas.

O foco do projeto é fazer **dinheiro do jeito certo**: nenhum centavo se perde em arredondamento, uma transferência nunca acontece pela metade e um clique repetido não envia o dinheiro duas vezes.

🌐 **Acesse:** [ecofintech-web.vercel.app](https://ecofintech-web.vercel.app)
📖 **API (Swagger):** [ecofintech-api.onrender.com/docs](https://ecofintech-api.onrender.com/docs)

> ⏳ A API roda no plano gratuito do Render, que "dorme" após 15 minutos sem uso. O primeiro acesso pode levar cerca de 1 minuto; depois fica rápido.

---

## 📁 Como o repositório está organizado

Este é um **monorepo**: o back-end e o front-end vivem no mesmo repositório, cada um na sua pasta, com dependências e README próprios.

```
ecofintech/
├── api/        # 🧠 Back-end: NestJS + PostgreSQL (regras de negócio, saldo, segurança)
├── web/        # 🎨 Front-end: React + Vite (as telas que o usuário vê)
└── README.md   # 📍 Você está aqui
```

| Pasta | O que tem | README detalhado |
|---|---|---|
| [`api/`](./api) | Rotas, banco de dados, autenticação, regras do dinheiro | [api/README.md](./api/README.md) |
| [`web/`](./web) | Telas, navegação, tema claro/escuro, gráficos | [web/README.md](./web/README.md) |

---

## 🔧 Funcionalidades

**Para o cliente**
- Cadastro com CPF e telefone validados, login e "esqueci minha senha" por e-mail
- Saldo (com opção de ocultar) e últimas movimentações
- Transferência por e-mail, CPF ou CNPJ, com tela de confirmação e comprovante
- Extrato paginado com os detalhes de cada lançamento
- Dashboard com o fluxo de entradas e saídas em 7, 30 ou 90 dias
- Contas de empresa (CNPJ): abrir, convidar membros, trocar de conta ativa
- Tema claro e escuro
- Pedido de encerramento da conta

**Para o administrador**
- Lista e busca de clientes
- Depósitos em qualquer conta
- Estorno de lançamentos (desfaz as duas pontas de uma transferência)
- Visão de todos os lançamentos do sistema, com filtros
- Fila de pedidos de encerramento: aprovar ou recusar

---

## 🚀 Tecnologias Utilizadas

| Camada | Tecnologias |
|---|---|
| **Back-end** | [NestJS](https://nestjs.com/) · TypeScript · [Prisma](https://www.prisma.io/) · PostgreSQL · JWT · Swagger · Nodemailer |
| **Front-end** | [React](https://react.dev/) · [Vite](https://vite.dev/) · [Tailwind CSS](https://tailwindcss.com/) · [TanStack Query](https://tanstack.com/query) · React Router · openapi-fetch |
| **Testes e qualidade** | [Vitest](https://vitest.dev/) · Testing Library · oxlint · Prettier |
| **Hospedagem** | [Vercel](https://vercel.com/) (front) · [Render](https://render.com/) (API) · [Neon](https://neon.tech/) (PostgreSQL) |

---

## 🏗️ Como as partes conversam

```
  Navegador
     │  abre o site
     ▼
┌──────────────┐   HTTPS + token JWT   ┌──────────────┐        SQL        ┌──────────────┐
│  web (React) │ ────────────────────▶ │  api (Nest)  │ ────────────────▶ │  PostgreSQL  │
│    Vercel    │ ◀──────────────────── │    Render    │ ◀──────────────── │     Neon     │
└──────────────┘     respostas JSON    └──────────────┘                   └──────────────┘
```

1. O **front** mostra as telas e guarda o token de login.
2. A cada ação, ele chama a **API** mandando o token no cabeçalho `Authorization`.
3. A **API** confere quem é a pessoa, aplica as regras (tem saldo? pode acessar esta conta?) e grava no **banco**.

Os tipos do front são **gerados a partir da documentação da API**. Se uma rota mudar no back-end, o TypeScript do front acusa o erro antes de chegar ao usuário.

---

## 📦 Instalação e Execução (local)

### Pré-requisitos

- [Node.js 24+](https://nodejs.org/)
- [PostgreSQL](https://www.postgresql.org/) rodando na sua máquina
- (Opcional) [Mailpit](https://mailpit.axllent.org/), para ver os e-mails de "esqueci minha senha" sem enviá-los de verdade

### Passo a passo

1. **Clone o repositório:**

```bash
git clone https://github.com/lucas-assmann/ecofintech.git
cd ecofintech
```

2. **Suba a API** (em um terminal):

```bash
cd api
npm install
# crie o arquivo .env (as variáveis estão explicadas no api/README.md)
npm run db:migrate     # cria as tabelas
npm run start:dev      # http://localhost:3000
```

3. **Suba o front** (em outro terminal):

```bash
cd web
npm install
cp .env.example .env   # aponta o front para http://localhost:3000
npm run dev            # http://localhost:5173
```

4. **Acesse no navegador:**

```
http://localhost:5173
```

⚠️ **Observação:** a API só aceita chamadas do endereço do front listado em `CORS_ORIGINS` (no `.env` da API). Em desenvolvimento, use `http://localhost:5173`.

👑 **Para virar administrador**, cadastre-se pelo site e rode no banco:

```sql
UPDATE users SET role = 'admin' WHERE email = 'seu@email.com';
```

Não existe rota na API que transforme alguém em admin, de propósito: só quem tem acesso direto ao banco consegue.

---

## 🧠 Decisões que valem a explicação

Um app de dinheiro tem armadilhas que um CRUD comum não tem. Estas foram as principais:

| Problema | Como o Ecofintech resolve |
|---|---|
| **Centavos sumindo** (`0.1 + 0.2 = 0.30000000000000004` em JavaScript) | Valores são `NUMERIC(15,2)` no banco e trafegam como texto (`"200.00"`). O front só formata, nunca faz conta com o valor. |
| **Transferência pela metade** (tirou de um, caiu o servidor, não chegou no outro) | Débito, crédito e lançamentos acontecem na **mesma transação do banco**: ou tudo é gravado, ou nada. |
| **Clique duplo / internet caindo** enviando o dinheiro duas vezes | **Idempotência:** cada operação leva uma chave única (`Idempotency-Key`). Se a mesma chave chegar de novo, a API devolve o resultado original em vez de transferir outra vez. |
| **Saldo negativo** com duas transferências ao mesmo tempo | A conta é travada durante a operação e o banco tem `CHECK (balance >= 0)` como segunda barreira. |
| **Sessão roubada** continuar valendo depois da troca de senha | Cada token carrega uma "versão". Trocar a senha, sair ou ter a conta desativada muda a versão e derruba **todas** as sessões abertas. |
| **Força bruta** no login | Limite de 5 tentativas por minuto por IP no login, cadastro e recuperação de senha. |
| **Histórico adulterado** | Lançamentos são imutáveis. Correções viram um **estorno**, um lançamento novo que aponta para o original, e cada operação registra quem a executou. |
| **Datas deslocadas pelo fuso** | Tudo é gravado em UTC e convertido para o horário de Brasília só na tela. A API se recusa a ligar se o banco não estiver em UTC. |

---

## ☁️ Deploy

| Parte | Onde | Configuração principal |
|---|---|---|
| **Front** | Vercel | Root Directory `web` · variável `VITE_API_URL` |
| **API** | Render | Root Directory `api` · build `npm ci --include=dev && npm run build && npm run db:migrate` |
| **Banco** | Neon | PostgreSQL em UTC, conexão com `sslmode=verify-full` |

Todo `git push` no `main` publica automaticamente, e cada serviço só faz deploy quando a **sua** pasta muda. Os detalhes estão na seção **Deploy** dos READMEs de [`api/`](./api/README.md) e [`web/`](./web/README.md).

---

## 👤 Autor

Desenvolvido por **Lucas Assmann**.

---

## 🛡️ Licença

Projeto de portfólio, sem licença de uso definida (todos os direitos reservados).

---
