import express from 'express';
import { handleError } from '../middleware/error.middleware.js';
import { backupService } from '../services/backup.service.js';

const router = express.Router();

/**
 * GET /api/backups
 * @returns {{filename: string, size: number, createdAt: string}[]} Newest first.
 */
router.get('/', async (req, res) => {
  try {
    res.json(await backupService.listBackups());
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * POST /api/backups
 * Writes a backup now (then applies the retention of the settings).
 */
router.post('/', async (req, res) => {
  try {
    res.json(await backupService.runBackup());
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * GET /api/backups/:filename
 * Downloads a backup.
 */
router.get('/:filename', (req, res) => {
  try {
    res.download(backupService.resolve(req.params.filename));
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * DELETE /api/backups/:filename
 */
router.delete('/:filename', async (req, res) => {
  try {
    await backupService.deleteBackup(req.params.filename);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
