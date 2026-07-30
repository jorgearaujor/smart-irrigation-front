# Esteira de Deploy AWS (Front + Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is NOT a good fit for superpowers:subagent-driven-development: most tasks require the human to click through the AWS Console, add DNS records at an external provider, or type values from a local secret file — a subagent has no browser and no way to act on those. Run it inline, one task at a time, with the human present.

**Goal:** Publicar `smart-irrigation-front` em `https://dashboard.velika.com.br` e a API `smart-irrigation-api` em `https://api.velika.com.br`, com deploy automático via GitHub Actions a cada push em `master`.

**Architecture:** S3 (privado, OAC) + CloudFront na frente do front-end estático. Elastic Beanstalk (Java SE, instância única, sem load balancer) rodando o jar do Spring Boot, com um segundo CloudFront na frente só para terminar TLS (evita o custo de um ALB). Um único certificado ACM (SAN) cobre os dois domínios. GitHub Actions autentica na AWS via OIDC (sem access keys de longa duração como secret).

**Tech Stack:** AWS CLI v2, AWS Console (CloudFront e Elastic Beanstalk), GitHub Actions, Node.js (para montar JSON dos comandos AWS), Maven, `einaregilsson/beanstalk-deploy`, `aws-actions/configure-aws-credentials`.

## Global Constraints

- Região AWS: `us-east-1` para todos os recursos (bucket S3, Elastic Beanstalk); o certificado ACM PRECISA estar em `us-east-1` porque é exigência do CloudFront, então mantemos tudo na mesma região por simplicidade.
- Domínio `velika.com.br`, DNS gerenciado **fora** da AWS — nenhuma mudança de nameserver, nenhum uso de Route53. Todo registro DNS é instrução manual pro usuário aplicar no provedor atual.
- Sem Terraform/IaC — provisionamento manual (CLI onde é direto, Console onde envolve muitos campos interdependentes: CloudFront e Elastic Beanstalk).
- Sem load balancer / múltiplas instâncias — Elastic Beanstalk de instância única.
- GitHub Actions autentica via OIDC — nenhuma AWS access key/secret key vai para GitHub Secrets.
- Repositório do front no GitHub: `jorgearaujor/smart-irrigation-front`. Repositório do backend no GitHub: `jorgearaujor/smart-irrigation-api` (o nome do remote é `smart-irrigation-api`, não `smart-irrigation` — confirme com `git remote -v` se tiver dúvida).
- Repo local do front: `C:\Users\Jorge\Desktop\Vscode\smart-irrigation-front`. Repo local do backend: `C:\Users\Jorge\IdeaProjects\smart-irrigation`.
- Nenhuma credencial AWS (access key/secret key) deve aparecer no texto desta conversa — sempre via arquivo local ou terminal separado do usuário.
- Arquivo de estado do rollout (IDs/ARNs capturados durante a execução, não é secret, mas não deve ser commitado): `C:\Users\Jorge\AppData\Local\Temp\claude\C--Users-Jorge-Desktop-Vscode-smart-irrigation-front\77d6091d-19a9-4e41-9633-af51a50b3f32\scratchpad\aws-deploy-ids.env`. Cada task que cria um recurso novo faz `source` nesse arquivo no início e `echo "export X=..." >> ...` no fim, pra próxima task poder reusar o valor.

---

### Task 1: Pré-requisitos — AWS CLI configurada (ação manual do usuário)

Esta task é executada pelo **usuário**, fora desta sessão de chat, num terminal próprio — assim nenhuma credencial AWS aparece na conversa.

**Interfaces:**
- Produces: um perfil AWS CLI funcional (`~/.aws/credentials` no Windows: `C:\Users\Jorge\.aws\credentials`) que todos os comandos `aws` das próximas tasks vão usar automaticamente.

- [ ] **Passo 1: Instalar a AWS CLI v2** (se ainda não tiver)

Baixe e instale: https://awscli.amazonaws.com/AWSCLIV2.msi (instalador oficial da AWS pra Windows).

- [ ] **Passo 2: Criar um usuário IAM de bootstrap no Console AWS**

No Console AWS → IAM → Users → Create user. Nome sugerido: `bootstrap-cli`. Anexe a policy gerenciada `AdministratorAccess` (só para esta fase de provisionamento manual — depois do rollout, as roles OIDC criadas nas próximas tasks é que o GitHub Actions vai usar no dia a dia; este usuário de bootstrap pode inclusive ser removido ao final). Em "Security credentials" do usuário criado, gere um **Access key** (tipo "Command Line Interface (CLI)").

- [ ] **Passo 3: Configurar a AWS CLI com essa credencial**

No SEU PRÓPRIO terminal (fora desta conversa):

```
aws configure
```

Informe a Access Key ID, Secret Access Key, região padrão `us-east-1` e formato de saída `json`.

- [ ] **Passo 4: Confirmar de volta nesta conversa**

Volte pra esta conversa e apenas confirme "feito" — não cole a access key/secret aqui. A partir da próxima task, os comandos `aws` rodados pela IA já vão pegar essa credencial automaticamente do arquivo `~/.aws/credentials`.

