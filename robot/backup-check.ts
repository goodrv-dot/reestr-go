
// ============================================================
// Щотижнева перевірка резервної копії: бере НАЙНОВІШИЙ файл із папки копій, розшифровує тим самим
// паролем (BACKUP_PASSPHRASE), розпаковує і перевіряє: формат, усі таблиці на місці, кількість рядків
// збігається із записаною в копії і близька до живої бази. Нічого в базі не змінює.
// Результат — у robot_state: backup_check_last / backup_check_status (адміністратор бачить збій у дзвіночку).
// ============================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';
const TABLES: [string, string[]][] = [
  ['persons', ['id']], ['cases', ['id']], ['case_values', ['case_id', 'stage_key']], ['case_history', ['id']],
  ['military_relations', ['id']], ['children', ['id']], ['person_programs', ['person_id', 'program_id']],
  ['person_veteran_statuses', ['person_id', 'status']], ['case_stage_defs', ['id']], ['case_statuses', ['module', 'name']],
  ['case_transfers', ['id']], ['case_seen', ['case_id', 'user_id']], ['cells', ['id']], ['regions', ['id']], ['hromadas', ['id']],
  ['mp_units', ['id']], ['programs', ['id']], ['operators', ['user_id']], ['segments', ['id']], ['import_batches', ['id']],
  ['export_log', ['id']], ['case_marks', ['case_id', 'user_id']], ['feedback', ['id']], ['app_settings', []],
  ['cab_modules', ['code']], ['person_lists', ['id']], ['person_list_members', ['list_id', 'person_id']],
  ['chat_threads', ['id']], ['chat_members', ['thread_id', 'user_id']], ['chat_messages', ['id']]
];
const MAGIC = new TextEncoder().encode('REESTR-BK1');
const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const u = new Uint8Array(buf as ArrayBuffer); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

async function googleToken(): Promise<string> {
  const k = JSON.parse(Deno.env.get('GOOGLE_SA_KEY') || 'null');
  if (!k?.private_key) throw new Error('Немає секрету GOOGLE_SA_KEY');
  const pem = String(k.private_key).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = enc({ alg: 'RS256', typ: 'JWT' }) + '.' + enc({ iss: k.client_email, scope: 'https://www.googleapis.com/auth/drive', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3000 });
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + b64url(sig) }) });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google не видав доступ: ' + (j.error_description || j.error || r.status));
  return j.access_token;
}


async function decrypt(file: Uint8Array, pass: string) {
  for (let i = 0; i < MAGIC.length; i++) if (file[i] !== MAGIC[i]) throw new Error('файл не є копією реєстру (немає підпису REESTR-BK1)');
  const salt = file.slice(MAGIC.length, MAGIC.length + 16), iv = file.slice(MAGIC.length + 16, MAGIC.length + 28), ct = file.slice(MAGIC.length + 28);
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  try { return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)); }
  catch { throw new Error('не вдалося розшифрувати: файл пошкоджений або пароль копії інший'); }
}
async function gunzip(bytes: Uint8Array) {
  const out = new Response(new Blob([bytes as any]).stream().pipeThrough(new DecompressionStream('gzip')));
  return new Uint8Array(await out.arrayBuffer());
}

Deno.serve(async (req: Request) => {
  const t0 = Date.now();
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const st = new Map<string, string>(((await db.from('robot_state').select('key, value').in('key', ['token', 'backup_folder'])).data || []).map((r: any) => [r.key, r.value]));
  if (!st.get('token') || req.headers.get('x-robot-token') !== st.get('token')) return new Response('forbidden', { status: 403 });
  const save = (status: string) => db.from('robot_state').upsert([
    { key: 'backup_check_last', value: new Date().toISOString(), updated_at: new Date().toISOString() },
    { key: 'backup_check_status', value: status, updated_at: new Date().toISOString() }]);
  try {
    const pass = Deno.env.get('BACKUP_PASSPHRASE') || '';
    if (pass.length < 12) throw new Error('немає секрету BACKUP_PASSPHRASE');
    const folder = st.get('backup_folder'); if (!folder) throw new Error('не вказано папку копій');
    const token = await googleToken();
    const q = encodeURIComponent(`'${folder}' in parents and name contains 'reestr-backup-' and trashed = false`);
    const lr = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,createdTime,size)`, { headers: { Authorization: 'Bearer ' + token } });
    const list = await lr.json(); const f = list?.files?.[0];
    if (!f) throw new Error('у папці немає жодної копії');
    const ageH = (Date.now() - Date.parse(f.createdTime)) / 3600e3;
    const dr = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: 'Bearer ' + token } });
    if (!dr.ok) throw new Error('Google Drive ' + dr.status + ' при завантаженні копії');
    const file = new Uint8Array(await dr.arrayBuffer());
    const data = JSON.parse(new TextDecoder().decode(await gunzip(await decrypt(file, pass))));
    if (data.format !== 'reestr-backup-1') throw new Error('невідомий формат копії: ' + data.format);
    const problems: string[] = []; let total = 0;
    for (const [name] of TABLES) {
      const rows = data.tables?.[name];
      if (!Array.isArray(rows)) { problems.push(`${name}: немає в копії`); continue; }
      if (rows.length !== data.counts?.[name]) problems.push(`${name}: у копії ${rows.length}, записано ${data.counts?.[name]}`);
      total += rows.length;
      const { count } = await db.from(name).select('*', { count: 'exact', head: true });
      const live = count ?? 0;
      // між копією і перевіркою дані змінюються; тривога — якщо копія помітно менша за базу
      if (live > 20 && rows.length < live * 0.9) problems.push(`${name}: у копії ${rows.length}, у базі ${live}`);
    }
    if (ageH > 36) problems.push(`найновіша копія стара: ${Math.round(ageH)} год`);
    const status = (problems.length ? 'помилка: ' + problems.join('; ') : 'ок') + ` · ${f.name} · рядків ${total} · ${Math.round(file.length / 1024)} КБ · ${Date.now() - t0} мс`;
    await save(status.slice(0, 900));
    return Response.json({ ok: !problems.length, file: f.name, total, problems, ms: Date.now() - t0 });
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 300);
    await save('помилка: ' + msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
});
