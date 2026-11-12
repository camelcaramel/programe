// Pyodide 런타임을 public/pyodide 로 복사한다 (CDN 없이 로컬/정적 호스팅에서 동작하도록)
import fs from 'node:fs';
import path from 'node:path';

const src = 'node_modules/pyodide';
const dst = 'public/pyodide';
const files = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];
fs.mkdirSync(dst, { recursive: true });
for (const f of files) {
  const from = path.join(src, f);
  const to = path.join(dst, f);
  if (!fs.existsSync(from)) { console.warn('[pyodide] missing', from); continue; }
  if (fs.existsSync(to) && fs.statSync(to).size === fs.statSync(from).size) continue;
  fs.copyFileSync(from, to);
}
console.log('[pyodide] ready in', dst);