---

### Task 2: Verificar acesso e criar o provedor OIDC do GitHub Actions

**Files:** nenhum arquivo de repositório — só chamadas AWS CLI.

**Interfaces:**
- Consumes: credencial configurada na Task 1.
- Produces: `ACCOUNT_ID`, `OIDC_PROVIDER_ARN` (gravados no arquivo de estado do rollout).

- [ ] **Passo 1: Confirmar identidade e criar o diretório de estado**

```bash
mkdir -p "C:\Users\Jorge\AppData\Local\Temp\claude\C--Users-Jorge-Desktop-Vscode-smart-irrigation-front\77d6091d-19a9-4e41-9633-af51a50b3f32\scratchpad"
STATE="C:\Users\Jorge\AppData\Local\Temp\claude\C--Users-Jorge-Desktop-Vscode-smart-irrigation-front\77d6091d-19a9-4e41-9633-af51a50b3f32\scratchpad\aws-deploy-ids.env"
aws sts get-caller-identity
```

Expected: JSON com `Account`, `Arn` do usuário `bootstrap-cli`.

- [ ] **Passo 2: Gravar o Account ID no arquivo de estado**

```bash
STATE="C:\Users\Jorge\AppData\Local\Temp\claude\C--Users-Jorge-Desktop-Vscode-smart-irrigation-front\77d6091d-19a9-4e41-9633-af51a50b3f32\scratchpad\aws-deploy-ids.env"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "export ACCOUNT_ID=$ACCOUNT_ID" > "$STATE"
cat "$STATE"
```

Expected: `export ACCOUNT_ID=123456789012` (12 dígitos).

- [ ] **Passo 3: Verificar se o OIDC provider do GitHub já existe**

```bash
source "$STATE"
aws iam list-open-id-connect-providers
```

Se já aparecer um ARN contendo `token.actions.githubusercontent.com`, pule pro Passo 5 e apenas grave esse ARN no estado.

- [ ] **Passo 4: Criar o OIDC provider (thumbprint calculado dinamicamente)**

```bash
source "$STATE"
THUMBPRINT=$(echo | openssl s_client -servername token.actions.githubusercontent.com -showcerts -connect token.actions.githubusercontent.com:443 2>/dev/null | openssl x509 -fingerprint -sha1 -noout | sed 's/.*=//; s/://g' | tr 'A-Z' 'a-z')
echo "Thumbprint: $THUMBPRINT"
OIDC_PROVIDER_ARN=$(aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list "$THUMBPRINT" \
  --query OpenIDConnectProviderArn --output text)
echo "export OIDC_PROVIDER_ARN=$OIDC_PROVIDER_ARN" >> "$STATE"
cat "$STATE"
```

Expected: `arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com` gravado no estado.

- [ ] **Passo 5 (se pulou o Passo 4): gravar o ARN existente**

```bash
source "$STATE"
OIDC_PROVIDER_ARN=$(aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?contains(Arn, 'token.actions.githubusercontent.com')].Arn" --output text)
echo "export OIDC_PROVIDER_ARN=$OIDC_PROVIDER_ARN" >> "$STATE"
```

---

### Task 3: Certificado ACM (SAN) para os dois domínios

**Interfaces:**
- Consumes: `ACCOUNT_ID` (Task 2).
- Produces: `CERT_ARN` (status `ISSUED` ao final da task — bloqueia até o usuário validar via DNS).

- [ ] **Passo 1: Solicitar o certificado**

```bash
source "$STATE"
CERT_ARN=$(aws acm request-certificate \
  --region us-east-1 \
  --domain-name dashboard.velika.com.br \
  --subject-alternative-names api.velika.com.br \
  --validation-method DNS \
  --query CertificateArn --output text)
echo "export CERT_ARN=$CERT_ARN" >> "$STATE"
echo "$CERT_ARN"
```

Expected: ARN no formato `arn:aws:acm:us-east-1:<ACCOUNT_ID>:certificate/<uuid>`.

- [ ] **Passo 2: Obter os registros CNAME de validação**

```bash
source "$STATE"
sleep 10
aws acm describe-certificate --region us-east-1 --certificate-arn "$CERT_ARN" \
  --query "Certificate.DomainValidationOptions[].{Domain:DomainName,Name:ResourceRecord.Name,Value:ResourceRecord.Value}" \
  --output table
```

Expected: uma linha por domínio (`dashboard.velika.com.br` e `api.velika.com.br`), cada uma com `Name` e `Value` de um registro CNAME. Se `Name`/`Value` vierem vazios, espere ~30s e rode de novo.

- [ ] **Passo 3 (usuário): criar os 2 registros CNAME no provedor de DNS atual**

No painel do seu provedor de DNS (fora da AWS), crie um registro CNAME pra cada linha da tabela do Passo 2: nome = coluna `Name` (sem o domínio raiz, dependendo de como o provedor pede), valor = coluna `Value`.

- [ ] **Passo 4: Aguardar a validação (pode levar de minutos a algumas horas, depende da propagação DNS)**

