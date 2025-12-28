import { Router } from 'express';
import { requireBearerAuth } from './middleware/auth.js';
import usersRouter from './routes/users.js';
import companiesRouter from './routes/companies.js';
import experiencesRouter from './routes/experiences.js';
import productsRouter from './routes/products.js';
import membersRouter from './routes/members.js';
import membershipsRouter from './routes/memberships.js';
import paymentsRouter from './routes/payments.js';

const router = Router();

router.use(requireBearerAuth);

router.get('/', (req, res) => {
  res.json({ status: 'whopSandbox', version: 'v1' });
});

router.use('/users', usersRouter);
router.use('/companies', companiesRouter);
router.use('/experiences', experiencesRouter);
router.use('/products', productsRouter);
router.use('/members', membersRouter);
router.use('/memberships', membershipsRouter);
router.use('/payments', paymentsRouter);

export default router;


