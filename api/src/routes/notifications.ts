import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { listUserNotifications, markNotificationRead } from '../services/notificationService';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req, res) => {
  const notifications = await listUserNotifications(req.user!.id);
  res.json({ notifications });
});

notificationsRouter.post('/:id/read', async (req, res) => {
  await markNotificationRead(req.params.id, req.user!.id);
  res.status(204).end();
});