```bash
source "$STATE"
aws acm wait certificate-validated --region us-east-1 --certificate-arn "$CERT_ARN"
echo "Certificado validado."
```

Expected: comando retorna sem erro (ele fica bloqueado até validar ou até dar timeout). Se der timeout, rode de novo depois de confirmar que os CNAMEs de validação propagaram (`nslookup -type=CNAME <Name>`).

---

### Task 4: Front-end — bucket S3 de origem

**Interfaces:**
- Consumes: `ACCOUNT_ID`.
- Produces: `FRONT_BUCKET` (nome do bucket).

- [ ] **Passo 1: Criar o bucket**

```bash
source "$STATE"
FRONT_BUCKET="smart-irrigation-front-$ACCOUNT_ID"
aws s3api create-bucket --bucket "$FRONT_BUCKET" --region us-east-1
echo "export FRONT_BUCKET=$FRONT_BUCKET" >> "$STATE"
```

Expected: JSON de resposta com `"Location": "/smart-irrigation-front-<ACCOUNT_ID>"`.

- [ ] **Passo 2: Bloquear todo acesso público (o bucket só será acessado via CloudFront/OAC)**

```bash
source "$STATE"
aws s3api put-public-access-block --bucket "$FRONT_BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

Expected: sem saída (sucesso silencioso).

- [ ] **Passo 3: Verificar**

```bash
source "$STATE"
aws s3api get-public-access-block --bucket "$FRONT_BUCKET"
```

Expected: os 4 campos como `true`.

---

### Task 5: Front-end — distribuição CloudFront #1 (Console) + policy do bucket

Criar a distribuição pelo Console é mais confiável aqui do que montar o JSON de `create-distribution` na mão, porque o wizard já linka o Origin Access Control (OAC) com a origem S3 corretamente.

**Interfaces:**
- Consumes: `FRONT_BUCKET` (Task 4), `CERT_ARN` (Task 3).
- Produces: `FRONT_DIST_ID`, `FRONT_DIST_DOMAIN`.

- [ ] **Passo 1 (Console): criar a distribuição**

AWS Console → CloudFront → Create distribution.
- **Origin domain**: selecione o bucket `smart-irrigation-front-<ACCOUNT_ID>` (S3).
- **Origin access**: "Origin access control settings (recommended)" → Create new OAC (nome sugerido: `smart-irrigation-front-oac`) → Create.
- **Viewer protocol policy**: Redirect HTTP to HTTPS.
- **Alternate domain name (CNAME)**: `dashboard.velika.com.br`.
- **Custom SSL certificate**: selecione o certificado ACM criado na Task 3 (deve aparecer pelo domínio).
- **Default root object**: `index.html`.
- **Description/Comment** (campo do distribution, em Settings gerais): `smart-irrigation-front` — importante pra localizar via CLI depois.
- Create distribution. Depois de criada, o Console mostra um banner pra **atualizar a bucket policy** automaticamente — clique em "Copy policy" / "Update bucket policy" se o wizard oferecer; se não oferecer, aplique via CLI no Passo 3 abaixo.

- [ ] **Passo 2 (Console): configurar SPA routing (erros 403/404 → index.html)**

Na distribuição criada → aba **Error pages** → Create custom error response:
- HTTP error code `403` → Response page path `/index.html` → HTTP Response code `200`.
- Repita para HTTP error code `404` → mesmo destino.

- [ ] **Passo 3: capturar o ID/domínio da distribuição e aplicar a bucket policy via CLI (caso o wizard não tenha aplicado)**

```bash
source "$STATE"
FRONT_DIST_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='smart-irrigation-front'].Id" --output text)
FRONT_DIST_DOMAIN=$(aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='smart-irrigation-front'].DomainName" --output text)
echo "export FRONT_DIST_ID=$FRONT_DIST_ID" >> "$STATE"
echo "export FRONT_DIST_DOMAIN=$FRONT_DIST_DOMAIN" >> "$STATE"
echo "Dist ID: $FRONT_DIST_ID / Domain: $FRONT_DIST_DOMAIN"

