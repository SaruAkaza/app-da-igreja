import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
if (!process.env.npm_execpath) throw new Error('Execute npm run check.');
for (const [folder, script] of [['backend','build'],['backend','test'],['mobile','typecheck'],['mobile','lint']]) {
  const result = spawnSync(process.execPath,[process.env.npm_execpath,'--prefix',folder,'run',script],{cwd:root,stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
