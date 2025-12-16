import app from './server/app.js';
import { initializeDatabase, testConnection } from './server/config/database.js';
import { logger } from './server/services/logger.service.js';

const port = process.env.API_PORT || 3001; 

async function startServer() {
  try {
    await initializeDatabase();
    
    if (await testConnection()) {
       app.listen(port, () => {
         logger.info(`API Server running at http://localhost:${port}`);
       });
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

startServer();
