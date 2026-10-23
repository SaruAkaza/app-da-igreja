import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
if (!process.env.npm_execpath) throw new Error('Execute npm run setup na raiz do projeto.');

if (process.platform === 'win32') {
  const systemRoot = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
  const relative = path.win32.relative(systemRoot, root);
  if (!relative || (!path.win32.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..\\'))) {
    console.error('O projeto está dentro da pasta do Windows. Clone-o em uma pasta do seu usuário, por exemplo C:\\Users\\SEU_USUARIO\\Projetos\\comunhao-teste, e execute npm run setup lá.');
    process.exit(1);
  }
}

function npm(args) {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], { cwd: root, stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status || 1);
}

for (const folder of ['backend','mobile']) {
  if (folder === 'backend') {
    // better-sqlite3 13 inclui binários prontos e declara gypfile:false.
    // npm ci perde essa informação do manifesto e chama node-gyp mesmo assim.
    // Instalamos primeiro, depois executamos os demais ciclos normalmente.
    npm(['ci', '--prefix', folder, '--ignore-scripts']);
    const sqlite = JSON.parse(fs.readFileSync(path.join(root, folder, 'node_modules/better-sqlite3/package.json'), 'utf8'));
    const lifecycle = ['preinstall', 'install', 'postinstall', 'prepare'];
    const usePrebuild = sqlite.gypfile === false && !lifecycle.some(event => sqlite.scripts?.[event]);
    const lock = JSON.parse(fs.readFileSync(path.join(root, folder, 'package-lock.json'), 'utf8'));
    const packages = [...new Set(Object.keys(lock.packages)
      .filter(location => location.includes('node_modules/'))
      .map(location => location.split('node_modules/').pop())
      .filter(name => !usePrebuild || name !== 'better-sqlite3'))];
    npm(['rebuild', '--prefix', folder, '--ignore-scripts=false', '--foreground-scripts', ...packages]);
    const probe = spawnSync(process.execPath, ['--input-type=module', '-e', "import Database from 'better-sqlite3'; const db = new Database(':memory:'); db.prepare('SELECT 1').get(); db.close();"], { cwd: path.join(root, folder), encoding: 'utf8' });
    if (probe.status !== 0) {
      console.error('Não foi possível carregar o SQLite. Confira a versão do Node e a compatibilidade do sistema. Nenhum banco da igreja foi aberto.');
      if (probe.error) console.error(probe.error.message);
      if (probe.stderr) process.stderr.write(probe.stderr);
      process.exit(1);
    }
  } else npm(['ci', '--prefix', folder]);
}
console.log('Tudo pronto. Execute npm run dev ou npm run demo.');
