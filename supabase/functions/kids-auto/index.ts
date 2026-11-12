// @ts-nocheck
// ============================================================
// Edge Function kids-auto: АВТОІМПОРТ анкет «Діти Морської піхоти» (нова форма, аркуш з колонками «10.11 …»).
// Робот щоночі читає таблицю відповідей і записує нові анкети в реєстр так само, як ручний «Імпорт»:
//   • представник — нова картка або доповнення наявної (за телефоном; без телефону — за точним ПІБ);
//   • діти — лише нові (за датою народження), наявним доповнюється стать / «ким доводиться»;
//   • зв’язок із військовим — якщо такий боєць є в кабінеті (точний і єдиний збіг ПІБ) — прив’язка до картки/справи;
//   • що потребує уваги — у список «Анкета «Діти» — автоімпорт: перевірити»; помилкові рядки — не пишемо (журнал kids_form_done).
// Оброблені рядки — у kids_form_done (ключ: позначка часу + телефон), тож повторний запуск нічого не дублює.
// Виклик: POST з x-robot-token (cron) або з ключем адміністратора; body {dry:true} — лише показати, що буде (без запису).
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseKidsV2, mergeByPhone, letters, clean, badDates, OTHER_DEG } from './parse.js';

const cors = {
  'Access-Control-Allow-Origin': 'https://goodrv-dot.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-robot-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const REVIEW_LIST = 'Анкета «Діти» — автоімпорт: перевірити';
const SRC_REF = 'Google Форма «Діти» (автоімпорт)';

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

// ---------- читання аркуша нової форми ----------
async function readForm(id) {
  const token = await googleToken();
  const meta = await sheets(token, `${id}?fields=properties.title,sheets.properties.title`);
  const titles = (meta.sheets || []).map((s) => s.properties.title);
  const q = titles.map((t) => 'ranges=' + encodeURIComponent(`'${t.replace(/'/g, "''")}'!1:5`)).join('&');
  const firsts = await sheets(token, `${id}/values:batchGet?${q}&valueRenderOption=FORMATTED_VALUE`);
  let idx = -1, hrow = 0;
  (firsts.valueRanges || []).some((v, i) => (v.values || []).some((row, j) => {
    if ((row || []).some((h) => /^10\.11\s/.test(String(h).trim()))) { idx = i; hrow = j; return true; }
    return false;
  }));
  if (idx < 0) throw new Error('У таблиці немає аркуша нової форми (колонки «10.11 …»)');
  const sheet = titles[idx];
  const all = await sheets(token, `${id}/values/${encodeURIComponent(`'${sheet.replace(/'/g, "''")}'`)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER&majorDimension=ROWS`);
  const values = (all.values || []).slice(hrow);
  const header = values[0] || [];
  const rows = values.slice(1).map((r) => header.map((_, i) => (r[i] === undefined || r[i] === '' ? null : r[i])));
  return { sheet, header, rows };
}

