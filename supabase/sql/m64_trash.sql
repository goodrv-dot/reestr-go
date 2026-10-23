-- Реєстр ГО · m64 · Кошик для видалених осіб і справ (5 днів). Виконати один раз у Supabase → SQL Editor → Run.
-- Кошик: видалена особа (з її справами, родичами-зв'язками, дітьми, списками) зберігається 5 днів
create table if not exists public.deleted_items (
  id bigserial primary key,
  person_id uuid not null,
  label text not null,
  journal_ids text,
  snapshot jsonb not null,
  deleted_by uuid,
  deleted_at timestamptz not null default now()
);
alter table public.deleted_items enable row level security;
create policy deleted_items_admin_read on public.deleted_items for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.deleted_items from anon, authenticated;
create index if not exists deleted_items_at on public.deleted_items(deleted_at);

create or replace function public.persons_to_trash() returns trigger
language plpgsql security definer set search_path = public as $$
declare cids uuid[];
begin
  select coalesce(array_agg(id), '{}') into cids from cases where person_id = old.id;
  insert into deleted_items(person_id, label, journal_ids, snapshot, deleted_by)
  values (old.id,
    concat_ws(' ', old.last_name, old.first_name, old.patronymic),
    (select string_agg(journal_id, ', ' order by journal_id) from cases where person_id = old.id),
    jsonb_build_object(
      'person', to_jsonb(old),
      'statuses', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from person_veteran_statuses x where person_id = old.id),
      'programs', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from person_programs x where person_id = old.id),
      'children', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from children x where person_id = old.id),
      'relations', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from military_relations x where person_id = old.id),
      'related_in', (select coalesce(jsonb_agg(id), '[]') from military_relations where related_person_id = old.id),
      'contact_in', (select coalesce(jsonb_agg(id), '[]') from cases where contact_person_id = old.id and person_id <> old.id),
      'lists', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from person_list_members x where person_id = old.id),
      'cases', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from cases x where id = any(cids)),
      'values', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from case_values x where case_id = any(cids)),
      'history', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from case_history x where case_id = any(cids)),
      'transfers', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from case_transfers x where case_id = any(cids)),
      'marks', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from case_marks x where case_id = any(cids))
    ),
    auth.uid());
  return old;
end $$;
revoke execute on function public.persons_to_trash() from public, anon, authenticated;
create trigger persons_trash before delete on public.persons for each row execute function public.persons_to_trash();