node -e "
const policy = {
  Version: '2012-10-17',
  Statement: [{
    Sid: 'AllowCloudFrontServicePrincipal',
    Effect: 'Allow',
    Principal: { Service: 'cloudfront.amazonaws.com' },
    Action: 's3:GetObject',
    Resource: 'arn:aws:s3:::$FRONT_BUCKET/*',
    Condition: { StringEquals: { 'AWS:SourceArn': 'arn:aws:cloudfront::$ACCOUNT_ID:distribution/$FRONT_DIST_ID' } }
  }]
};
require('fs').writeFileSync('bucket-policy.json', JSON.stringify(policy, null, 2));
"
aws s3api put-bucket-policy --bucket "$FRONT_BUCKET" --policy file://bucket-policy.json
rm bucket-policy.json
```

Expected: sem erro. Confirme com `aws s3api get-bucket-policy --bucket "$FRONT_BUCKET"`.

- [ ] **Passo 4: aguardar a distribuição ficar "Deployed"**

```bash
source "$STATE"
aws cloudfront wait distribution-deployed --id "$FRONT_DIST_ID"
echo "Distribuição pronta: https://$FRONT_DIST_DOMAIN"
```

Expected: comando retorna sem erro (leva alguns minutos).

---

### Task 6: Front-end — IAM role para o GitHub Actions

**Interfaces:**
- Consumes: `OIDC_PROVIDER_ARN`, `FRONT_BUCKET`, `FRONT_DIST_ID`, `ACCOUNT_ID`.
- Produces: `FRONT_ROLE_ARN`.

- [ ] **Passo 1: Criar a trust policy e a role**

```bash
source "$STATE"
node -e "
const trust = {
  Version: '2012-10-17',
  Statement: [{
    Effect: 'Allow',
    Principal: { Federated: '$OIDC_PROVIDER_ARN' },
    Action: 'sts:AssumeRoleWithWebIdentity',
    Condition: {
      StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
      StringLike: { 'token.actions.githubusercontent.com:sub': 'repo:jorgearaujor/smart-irrigation-front:ref:refs/heads/master' }
    }
  }]
};
require('fs').writeFileSync('trust-front.json', JSON.stringify(trust, null, 2));
"
FRONT_ROLE_ARN=$(aws iam create-role \
  --role-name gha-deploy-smart-irrigation-front \
  --assume-role-policy-document file://trust-front.json \
  --query Role.Arn --output text)
