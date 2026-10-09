# Зведення: «Не в роботі» (основа) + «Аркуш2» (доповнення) -> один файл старого формату журналу 200
import sys, re, datetime, collections, warnings, openpyxl
warnings.filterwarnings('ignore')
f1, f2, out_path, rep_path = sys.argv[1:5]
w1 = openpyxl.load_workbook(f1, data_only=True)['Аркуш2']
w2 = openpyxl.load_workbook(f2, data_only=True).worksheets[0]
norm = lambda s: re.sub(r'[^а-яіїєґa-z]', '', str(s or '').lower().replace('ʼ', '').replace("'", '').replace('’', ''))
EMPTY = lambda v: v is None or str(v).strip() in ('', '—', '-', '–')
s = lambda v: '' if EMPTY(v) else str(v).strip()
MONTHS = {'січ':1,'лют':2,'берез':3,'квіт':4,'трав':5,'черв':6,'лип':7,'серп':8,'верес':9,'жовт':10,'листоп':11,'груд':12}
def date_exact(v):
    if EMPTY(v): return None
    if isinstance(v, datetime.datetime): return v.date()
    t = str(v)
    m = re.search(r'(\d{1,2})[/.](\d{1,2})[/.](\d{4})', t)
    if m:
        try: return datetime.date(int(m[3]), int(m[2]), int(m[1]))
        except ValueError: return None
    m = re.search(r'(\d{1,2})\s+([а-яіїєґ]+)\s+(\d{4})', t.lower())
    if m:
        mon = next((n for k, n in MONTHS.items() if m[2].startswith(k)), None)
        if mon:
            try: return datetime.date(int(m[3]), mon, int(m[1]))
            except ValueError: return None
    return None
fmt = lambda d: d.strftime('%d.%m.%Y') if d else ''
def phone(v):
    if EMPTY(v): return None
    if isinstance(v, (int, float)):
        d = str(int(v)); return ('0' + d) if len(d) == 9 else ('+' + d if d.startswith('380') else d)
    return str(v).strip()
DEG = {'батько':'Батько','мати':'Мати','дружина':'Дружина','брат':'Брат','сестра':'Сестра','син':'Син','донька':'Донька','чоловік':'Чоловік'}

# ---- основа: файл 2 (без колонки A-групування і без «Виконавець»)
last = max(r for r in range(1, w2.max_row + 1) if any(w2.cell(r, c).value not in (None, '') for c in range(2, w2.max_column + 1)))
cols = [c for c in range(2, w2.max_column + 1) if w2.cell(1, c).value not in (None, '') and norm(w2.cell(1, c).value) != 'виконавець']
HDR = [str(w2.cell(1, c).value).strip() for c in cols] + ['Статус']
ix = {norm(h): i for i, h in enumerate(HDR)}
I = lambda name: ix[norm(name)]
iF, iBD, iREC, iDEG, iADDR, iPH, iNOTE, iBDATE, iBPLACE = (I('прізвище , імя ,по-батькові'), I('Дата народження'), I('Отримувач сповіщення'),
    I('Спорідненість'), I('Адреса отримувача'), I('Контакти отримувача'), I('Примітки'), I('Дата поховання'), I('Місце поховання'))
rows = []
for r in range(2, last + 1):
    row = [w2.cell(r, c).value for c in cols] + ['Не беремо в роботу']
    if all(v in (None, '') for v in row[:-1]): continue
    rows.append(row)
by_name = collections.defaultdict(list)
for row in rows:
    if row[iF]: by_name[norm(row[iF])].append(row)

stat = collections.Counter(); report = []
def add_note(row, text):
    row[iNOTE] = '; '.join(x for x in [s(row[iNOTE]), text] if x)

