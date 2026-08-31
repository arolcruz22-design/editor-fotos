import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa .env (copia .env.example).`);
  }
  return value;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',

  databaseUrl: required('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/estudio4k_db'),

  jwtSecret: required('JWT_SECRET', 'dev_only_secret_change_me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 10),

  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY ?? '',

  higgsfield: {
    apiKey: process.env.HIGGSFIELD_API_KEY ?? '',
    baseUrl: process.env.HIGGSFIELD_BASE_URL ?? 'https://api.higgsfield.ai/v1',
    workspaceId: process.env.HIGGSFIELD_WORKSPACE_ID ?? '',
  },

  meta: {
    appId: process.env.FB_APP_ID ?? '',
    appSecret: process.env.FB_APP_SECRET ?? '',
    graphApiVersion: process.env.FB_GRAPH_API_VERSION ?? 'v21.0',
  },

  company: {
    name: process.env.COMPANY_NAME ?? 'Todomotos S.A. de C.V.',
    country: process.env.COMPANY_COUNTRY ?? 'Honduras',
    timezone: process.env.COMPANY_TIMEZONE ?? 'America/Tegucigalpa',
    defaultCurrency: process.env.DEFAULT_CURRENCY ?? 'HNL',
  },
};
