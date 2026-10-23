import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const mobile = path.join(root, 'mobile');
const output = path.join(mobile, 'dist-pages');
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'app-da-igreja';
const basePath = (process.env.PAGES_BASE_PATH || `/${repository}`).replace(/\/$/, '');
if (!/^\/[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*$/.test(basePath)) {
  throw new Error('PAGES_BASE_PATH deve ser um caminho como /app-da-igreja.');
}
const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || '';
if (apiUrl) {
  const url = new URL(apiUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('EXPO_PUBLIC_API_URL deve conter apenas a origem HTTPS da API, sem caminho ou credenciais.');
  }
} else {
  console.warn('API ainda não configurada. O aplicativo solicitará o endereço HTTPS na tela de entrada.');
}
const result = spawnSync(process.execPath, [path.join(mobile, 'node_modules/expo/bin/cli'), 'export', '--platform', 'web', '--output-dir', output], {
  cwd: mobile,
  stdio: 'inherit',
  env: { ...process.env, COMUNHAO_WEB_BASE_PATH: basePath, EXPO_PUBLIC_PAGES: 'true', EXPO_PUBLIC_API_URL: apiUrl },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
fs.writeFileSync(path.join(output, '.nojekyll'), '');
fs.copyFileSync(path.join(output, 'index.html'), path.join(output, '404.html'));

// O Pages não oferece rewrites de SPA. Entradas reais permitem atualizar as
// rotas conhecidas; 404.html mantém as demais rotas sob controle do Expo Router.
function addRouteEntries(directory, segments = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.includes('[')) continue;
      addRouteEntries(path.join(directory, entry.name), entry.name.startsWith('(') ? segments : [...segments, entry.name]);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/^[_+]/.test(entry.name) && !entry.name.includes('[')) {
      const name = entry.name.replace(/\.(tsx?|jsx?)$/, '');
      const route = name === 'index' ? segments : [...segments, name];
      if (!route.length) continue;
      const destination = path.join(output, ...route);
      fs.mkdirSync(destination, { recursive: true });
      fs.copyFileSync(path.join(output, 'index.html'), path.join(destination, 'index.html'));
    }
  }
}
addRouteEntries(path.join(mobile, 'src/app'));
console.log(`GitHub Pages: ${basePath}/ — arquivos em mobile/dist-pages`);
