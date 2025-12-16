// src/main.tsx
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { init } from './lib/i18n';

console.log('Initializing application...');

async function bootstrap() {
  await init();
  createRoot(document.getElementById("root")!).render(<App />);
  console.log('Application initialized and rendered.');
}

bootstrap();
