#!/usr/bin/env node
// Le o .env (nao versionado) e gera src/environments/firebase.config.ts.
// Sem .env, cai para .env.example (login nao funciona, mas o app sobe com dados mockados).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(rootDir, '.env');
const envExamplePath = resolve(rootDir, '.env.example');
const outPath = resolve(rootDir, 'src/environments/firebase.config.ts');

const REQUIRED_KEYS = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_MEASUREMENT_ID',
];

function parseEnvFile(path) {
  if (!existsSync(path)) return null;
  const vars = {};
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

let vars = parseEnvFile(envPath);
let source = '.env';
if (!vars) {
  console.warn(
    '[generate-env] .env nao encontrado na raiz do projeto — usando .env.example (login com Firebase nao vai funcionar).\n' +
      '[generate-env] Copie .env.example para .env e preencha com as credenciais reais do Firebase Web App.',
  );
  vars = parseEnvFile(envExamplePath) ?? {};
  source = '.env.example';
}

const missing = REQUIRED_KEYS.filter((key) => !vars[key]);
if (missing.length > 0) {
  console.warn(`[generate-env] Variaveis vazias em ${source}: ${missing.join(', ')}`);
}

const config = Object.fromEntries(REQUIRED_KEYS.map((key) => [key, vars[key] ?? '']));

const fileContent = `// Arquivo GERADO por scripts/generate-env.mjs a partir do .env — nao editar a mao, nao commitar.
export const firebaseConfig = {
  apiKey: '${config.FIREBASE_API_KEY}',
  authDomain: '${config.FIREBASE_AUTH_DOMAIN}',
  projectId: '${config.FIREBASE_PROJECT_ID}',
  storageBucket: '${config.FIREBASE_STORAGE_BUCKET}',
  messagingSenderId: '${config.FIREBASE_MESSAGING_SENDER_ID}',
  appId: '${config.FIREBASE_APP_ID}',
  measurementId: '${config.FIREBASE_MEASUREMENT_ID}',
};
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, fileContent, 'utf8');
console.log(`[generate-env] src/environments/firebase.config.ts gerado a partir de ${source}.`);
