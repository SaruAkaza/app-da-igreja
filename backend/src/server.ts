import { createApp } from './app.js';
import { db, initDatabase } from './config/database.js';
import { demoMode, dataDir } from './config/runtime.js';
import { runSeed } from './config/seed.js';
initDatabase();
if (demoMode) await runSeed();
const port = Number(process.env.PORT || 3000);
const server = createApp().listen(port, () => console.log('Comunhão: http://localhost:' + port + '/admin/ | Dados: ' + dataDir + ' | Demo: ' + demoMode));
function stop() { server.close(() => { db.close(); process.exit(0); }); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
