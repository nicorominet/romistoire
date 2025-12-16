import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    // We only want to run backend tests with this config
    include: ['server/tests/**/*.test.js'],
  },
  resolve: {
     alias: {
        // Just in case we need it, though backend usually uses relative imports
        '@': path.resolve(process.cwd(), './src')
     }
  }
});
