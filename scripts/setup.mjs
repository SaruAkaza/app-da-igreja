import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
if (!process.env.npm_execpath) throw new Error('Execute npm run setup na raiz do projeto.');
for (const folder of ['backend','mobile']) {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'install', '--prefix', folder], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Tudo pronto. Execute npm run dev ou npm run demo.');