// ---------- звірка з реєстром (як matchExisting у import.js) ----------
const COLS = 'id, journal, phone, extra_phones, name_check, is_extra, last_name, first_name, patronymic, email, region_id, settlement, cell_id, birth_date, consent_pd_at, consent_messages, sex, children(id, birth_date, full_name, rep_relation, sex), military_relations!military_relations_person_id_fkey(id, related_full_name, relation_degree, related_person_id), person_programs(program_id, role)';
async function matchExisting(db, list) {
  const allPhones = (r) => [r.person.phone, ...(r.person.extra_phones || [])].filter(Boolean);
  const phones = [...new Set(list.flatMap(allPhones))];
  const found = new Map(), byId = new Map();
  const one = (p) => { if (!byId.has(p.id)) byId.set(p.id, p); return byId.get(p.id); };
  for (let i = 0; i < phones.length; i += 100) {
    const chunk = phones.slice(i, i + 100);
    const [a, b] = await Promise.all([db.from('persons').select(COLS).in('phone', chunk), db.from('persons').select(COLS).overlaps('extra_phones', chunk)]);
    if (a.error) throw a.error; if (b.error) throw b.error;
    [...a.data, ...b.data].forEach((p) => { p = one(p); [p.phone, ...(p.extra_phones || [])].filter(Boolean).forEach((ph) => { if (!found.has(ph)) found.set(ph, p); }); });
  }
  const noPhone = list.filter((r) => !r.person.phone && r.person.last_name && !r.errors.length);
  const byName = new Map();
  const lastNames = [...new Set(noPhone.map((r) => r.person.last_name))];
  if (lastNames.length) {
    const { data, error } = await db.from('persons').select(COLS).in('last_name', lastNames);
    if (error) throw error;
    data.forEach((p) => { const k = letters(p.last_name) + '|' + letters(p.first_name) + '|' + letters(p.patronymic); p = one(p); byName.set(k, byName.has(k) && byName.get(k) !== p ? 'many' : p); });
  }
  list.forEach((r) => {
    if (r.errors.length) { r.state = 'error'; return; }
    let ex = allPhones(r).map((ph) => found.get(ph)).find(Boolean);
    if (!ex && !r.person.phone && r.person.last_name) {
      const m = byName.get(letters(r.person.last_name) + '|' + letters(r.person.first_name) + '|' + letters(r.person.patronymic));
      if (m && m !== 'many') ex = m; else if (m === 'many') r.warnings.push('У реєстрі кілька людей з таким ПІБ — створено нову картку, перевірте');
    }
    if (ex) {
      r.existing = ex;
      if (ex.name_check && r.person.last_name && r.person.first_name && !r.person.name_check) r.fixName = true;
      else if (letters(ex.last_name).slice(0, 4) !== letters(r.person.last_name).slice(0, 4)) r.warnings.push(`Телефон уже є в реєстрі в людини з іншим прізвищем («${ex.last_name} ${ex.first_name}») — дітей додано до неї, перевірте, чи це та сама людина`);
    }
    r.state = ex ? 'update' : 'new';
  });
}

// ---------- зв’язок із бійцем: точний і єдиний збіг ПІБ серед карток, що мають справу в кабінеті ----------
async function linkSoldiers(db, list) {
  const rels = list.flatMap((r) => (r.state === 'error' ? [] : r.relations.map((rel) => ({ r, rel })))).filter((x) => x.rel.related_full_name);
  const lasts = [...new Set(rels.map((x) => x.rel.related_full_name.split(' ')[0]))];
  if (!lasts.length) return;
  const { data, error } = await db.from('persons').select('id, last_name, first_name, patronymic, birth_date, cases!cases_person_id_fkey!inner(id)').in('last_name', lasts);
  if (error) throw error;
  const idx = new Map();
  (data || []).forEach((p) => { const k = letters([p.last_name, p.first_name, p.patronymic].filter(Boolean).join(' ')); idx.set(k, [...(idx.get(k) || []), p]); });
  rels.forEach(({ r, rel }) => {
    let c = idx.get(letters(rel.related_full_name)) || [];
    if (rel.related_birth_date) c = c.filter((p) => !p.birth_date || p.birth_date === rel.related_birth_date);
    if (c.length === 1) rel.related_person_id = c[0].id;
    else if (c.length > 1) r.warnings.push(`Військового «${rel.related_full_name}» у кабінеті кілька — прив’яжіть родину до потрібної справи вручну`);
    else if (rel.related_status === 'Загиблий') r.warnings.push(`Загиблого «${rel.related_full_name}» немає серед справ кабінету 200 (або ПІБ написано інакше) — перевірте`);
  });
}

