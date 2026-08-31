import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import * as higgsfield from '../services/higgsfieldClient.js';

export const higgsfieldRouter = Router();
higgsfieldRouter.use(requireAuth);

const generateSchema = z.object({
  prompt: z.string().min(3),
  quality: z.enum(['standard', '4k']).default('4k'),
  format: z.enum(['webp', 'mp4']).default('webp'),
  duration: z.number().positive().optional(),
  optimize: z.boolean().default(true),
  lighting: z.record(z.any()).optional(), // snapshot de sliders del módulo de iluminación
});

higgsfieldRouter.post('/generate', async (req, res, next) => {
  try {
    const body = generateSchema.parse(req.body);
    const job = await higgsfield.generateContent(body);

    await pool.query(
      `INSERT INTO generation_jobs (owner_id, higgsfield_job_id, prompt, quality, format, lighting_preset, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.user!.userId, job.id, body.prompt, body.quality, body.format, body.lighting ?? null, job.status]
    );

    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
});

higgsfieldRouter.get('/jobs', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM generation_jobs WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 200',
      [req.user!.userId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

higgsfieldRouter.get('/jobs/:jobId', async (req, res, next) => {
  try {
    const job = await higgsfield.getJobStatus(req.params.jobId);

    if (job.status === 'completed' || job.status === 'failed') {
      await pool.query(
        `UPDATE generation_jobs
         SET status = $2, result_url = $3, file_size_bytes = $4, completed_at = now()
         WHERE higgsfield_job_id = $1`,
        [req.params.jobId, job.status, job.result?.url ?? null, job.result?.fileSize ?? null]
      );
    }

    res.json(job);
  } catch (err) {
    next(err);
  }
});

higgsfieldRouter.delete('/jobs/:jobId', async (req, res, next) => {
  try {
    await higgsfield.deleteJob(req.params.jobId);
    await pool.query('DELETE FROM generation_jobs WHERE higgsfield_job_id = $1 AND owner_id = $2', [
      req.params.jobId,
      req.user!.userId,
    ]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

higgsfieldRouter.get('/jobs/:jobId/download', async (req, res, next) => {
  try {
    const url = await higgsfield.downloadJobContentUrl(req.params.jobId);
    if (!url) throw new ApiError(409, 'El contenido todavía no está listo.');
    res.json({ url });
  } catch (err) {
    next(err);
  }
});
