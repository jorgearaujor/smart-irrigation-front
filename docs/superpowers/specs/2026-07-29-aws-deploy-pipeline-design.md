# Esteira de deploy AWS (front + backend) — Design

Data: 2026-07-29

## Objetivo

Configurar deploy contínuo via GitHub Actions para os dois repositórios do projeto SmartIrrigation, publicando na AWS com domínio próprio (`velika.com.br`):

- `smart-irrigation-front` (Angular, SPA estático) → `dashboard.velika.com.br`
- `smart-irrigation` (Spring Boot, API) → `api.velika.com.br`

## Contexto levantado

- **Front**: Angular 21 standalone, build estático em `dist/smart-irrigation-front/browser`. Precisa de variáveis do Firebase injetadas em build-time via `scripts/generate-env.mjs` (lê `.env`, gera `src/environments/firebase.config.ts`, não versionado).
- **Backend**: Java 17 + Spring Boot 4.1, Maven (com wrapper). Sem banco relacional — usa Firestore (Firebase) como banco. Autenticação com Firebase Admin SDK via um JSON de service account, cujo caminho vem de `GOOGLE_APPLICATION_CREDENTIALS` (`FirebaseConfig.java` faz `GoogleCredentials.fromStream(...)` a partir desse arquivo). Variáveis obrigatórias hoje: `FIRESTORE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`, `DEVICE_API_KEY`; opcionais: `MYAPP_CORS_ALLOWED_ORIGINS`, `DASHBOARD_AUTH_ENABLED`.
- Nenhum dos dois repositórios tem workflow de CI/CD hoje. Nenhum recurso AWS existe ainda.
- Domínio `velika.com.br` já é do usuário, DNS gerenciado **fora** da AWS (Route53 não é usado) — todos os registros (validação ACM, CNAMEs) precisam ser criados manualmente no provedor de DNS atual.
- Provisionamento decidido: **manual via AWS CLI/Console**, sem Terraform/IaC.
- Região escolhida: **us-east-1**.

## Arquitetura

### Front-end: S3 + CloudFront

- Bucket S3 privado (sem hosting estático público), origem de uma distribuição CloudFront via **Origin Access Control (OAC)**.
- CloudFront #1: domínio alternativo `dashboard.velika.com.br`, certificado ACM (obrigatoriamente em `us-east-1` por exigência do CloudFront).
- Roteamento de SPA: *custom error responses* do CloudFront (403 e 404 do S3) reescrevem para `/index.html` com status 200, para o router do Angular assumir o roteamento client-side.
- Deploy: sync do diretório de build pro bucket + invalidação do cache do CloudFront.

### Backend: Elastic Beanstalk + CloudFront

- Elastic Beanstalk, plataforma **Java 17 (Corretto)**, ambiente de **instância única, sem load balancer** — a forma mais barata de rodar o jar (evita o custo de um ALB, ~US$16+/mês).
- Como uma instância única não tem certificado TLS próprio, HTTPS é resolvido colocando **CloudFront #2** na frente do ambiente EB (origem custom, HTTP na porta 80), com domínio alternativo `api.velika.com.br` e o mesmo certificado ACM.
- Cache do CloudFront #2 desabilitado (política `CachingDisabled`) e todos os headers/query strings/cookies encaminhados (política `AllViewer` ou equivalente), já que é uma API, não conteúdo estático.
- Endurecimento opcional (não obrigatório no primeiro rollout): restringir o security group do EB pra aceitar tráfego na porta 80 apenas do prefix list gerenciado da AWS `com.amazonaws.global.cloudfront.origin-facing`, evitando que alguém acesse a API pulando o CloudFront/HTTPS.
- Credencial do Firebase: o conteúdo do JSON da service account vira uma *environment property* do EB, em base64 (`FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`). Um arquivo `.ebextensions/01-firebase-credentials.config` no repo do backend decodifica essa variável e escreve o JSON em disco na instância durante o deploy; `GOOGLE_APPLICATION_CREDENTIALS` é setado (também como environment property) apontando pra esse arquivo gerado. Não requer mudança no código Java.
- Demais variáveis de ambiente do backend (`DEVICE_API_KEY`, `MYAPP_CORS_ALLOWED_ORIGINS=https://dashboard.velika.com.br`, `DASHBOARD_AUTH_ENABLED`, `FIRESTORE_PROJECT_ID`) também como environment properties do EB — configuradas uma vez na criação do ambiente, não a cada deploy.

### Certificado e DNS

- Um único certificado ACM (região `us-east-1`) cobrindo `dashboard.velika.com.br` e `api.velika.com.br` (SAN).
- Registros a criar no provedor de DNS atual do usuário (fora da AWS):
  - 2x CNAME de validação do ACM (um por nome coberto pelo certificado).
  - `dashboard.velika.com.br` → CNAME para o domínio gerado pelo CloudFront #1.
  - `api.velika.com.br` → CNAME para o domínio gerado pelo CloudFront #2.

