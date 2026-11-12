# kids-auto — автоімпорт анкет «Діти Морської піхоти» (нова форма)

Щоночі о 01:30 UTC (cron `kids-auto-night`) робот читає аркуш відповідей нової форми (колонки «10.11 …»)
і записує нові анкети в реєстр так само, як ручний «Імпорт». Оброблені рядки — у таблиці `kids_form_done`
(ключ: позначка часу + цифри телефону), тому повторний запуск нічого не дублює.
Статус — `robot_state.kids_auto_status`; якщо «помилка…» або робот не запускався 50 год — попередження адміністратору.
Що варто перевірити — список «Анкета «Діти» — автоімпорт: перевірити».

Розбір (`parse.js`) — КОПІЯ функцій з `import.js` (parseKids, parseKidsV2, makeChild, mergeByPhone…).
Змінюєте розбір у import.js — перенесіть сюди.

Деплой (один файл, бо MCP-деплой приймає вміст файлів):
```
cp ../../validation.js ../../options.js .   # тимчасово, поруч із parse.js
esbuild index.ts --bundle --format=esm --platform=neutral --external:npm:* --minify --charset=utf8 --outfile=bundle.js
# вміст bundle.js → deploy_edge_function kids-auto (verify_jwt: false), потім rm validation.js options.js bundle.js
```
У `parse.js` імпорти `./validation.js` і `./options.js` — це копії з кореня репозиторію на момент збірки.
Ручний запуск (адміністратор або x-robot-token): POST, тіло `{"dry":true}` — лише показати, що буде.
