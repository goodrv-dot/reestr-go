// Збирає legacy/ — копію скриптів сайту старим синтаксисом для iPhone / Safari до iOS 14.
// Запускати після КОЖНОЇ зміни будь-якого .js сайту, перед комітом:
//   npm i --no-save esbuild && node tools/build-legacy.mjs
// Сам код не змінюється — лише переписуються новіші конструкції (?. ?? ||= …) на старі.
import { transform } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const boot = fs.readFileSync(path.join(root, 'boot.js'), 'utf8');
const app = JSON.parse(boot.match(/var APP = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
const files = [...app, 'vendor/supabase-2.117.3.js'];
const TARGET = ['es2018'];   // Safari 12+ (iOS 12+)
let total = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  const out = await transform(src, { loader: 'js', target: TARGET, charset: 'utf8', legalComments: 'none' });
  const dst = path.join(root, 'legacy', f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, '// АВТОМАТИЧНО з ' + f + ' (tools/build-legacy.mjs) — не редагувати вручну\n' + out.code);
  total += out.code.length;
}
console.log(`legacy/: ${files.length} файлів, ${Math.round(total / 1024)} КБ, ціль ${TARGET.join(',')}`);