### Autenticação do GitHub Actions com a AWS (OIDC)

- Um único IAM OIDC Identity Provider (`token.actions.githubusercontent.com`) na conta AWS, compartilhado pelos dois repositórios.
- Duas IAM Roles, cada uma com trust policy restrita ao respectivo repositório/branch:
  - `gha-deploy-smart-irrigation-front`: permissões `s3:PutObject`/`s3:DeleteObject`/`s3:ListBucket` no bucket do front + `cloudfront:CreateInvalidation` na distribuição #1.
  - `gha-deploy-smart-irrigation-backend`: permissões do Elastic Beanstalk (`elasticbeanstalk:*` escopado à aplicação), acesso ao bucket S3 de versões do EB, `autoscaling`/`ec2` de leitura, e `iam:PassRole` para as roles de serviço/instância do EB.
- Sem access keys de longa duração armazenadas como secret — cada job assume a role via OIDC no momento da execução.

### Segredos e variáveis do GitHub Actions

**Repo `smart-irrigation-front`:**
- `AWS_ROLE_ARN` (role do front)
- `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `FIREBASE_MEASUREMENT_ID`
- `S3_BUCKET_NAME`, `CLOUDFRONT_DISTRIBUTION_ID`

**Repo `smart-irrigation`:**
- `AWS_ROLE_ARN` (role do backend)
- `EB_APPLICATION_NAME`, `EB_ENVIRONMENT_NAME`
- (as environment properties do EB — `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`, `DEVICE_API_KEY`, etc. — são configuradas uma vez direto no ambiente EB, não precisam ser secret do GitHub Actions, já que o workflow não as manipula a cada deploy)

### Workflows do GitHub Actions

**Front (`.github/workflows/deploy.yml`)** — dispara em push para `master`:
1. Checkout, setup Node.
2. `npm ci`.
3. Gera `.env` a partir dos secrets do Firebase.
4. `npm run build -- --configuration production`.
5. `aws-actions/configure-aws-credentials` (OIDC, assume `AWS_ROLE_ARN`, região `us-east-1`).
6. `aws s3 sync dist/smart-irrigation-front/browser s3://$S3_BUCKET_NAME --delete`.
7. `aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths "/*"`.

**Backend (`.github/workflows/deploy.yml`)** — dispara em push para `master`:
1. Checkout, setup Java 17 (Corretto/Temurin).
2. `./mvnw -B clean package` (roda os testes existentes como parte do build).
3. `aws-actions/configure-aws-credentials` (OIDC, assume `AWS_ROLE_ARN`, região `us-east-1`).
4. `einaregilsson/beanstalk-deploy` — publica o jar gerado (`target/*.jar`) como nova versão no ambiente EB.

## Custo estimado

- S3 + CloudFront (x2 distribuições): centavos/mês no volume de tráfego de um projeto pessoal; free tier cobre 1TB de saída e 2M de requisições/mês nos primeiros 12 meses de conta nova.
- ACM: gratuito.
- Elastic Beanstalk (EC2 `t3.micro`, instância única, sem ALB): free tier (750h/mês, 12 meses em conta nova) ou ~US$8-10/mês depois disso (instância + volume EBS).
- Sem custo de Route53 (DNS fica no provedor atual) e sem custo de banco de dados (Firestore é gerenciado pelo Firebase, fora da AWS).

## Fora de escopo

- Infraestrutura como código (Terraform/CloudFormation) — decidido explicitamente que o provisionamento inicial será manual via AWS CLI/Console.
- Load balancer / ambiente EB com múltiplas instâncias, auto-scaling — não necessário pro volume atual do projeto.
- Staging/homologação separado — só ambiente de produção por enquanto.
- Banco de dados relacional na AWS — não se aplica, o backend usa Firestore.
- Migração do DNS do domínio para Route53.

## Plano de rollout

1. Provisionamento manual na AWS (passo a passo AWS CLI/Console): certificado ACM, bucket S3, duas distribuições CloudFront, aplicação/ambiente Elastic Beanstalk, OIDC provider + duas IAM roles.
2. Criação dos registros DNS no provedor atual (validação do ACM, depois os CNAMEs finais).
3. Cadastro dos secrets em cada repositório no GitHub.
4. Criação dos arquivos de workflow (`deploy.yml`) e, no backend, do `.ebextensions/01-firebase-credentials.config`.
5. Primeiro deploy (push ou `workflow_dispatch`) e validação: dashboard carrega via HTTPS, API responde via HTTPS em `api.velika.com.br`, CORS entre os dois domínios funciona.
