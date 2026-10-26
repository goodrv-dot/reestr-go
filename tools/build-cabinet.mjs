// Збирає cabinet.js із частин src/cabinet/*.js (по порядку імен). Код не змінюється — лише склеюється,
// рядки-підказки на початку частин («//@ …») відкидаються. Правити — частини в src/cabinet/, НЕ cabinet.js.
// Запускається сам із tools/build-legacy.mjs; окремо: node tools/build-cabinet.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const HEAD = '// ЗІБРАНО з src/cabinet/*.js (tools/build-cabinet.mjs) — правити там, не тут\n';
export function buildCabinet() {
  const dir = path.join(root, 'src/cabinet');
  const parts = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
  const body = parts.map((f) => fs.readFileSync(path.join(dir, f), 'utf8').replace(/^(\/\/@[^\n]*\n)+/, '')).join('');
  const out = path.join(root, 'cabinet.js');
  const prev = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  // захист: якщо хтось правив cabinet.js напряму — не затираємо, а зупиняємось
  if (prev && !prev.startsWith(HEAD) && prev !== body) throw new Error('cabinet.js змінено напряму — перенесіть правки в src/cabinet/ і запустіть збірку ще раз');
  if (prev.startsWith(HEAD) && prev.slice(HEAD.length) !== body && fs.statSync(out).mtimeMs > Math.max(...parts.map((f) => fs.statSync(path.join(dir, f)).mtimeMs)))
    throw new Error('cabinet.js новіший за частини й відрізняється — перенесіть правки в src/cabinet/');
  fs.writeFileSync(out, HEAD + body);
  return { parts: parts.length, bytes: body.length };
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const r = buildCabinet();
  console.log(`cabinet.js: зібрано з ${r.parts} частин, ${Math.round(r.bytes / 1024)} КБ`);
}