// ---------- запис (як createNew / addToExisting / insertChildren у import.js) ----------
async function insertChildren(db, personId, rels, kids, progs) {
  if (rels.length) { const { error } = await db.from('military_relations').insert(rels.map((x) => ({ ...x, person_id: personId }))); if (error) throw error; }
  if (kids.length) { const { error } = await db.from('children').insert(kids.map((x) => ({ ...x, person_id: personId }))); if (error) throw error; }
  if (progs.length) { const { error } = await db.from('person_programs').upsert(progs.map((x) => ({ person_id: personId, ...x })), { onConflict: 'person_id,program_id', ignoreDuplicates: true }); if (error) throw error; }
}
const roleFor = (r) => (r.isRelative ? 'linked' : 'main');
async function createNew(db, r, batchId) {
  const p = { ...r.person, source: 'Анкета', source_ref: SRC_REF, import_batch_id: batchId };
  if (p.extra_phones && !p.extra_phones.length) delete p.extra_phones;
  const { data, error } = await db.from('persons').insert(p).select('id').single();
  if (error) throw error;
  await insertChildren(db, data.id, r.relations, r.children, r.programs.filter(Boolean).map((pid) => ({ program_id: pid, role: roleFor(r) })));
  return { id: data.id, kids: r.children.length };
}
async function addToExisting(db, r) {
  const ex = r.existing, patch = {};
  ['email', 'region_id', 'settlement', 'birth_date', 'consent_pd_at'].forEach((k) => { if (!ex[k] && r.person[k]) patch[k] = r.person[k]; });
  if (r.fixName) Object.assign(patch, { last_name: r.person.last_name, first_name: r.person.first_name, patronymic: r.person.patronymic || null, name_check: false, name_check_note: null });
  if (!ex.consent_messages && r.person.consent_messages) patch.consent_messages = true;
  if ((!ex.sex || ex.sex === 'Не вказано') && r.person.sex && r.person.sex !== 'Не вказано') patch.sex = r.person.sex;
  if (ex.is_extra && !r.isRelative) patch.is_extra = false;
  if (r.person.journal) { const j = { ...(ex.journal || {}) }; Object.entries(r.person.journal).forEach(([k, v]) => { j[k] = { ...(j[k] || {}), ...v }; }); patch.journal = j; }
  const known = new Set([ex.phone, ...(ex.extra_phones || [])].filter(Boolean));
  const newPhones = [r.person.phone, ...(r.person.extra_phones || [])].filter((ph) => ph && !known.has(ph));
  if (newPhones.length) { if (!ex.phone) patch.phone = newPhones.shift(); if (newPhones.length) patch.extra_phones = [...(ex.extra_phones || []), ...newPhones]; }
  const kids = r.children.filter((k) => !(ex.children || []).some((x) => x.birth_date === k.birth_date));
  if (kids.length) patch.has_children = 'Так';
  if (Object.keys(patch).length) { const { error } = await db.from('persons').update(patch).eq('id', ex.id); if (error) throw error; Object.assign(ex, patch); }
  for (const k of r.children) {
    const old = (ex.children || []).find((x) => x.birth_date === k.birth_date);
    if (!old || !old.id) continue;
    const cfix = {};
    if (!old.rep_relation && k.rep_relation) cfix.rep_relation = k.rep_relation;
    if ((!old.sex || old.sex === 'Не вказано') && k.sex && k.sex !== 'Не вказано') cfix.sex = k.sex;
    if (Object.keys(cfix).length) { const { error } = await db.from('children').update(cfix).eq('id', old.id); if (error) throw error; Object.assign(old, cfix); }
  }
  const rels = r.relations.filter((rel) => !(ex.military_relations || []).some((x) => letters(x.related_full_name) === letters(rel.related_full_name)));
  for (const rel of r.relations) {
    const old = (ex.military_relations || []).find((x) => letters(x.related_full_name) === letters(rel.related_full_name));
    if (!old) continue;
    const fix = {};
    if (!old.related_person_id && rel.related_person_id) fix.related_person_id = rel.related_person_id;
    if (old.relation_degree === OTHER_DEG && rel.relation_degree && rel.relation_degree !== OTHER_DEG) fix.relation_degree = rel.relation_degree;
    if (Object.keys(fix).length) { const { error } = await db.from('military_relations').update(fix).eq('id', old.id); if (error) throw error; Object.assign(old, fix); }
  }
  const progs = r.programs.filter(Boolean).filter((pid) => !(ex.person_programs || []).some((x) => x.program_id === pid)).map((pid) => ({ program_id: pid, role: roleFor(r) }));
  await insertChildren(db, ex.id, rels, kids, progs);
  ex.children = [...(ex.children || []), ...kids];
  ex.military_relations = [...(ex.military_relations || []), ...rels];
  ex.person_programs = [...(ex.person_programs || []), ...progs];
  return { id: ex.id, kids: kids.length };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Метод не підтримується' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const setState = (key, value) => db.from('robot_state').upsert({ key, value, updated_at: new Date().toISOString() });
  try {
    // хто викликає: робот (x-robot-token) або активний адміністратор
    const st = new Map(((await db.from('robot_state').select('key, value').in('key', ['token', 'sheet_kids'])).data || []).map((r) => [r.key, r.value]));
    let ok = !!st.get('token') && req.headers.get('x-robot-token') === st.get('token');
    if (!ok) {
      const uc = createClient(url, Deno.env.get('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
      const { data: { user } } = await uc.auth.getUser();
      if (user) { const { data: me } = await db.from('operators').select('role, active').eq('user_id', user.id).maybeSingle(); ok = !!me && me.active && me.role === 'admin'; }
    }
    if (!ok) return json({ error: 'forbidden' }, 403);
    const body = await req.json().catch(() => ({}));
    const dry = !!body.dry;
    if (!st.get('sheet_kids')) return json({ error: 'Таблицю анкет не підключено (sheet_kids)' }, 400);

    const { header, rows } = await readForm(st.get('sheet_kids'));
    const hs = header.map((h) => clean(h));
    const tsI = hs.findIndex((h) => /позначка|відмітка|отметка|timestamp/i.test(h));
    const phI = hs.findIndex((h) => /^2\.\s/.test(h));
    const keyOf = (r) => `${r[tsI] ?? ''}|${String(r[phI] ?? '').replace(/\D/g, '')}`;
    const { data: doneRows, error: de } = await db.from('kids_form_done').select('key');
    if (de) throw de;
    const done = new Set((doneRows || []).map((x) => x.key));
    const fresh = new Set(rows.map((r, i) => (done.has(keyOf(r)) ? null : i + 2)).filter(Boolean));   // номери рядків (як у розборі: перший рядок даних = 2)
    if (!fresh.size) { if (!dry) { await setState('kids_auto_last', new Date().toISOString()); await setState('kids_auto_status', 'ок: нових анкет немає'); } return json({ ok: true, total: rows.length, fresh: 0 }); }

    const [rg, un, pr] = await Promise.all([db.from('regions').select('id, name'), db.from('mp_units').select('id, name').eq('active', true), db.from('programs').select('id, name').eq('active', true)]);
    const ctx = { regions: new Map((rg.data || []).map((x) => [x.id, x.name])), units: new Map((un.data || []).map((x) => [x.id, x.name])),
      programByName: (n) => (pr.data || []).find((x) => x.name === n)?.id };
    badDates.clear();
    let list = parseKidsV2(rows, header, ctx);
    list.forEach((r) => { const bad = badDates.get(r.rows[0]); if (bad && !r.isRelative) r.warnings.push(`Дати ${bad.join(', ')} не існує — не записано`); });
    list = list.filter((r) => fresh.has(r.rows[0]));
    list = mergeByPhone(list);
    await matchExisting(db, list);
    await linkSoldiers(db, list);

    const summary = { total: rows.length, fresh: fresh.size, records: list.length, new: 0, update: 0, error: 0, kids: 0, review: 0, linked: 0 };
    list.forEach((r) => { summary[r.state] = (summary[r.state] || 0) + 1; summary.linked += r.relations.filter((x) => x.related_person_id).length; });
    if (dry) return json({ ok: true, dry: true, summary, rows: list.map((r) => ({ rows: r.rows, state: r.state, kids: r.children.length, linked: r.relations.some((x) => x.related_person_id), warnings: r.warnings.length, errors: r.errors.length })) });

    const { data: batch } = await db.from('import_batches').insert({ file_name: SRC_REF, template: 'Діти МП — анкети, нова форма (автоімпорт)', rows_total: list.length }).select('id').single();
    const review = [];
    const logRows = [];
    for (const r of list) {
      let res = null, err = null;
      if (r.state !== 'error') {
        try { res = r.existing ? await addToExisting(db, r) : await createNew(db, r, batch?.id); summary.kids += res.kids; }
        catch (e) { err = String(e?.message || e).slice(0, 200); r.state = 'error'; r.errors.push('Не вдалося записати: ' + err); }
      }
      if (res && r.warnings.length) review.push({ person_id: res.id, note: `[рядок ${r.rows.join(', ')}] ` + r.warnings.join('; ').slice(0, 900) });
      r.rows.forEach((rowNo) => logRows.push({ key: keyOf(rows[rowNo - 2]), row_no: rowNo, person_id: res?.id || null,
        result: r.state === 'error' ? 'error' : r.existing ? 'update' : 'new', note: [...r.errors, ...r.warnings].join('; ').slice(0, 1000) || null }));
    }
    summary.error = list.filter((r) => r.state === 'error').length;
    // помилкові рядки теж позначаємо обробленими (щоб не пробувати щоночі), причина — у kids_form_done
    if (logRows.length) { const { error } = await db.from('kids_form_done').upsert(logRows, { onConflict: 'key' }); if (error) throw error; }
    if (review.length) {
      let { data: l } = await db.from('person_lists').select('id').eq('name', REVIEW_LIST).maybeSingle();
      if (!l) {
        const { data: tpl } = await db.from('person_lists').select('owner_id, shared_with').eq('id', 20).maybeSingle();
        ({ data: l } = await db.from('person_lists').insert({ name: REVIEW_LIST, owner_id: tpl?.owner_id, shared_with: tpl?.shared_with || [],
          description: 'Анкети «Діти», які робот імпортував автоматично, але щось варто перевірити (у примітці — що саме). Після перевірки приберіть людину зі списку. Рядки з помилками (без ПІБ, без дати народження дитини) робот не записує — їх видно в адміністратора.' }).select('id').single());
      }
      if (l) { const { error } = await db.from('person_list_members').upsert(review.map((x) => ({ list_id: l.id, ...x })), { onConflict: 'list_id,person_id', ignoreDuplicates: true }); if (error) console.error(error); }
      summary.review = review.length;
    }
    if (batch) await db.from('import_batches').update({ rows_imported: summary.records - summary.error, rows_skipped: summary.error }).eq('id', batch.id);
    const status = `ок: анкет ${summary.fresh}, нових карток ${summary.new}, доповнено ${summary.update}, дітей додано ${summary.kids}, прив’язано до справ ${summary.linked}` +
      (summary.review ? `, перевірити ${summary.review}` : '') + (summary.error ? `, не записано (помилки) ${summary.error}` : '');
    await setState('kids_auto_last', new Date().toISOString()); await setState('kids_auto_status', status);
    return json({ ok: true, summary });
  } catch (e) {
    console.error(e);
    try { await setState('kids_auto_status', 'помилка: ' + String(e?.message || e).slice(0, 250)); } catch { /* */ }
    return json({ error: String(e?.message || e).slice(0, 300) }, 500);
  }
});
