import app from './server/app.js';
import { initializeDatabase, testConnection } from './server/config/database.js';
import { logger } from './server/services/logger.service.js';
import { systemService } from './server/services/system.service.js';

const port = process.env.API_PORT || 3001; 

// Images uploaded on the create page and never saved with a story become orphans: purge them daily,
// keeping files younger than 24 h (a story may still be in progress).
const ORPHAN_UPLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function purgeOrphanUploads() {
  try {
    const { deletedCount, reclaimedSpace } = await systemService.cleanupImages({ minAgeMs: ORPHAN_UPLOAD_MAX_AGE_MS });
    if (deletedCount > 0) logger.info(`Orphan uploads purged: ${deletedCount} file(s), ${reclaimedSpace} bytes.`);
  } catch (error) {
    // Never block the server for a cleanup failure
    logger.error('Orphan uploads purge failed:', {}, error);
  }
}

async function startServer() {
  try {
    await initializeDatabase();
    
    if (await testConnection()) {
       app.listen(port, () => {
         logger.info(`API Server running at http://localhost:${port}`);
       });
       purgeOrphanUploads();
       setInterval(purgeOrphanUploads, ORPHAN_UPLOAD_MAX_AGE_MS).unref();
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
