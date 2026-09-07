import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
let html=read('src/template.html');
html=html.replace('/*__CSS__*/',read('src/styles.css'))
  .replace('/*__DATA__*/',read('src/data.js'))
  .replace('/*__CORE__*/',read('src/core.js'))
  .replace('/*__APP__*/',read('src/app.js'));
fs.writeFileSync(path.join(root,'relationship-os.html'),html);
fs.writeFileSync(path.join(root,'index.html'),html);
console.log(`built relationship-os.html (${Buffer.byteLength(html)} bytes)`);
