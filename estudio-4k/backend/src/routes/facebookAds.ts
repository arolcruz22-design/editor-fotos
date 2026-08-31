import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveAccount } from './accounts.js';
import * as meta from '../services/metaAdsClient.js';

// Todas las rutas reciben :accountId (el id interno del panel, ver routes/accounts.ts)
// para poder operar sobre cualquiera de las cuentas de Facebook conectadas.
export const facebookAdsRouter = Router();
facebookAdsRouter.use(requireAuth);

facebookAdsRouter.get('/:accountId/campaigns', async (req, res, next) => {
  try {
    const { ref } = await resolveAccount(req.user!.userId, req.params.accountId);
    const campaigns = await meta.listCampaigns(ref);
    res.json(campaigns);
  } catch (err) {
    next(err);
  }
});

const createCampaignSchema = z.object({
  name: z.string().min(2),
  objective: z.enum(['REACH', 'OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT', 'OUTCOME_SALES', 'OUTCOME_LEADS']),
  dailyBudgetCents: z.number().int().positive(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
});

facebookAdsRouter.post('/:accountId/campaigns', async (req, res, next) => {
  try {
    const { ref } = await resolveAccount(req.user!.userId, req.params.accountId);
    const body = createCampaignSchema.parse(req.body);
    const campaign = await meta.createCampaign(ref, body);
    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
});

facebookAdsRouter.post('/:accountId/campaigns/:campaignId/pause', async (req, res, next) => {
  try {
    const { ref } = await resolveAccount(req.user!.userId, req.params.accountId);
    await meta.setCampaignStatus(ref, req.params.campaignId, 'PAUSED');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

facebookAdsRouter.post('/:accountId/campaigns/:campaignId/activate', async (req, res, next) => {
  try {
    const { ref } = await resolveAccount(req.user!.userId, req.params.accountId);
    await meta.setCampaignStatus(ref, req.params.campaignId, 'ACTIVE');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

facebookAdsRouter.get('/:accountId/campaigns/:campaignId/insights', async (req, res, next) => {
  try {
    const { ref } = await resolveAccount(req.user!.userId, req.params.accountId);
    const insights = await meta.getCampaignInsights(ref, req.params.campaignId);
    res.json(insights);
  } catch (err) {
    next(err);
  }
});

const createCreativeSchema = z.object({
  name: z.string().min(2),
  pageId: z.string().min(1),
  imageUrl: z.string().url().optional(), // idealmente una URL generada por Higgsfield
  message: z.string().min(1),
  link: z.string().url(),
  linkTitle: z.string().min(1),
  generationJobId: z.string().uuid().optional(),
});

facebookAdsRouter.post('/:accountId/creatives', async (req, res, next) => {
  try {
    const { ref, row } = await resolveAccount(req.user!.userId, req.params.accountId);
    const body = createCreativeSchema.parse(req.body);

    let imageHash: string | undefined;
    if (body.imageUrl) {
      const uploaded = await meta.uploadImageCreative(ref, body.imageUrl);
      imageHash = uploaded.imageHash;
    }

    const creative = await meta.createAdCreative(ref, {
      name: body.name,
      pageId: body.pageId,
      imageHash,
      message: body.message,
      link: body.link,
      linkTitle: body.linkTitle,
    });

    await pool.query(
      `INSERT INTO creative_publications (generation_job_id, fb_ad_account_id, fb_creative_id)
       VALUES ($1, $2, $3)`,
      [body.generationJobId ?? null, row.id, creative.id]
    );

    res.status(201).json(creative);
  } catch (err) {
    next(err);
  }
});
