// ============================================================
// Робот-дзеркало: Кабінет → Google Таблиця (лише в один бік).
// Запускається розкладом у базі (pg_cron) через robot_kick(): ОКРЕМИЙ запуск на кожен модуль
// (200, 300, БЗВ, Звільнені з полону, Ветерани) — так кожен запуск вкладається в ліміт 2 с процесорного часу.
// Режим «auto» пише, лише якщо дані змінились; уночі «full» переписує все й оформлення.
// Дані готує база (mirror_cases — компактно, лише потрібні поля). Аркуші осередків — формула FILTER
// з головного аркуша «Журнал …», тож рядки пишемо лише один раз.
// Ключ Google — у секреті GOOGLE_SA_KEY; доступ до бази — службовий ключ Supabase.
// Відповідь містить лише лічильники, без персональних даних.
// v10 — 10.11.2026
// ============================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildTabs, buildLists, NEW_KINDS, TAB_NAME, type Tab, type ListCol } from './build.ts';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const ALL_KINDS = ['200', '300', ...NEW_KINDS];
const GUARD = 'Ця таблиця — дзеркало Кабінету. Зміни, внесені тут, буде перезаписано. Працюйте в Кабінеті.';
const dov = (k: string) => `Довідники ${TAB_NAME[k] || k}`;
const DEFAULT_TITLES = ['Sheet1', 'Лист1', 'Аркуш1', 'Аркуш 1', 'Лист 1'];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// аркуші, якими керує робот для цього модуля (чужі модулі не чіпаємо, навіть якщо таблиця спільна)
const managedOf = (kind: string) => { const n = esc(TAB_NAME[kind] || kind); return new RegExp(`^(Журнал ${n}|Довідники ${n}|${n} .+)$`); };

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
  const unsigned = enc({ alg: 'RS256', typ: 'JWT' }) + '.' + enc({ iss: k.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3000 });
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + b64url(sig) }) });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google не видав доступ: ' + (j.error_description || j.error || r.status));
  return j.access_token;
}

async function gapi(token: string, url: string, method = 'GET', body?: unknown) {
  const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Google Sheets ${r.status}: ${(j as any)?.error?.message || ''}`.slice(0, 300));
  return j as any;
}

async function all(q: () => any) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q().range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

async function loadData(db: any, kind: string) {
  const [defs, ops, cells, regions, units, statuses] = await Promise.all([
    all(() => db.from('case_stage_defs').select('module, key, label, kind, options, sheet_column, active, sort').eq('module', kind).order('sort')),
    all(() => db.from('operators').select('user_id, full_name').order('user_id')),
    all(() => db.from('cells').select('id, name, active').order('id')),
    all(() => db.from('regions').select('id, name').order('id')),
    all(() => db.from('mp_units').select('id, name').order('id')),
    all(() => db.from('case_statuses').select('module, name, sort').eq('module', kind).order('sort'))
  ]);
  // справи модуля — компактно з бази, сторінками по 1000
  const cases: any[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await db.rpc('mirror_cases', { p_kind: kind, p_offset: off, p_limit: 1000 });
    if (error) throw new Error(error.message);
    cases.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const vets = new Map<string, string[]>();
  cases.forEach((c) => { if (c.vets?.length) vets.set(c.person_id, c.vets); });
  return {
    inp: {
      cases, defs, defsFull: defs, statuses, vets,
      ops: new Map(ops.map((o) => [o.user_id, o.full_name])),
      cells: new Map(cells.map((c) => [c.id, c.name])),
      regions: new Map(regions.map((r) => [r.id, r.name])),
      units: new Map(units.map((u) => [u.id, u.name]))
    },
    cellNames: cells.filter((c) => c.active).map((c) => c.name)
  };
}

const colLetter = (n: number) => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;
const qs = (s: string) => `"${s.replace(/"/g, '""')}"`;

// формула аркуша осередку: рядки головного аркуша, де колонка «Осередок ГО» (або «Регіон») = назва осередку;
// «Без осередку» — рядки, де там не стоїть жоден відомий осередок
// sep — роздільник аргументів у мові таблиці (en: «,»; uk / ru / більшість європейських: «;»)
function cellFormula(main: Tab, t: Tab, sep: string) {
  const last = colLetter(main.header.length - 1), c = colLetter(t.cellOf!.col), src = q(main.title);
  const rng = `${src}!A2:${last}`, col = `${src}!${c}2:${c}`, ids = `${src}!A2:A`;
  const cond = t.cellOf!.name === 'Без осередку'
    ? `(${ids}<>"")*ISNA(MATCH(${col}${sep}{${t.cellOf!.known.map(qs).join(';') || '""'}}${sep}0))`
    : `${col}=${qs(t.cellOf!.name)}`;
  return `=IFERROR(FILTER(${rng}${sep}${cond})${sep}"")`;
}

