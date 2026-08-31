import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { encryptToken, decryptToken } from '../utils/crypto.js';
import { ApiError } from '../middleware/errorHandler.js';
import { verifyAccessToken, listOwnedAdAccounts } from '../services/metaAdsClient.js';

// Gestión de MÚLTIPLES cuentas publicitarias de Facebook conectadas al panel.
// Cada cuenta guarda su propio access token (cifrado), lo que permite operar
// varias tiendas/marcas de Todomotos desde el mismo dashboard.
export const accountsRouter = Router();
accountsRouter.use(requireAuth);

function toPublicAccount(row: any) {
  return {
    id: row.id,
    label: row.label,
    adAccountId: row.ad_account_id,
    businessId: row.business_id,
    currency: row.currency,
    timezone: row.timezone,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

accountsRouter.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM fb_ad_accounts WHERE owner_id = $1 ORDER BY created_at DESC',
      [req.user!.userId]
    );
    res.json(rows.map(toPublicAccount));
  } catch (err) {
    next(err);
  }
});

// Dada una cuenta de sistema/página de Facebook con acceso a Business Manager,
// lista las cuentas publicitarias disponibles para ese token antes de conectarlas.
const discoverSchema = z.object({ accessToken: z.string().min(10) });
accountsRouter.post('/discover', async (req, res, next) => {
  try {
    const { accessToken } = discoverSchema.parse(req.body);
    await verifyAccessToken(accessToken); // valida que el token es utilizable
    const accounts = await listOwnedAdAccounts(accessToken);
    res.json({ accounts });
  } catch (err) {
    next(err);
  }
});

const connectSchema = z.object({
  label: z.string().min(2),
  adAccountId: z.string().regex(/^act_\d+$/, 'El ID debe tener el formato act_XXXXXXXXXX'),
  accessToken: z.string().min(10),
  businessId: z.string().optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
});

accountsRouter.post('/', async (req, res, next) => {
  try {
    const body = connectSchema.parse(req.body);
    await verifyAccessToken(body.accessToken); // falla rápido si el token es inválido

    const { rows } = await pool.query(
      `INSERT INTO fb_ad_accounts (owner_id, label, ad_account_id, business_id, access_token_encrypted, currency, timezone)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'HNL'), COALESCE($7, 'America/Tegucigalpa'))
       RETURNING *`,
      [
        req.user!.userId,
        body.label,
        body.adAccountId,
        body.businessId ?? null,
        encryptToken(body.accessToken),
        body.currency,
        body.timezone,
      ]
    );
    res.status(201).json(toPublicAccount(rows[0]));
  } catch (err: any) {
    if (err.code === '23505') return next(new ApiError(409, 'Esa cuenta publicitaria ya está conectada.'));
    next(err);
  }
});

accountsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM fb_ad_accounts WHERE id = $1 AND owner_id = $2', [
      req.params.id,
      req.user!.userId,
    ]);
    if (!rowCount) throw new ApiError(404, 'Cuenta no encontrada.');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

accountsRouter.patch('/:id', async (req, res, next) => {
  try {
    const body = z.object({ isActive: z.boolean().optional(), label: z.string().min(2).optional() }).parse(req.body);
    const { rows } = await pool.query(
      `UPDATE fb_ad_accounts SET
         is_active = COALESCE($3, is_active),
         label = COALESCE($4, label)
       WHERE id = $1 AND owner_id = $2
       RETURNING *`,
      [req.params.id, req.user!.userId, body.isActive ?? null, body.label ?? null]
    );
    if (!rows[0]) throw new ApiError(404, 'Cuenta no encontrada.');
    res.json(toPublicAccount(rows[0]));
  } catch (err) {
    next(err);
  }
});

// Helper interno usado por routes/facebookAds.ts para resolver una cuenta
// conectada (y descifrar su token) a partir del id del panel.
export async function resolveAccount(ownerId: string, accountId: string) {
  const { rows } = await pool.query('SELECT * FROM fb_ad_accounts WHERE id = $1 AND owner_id = $2', [
    accountId,
    ownerId,
  ]);
  const row = rows[0];
  if (!row) throw new ApiError(404, 'Cuenta publicitaria no encontrada o no pertenece a este usuario.');
  return {
    row,
    ref: { accessToken: decryptToken(row.access_token_encrypted), adAccountId: row.ad_account_id },
  };
}