# ---- доповнення з файлу 1
for r in range(2, w1.max_row + 1):
    g = lambda c: w1.cell(r, c).value
    fio = ' '.join(x for x in [s(g(2)), s(g(3)), s(g(4))] if x)
    if not fio: continue
    n = norm(fio); bd1 = date_exact(g(6))
    targets = by_name.get(n, [])
    bur1 = date_exact(g(18)); burraw1 = s(g(18)); place1 = s(g(17))
    kin1 = []
    for dc, nc, bc, ac, pc in [(7, 8, 9, 10, 11), (12, 13, 14, 15, 16)]:
        nm = s(g(nc))
        if not nm: continue
        draw = s(g(dc)).lower(); bd = g(bc)
        bdt = '' if EMPTY(bd) else (fmt(date_exact(bd)) or (f'{int(bd)} р.н.' if isinstance(bd, (int, float)) else s(bd)))
        kin1.append(dict(name=nm, deg_raw=draw, bd=bdt, addr=s(g(ac)), ph=phone(g(pc))))
    if targets:
        stat['matched'] += 1
        base = targets[0]
        bd2 = date_exact(base[iBD])
        if bd1 and bd2 and bd1 != bd2:
            add_note(base, f'Інша дата народження в іншому списку: {fmt(bd1)}'); report.append((fio, 'дата народження', fmt(bd2), fmt(bd1)))
        # поховання
        if EMPTY(base[iBDATE]) and (bur1 or burraw1):
            if bur1: base[iBDATE] = fmt(bur1); stat['burial_date_added'] += 1
            else: add_note(base, f'Дата поховання (неточна): {burraw1}')
        elif bur1 and date_exact(base[iBDATE]) and date_exact(base[iBDATE]) != bur1:
            add_note(base, f'Інша дата поховання в іншому списку: {fmt(bur1)}'); report.append((fio, 'дата поховання', fmt(date_exact(base[iBDATE])), fmt(bur1)))
        if EMPTY(base[iBPLACE]) and place1: base[iBPLACE] = place1; stat['burial_place_added'] += 1
        elif place1 and norm(base[iBPLACE]) != norm(place1):
            add_note(base, f'Місце поховання за іншим списком: {place1}'); report.append((fio, 'місце поховання', s(base[iBPLACE]), place1))
        known = {norm(t[iREC]) for t in targets if t[iREC]}
        for k in kin1:
            if '(помер' in k['deg_raw']:
                add_note(base, f"{k['deg_raw']}: {k['name']}"); stat['deceased_kin_note'] += 1; continue
            if k['bd']: add_note(base, f"{k['deg_raw'] or 'родич'} {k['name']}: дата народження {k['bd']}")
            nk = norm(k['name'])
            hit = next((t for t in targets if t[iREC] and (norm(t[iREC]) == nk or nk.startswith(norm(t[iREC])) or norm(t[iREC]).startswith(nk))), None)
            if hit:    # той самий отримувач — доповнюємо порожнє
                if EMPTY(hit[iPH]) and k['ph']: hit[iPH] = k['ph']; stat['phone_added'] += 1
                elif k['ph'] and norm(phone(hit[iPH]) or '')[-9:] != re.sub(r'\D', '', k['ph'])[-9:] and re.sub(r'\D','',str(hit[iPH] or ''))[-9:] != re.sub(r'\D','',k['ph'])[-9:]:
                    add_note(base, f"Інший телефон {k['name']} за іншим списком: {k['ph']}"); report.append((fio, f"телефон {k['name']}", s(hit[iPH]), k['ph']))
                if EMPTY(hit[iADDR]) and k['addr']: hit[iADDR] = k['addr']; stat['addr_added'] += 1
                continue
            base_deg = re.sub(r'\s*\(.*\)', '', k['deg_raw']).strip()
            deg = k['deg_raw'] if '(' in k['deg_raw'] else DEG.get(base_deg, k['deg_raw'])
            empty_row = next((t for t in targets if EMPTY(t[iREC])), None)
            row = empty_row if empty_row is not None else list(base)
            if empty_row is None:   # новий рядок-отримувач того ж загиблого (імпорт зведе в одну картку)
                for j in range(len(row)):
                    if j not in (iF, iBD) and HDR[j] != 'Статус' and not re.match(r'(датазагибелі|регіон|військовачастина|бригада|звання|позивний|датасповіщення|сповіщення)', norm(HDR[j])): row[j] = None
                rows.append(row); targets.append(row)
            row[iREC] = k['name']; row[iDEG] = deg; row[iADDR] = k['addr'] or None; row[iPH] = k['ph']
            stat['kin_added'] += 1
    else:
        stat['new_fallen'] += 1
        new = [None] * len(HDR); new[-1] = 'Не беремо в роботу'
        new[iF] = fio; new[iBD] = fmt(bd1) or s(g(6))
        new[iBDATE] = fmt(bur1) or None; new[iBPLACE] = place1 or None
        if burraw1 and not bur1: add_note(new, f'Дата поховання (неточна): {burraw1}')
        dz = s(g(19)); dd = date_exact(dz)
        if dd: new[I('Дата загибелі')] = fmt(dd)
        made = False
        for k in kin1:
            if '(помер' in k['deg_raw']: add_note(new, f"{k['deg_raw']}: {k['name']}"); continue
            if k['bd']: add_note(new, f"{k['deg_raw'] or 'родич'} {k['name']}: дата народження {k['bd']}")
            row = list(new) if made else new
            base_deg = re.sub(r'\s*\(.*\)', '', k['deg_raw']).strip()
            row[iREC] = k['name']; row[iDEG] = k['deg_raw'] if '(' in k['deg_raw'] else DEG.get(base_deg, k['deg_raw'])
            row[iADDR] = k['addr'] or None; row[iPH] = k['ph']
            if made: rows.append(row)
            else: rows.append(new); made = True
        if not made: rows.append(new)

out = openpyxl.Workbook(); o = out.active; o.title = 'Журнал 200'; o.append(HDR)
for row in rows: o.append([v.date() if isinstance(v, datetime.datetime) else v for v in row])
for c in range(1, len(HDR) + 1): o.column_dimensions[openpyxl.utils.get_column_letter(c)].width = 18
o.freeze_panes = 'A2'; out.save(out_path)
rb = openpyxl.Workbook(); rs = rb.active; rs.title = 'Розбіжності'
rs.append(['Загиблий', 'Що', 'У файлі «Не в роботі» (лишено)', 'В «Аркуш 2» (у примітку)'])
for x in report: rs.append(list(x))
for c, w in zip('ABCD', (36, 26, 34, 34)): rs.column_dimensions[c].width = w
rb.save(rep_path)
print(dict(stat), '| rows out', len(rows), '| conflicts', len(report), collections.Counter(x[1].split()[0] for x in report))
