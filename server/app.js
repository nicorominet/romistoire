import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import storyRoutes from './routes/story.routes.js';
import themeRoutes from './routes/theme.routes.js';
import seriesRoutes from './routes/series.routes.js';
import weeklyThemeRoutes from './routes/weeklyTheme.routes.js';
import generationRoutes from './routes/generation.routes.js';
import systemRoutes from './routes/system.routes.js';
import pdfRoutes from './routes/pdf.routes.js';
import configRoutes from './routes/config.routes.js';

import logsRoutes from './routes/logs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { ENV_CONFIG } from './config/env.config.js';

import { requestLogger } from './middleware/requestLogger.js';

const app = express();

app.use(cors());
app.use(requestLogger); // Register logger early
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve Uploads
app.use('/uploads', express.static(ENV_CONFIG.UPLOADS_DIR));

// API Routes
app.use('/api/stories', storyRoutes);
app.use('/api/themes', themeRoutes);
app.use('/api/series', seriesRoutes);
app.use('/api/weekly-themes', weeklyThemeRoutes);
app.use('/api/generate', generationRoutes);
app.use('/api/export', pdfRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api', systemRoutes);
app.use('/api', configRoutes);

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

export default app;
