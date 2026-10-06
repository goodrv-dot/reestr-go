// Налаштування підключення до Supabase.
// Ці значення ПУБЛІЧНІ (так задумано): дані захищає база (RLS), а не секретність ключа.
// НІКОЛИ не вписуйте сюди пароль бази чи service_role ключ.
window.APP_CONFIG = {
  SUPABASE_URL: 'https://pbvlnjcutnehjcqimubz.supabase.co',
  SUPABASE_KEY: 'sb_publishable_toshCx7qTQ5KVNatDo69hQ_9Sn8W1pU',
  // «Додати особу» в реєстрі заморожено: загиблих і поранених заводять у Кабінеті, «Діти МП» приходять з анкети.
  // Щоб повернути кнопку — поставте true.
  ADD_PERSON: false,
  IDLE_MINUTES: 30 // автовихід після бездіяльності
};
