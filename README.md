# Ofertas Bot MVP

Motor modular para importar produtos, detectar boas ofertas, gerar posts de afiliado, enfileirar publicacoes e distribuir por canais desacoplados.

## Primeiro milestone

`produto -> oferta -> score -> link afiliado -> copy -> fila -> canal mock -> publicacao -> log`

## Estrutura

- `apps/api`: API Fastify
- `apps/web`: painel web (proxima etapa)
- `packages/database`: Prisma/PostgreSQL
- `packages/core`: motor de ofertas e regras
- `packages/marketplaces`: providers Shopee/ML e mocks
- `packages/channels`: adaptadores de distribuicao
- `packages/shared`: tipos/utilitarios compartilhados

## Infra local

1. Copie `.env.example` para `.env`.
2. Rode `docker compose up -d`.
3. Instale dependencias com `npm install`.
4. Rode `npm run db:generate`.
5. Rode `npm run db:migrate`.
6. Rode `npm run dev:api`.

## Principio de arquitetura

O WhatsApp nao faz parte do nucleo. Ele sera um `ChannelAdapter`. O MVP usa `MockChannelAdapter`, permitindo validar o fluxo inteiro antes de escolher uma integracao real e compativel com as regras da plataforma.
