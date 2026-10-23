import { spawn } from 'node:child_process';

const SUBDOMAIN = process.env.TUNNEL_SUBDOMAIN || 'comunhao-app-igreja';
const PORT = process.env.PORT || '3000';

console.log(`Iniciando túnel persistente para a porta ${PORT} com subdomínio "${SUBDOMAIN}"...`);

let running = true;
let child = null;

function startTunnel() {
  if (!running) return;
  console.log(`[Túnel] Conectando https://${SUBDOMAIN}.loca.lt...`);
  
  child = spawn('npx', [
    'localtunnel',
    '--port', PORT,
    '--local-host', '127.0.0.1',
    '--subdomain', SUBDOMAIN
  ], {
    shell: true,
    stdio: 'inherit'
  });

  child.on('exit', (code) => {
    console.warn(`[Túnel] Conexão encerrada (código ${code}). Reconectando em 3 segundos...`);
    if (running) {
      setTimeout(startTunnel, 3000);
    }
  });

  child.on('error', (err) => {
    console.error('[Túnel] Erro no processo:', err.message);
  });
}

// Keep-alive ping a cada 45 segundos para manter a conexão aberta e evitar timeout
setInterval(async () => {
  try {
    const res = await fetch(`https://${SUBDOMAIN}.loca.lt/api/health`, {
      headers: { 'Bypass-Tunnel-Reminder': 'true' }
    });
    if (res.ok) {
      // Conexão saudável
    }
  } catch (err) {
    // Falha silenciosa no ping; o listener de exit se encarrega de reiniciar se necessário
  }
}, 45000);

process.on('SIGINT', () => { running = false; child?.kill(); process.exit(0); });
process.on('SIGTERM', () => { running = false; child?.kill(); process.exit(0); });

startTunnel();
