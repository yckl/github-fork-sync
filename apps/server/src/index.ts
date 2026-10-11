import { startApp } from './server.js';

startApp().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
