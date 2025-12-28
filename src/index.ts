import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import funnelsRouter from './routes/funnels.js';
import authRouter from './routes/auth.js';
import analyticsRouter from './routes/analytics.js';
import splashRouter from './routes/splash.js';
import whopSandboxRouter from './whopSandbox/router.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'running' });
});

app.use('/whopSandbox/api/v1', whopSandboxRouter);
app.use('/auth', authRouter);
app.use('/funnels', funnelsRouter);
app.use('/analytics', analyticsRouter);
app.use('/splash', splashRouter);

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
  });
}

export default app;