async function writeSheet(token: string, sheetId: string, kind: string, dataTabs: Tab[], ls: ListCol[]) {
  const main = dataTabs.find((t) => !t.cellOf)!;
  const n0 = Math.max(0, ...ls.map((l) => l.values.length));
  const ref: Tab = { title: dov(kind), module: kind, header: ls.map((l) => l.title), widths: ls.map(() => 24), rows: Array.from({ length: n0 }, (_, i) => ls.map((l) => l.values[i] ?? '')), dateCols: [] };
  const tabs = ls.length ? [...dataTabs, ref] : [...dataTabs];
  const MANAGED = managedOf(kind);
  const meta = await gapi(token, `${SHEETS}/${sheetId}?fields=properties.locale,sheets(properties,protectedRanges)`);
  const sep = /^en/i.test(meta.properties?.locale || 'en') ? ',' : ';';
  const guarded = new Set<number>((meta.sheets || []).filter((s: any) => (s.protectedRanges || []).some((r: any) => r.description === GUARD)).map((s: any) => s.properties.sheetId));
  const existing = new Map<string, any>((meta.sheets || []).map((s: any) => [s.properties.title, s.properties]));
  const want = new Set(tabs.map((t) => t.title));
  const gridRows = (t: Tab) => Math.max(t.rows.length + (t.cellOf ? 60 : 20), 50);
  const reqs: any[] = [];
  tabs.forEach((t) => {
    if (!existing.has(t.title)) reqs.push({ addSheet: { properties: { title: t.title, gridProperties: { rowCount: gridRows(t), columnCount: t.header.length, frozenRowCount: 1 } } } });
  });
  existing.forEach((p, title) => {
    if ((MANAGED.test(title) && !want.has(title)) || DEFAULT_TITLES.includes(title)) reqs.push({ deleteSheet: { sheetId: p.sheetId } });
  });
  const ids = new Map<string, number>();
  existing.forEach((p, title) => ids.set(title, p.sheetId));
  if (reqs.length) {
    const res = await gapi(token, `${SHEETS}/${sheetId}:batchUpdate`, 'POST', { requests: reqs });
    (res.replies || []).forEach((r: any) => { if (r.addSheet) ids.set(r.addSheet.properties.title, r.addSheet.properties.sheetId); });
  }
  // порядок аркушів: свої — після вже наявних чужих (у спільній таблиці), у своєму порядку
  const base = [...existing.keys()].filter((t) => !MANAGED.test(t) && !DEFAULT_TITLES.includes(t)).length;
  await gapi(token, `${SHEETS}/${sheetId}:batchUpdate`, 'POST', { requests: tabs.map((t, i) => ({ updateSheetProperties: {
    properties: { sheetId: ids.get(t.title)!, index: base + i, gridProperties: { rowCount: gridRows(t), columnCount: t.header.length, frozenRowCount: 1 } },
    fields: 'index,gridProperties.rowCount,gridProperties.columnCount,gridProperties.frozenRowCount' } })) });
  // значення: очищаємо; рядки — лише в головний аркуш і довідник (RAW — телефони з нулем лишаються текстом);
  // аркуші осередків — шапка + формула FILTER (USER_ENTERED)
  await gapi(token, `${SHEETS}/${sheetId}/values:batchClear`, 'POST', { ranges: tabs.map((t) => q(t.title)) });
  const plain = tabs.filter((t) => !t.cellOf), cellTabs = tabs.filter((t) => t.cellOf);
  await gapi(token, `${SHEETS}/${sheetId}/values:batchUpdate`, 'POST', {
    valueInputOption: 'RAW',
    data: [
      ...plain.map((t) => ({ range: `${q(t.title)}!A1:${colLetter(t.header.length - 1)}${t.rows.length + 1}`, values: [t.header, ...t.rows] })),
      ...cellTabs.map((t) => ({ range: `${q(t.title)}!A1:${colLetter(t.header.length - 1)}1`, values: [t.header] }))
    ]
  });
  if (cellTabs.length) await gapi(token, `${SHEETS}/${sheetId}/values:batchUpdate`, 'POST', {
    valueInputOption: 'USER_ENTERED', data: cellTabs.map((t) => ({ range: `${q(t.title)}!A2`, values: [[cellFormula(main, t, sep)]] }))
  });
  // оформлення: шапка, ширина колонок, формат дат, фільтр, випадні списки
  const look: any[] = [];
  tabs.forEach((t) => {
    const sid = ids.get(t.title)!;
    const n = t.rows.length + 1, cols = t.header.length, end = gridRows(t);
    look.push({ repeatCell: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: cols },
      cell: { userEnteredFormat: { textFormat: { bold: true }, wrapStrategy: 'WRAP', verticalAlignment: 'MIDDLE', backgroundColor: { red: 0.85, green: 0.9, blue: 0.95 } } },
      fields: 'userEnteredFormat(textFormat,wrapStrategy,verticalAlignment,backgroundColor)' } });
    look.push({ repeatCell: { range: { sheetId: sid, startRowIndex: 1, endRowIndex: end, startColumnIndex: 0, endColumnIndex: cols },
      cell: { userEnteredFormat: { verticalAlignment: 'TOP', wrapStrategy: 'WRAP', numberFormat: { type: 'TEXT' } } }, fields: 'userEnteredFormat(verticalAlignment,wrapStrategy,numberFormat)' } });
    t.dateCols.forEach((c) => look.push({ repeatCell: { range: { sheetId: sid, startRowIndex: 1, endRowIndex: end, startColumnIndex: c, endColumnIndex: c + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd.mm.yyyy' } } }, fields: 'userEnteredFormat.numberFormat' } }));
    t.widths.forEach((w, c) => look.push({ updateDimensionProperties: { range: { sheetId: sid, dimension: 'COLUMNS', startIndex: c, endIndex: c + 1 }, properties: { pixelSize: Math.round(w * 7.5) }, fields: 'pixelSize' } }));
    if (!guarded.has(sid)) look.push({ addProtectedRange: { protectedRange: { range: { sheetId: sid }, description: GUARD, warningOnly: true } } });
    look.push({ setBasicFilter: { filter: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: Math.max(n, 2), startColumnIndex: 0, endColumnIndex: cols } } } });
    look.push({ setDataValidation: { range: { sheetId: sid, startRowIndex: 1, endRowIndex: end, startColumnIndex: 0, endColumnIndex: cols } } });
    // випадні списки — лише в головному аркуші (аркуші осередків — результат формули)
    if (t === main && ls.length) ls.forEach((l, j) => {
      const letter = colLetter(j);
      const formula = `=${q(dov(kind))}!$${letter}$2:$${letter}$${l.values.length + 1}`;
      l.columns.forEach((name) => {
        const c = t.header.indexOf(name); if (c < 0) return;
        look.push({ setDataValidation: { range: { sheetId: sid, startRowIndex: 1, endRowIndex: end, startColumnIndex: c, endColumnIndex: c + 1 },
          rule: { condition: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: formula }] }, showCustomUi: true, strict: false } } });
      });
    });
  });
  await gapi(token, `${SHEETS}/${sheetId}:batchUpdate`, 'POST', { requests: look });
}

