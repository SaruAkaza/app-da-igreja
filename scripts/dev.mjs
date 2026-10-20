import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const backend = path.join(root,'backend'), mobile = path.join(root,'mobile');
const tsx = path.join(backend,'node_modules/tsx/dist/cli.mjs');
const expo = path.join(mobile,'node_modules/expo/bin/cli');
if (!fs.existsSync(tsx) || !fs.existsSync(expo)) { console.error('Primeiro execute npm run setup.'); process.exit(1); }
const demo = process.argv.includes('--demo');
const env = { ...process.env, ...(demo ? { DEMO_MODE:'true', DATA_DIR:path.join(root,'.demo-data'), NODE_ENV:'development' } : {}) };
const children = [
  spawn(process.execPath,[tsx,'watch','src/server.ts'],{cwd:backend,env,stdio:'inherit'}),
  spawn(process.execPath,[expo,'start'],{cwd:mobile,env,stdio:'inherit'}),
];
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;children.forEach(child=>child.kill());process.exitCode=code;}
children.forEach(child=>{child.on('error',error=>{console.error(error.message);stop(1);});child.on('exit',code=>{if(!stopping)stop(code||0);});});
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
console.log(demo?'Demonstração com banco separado em .demo-data.':'Aplicativo iniciado. No terminal do Expo, pressione w para abrir no navegador.');
