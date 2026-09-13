# Racha — PWA para organização de peladas

Criar → Convidar → Organizar → Sortear → Jogar → Registrar → Finalizar.

## Executar localmente

```bash
npm install
cp .env.example .env
npm run dev        # desenvolvimento
npm run build      # build de produção (gera o service worker)
npm run preview    # testar o build, inclusive a instalação do PWA
```

Conta de demonstração (dados simulados): **demo@racha.app** / **racha123**

Os dados simulados ficam no `localStorage` do navegador (chave `racha:mockdb`).
Para restaurar o estado inicial: Configurações → Restaurar dados de demonstração, ou limpe o armazenamento do site.

## Arquitetura

```
src/
  types/        Entidades (User, PeladaEvent, Participant, Team, Game, Invitation, Notification)
  domain/       Regras puras: permissões, sorteio, rodízio, cronômetro, mapas
  services/
    contracts.ts   Interfaces que a interface consome (Auth, User, Event, Game, Notification, Storage)
    mock/          Implementação simulada (localStorage)
    http/          Cliente HTTP para o backend real
    index.ts       Seleciona a implementação conforme VITE_DATA_SOURCE
  stores/       Estado global (sessão, toasts, invalidação)
  hooks/        useAsync, useTimer, useInstallPrompt, useDebounced
  components/   ui/ (primitivos) e app/ (componentes do produto)
  layouts/      AppLayout (barra inferior no celular, lateral no desktop)
  features/     Módulos compostos (pelada)
  pages/        auth/ e app/ — as 15 telas
  app/router.tsx
```

A interface depende exclusivamente de `src/services/contracts.ts`. Para conectar um backend
(PostgreSQL, Supabase, Neon ou API própria), implemente esses contratos e defina
`VITE_DATA_SOURCE=api`. Nenhuma tela precisa ser alterada.

## Deploy na Vercel

1. Importe o repositório na Vercel (framework: Vite).
2. Cadastre as variáveis de `.env.example` em Project Settings → Environment Variables.
3. `vercel.json` já redireciona as rotas para o SPA.

## Google Maps

- Sem chave: o mapa usa o embed público a partir do endereço ou do link informado.
- Com `VITE_GOOGLE_MAPS_API_KEY`: usa a Maps Embed API oficial.
- Coordenadas só são usadas quando constam no próprio link do Google Maps; nunca são inventadas.
