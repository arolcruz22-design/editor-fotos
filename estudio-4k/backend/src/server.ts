import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { accountsRouter } from './routes/accounts.js';
import { higgsfieldRouter } from './routes/higgsfield.js';
import { facebookAdsRouter } from './routes/facebookAds.js';
import { lightingRouter } from './routes/lighting.js';

const app = express();

app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Rate limiting general (protege las API de Higgsfield/Meta de abuso accidental)
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', company: config.company.name, timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/higgsfield', higgsfieldRouter);
app.use('/api/facebook-ads', facebookAdsRouter);
app.use('/api/lighting', lightingRouter);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`🎬 Estudio 4K backend corriendo en http://localhost:${config.port} (${config.env})`);
});
