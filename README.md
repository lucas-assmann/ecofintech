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
├── app.module.ts
└── main.ts
test/                  # testes e2e
docs/adr/              # Architecture Decision Records
```
