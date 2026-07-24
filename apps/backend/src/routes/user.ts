import { Router } from 'express';

/**
 * Legacy Express `/user` router — closed (ADR-0011).
 * All methods return 404 so anonymous and non-admin callers cannot list/get/create Users.
 * Prefer TSOA Platform Admin APIs under `/admin/users`.
 */
const router = Router();

router.use((_req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

export default router;
