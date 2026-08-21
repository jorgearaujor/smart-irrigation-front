#!/usr/bin/env node
// Le variaveis de ambiente (nesta ordem de prioridade: variaveis reais do processo/host,
// como as configuradas na Vercel > .env local, nao versionado > .env.example) e gera:
//  - src/environments/firebase.config.ts
//  - src/environments/runtime-flags.ts
// Sem nenhuma fonte configurada, cai para os defaults abaixo (login nao funciona,
// mas o app sobe com dados mockados).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(rootDir, '.env');
const envExamplePath = resolve(rootDir, '.env.example');
const firebaseOutPath = resolve(rootDir, 'src/environments/firebase.config.ts');
const runtimeFlagsOutPath = resolve(rootDir, 'src/environments/runtime-flags.ts');

const FIREBASE_KEYS = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_MEASUREMENT_ID',
];

const DEFAULTS = {
  USE_MOCK_DATA: 'false',
  REQUIRE_AUTH: 'true',
  API_BASE_URL: 'http://localhost:8080/api',
};

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

const exampleVars = parseEnvFile(envExamplePath) ?? {};
const localVars = parseEnvFile(envPath);

function readVar(key) {
  if (process.env[key] !== undefined && process.env[key] !== '') return process.env[key];
  if (localVars && localVars[key] !== undefined && localVars[key] !== '') return localVars[key];
  if (exampleVars[key] !== undefined && exampleVars[key] !== '') return exampleVars[key];
  return DEFAULTS[key] ?? '';
}

const source = process.env.VERCEL
  ? 'variaveis de ambiente da Vercel'
  : localVars
    ? '.env'
    : '.env.example';

const missingFirebase = FIREBASE_KEYS.filter((key) => !readVar(key));
if (missingFirebase.length > 0) {
  console.warn(
    `[generate-env] Variaveis do Firebase ausentes (${source}): ${missingFirebase.join(', ')} — login nao vai funcionar.`,
  );
}

const firebaseConfig = Object.fromEntries(FIREBASE_KEYS.map((key) => [key, readVar(key)]));

const firebaseFileContent = `// Arquivo GERADO por scripts/generate-env.mjs a partir do .env — nao editar a mao, nao commitar.
export const firebaseConfig = {
  apiKey: '${firebaseConfig.FIREBASE_API_KEY}',
  authDomain: '${firebaseConfig.FIREBASE_AUTH_DOMAIN}',
  projectId: '${firebaseConfig.FIREBASE_PROJECT_ID}',
  storageBucket: '${firebaseConfig.FIREBASE_STORAGE_BUCKET}',
  messagingSenderId: '${firebaseConfig.FIREBASE_MESSAGING_SENDER_ID}',
  appId: '${firebaseConfig.FIREBASE_APP_ID}',
  measurementId: '${firebaseConfig.FIREBASE_MEASUREMENT_ID}',
};
`;

const useMockData = readVar('USE_MOCK_DATA').toLowerCase() === 'true';
const requireAuth = readVar('REQUIRE_AUTH').toLowerCase() === 'true';
const apiBaseUrl = readVar('API_BASE_URL');

const runtimeFlagsFileContent = `// Arquivo GERADO por scripts/generate-env.mjs a partir do .env — nao editar a mao, nao commitar.
export const runtimeFlags = {
  useMockData: ${useMockData},
  requireAuth: ${requireAuth},
  apiBaseUrl: '${apiBaseUrl}',
};
`;

mkdirSync(dirname(firebaseOutPath), { recursive: true });
writeFileSync(firebaseOutPath, firebaseFileContent, 'utf8');
writeFileSync(runtimeFlagsOutPath, runtimeFlagsFileContent, 'utf8');
console.log(`[generate-env] firebase.config.ts e runtime-flags.ts gerados (fonte: ${source}).`);
