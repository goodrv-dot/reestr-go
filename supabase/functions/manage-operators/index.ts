// Edge Function: керування співробітниками (лише для адміністратора).
// Секретний ключ service_role використовується тільки тут, на сервері Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGIN = 'https://goodrv-dot.github.io';
const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Тимчасовий пароль без схожих символів (0/O, 1/l/I)
function tempPassword(len = 12) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => abc[n % abc.length]).join('');
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ROLES = ['admin', 'operator'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Метод не підтримується' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Хто викликає?
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Потрібно увійти' }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: me } = await admin.from('operators').select('role, active').eq('user_id', user.id).maybeSingle();
    if (!me || !me.active || me.role !== 'admin') return json({ error: 'Лише для адміністратора' }, 403);

    const body = await req.json();
    const action = body.action;

    if (action === 'create') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const full_name = String(body.full_name ?? '').trim();
      const role = ROLES.includes(body.role) ? body.role : 'operator';
      const can_export = body.can_export === true;
      if (!EMAIL_RE.test(email)) return json({ error: 'Невірна електронна пошта' }, 400);
      if (full_name.length < 3) return json({ error: 'Вкажіть ПІБ' }, 400);

      const password = tempPassword();
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) {
        const exists = /already|registered|exists/i.test(error.message);
        return json({ error: exists ? 'Користувач з такою поштою вже існує' : 'Не вдалося створити обліковий запис' }, exists ? 409 : 500);
      }
      const ins = await admin.from('operators').insert({
        user_id: data.user.id, full_name, role, can_export, email, must_change_password: true,
      });
      if (ins.error) {
        await admin.auth.admin.deleteUser(data.user.id);
        return json({ error: 'Не вдалося додати співробітника' }, 500);
      }
      return json({ ok: true, password });
    }

    const userId = String(body.user_id ?? '');
    if (!userId) return json({ error: 'Не вказано співробітника' }, 400);
    const self = userId === user.id;

    if (action === 'update') {
      const patch: Record<string, unknown> = {};
      if (body.role !== undefined) {
        if (!ROLES.includes(body.role)) return json({ error: 'Невідома роль' }, 400);
        if (self && body.role !== 'admin') return json({ error: 'Не можна зняти роль адміністратора з себе' }, 400);
        patch.role = body.role;
      }
      if (body.can_export !== undefined) patch.can_export = body.can_export === true;
      if (body.full_name !== undefined) patch.full_name = String(body.full_name).trim();
      const { error } = await admin.from('operators').update(patch).eq('user_id', userId);
      if (error) return json({ error: 'Не вдалося зберегти' }, 500);
      return json({ ok: true });
    }

    if (action === 'reset_password') {
      const password = tempPassword();
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: 'Не вдалося змінити пароль' }, 500);
      await admin.from('operators').update({ must_change_password: true }).eq('user_id', userId);
      return json({ ok: true, password });
    }

    if (action === 'deactivate' || action === 'activate') {
      if (self) return json({ error: 'Не можна деактивувати себе' }, 400);
      const active = action === 'activate';
      const { error } = await admin.from('operators').update({ active }).eq('user_id', userId);
      if (error) return json({ error: 'Не вдалося змінити стан' }, 500);
      await admin.auth.admin.updateUserById(userId, { ban_duration: active ? 'none' : '876000h' });
      return json({ ok: true });
    }

    return json({ error: 'Невідома дія' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: 'Помилка сервера' }, 500);
  }
});