echo "export FRONT_ROLE_ARN=$FRONT_ROLE_ARN" >> "$STATE"
rm trust-front.json
echo "$FRONT_ROLE_ARN"
```

Expected: `arn:aws:iam::<ACCOUNT_ID>:role/gha-deploy-smart-irrigation-front`.

- [ ] **Passo 2: Anexar a permissions policy (S3 + invalidação do CloudFront)**

```bash
source "$STATE"
node -e "
const policy = {
  Version: '2012-10-17',
  Statement: [
    {
      Sid: 'S3Deploy',
      Effect: 'Allow',
      Action: ['s3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
      Resource: ['arn:aws:s3:::$FRONT_BUCKET', 'arn:aws:s3:::$FRONT_BUCKET/*']
    },
    {
      Sid: 'CloudFrontInvalidate',
      Effect: 'Allow',
      Action: 'cloudfront:CreateInvalidation',
      Resource: 'arn:aws:cloudfront::$ACCOUNT_ID:distribution/$FRONT_DIST_ID'
    }
  ]
};
require('fs').writeFileSync('policy-front.json', JSON.stringify(policy, null, 2));
"
aws iam put-role-policy \
  --role-name gha-deploy-smart-irrigation-front \
  --policy-name deploy-permissions \
  --policy-document file://policy-front.json
rm policy-front.json
```

Expected: sem saída. Confirme com `aws iam get-role-policy --role-name gha-deploy-smart-irrigation-front --policy-name deploy-permissions`.

---

### Task 7: Front-end — workflow do GitHub Actions + secrets + primeiro deploy

**Files:**
- Create: `smart-irrigation-front/.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `FRONT_ROLE_ARN`, `FRONT_BUCKET`, `FRONT_DIST_ID` (viram GitHub Secrets, não variáveis do workflow).

- [ ] **Passo 1: Criar o workflow**

```yaml
name: Deploy front-end

on:
  push:
    branches: [master]
  workflow_dispatch: {}

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Instalar dependências
        run: npm ci

      - name: Gerar .env a partir dos secrets do Firebase
        run: |
          cat > .env <<EOF
          FIREBASE_API_KEY=${{ secrets.FIREBASE_API_KEY }}
          FIREBASE_AUTH_DOMAIN=${{ secrets.FIREBASE_AUTH_DOMAIN }}
          FIREBASE_PROJECT_ID=${{ secrets.FIREBASE_PROJECT_ID }}
          FIREBASE_STORAGE_BUCKET=${{ secrets.FIREBASE_STORAGE_BUCKET }}
          FIREBASE_MESSAGING_SENDER_ID=${{ secrets.FIREBASE_MESSAGING_SENDER_ID }}
          FIREBASE_APP_ID=${{ secrets.FIREBASE_APP_ID }}
          FIREBASE_MEASUREMENT_ID=${{ secrets.FIREBASE_MEASUREMENT_ID }}
          EOF

      - name: Build de produção
        run: npm run build -- --configuration production

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-east-1

      - name: Sync pro S3
        run: aws s3 sync dist/smart-irrigation-front/browser "s3://${{ secrets.S3_BUCKET_NAME }}" --delete

      - name: Invalidar cache do CloudFront
        run: aws cloudfront create-invalidation --distribution-id "${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }}" --paths "/*"
```

- [ ] **Passo 2: Commitar o workflow**

```bash
cd "C:\Users\Jorge\Desktop\Vscode\smart-irrigation-front"
git add .github/workflows/deploy.yml
git commit -m "ci: adiciona deploy automatico do front para S3/CloudFront"
```

- [ ] **Passo 3 (usuário): cadastrar os secrets no GitHub**

No repositório `jorgearaujor/smart-irrigation-front` → Settings → Secrets and variables → Actions → New repository secret. Crie (os 3 primeiros valores estão no arquivo de estado do rollout; os 7 de Firebase estão no `.env` local do front ou no `.env.example`/Firebase Console):

| Secret | Valor |
|---|---|
| `AWS_ROLE_ARN` | valor de `FRONT_ROLE_ARN` no arquivo de estado |
| `S3_BUCKET_NAME` | valor de `FRONT_BUCKET` |
| `CLOUDFRONT_DISTRIBUTION_ID` | valor de `FRONT_DIST_ID` |
| `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `FIREBASE_MEASUREMENT_ID` | os mesmos valores do `.env` local do front |

- [ ] **Passo 4: Push e verificar o deploy**

```bash
cd "C:\Users\Jorge\Desktop\Vscode\smart-irrigation-front"
git push
```

Acompanhe em GitHub → Actions. Ao terminar, verifique (ainda pelo domínio da CloudFront, antes do corte de DNS na Task 11):

```bash
source "$STATE"
curl -sI "https://$FRONT_DIST_DOMAIN" | head -n 1
```

Expected: `HTTP/2 200`.

---

### Task 8: Backend — preparar o repo pra rodar na plataforma Java SE do Elastic Beanstalk

A plataforma "Java SE" do Elastic Beanstalk roda `java -jar` direto (sem Docker/Tomcat) e espera que a aplicação escute na porta definida pela variável de ambiente `PORT`. O jar também precisa ter um nome previsível pro workflow referenciar.

**Files:**
- Modify: `smart-irrigation/pom.xml`
- Modify: `smart-irrigation/src/main/resources/application.properties`

**Interfaces:**
- Produces: `target/app.jar` (nome fixo, usado pela Task 10).

- [ ] **Passo 1: Fixar o nome do jar gerado**

Em `smart-irrigation/pom.xml`, dentro de `<build>`, adicione `<finalName>` antes de `<plugins>`:

```xml
<build>
    <finalName>app</finalName>
    <plugins>
```

- [ ] **Passo 2: Escutar na porta que o Elastic Beanstalk injeta**

Em `smart-irrigation/src/main/resources/application.properties`, adicione uma linha:

```properties
spring.application.name=smart-irrigation
springdoc.swagger-ui.path=/swagger-ui.html
spring.config.import=optional:file:.env[.properties]
server.port=${PORT:8080}
```

- [ ] **Passo 3: Build local pra confirmar que nada quebrou**

```bash
cd "C:\Users\Jorge\IdeaProjects\smart-irrigation"
./mvnw -B clean package
ls target/app.jar
```

Expected: `target/app.jar` existe e os testes do `package` passam.

- [ ] **Passo 4: Commitar**

```bash
cd "C:\Users\Jorge\IdeaProjects\smart-irrigation"
git add pom.xml src/main/resources/application.properties
git commit -m "build: fixa nome do jar e porta via PORT para Elastic Beanstalk"
```

---

### Task 9: Backend — aplicação e ambiente Elastic Beanstalk (Console)

**Interfaces:**
- Consumes: `target/app.jar` (Task 8, só pro primeiro deploy manual opcional — o real vem do workflow).
- Produces: `EB_APP_NAME=smart-irrigation-api`, `EB_ENV_NAME=smart-irrigation-api-prod`, `EB_ENV_DOMAIN`.

- [ ] **Passo 1 (Console): criar a aplicação**

AWS Console → Elastic Beanstalk → Applications → Create application. Nome: `smart-irrigation-api`.

- [ ] **Passo 2 (Console): criar o ambiente**

Dentro da aplicação → Create environment → **Web server environment**.
- **Environment name**: `smart-irrigation-api-prod`.
- **Platform**: "Java SE" → escolha a versão mais recente do Corretto 17 disponível (ex.: "Corretto 17 running on 64bit Amazon Linux 2023").
- **Application code**: "Sample application" (o deploy real vem do GitHub Actions na Task 10).
- Em **Configure more options** → categoria **Capacity**: mude o "Environment type" de "Load balanced" para **"Single instance"**.
- Categoria **Instance traffic and scaling**: instance type `t3.micro` (ou a que já for sugerida como free-tier).
- Demais categorias (Service role, Instance profile): aceite a criação automática dos papéis padrão (`aws-elasticbeanstalk-service-role`, `aws-elasticbeanstalk-ec2-role`) se ainda não existirem.
- Create environment. Aguarde o status ficar **Ok** (verde) — leva alguns minutos.

- [ ] **Passo 3: capturar o domínio do ambiente via CLI**

```bash
source "$STATE"
EB_ENV_DOMAIN=$(aws elasticbeanstalk describe-environments \
  --application-name smart-irrigation-api --environment-names smart-irrigation-api-prod \
  --query "Environments[0].CNAME" --output text)
echo "export EB_APP_NAME=smart-irrigation-api" >> "$STATE"
echo "export EB_ENV_NAME=smart-irrigation-api-prod" >> "$STATE"
echo "export EB_ENV_DOMAIN=$EB_ENV_DOMAIN" >> "$STATE"
echo "$EB_ENV_DOMAIN"
```

Expected: algo como `smart-irrigation-api-prod.xxxxxxxxxx.us-east-1.elasticbeanstalk.com`.

---

### Task 10: Backend — variáveis de ambiente do Elastic Beanstalk (lidas do `.env` local)

Este script lê o `.env` real do backend (que já existe localmente e nunca foi commitado) e o JSON da service account do Firebase, e passa os valores direto pro `aws elasticbeanstalk update-environment` — sem nunca imprimir os segredos no terminal/chat.

**Interfaces:**
- Consumes: `smart-irrigation/.env`, arquivo JSON apontado por `GOOGLE_APPLICATION_CREDENTIALS` dentro dele, `EB_APP_NAME`, `EB_ENV_NAME`.

- [ ] **Passo 1: Rodar o script de configuração**

```bash
source "$STATE"
cd "C:\Users\Jorge\IdeaProjects\smart-irrigation"
node -e "
const fs = require('fs');
const path = require('path');

function parseEnv(file) {
  const vars = {};
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    vars[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return vars;
}

const envVars = parseEnv('.env');
const credPath = path.resolve(envVars.GOOGLE_APPLICATION_CREDENTIALS);
const credJson = fs.readFileSync(credPath, 'utf8');
const credB64 = Buffer.from(credJson, 'utf8').toString('base64');

const settings = [
  { Namespace: 'aws:elasticbeanstalk:application:environment', OptionName: 'FIRESTORE_PROJECT_ID', Value: envVars.FIRESTORE_PROJECT_ID },
  { Namespace: 'aws:elasticbeanstalk:application:environment', OptionName: 'DEVICE_API_KEY', Value: envVars.DEVICE_API_KEY },
  { Namespace: 'aws:elasticbeanstalk:application:environment', OptionName: 'DASHBOARD_AUTH_ENABLED', Value: envVars.DASHBOARD_AUTH_ENABLED || 'false' },
  { Namespace: 'aws:elasticbeanstalk:application:environment', OptionName: 'MYAPP_CORS_ALLOWED_ORIGINS', Value: 'https://dashboard.velika.com.br' },
  { Namespace: 'aws:elasticbeanstalk:application:environment', OptionName: 'GOOGLE_APPLICATION_CREDENTIALS', Value: '/var/app/current/firebase-service-account.json' },
  { Namespace: 'aws:elasticbeanstalk:application:environment', OptionName: 'FIREBASE_SERVICE_ACCOUNT_JSON_BASE64', Value: credB64 },
];

fs.writeFileSync('eb-option-settings.json', JSON.stringify(settings, null, 2));
console.log('eb-option-settings.json gerado, ' + settings.length + ' variaveis.');
"

aws elasticbeanstalk update-environment \
  --application-name "$EB_APP_NAME" \
  --environment-name "$EB_ENV_NAME" \
  --option-settings file://eb-option-settings.json

rm eb-option-settings.json
```

Expected: JSON de resposta com `"Status": "Updating"`. O arquivo `eb-option-settings.json` é apagado logo em seguida (continha o JSON da service account em base64).

- [ ] **Passo 2: Aguardar o ambiente voltar pra "Ready"**

```bash
source "$STATE"
aws elasticbeanstalk wait environment-updated --application-name "$EB_APP_NAME" --environment-names "$EB_ENV_NAME"
echo "Ambiente atualizado."
```

---

### Task 11: Backend — hook que escreve o JSON da service account em disco

O Elastic Beanstalk (plataforma Amazon Linux 2023) expõe as environment properties pro app via variáveis de ambiente do processo Java automaticamente, mas os **hooks de deploy** (que rodam antes do app subir) precisam ler essas properties através do utilitário `get-config` — não vêm como env var do shell do hook.

**Files:**
- Create: `smart-irrigation/.platform/hooks/predeploy/01_write_firebase_credentials.sh`

**Interfaces:**
- Consumes: environment property `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` (Task 10).
- Produces: `/var/app/staging/firebase-service-account.json` na instância (promovido a `/var/app/current/...` quando o deploy é finalizado — mesmo caminho setado em `GOOGLE_APPLICATION_CREDENTIALS` na Task 10).

- [ ] **Passo 1: Criar o hook**

```bash
mkdir -p "C:\Users\Jorge\IdeaProjects\smart-irrigation\.platform\hooks\predeploy"
```

Conteúdo de `smart-irrigation/.platform/hooks/predeploy/01_write_firebase_credentials.sh`:

```bash
#!/bin/bash
set -e
FIREBASE_JSON_B64=$(/opt/elasticbeanstalk/bin/get-config environment -k FIREBASE_SERVICE_ACCOUNT_JSON_BASE64)
echo "$FIREBASE_JSON_B64" | base64 --decode > /var/app/staging/firebase-service-account.json
chmod 600 /var/app/staging/firebase-service-account.json
```

- [ ] **Passo 2: Marcar como executável e commitar**

Hooks do Elastic Beanstalk precisam do bit de execução, que o Git no Windows não seta sozinho:

```bash
cd "C:\Users\Jorge\IdeaProjects\smart-irrigation"
git add .platform/hooks/predeploy/01_write_firebase_credentials.sh
git update-index --chmod=+x .platform/hooks/predeploy/01_write_firebase_credentials.sh
git commit -m "ci: escreve a service account do Firebase em disco no deploy do EB"
```

---

### Task 12: Backend — distribuição CloudFront #2 (Console) na frente do Elastic Beanstalk

**Interfaces:**
- Consumes: `EB_ENV_DOMAIN` (Task 9), `CERT_ARN` (Task 3).
- Produces: `API_DIST_ID`, `API_DIST_DOMAIN`.

- [ ] **Passo 1 (Console): criar a distribuição**

AWS Console → CloudFront → Create distribution.
- **Origin domain**: cole manualmente o valor de `EB_ENV_DOMAIN` (é um domínio custom, não vai aparecer no dropdown de S3/etc.).
- **Protocol**: HTTP only, porta 80.
- **Viewer protocol policy**: Redirect HTTP to HTTPS.
- **Cache policy**: `CachingDisabled` (gerenciada pela AWS).
- **Origin request policy**: `AllViewer` (gerenciada pela AWS — encaminha todos os headers, cookies e query strings, necessário pra `Authorization`, `X-Device-Key` e CORS).
- **Alternate domain name (CNAME)**: `api.velika.com.br`.
- **Custom SSL certificate**: o mesmo certificado ACM da Task 3.
- **Description/Comment**: `smart-irrigation-api`.
- Create distribution.

- [ ] **Passo 2: capturar ID/domínio e aguardar deploy**

```bash
source "$STATE"
API_DIST_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='smart-irrigation-api'].Id" --output text)
API_DIST_DOMAIN=$(aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='smart-irrigation-api'].DomainName" --output text)
echo "export API_DIST_ID=$API_DIST_ID" >> "$STATE"
echo "export API_DIST_DOMAIN=$API_DIST_DOMAIN" >> "$STATE"
aws cloudfront wait distribution-deployed --id "$API_DIST_ID"
echo "Distribuicao pronta: https://$API_DIST_DOMAIN"
```

---

### Task 13: Backend — IAM role, workflow do GitHub Actions e primeiro deploy

**Files:**
- Create: `smart-irrigation/.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `OIDC_PROVIDER_ARN`, `ACCOUNT_ID`, `EB_APP_NAME`, `EB_ENV_NAME`.

- [ ] **Passo 1: Criar a role + policy pro backend**

```bash
source "$STATE"
node -e "
const trust = {
  Version: '2012-10-17',
  Statement: [{
    Effect: 'Allow',
    Principal: { Federated: '$OIDC_PROVIDER_ARN' },
    Action: 'sts:AssumeRoleWithWebIdentity',
    Condition: {
      StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
      StringLike: { 'token.actions.githubusercontent.com:sub': 'repo:jorgearaujor/smart-irrigation-api:ref:refs/heads/master' }
    }
  }]
};
require('fs').writeFileSync('trust-backend.json', JSON.stringify(trust, null, 2));
"
BACKEND_ROLE_ARN=$(aws iam create-role \
  --role-name gha-deploy-smart-irrigation-api \
  --assume-role-policy-document file://trust-backend.json \
  --query Role.Arn --output text)
echo "export BACKEND_ROLE_ARN=$BACKEND_ROLE_ARN" >> "$STATE"
rm trust-backend.json

EB_BUCKET=$(aws elasticbeanstalk create-storage-location --query S3Bucket --output text)
echo "export EB_BUCKET=$EB_BUCKET" >> "$STATE"

node -e "
const policy = {
  Version: '2012-10-17',
  Statement: [
    {
      Sid: 'ElasticBeanstalkDeploy',
      Effect: 'Allow',
      Action: [
        'elasticbeanstalk:CreateApplicationVersion',
        'elasticbeanstalk:DescribeApplicationVersions',
        'elasticbeanstalk:UpdateEnvironment',
        'elasticbeanstalk:DescribeEnvironments',
        'elasticbeanstalk:DescribeEvents',
        'elasticbeanstalk:DescribeConfigurationSettings'
      ],
      Resource: '*'
    },
    {
      Sid: 'EBStorageBucket',
      Effect: 'Allow',
      Action: ['s3:PutObject', 's3:GetObject', 's3:ListBucket'],
      Resource: ['arn:aws:s3:::$EB_BUCKET', 'arn:aws:s3:::$EB_BUCKET/*']
    },
    {
      Sid: 'EBHealthDescribe',
      Effect: 'Allow',
      Action: ['autoscaling:DescribeAutoScalingGroups', 'autoscaling:DescribeScalingActivities', 'ec2:DescribeInstances'],
      Resource: '*'
    }
  ]
};
require('fs').writeFileSync('policy-backend.json', JSON.stringify(policy, null, 2));
"
aws iam put-role-policy \
  --role-name gha-deploy-smart-irrigation-api \
  --policy-name deploy-permissions \
  --policy-document file://policy-backend.json
rm policy-backend.json
echo "$BACKEND_ROLE_ARN"
```

Expected: `BACKEND_ROLE_ARN` no formato `arn:aws:iam::<ACCOUNT_ID>:role/gha-deploy-smart-irrigation-api`.

- [ ] **Passo 2: Criar o workflow**

```yaml
name: Deploy backend

on:
  push:
    branches: [master]
  workflow_dispatch: {}

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: 'corretto'
          java-version: '17'
          cache: 'maven'

      - name: Build
        run: ./mvnw -B clean package

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-east-1

      - name: Deploy no Elastic Beanstalk
        uses: einaregilsson/beanstalk-deploy@v22
        with:
          aws_access_key: ${{ env.AWS_ACCESS_KEY_ID }}
          aws_secret_key: ${{ env.AWS_SECRET_ACCESS_KEY }}
          aws_session_token: ${{ env.AWS_SESSION_TOKEN }}
          application_name: ${{ secrets.EB_APPLICATION_NAME }}
          environment_name: ${{ secrets.EB_ENVIRONMENT_NAME }}
          version_label: ${{ github.sha }}
          region: us-east-1
          deployment_package: target/app.jar
```

- [ ] **Passo 3: Commitar**

```bash
cd "C:\Users\Jorge\IdeaProjects\smart-irrigation"
git add .github/workflows/deploy.yml
git commit -m "ci: adiciona deploy automatico do backend para Elastic Beanstalk"
```

- [ ] **Passo 4 (usuário): cadastrar os secrets no GitHub**

No repositório `jorgearaujor/smart-irrigation-api` → Settings → Secrets and variables → Actions:

| Secret | Valor |
|---|---|
| `AWS_ROLE_ARN` | valor de `BACKEND_ROLE_ARN` no arquivo de estado |
| `EB_APPLICATION_NAME` | `smart-irrigation-api` |
| `EB_ENVIRONMENT_NAME` | `smart-irrigation-api-prod` |

- [ ] **Passo 5: Push e verificar**

```bash
cd "C:\Users\Jorge\IdeaProjects\smart-irrigation"
git push
```

Acompanhe em GitHub → Actions. Ao terminar:

```bash
source "$STATE"
curl -s "https://$API_DIST_DOMAIN/swagger-ui.html" -o /dev/null -w "%{http_code}\n"
```

Expected: `200`.

---

### Task 14: Corte de DNS final (ação manual do usuário)

- [ ] **Passo 1: Criar os CNAMEs finais no provedor de DNS atual**

```bash
source "$STATE"
echo "dashboard.velika.com.br -> $FRONT_DIST_DOMAIN"
echo "api.velika.com.br -> $API_DIST_DOMAIN"
```

No painel do seu provedor de DNS, crie:
- CNAME `dashboard.velika.com.br` → valor de `$FRONT_DIST_DOMAIN`.
- CNAME `api.velika.com.br` → valor de `$API_DIST_DOMAIN`.

(Os CNAMEs de validação do certificado ACM, criados na Task 3, podem ficar ou ser removidos depois que o certificado estiver `ISSUED` — a AWS não precisa mais deles pra manter o certificado válido, só usou pra validar a posse do domínio uma vez.)

- [ ] **Passo 2: Aguardar propagação e verificar**

```bash
nslookup dashboard.velika.com.br
nslookup api.velika.com.br
```

Expected: resolve pro domínio `*.cloudfront.net` correspondente.

---

### Task 15: Verificação fim a fim

- [ ] **Passo 1: Dashboard via domínio final**

```bash
curl -sI https://dashboard.velika.com.br | head -n 1
```

Expected: `HTTP/2 200`.

- [ ] **Passo 2: API via domínio final**

```bash
curl -s https://api.velika.com.br/swagger-ui.html -o /dev/null -w "%{http_code}\n"
```

Expected: `200`.

- [ ] **Passo 3: CORS entre os dois domínios**

```bash
curl -s -X OPTIONS https://api.velika.com.br/api/culturas \
  -H "Origin: https://dashboard.velika.com.br" \
  -H "Access-Control-Request-Method: GET" \
  -o /dev/null -D - | grep -i access-control-allow-origin
```

Expected: header `Access-Control-Allow-Origin: https://dashboard.velika.com.br` (confirma que `MYAPP_CORS_ALLOWED_ORIGINS` setado na Task 10 está correto).

- [ ] **Passo 4: Abrir `https://dashboard.velika.com.br` num navegador e conferir visualmente**

Confirme que o dashboard carrega, que os gráficos aparecem (dados mock, já que `useMockData: true` por padrão) e que não há erros de console relacionados a CORS ou 404 de assets.

- [ ] **Passo 5: Checklist de custo/segurança pós-rollout**

- Remover ou reduzir a policy `AdministratorAccess` do usuário `bootstrap-cli` criado na Task 1 (ele não é mais necessário depois do provisionamento).
- Anotar que `t3.micro` do Elastic Beanstalk deixa de ser free-tier depois de 12 meses de conta nova — revisar custo então.
