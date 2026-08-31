import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db.js';
import { config } from '../config.js';
import { ApiError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
  fullName: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(user: { id: string; email: string; role: string }) {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

// El primer usuario registrado en una instancia nueva queda como admin;
// los siguientes quedan como editores (útil para el equipo de Todomotos).
authRouter.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const { rows: existing } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
    const isFirstUser = existing[0].count === 0;

    const passwordHash = await bcrypt.hash(body.password, config.bcryptRounds);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role`,
      [body.email.toLowerCase(), passwordHash, body.fullName, isFirstUser ? 'admin' : 'editor']
    );
    const user = rows[0];
    res.status(201).json({ user, token: signToken(user) });
  } catch (err: any) {
    if (err.code === '23505') return next(new ApiError(409, 'Ya existe una cuenta con ese correo.'));
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, full_name, role FROM users WHERE email = $1',
      [body.email.toLowerCase()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
      throw new ApiError(401, 'Correo o contraseña incorrectos.');
    }
    res.json({
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
      token: signToken(user),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, email, full_name, role FROM users WHERE id = $1', [
      req.user!.userId,
    ]);
    if (!rows[0]) throw new ApiError(404, 'Usuario no encontrado.');
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});
