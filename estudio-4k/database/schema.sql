-- Estudio 4K Profesional · Todomotos S.A. de C.V.
-- Esquema PostgreSQL

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Usuarios del panel (equipo de Todomotos que administra el estudio)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cuentas publicitarias de Facebook/Meta conectadas.
-- Permite administrar varias cuentas de anuncios (una por tienda/marca) desde
-- el mismo panel. El access_token se guarda cifrado (ver backend/src/utils/crypto.ts).
CREATE TABLE IF NOT EXISTS fb_ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,                    -- nombre visible en el panel, ej. "Todomotos Medina"
  ad_account_id TEXT NOT NULL,            -- act_XXXXXXXXXX
  business_id TEXT,                       -- Meta Business Manager ID (opcional)
  access_token_encrypted TEXT NOT NULL,   -- token de larga duración, cifrado con AES-256-GCM
  token_expires_at TIMESTAMPTZ,
  currency TEXT NOT NULL DEFAULT 'HNL',
  timezone TEXT NOT NULL DEFAULT 'America/Tegucigalpa',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, ad_account_id)
);

-- Historial de generaciones de contenido 4K (Higgsfield.ai)
CREATE TABLE IF NOT EXISTS generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  higgsfield_job_id TEXT NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  quality TEXT NOT NULL DEFAULT '4k',
  format TEXT NOT NULL DEFAULT 'webp',
  lighting_preset JSONB,                  -- snapshot de los sliders de iluminación usados
  status TEXT NOT NULL DEFAULT 'pending',
  result_url TEXT,
  file_size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Vínculo entre una generación y la campaña/creative de Facebook donde se usó
CREATE TABLE IF NOT EXISTS creative_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_job_id UUID REFERENCES generation_jobs(id) ON DELETE SET NULL,
  fb_ad_account_id UUID NOT NULL REFERENCES fb_ad_accounts(id) ON DELETE CASCADE,
  fb_campaign_id TEXT,
  fb_creative_id TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Presets de iluminación guardados (sliders RGB, temperatura, intensidad)
CREATE TABLE IF NOT EXISTS lighting_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  settings JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fb_ad_accounts_owner ON fb_ad_accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_owner ON generation_jobs(owner_id);
CREATE INDEX IF NOT EXISTS idx_creative_pub_account ON creative_publications(fb_ad_account_id);