create or replace function public.restore_deleted(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare s jsonb; pid uuid; cids uuid[]; lbl text;
begin
  if not is_admin() then raise exception 'Відновлювати з кошика може лише адміністратор'; end if;
  select snapshot, person_id, label into s, pid, lbl from deleted_items where id = p_id;
  if s is null then raise exception 'У кошику цього вже немає (минуло 5 днів або вже відновлено)'; end if;
  if exists (select 1 from persons where id = pid) then raise exception 'Ця особа вже є в реєстрі'; end if;

  insert into persons select * from jsonb_populate_record(null::persons, s->'person');
  insert into person_veteran_statuses select * from jsonb_populate_recordset(null::person_veteran_statuses, s->'statuses');
  insert into person_programs select * from jsonb_populate_recordset(null::person_programs, s->'programs');
  insert into children select * from jsonb_populate_recordset(null::children, s->'children');
  insert into military_relations select r.* from jsonb_populate_recordset(null::military_relations, s->'relations') r
    where r.related_person_id is null or exists (select 1 from persons where id = r.related_person_id);
  update military_relations set related_person_id = pid
    where id in (select (jsonb_array_elements_text(s->'related_in'))::uuid) and related_person_id is null;

  insert into cases select c.* from jsonb_populate_recordset(null::cases, s->'cases') c;
  select coalesce(array_agg(id), '{}') into cids from jsonb_populate_recordset(null::cases, s->'cases');
  -- тригер вставки міг поставити «передано зараз» — повертаємо як було (без нового сповіщення)
  update cases c set transferred_at = o.transferred_at, transferred_by = o.transferred_by
    from jsonb_populate_recordset(null::cases, s->'cases') o where c.id = o.id;
  update cases set contact_person_id = pid
    where id in (select (jsonb_array_elements_text(s->'contact_in'))::uuid) and contact_person_id is null;
  insert into case_values select * from jsonb_populate_recordset(null::case_values, s->'values');
  delete from case_history where case_id = any(cids);   -- записи, які щойно створив тригер значень
  insert into case_history select * from jsonb_populate_recordset(null::case_history, s->'history');
  insert into case_history(case_id, field, old_value, new_value, source, changed_by)
    select unnest(cids), 'Відновлено', null, 'з кошика', 'кошик', auth.uid();
  insert into case_transfers select * from jsonb_populate_recordset(null::case_transfers, s->'transfers');
  insert into case_marks select m.* from jsonb_populate_recordset(null::case_marks, s->'marks') m
    where exists (select 1 from auth.users u where u.id = m.user_id);
  insert into person_list_members select m.* from jsonb_populate_recordset(null::person_list_members, s->'lists') m
    where exists (select 1 from person_lists l where l.id = m.list_id);

  delete from deleted_items where id = p_id;
  return lbl;
end $$;
revoke execute on function public.restore_deleted(bigint) from public, anon;
grant execute on function public.restore_deleted(bigint) to authenticated;

-- щоночі прибираємо з кошика старше 5 днів

select cron.schedule('trash-purge', '45 0 * * *', $$delete from public.deleted_items where deleted_at < now() - interval '5 days'$$);

-- нова справа не бере номер справи, що лежить у кошику
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.create_case'::regproc);
  if position('from cases where module = p_module;' in d) = 0 then raise exception 'create_case: шаблон не знайдено'; end if;
  d := replace(d, 'from cases where module = p_module;',
    'from (select journal_id from cases where module = p_module union all select x->>''journal_id'' from deleted_items di, jsonb_array_elements(di.snapshot->''cases'') x where x->>''module'' = p_module::text) j;');
  execute d;
end $do$;


-- самоперевірка на вигаданій особі «ТестКошик»: видалити → кошик → відновити; усе відкочується, у базі нічого не лишається
do $t$
declare msg text := ''; adm uuid; pid uuid := gen_random_uuid(); cid uuid := gen_random_uuid(); tid bigint; r text;
begin
  begin
    select user_id into adm from operators where role = 'admin' and active limit 1;
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'aal', 'aal2')::text, true);
    perform set_config('request.jwt.claim.sub', adm::text, true);
    insert into persons(id, last_name, first_name, military_status) values (pid, 'ТестКошик', 'Тест', 'Загиблий');
    insert into cases(id, module, person_id, journal_id, status) values (cid, '200', pid, '200-9999', 'В роботі');
    insert into case_values(case_id, stage_key, value) values (cid, 'problems', 'тест');
    delete from persons where id = pid;
    select id into tid from deleted_items where person_id = pid;
    msg := format('у кошику: %s, справ: %s; ', tid is not null, (select jsonb_array_length(snapshot->'cases') from deleted_items where id = tid));
    r := restore_deleted(tid);
    msg := msg || format('відновлено: особа %s, справа %s, полів %s, з кошика прибрано: %s',
      (select count(*) from persons where id = pid), (select journal_id from cases where id = cid),
      (select count(*) from case_values where case_id = cid), (select count(*) = 0 from deleted_items where id = tid));
    raise exception 'TEST_DONE';
  exception when others then
    if sqlerrm <> 'TEST_DONE' then msg := msg || ' ПОМИЛКА: ' || sqlerrm; end if;
  end;
  perform set_config('trash.test', msg, false);
end $t$;
select current_setting('trash.test', true) as "Перевірка кошика",
  (select count(*) from cron.job where jobname = 'trash-purge') as "Нічне очищення",
  (select count(*) from persons where last_name = 'ТестКошик') as "Тестових залишків (має бути 0)";
