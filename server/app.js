import express from 'express';
import cors from 'cors';
import path from 'path';

import storyRoutes from './routes/story.routes.js';
import themeRoutes from './routes/theme.routes.js';
import seriesRoutes from './routes/series.routes.js';
import weeklyThemeRoutes from './routes/weeklyTheme.routes.js';
import generationRoutes from './routes/generation.routes.js';
import systemRoutes from './routes/system.routes.js';
import pdfRoutes from './routes/pdf.routes.js';
import illustrationRoutes from './routes/illustration.routes.js';

import logsRoutes from './routes/logs.js';
import settingsRoutes from './routes/settings.routes.js';
import backupRoutes from './routes/backup.routes.js';
import generationJobRoutes from './routes/generation_jobs.routes.js';


import { ENV_CONFIG } from './config/env.config.js';

import { requestLogger } from './middleware/requestLogger.js';
import { allowedOrigins, originGuard } from './middleware/origin.middleware.js';

const app = express();

// Only the app may call the API from a browser (no login: any other website could reset the data)
const origins = allowedOrigins();
app.use(cors({ origin: origins }));
app.use(requestLogger); // Register logger early (refused requests are logged too)
app.use(originGuard(origins));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Cache Control Middleware: Disable caching for all API routes
app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.set('Surrogate-Control', 'no-store');
    }
    next();
});

// Serve Uploads
// nosniff: browsers must not reinterpret an uploaded file as HTML/script
app.use('/uploads', express.static(ENV_CONFIG.UPLOADS_DIR, {
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
}));
// Audio generated before the move to uploads/audio
app.use('/audio', express.static(path.join(ENV_CONFIG.PROJECT_ROOT, 'public', 'audio')));

// API Routes
app.use('/api/stories', storyRoutes);
app.use('/api/themes', themeRoutes);
app.use('/api/series', seriesRoutes);
app.use('/api/weekly-themes', weeklyThemeRoutes);
app.use('/api/generate', generationRoutes);
app.use('/api/export', pdfRoutes);
app.use('/api/illustrations', illustrationRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/generation-jobs', generationJobRoutes);
app.use('/api', systemRoutes);

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

export default app;
