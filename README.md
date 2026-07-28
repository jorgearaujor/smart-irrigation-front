# SmartIrrigation — Front-end Web

Painel web em Angular para monitorar e controlar um sistema de irrigação automatizada: acompanha sensores em tempo real, permite irrigação manual, configura parâmetros agronômicos e culturas, e mostra histórico em gráficos.

Repositórios relacionados:
- Backend (Spring Boot): [`smart-irrigation`](https://github.com/jorgearaujor/smart-irrigation)
- App mobile (Android/Kotlin): [`SmartIrrigation`](https://github.com/jorgearaujor/SmartIrrigation)

## Stack

- **Angular 21** (standalone components, sem NgModules, tudo lazy-loaded via `loadComponent`)
- **Tailwind CSS v4** (setup CSS-first, sem `tailwind.config`; toda estilização é via classes utilitárias direto no template)
- **ng2-charts / Chart.js** — gráficos do histórico
- **Firebase JS SDK** — autenticação (Firebase Auth)
- **Vitest** — testes unitários

## Como rodar

```bash
npm install
npm start        # ng serve — abre em http://localhost:4200
```

Por padrão o projeto roda **com dados mockados** (`useMockData: true` em `src/environments/environment.ts`), então dá pra explorar a interface inteira sem precisar do backend nem do Firebase configurado. Para usar a API real, edite `environment.ts`:

```ts
useMockData: false,
apiBaseUrl: 'http://localhost:8080/api', // endereço do backend
```

Para o **login funcionar** (opcional em modo mock, já que `requireAuth` fica `false` por padrão), copie `.env.example` para `.env` e preencha com as credenciais do seu Firebase Web App (Firebase Console > Configurações do projeto > Seus apps). O `.env` não é versionado; `npm start`/`npm run build` geram `src/environments/firebase.config.ts` a partir dele automaticamente (script `scripts/generate-env.mjs`, chamado via `prestart`/`prebuild`). Sem `.env`, esse arquivo é gerado com valores vazios e o app sobe normalmente — só o login que não vai funcionar.

Rodar os testes: `npm test` (Vitest).

## Telas / funcionalidades

### Dashboard (`/dashboard`)
Tela principal. Mostra status ao vivo do dispositivo (ocioso/irrigando, modo, autorização), sensores atuais (temperatura, umidade do ar, umidade do solo — com destaque visual quando abaixo do limiar configurado), e dá acesso a:
- **Alternar modo** manual/automático.
- **Irrigação manual** — define volume em litros e liga/desliga.
- **Autorização automática** — libera/bloqueia o modo automático decidir sozinho quando irrigar.
- **Última irrigação** — resumo do evento mais recente (duração, volume, umidade antes).
- Botão para ir em **Configurações**.

### Histórico (`/historico`)
Gráficos de linha (temperatura, umidade do ar, umidade do solo) com seletor de período (últimas 24h / 7 dias / 30 dias), mais uma tabela com o histórico de eventos de irrigação no período.

### Configurações (`/configuracoes`)
Três cards independentes, cada um salvando separadamente (refletindo que são dados diferentes no backend):
- **Localização** — latitude do sistema.
- **Cultura** — seleciona a cultura cadastrada e a fase de crescimento (1 a 4); o coeficiente de cultura (Kc) é calculado automaticamente a partir dessa escolha, não é digitado manualmente.
- **Parâmetros Agronômicos** — espaçamento entre plantas/linhas, vazão do gotejador, nº de gotejadores por planta, quantidade total de plantas, umidade mínima do solo.

Administradores também veem um botão **Novo usuário**, que leva para `/cadastro`.

### Login (`/login`) e Cadastro (`/cadastro`)
Login por e-mail/senha (Firebase Auth). O cadastro de um novo usuário só é acessível a quem já está logado como Administrador — não existe autocadastro público; um admin preenche nome, e-mail, senha inicial e a permissão (`Administrador` ou `Visualizador`) de quem está sendo cadastrado. A criação do usuário (Firebase Auth + registro em `usuarios`) é feita pelo backend, não direto do navegador, justamente para não derrubar a sessão de quem está criando o novo usuário.

**⚠️ Login está implementado mas desligado por padrão.** Veja a seção abaixo.

## Autenticação (implementada, mas desativada por enquanto)

Todo o fluxo de login/permissões está pronto — Firebase Auth, guards de rota, interceptor que anexa o token em toda chamada à API, botão "Novo usuário" restrito a admins — mas está desligado via uma flag, para facilitar testes locais sem depender do backend exigir autenticação:

```ts
// src/environments/environment.ts
requireAuth: false,
```

Com `requireAuth: false`, os guards (`authGuard`, `adminGuard`) liberam todas as rotas sem precisar de sessão, e o botão "Novo usuário" aparece pra qualquer um.

**Para reativar**: troque para `requireAuth: true` aqui **e** `DASHBOARD_AUTH_ENABLED=true` no `.env` do backend. Nenhuma outra mudança é necessária.

## Endpoints da API consumidos

Todas as rotas abaixo usam `environment.apiBaseUrl` como base. Quando `requireAuth: true`, o `authInterceptor` anexa `Authorization: Bearer <token>` em todas elas automaticamente.

### `IrrigationService` — `/api/devices/{deviceId}/...`

| Método | Rota | Usado em |
|---|---|---|
| GET | `/status` | Polling automático (`statusPollingIntervalMs`) — status ao vivo no Dashboard |
| GET | `/config-irrigacao` | Carregado ao iniciar o app — parâmetros agronômicos exibidos em Configurações |
| PUT | `/config-irrigacao` | Configurações → cards "Cultura" e "Parâmetros Agronômicos" |
| POST | `/irrigation/start` | Dashboard → irrigação manual (liga, com volume em litros) |
| POST | `/irrigation/stop` | Dashboard → irrigação manual (desliga) |
| PUT | `/mode` | Dashboard → alternância manual/automático |
| PUT | `/authorization` | Dashboard → autorização do modo automático |
| PUT | `/latitude` | Configurações → card "Localização" |
| GET | `/telemetry` | Histórico (gráficos, por período) + polling (`telemetryPollingIntervalMs`) para a última leitura no Dashboard |
| GET | `/irrigation-history` | Histórico → tabela de eventos de irrigação |

### Demais rotas

| Método | Rota | Usado em |
|---|---|---|
| GET | `/api/culturas` | Configurações → seletor de cultura (preenche os coeficientes Kc por fase) |
| GET | `/api/usuarios/me` | Carregado logo após o login — perfil do usuário (`nome`, `tipo`/`isAdmin`) |
| POST | `/api/usuarios` | Cadastro (`/cadastro`) — só aparece/funciona para administradores |

O login em si não passa pelo backend: `signInWithEmailAndPassword` é chamado direto no SDK do Firebase Auth. Só depois disso o front busca `/api/usuarios/me` para descobrir o perfil e a permissão do usuário.

## Arquitetura

```
src/app/
├── core/
│   ├── services/         IrrigationService, AuthService, UsuarioService
│   ├── guards/            authGuard, adminGuard
│   ├── interceptors/      authInterceptor (anexa token), authErrorInterceptor (401/403 → logout + /login)
│   ├── mocks/              mockApiInterceptor (dados fake quando useMockData=true)
│   └── models/             interfaces TypeScript espelhando os DTOs do backend
└── features/
    ├── dashboard/
    ├── historical-charts/
    ├── settings/
    └── auth/
        ├── login/
        └── cadastro/
```

### `IrrigationService`
Serviço central do dashboard — mantém `status`, `config` e `latestTelemetry` como signals atualizados automaticamente por polling (a cada `statusPollingIntervalMs` / `telemetryPollingIntervalMs`, configurável em `environment.ts`). Expõe métodos para todas as ações do dashboard (`startIrrigation`, `stopIrrigation`, `setMode`, `setAuthorization`, `updateConfig`, `updateLatitude`, `getCulturas`, `getTelemetryHistory`, `getIrrigationHistory`).

### `AuthService`
Encapsula o Firebase Auth (login por e-mail/senha) e mantém o perfil do usuário (`nome`, `tipo`, etc. vindo do backend via `UsuarioService.getMe()`) como signal, com um computed `isAdmin`.

### Mock de API (`mock-api.interceptor.ts`)
Quando `useMockData: true`, esse interceptor intercepta toda chamada à API e responde com dados fake gerados em memória (incluindo geração de séries de telemetria sintéticas para os gráficos), sem precisar do backend rodando. Sempre que um endpoint novo é adicionado no backend, o mock correspondente deve ser adicionado aqui também para manter os dois em paridade.

## Configuração de ambiente (`src/environments/environment.ts`)

| Chave | Descrição |
|---|---|
| `apiBaseUrl` | Endereço base do backend |
| `deviceId` | ID do dispositivo monitorado (ex: `esp32-01`) |
| `statusPollingIntervalMs` / `telemetryPollingIntervalMs` | Frequência do polling automático |
| `useMockData` | `true` = usa dados fake, não depende do backend |
| `requireAuth` | `true` = exige login pra acessar qualquer tela |

Esse arquivo é único (não há `environment.prod.ts`/`fileReplacements`) e é versionado no Git — nenhuma das chaves acima é sensível.

## Firebase (`.env` + `src/environments/firebase.config.ts`)

A configuração do Firebase Web App (projeto `smart-irrigation-ifmaker`) fica fora do `environment.ts` e fora do Git:

1. Copie `.env.example` para `.env` (raiz do projeto) e preencha com os valores do Firebase Console (Configurações do projeto > Seus apps > SDK setup and configuration).
2. `npm start`, `npm run build`, `npm run watch` e `npm test` rodam `scripts/generate-env.mjs` automaticamente antes (`prestart`/`prebuild`/`prewatch`/`pretest`), que lê o `.env` e gera `src/environments/firebase.config.ts` — esse arquivo é gitignorado, não editar a mão.
3. Sem `.env`, o script cai para `.env.example` (valores vazios): o app sobe normalmente com dados mockados, só o login que não funciona.

**Sobre a chave (`apiKey`) não ser mais versionada:** o `apiKey` de um Firebase Web App não é um segredo de servidor — ele só identifica o projeto, e por isso o próprio Firebase permite (e documenta) deixá-lo em código client-side; a segurança de verdade vem das Firestore Security Rules e da allowlist em `usuarios/{uid}` que o backend confere a cada request (veja o README do backend). Mesmo assim, tirar do Git evita que ele fique permanentemente no histórico do repositório. Duas ressalvas importantes: (a) como o app roda no navegador, esse valor continua indo parar no bundle compilado de qualquer build publicado — tirar do Git não o esconde de quem inspeciona o site em produção; (b) commits antigos deste repositório (anteriores a este ajuste) ainda têm essa chave no histórico do Git — como o valor nunca foi um segredo de servidor, não há necessidade de rotacioná-la, mas se preferir trocar, gere uma nova Web App no Firebase Console.