async function sha(s: string) { return b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }

Deno.serve(async (req: Request) => {
  const t0 = Date.now();
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const state = async () => new Map<string, string>(((await db.from('robot_state').select('key, value')).data || []).map((r: any) => [r.key, r.value]));
  const setState = (rows: Record<string, string | null>) =>
    db.from('robot_state').upsert(Object.entries(rows).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() })));
  const st = await state();
  if (!st.get('token') || req.headers.get('x-robot-token') !== st.get('token')) return new Response('forbidden', { status: 403 });
  const body = await req.json().catch(() => ({}));
  const mode = body.mode === 'full' ? 'full' : 'auto';
  const kind = String(body.kind || '');
  if (!ALL_KINDS.includes(kind)) return Response.json({ ok: false, error: 'kind?' }, { status: 400 });
  const K = (s: string) => `${s}_${kind}`;
  const sheetId = st.get('sheet_' + kind) || (NEW_KINDS.includes(kind) ? '' : st.get('sheet_id') || '');
  if (!sheetId) return Response.json({ ok: true, skipped: 'no sheet' });

  // загальний стан для кабінету (дзвіночок / «Google-дзеркало: оновлено …»): найстаріший з модулів
  const summarize = async () => {
    const s = await state();
    const kinds = ALL_KINDS.filter((k) => s.get('sheet_' + k) || (!NEW_KINDS.includes(k) && s.get('sheet_id')));
    const runs = kinds.map((k) => s.get('last_run_' + k) || '');
    const writes = kinds.map((k) => s.get('last_write_' + k) || '').filter(Boolean).sort();
    const bad = kinds.filter((k) => /^помилка/.test(s.get('last_status_' + k) || ''));
    const status = bad.length
      ? 'помилка: ' + bad.map((k) => `${TAB_NAME[k]} — ${(s.get('last_status_' + k) || '').replace(/^помилка:\s*/, '')}`).join('; ')
      : 'ок: ' + kinds.map((k) => `${TAB_NAME[k]}: ${(s.get('last_status_' + k) || '—').replace(/^ок:\s*/, '')}`).join(' | ');
    await setState({ last_run: runs.some((r) => !r) ? null : runs.sort()[0], last_write: writes[0] || null, last_status: status.slice(0, 900) });
  };

  // швидка перевірка: якщо з початку минулого завантаження дані не мінялись — нічого не читаємо
  const changedAt = Date.parse(st.get('data_changed_at') || '') || Date.now();
  const lastLoad = Date.parse(st.get(K('last_load')) || '') || 0;
  if (mode === 'auto' && lastLoad && changedAt + 3000 < lastLoad) {
    await setState({ [K('last_run')]: new Date().toISOString(), [K('last_status')]: `ок: auto, без змін · ${Date.now() - t0} мс` });
    await summarize();
    return Response.json({ ok: true, kind, mode, changed: false, quick: true });
  }

  const { data: locked } = await db.rpc('robot_lock_k', { p_kind: kind });
  if (!locked) return Response.json({ ok: true, kind, skipped: 'busy' });
  let checkNote = '';
  try {
    const loadStarted = new Date().toISOString();
    const { inp, cellNames } = await loadData(db, kind);
    const tabs = buildTabs(inp as any, cellNames, [kind]);
    const main = tabs.find((t) => !t.cellOf)!;
    const lists = buildLists(inp as any, main);
    // відбиток змін — лише головний аркуш (аркуші осередків з нього рахуються формулою) + переліки й осередки
    const hash = await sha(JSON.stringify([main.header, main.rows, lists, cellNames]));
    const changed = hash !== st.get(K('last_hash'));
    if (changed || mode === 'full') {
      const token = await googleToken();
      await writeSheet(token, sheetId, kind, tabs, lists);
      await setState({ [K('last_hash')]: hash, [K('last_write')]: new Date().toISOString() });
      // перевірка: на аркушах осередків формула дала стільки ж рядків, скільки справ осередку (лише лічильники)
      const cellTabs = tabs.filter((t) => t.cellOf);
      if (cellTabs.length) {
        const r = await gapi(token, `${SHEETS}/${sheetId}/values:batchGet?` + cellTabs.map((t) => 'ranges=' + encodeURIComponent(`${q(t.title)}!A2:A`)).join('&'));
        const got = (r.valueRanges || []).map((v: any) => (v.values || []).filter((x: any[]) => x[0] !== undefined && x[0] !== '').length);
        const off = cellTabs.filter((t, i) => got[i] !== t.rows.length);
        if (off.length) {
          const errs = [...new Set((r.valueRanges || []).map((v: any) => String(v.values?.[0]?.[0] ?? '')).filter((x: string) => /^[#=]/.test(x)).map((x: string) => x.slice(0, 40)))].slice(0, 2).join(' ');
          checkNote = ` · ⚠ аркуші осередків не збіглися: ${off.length}${errs ? ' (' + errs + ')' : ''}`;
        }
      }
    }
    const status = `ок: ${mode}${changed ? ', оновлено' : ', без змін'} · справ ${main.rows.length}${checkNote} · ${Date.now() - t0} мс`;
    await setState({ [K('last_run')]: new Date().toISOString(), [K('last_status')]: status, [K('last_load')]: loadStarted });
    await summarize();
    return Response.json({ ok: true, kind, mode, changed, rows: main.rows.length, check: checkNote || 'ok', ms: Date.now() - t0 });
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 300);
    await setState({ [K('last_run')]: new Date().toISOString(), [K('last_status')]: 'помилка: ' + msg });
    await summarize();
    return Response.json({ ok: false, kind, error: msg }, { status: 500 });
  } finally {
    await db.rpc('robot_unlock_k', { p_kind: kind });
  }
});
