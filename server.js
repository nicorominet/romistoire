import app from './server/app.js';
import { initializeDatabase, testConnection } from './server/config/database.js';
import { logger } from './server/services/logger.service.js';
import { maintenanceService } from './server/services/maintenance.service.js';
import { generationWorker } from './server/services/generation_worker.js';
import { aiUsageService } from './server/services/ai_usage.service.js';
import { ENV_CONFIG } from './server/config/env.config.js';

const port = process.env.API_PORT || 3001; 

// Housekeeping set in Settings > Storage (automatic backup, orphan uploads purge, old logs):
// checked every hour, each task decides whether it is due.
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;

const runMaintenance = () => maintenanceService.run().catch((error) => logger.error('Maintenance failed:', {}, error));

async function startServer() {
  try {
    await initializeDatabase();
    
    if (await testConnection()) {
       app.listen(port, () => {
         logger.info(`API Server running at http://localhost:${port}`);
       });
       runMaintenance();
       // Quota statistics: the requests already in the AI logs, once
       aiUsageService.importFromAiLogs(ENV_CONFIG.LOGS_DIR)
         .then((count) => { if (count > 0) logger.info(`Quota statistics: ${count} request(s) imported from the AI logs.`); })
         .catch((error) => logger.error('Quota statistics import failed:', {}, error));
       // Mass generation jobs interrupted by a restart start again where they stopped
       generationWorker.resumeAfterRestart().catch((error) => logger.error('Generation worker failed:', {}, error));
       setInterval(runMaintenance, MAINTENANCE_INTERVAL_MS).unref();
    } else {
       logger.error('Failed to connect to database. Server not started.');
       process.exit(1);
    }
  } catch (error) {
    logger.error('Error starting the server:', {}, error);
    process.exit(1);
  }
}

startServer();


// server restart trigger 2
