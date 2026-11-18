// @ts-nocheck
// ============================================================
// Edge Function awards-sync: таблиця Google «звернення по нагородам» (веде Анастасія Супрун) → реєстр.
// Робот читає перший аркуш (рядок заголовків — той, де є «Загиблий») і передає рядки в базу: awards_appeal_sync().
// База сама: знаходить справу 200 загиблого (або створює нову), доповнює порожні поля (в/ч, бригада, обставини),
// додає / доповнює родича, що звернувся, і оновлює список «звернення по нагородам» (примітка з таблиці).
// Змінені рядки обробляються повторно (awards_appeal_rows зберігає відбиток кожного рядка), незмінені — пропускаються.
// Таблиця: robot_state.sheet_awards (id таблиці). Доступ: таблицю «поділено» з адресою робота (GOOGLE_SA_KEY).
// Виклик: POST з x-robot-token (cron) або з ключем адміністратора; body {dry:true} — лише порахувати, без запису.
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': 'https://goodrv-dot.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-robot-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const b64url = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
async function googleToken() {
  const k = JSON.parse(Deno.env.get('GOOGLE_SA_KEY') || 'null');
  if (!k?.private_key) throw new Error('Немає секрету GOOGLE_SA_KEY');
  const pem = String(k.private_key).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = enc({ alg: 'RS256', typ: 'JWT' }) + '.' + enc({ iss: k.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3000 });
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + b64url(sig) }) });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google не видав доступ: ' + (j.error_description || j.error || r.status));
  return j.access_token;
}
async function sheets(token, url) {
  const r = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + url, { headers: { Authorization: 'Bearer ' + token } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Google Sheets ${r.status}: ${String(j?.error?.message || '').slice(0, 200)}`);
  return j;
}
const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

async function readSheet(id) {
  const token = await googleToken();
  const meta = await sheets(token, `${id}?fields=sheets.properties.title`);
  const title = meta.sheets?.[0]?.properties?.title;
  if (!title) throw new Error('У таблиці немає аркушів');
  const all = await sheets(token, `${id}/values/${encodeURIComponent(`'${title.replace(/'/g, "''")}'`)}?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`);
  const values = all.values || [];
  const h = values.findIndex((row) => (row || []).some((x) => clean(x) === 'Загиблий'));
  if (h < 0) throw new Error('Не знайдено рядок заголовків (колонка «Загиблий»)');
  const header = values[h].map(clean);
  return values.slice(h + 1)
    .map((row) => Object.fromEntries(header.map((k, i) => [k, clean(row?.[i])]).filter(([k]) => k)))
    .filter((o) => o['Загиблий']);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Метод не підтримується' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const setState = (key, value) => db.from('robot_state').upsert({ key, value, updated_at: new Date().toISOString() });
  try {
    const st = new Map(((await db.from('robot_state').select('key, value').in('key', ['token', 'sheet_awards'])).data || []).map((r) => [r.key, r.value]));
    let ok = !!st.get('token') && req.headers.get('x-robot-token') === st.get('token');
    if (!ok) {
      const uc = createClient(url, Deno.env.get('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
      const { data: { user } } = await uc.auth.getUser();
      if (user) { const { data: me } = await db.from('operators').select('role, active').eq('user_id', user.id).maybeSingle(); ok = !!me && me.active && me.role === 'admin'; }
    }
    if (!ok) return json({ error: 'forbidden' }, 403);
    const body = await req.json().catch(() => ({}));
    if (!st.get('sheet_awards')) return json({ error: 'Таблицю не підключено (robot_state.sheet_awards)' }, 400);
    const rows = await readSheet(st.get('sheet_awards'));
    const { data, error } = await db.rpc('awards_appeal_sync', { p_rows: rows, p_dry: !!body.dry });
    if (error) throw error;
    if (!body.dry) {
      await setState('awards_sync_last', new Date().toISOString());
      await setState('awards_sync_status', `ок: рядків ${rows.length}, нових справ ${data.new}, оновлено ${data.updated}, без змін ${data.same}` + (data.ambiguous ? `, не оброблено (кілька однакових ПІБ) ${data.ambiguous}` : ''));
    }
    return json({ ok: true, rows: rows.length, ...data });
  } catch (e) {
    console.error(e);
    try { await setState('awards_sync_status', 'помилка: ' + String(e?.message || e).slice(0, 250)); } catch { /* */ }
    return json({ error: String(e?.message || e).slice(0, 300) }, 500);
  }
});
