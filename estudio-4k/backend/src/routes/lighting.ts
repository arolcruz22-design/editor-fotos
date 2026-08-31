import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

// Presets de iluminación del "Estudio 4K" (sliders RGB, temperatura de color,
// intensidad) que luego se envían como contexto a Higgsfield al generar contenido.
export const lightingRouter = Router();
lightingRouter.use(requireAuth);

lightingRouter.get('/presets', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM lighting_presets WHERE owner_id = $1 ORDER BY created_at DESC',
      [req.user!.userId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

const presetSchema = z.object({
  name: z.string().min(1),
  settings: z.object({
    red: z.number().min(0).max(255),
    green: z.number().min(0).max(255),
    blue: z.number().min(0).max(255),
    colorTemperatureK: z.number().min(2000).max(10000),
    intensityPercent: z.number().min(0).max(100),
  }),
});

lightingRouter.post('/presets', async (req, res, next) => {
  try {
    const body = presetSchema.parse(req.body);
    const { rows } = await pool.query(
      'INSERT INTO lighting_presets (owner_id, name, settings) VALUES ($1, $2, $3) RETURNING *',
      [req.user!.userId, body.name, body.settings]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

lightingRouter.delete('/presets/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM lighting_presets WHERE id = $1 AND owner_id = $2', [
      req.params.id,
      req.user!.userId,
    ]);
    if (!rowCount) throw new ApiError(404, 'Preset no encontrado.');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
