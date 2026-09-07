# Relationship OS

Однофайловый, local-first интерактивный опросник для двух независимых перспектив в отношениях.

## Что внутри

- 4 временных среза эволюции отношений;
- основной маршрут из 12 вопросов и полный из 24;
- autosave в `localStorage` после каждого изменения;
- несколько локальных профилей на одном устройстве;
- `Начать заново` с очисткой текущих ответов и импортированного сравнения;
- экспорт Markdown и JSON;
- локальный импорт JSON партнёра;
- детерминированное сравнение структурированных данных без «оценки совместимости»;
- free-text ответы показываются рядом и могут быть скопированы вместе для последующего смыслового анализа в ChatGPT.

Сайт: https://kozlovda.github.io/relationship-os/

## Privacy model

Приложение не содержит backend, analytics, remote fonts, external JS/CSS или сетевых запросов. Все ответы находятся только в `localStorage` конкретного браузера, пока пользователь сам не экспортирует их в файл/clipboard.

GitHub Pages публикует **только код анкеты**. Ответы в GitHub не записываются.

## Файлы

- `relationship-os.html` — готовый автономный файл.
- `index.html` — те же байты под GitHub Pages.
- `src/` — исходники разработки.
- `scripts/build.mjs` — сборка single-file версии.
- `tests/core.test.js` — pure JS tests.
- `tests/ui_smoke.py` — smoke flow через Playwright/Chromium.

## Сборка

```bash
node scripts/build.mjs
```

## Проверка

Node.js и Python 3. Для UI-проверок установите тестовые зависимости в отдельное окружение:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-test.txt
python -m playwright install chromium
```

Затем:

```bash
node --test tests/core.test.js
python tests/ui_smoke.py
python tests/static_audit.py
```

## GitHub Pages

Предлагаемое имя репозитория: `relationship-os`.

После создания репозитория у `kozlovda`:

1. положить `index.html` в корень default branch;
2. GitHub → **Settings → Pages**;
3. Source: **Deploy from a branch**;
4. выбрать default branch и `/ (root)`;
5. итоговый адрес ожидаемо будет `https://kozlovda.github.io/relationship-os/`.

Публиковать исходники необязательно: для самого Pages достаточно `index.html`, хотя хранить README и исходники удобно для будущих обновлений.

## Ограничения и данные

См. [PRIVACY.md](PRIVACY.md). Импорт добавляет результат партнёра для сравнения; восстановление своего редактируемого профиля из JSON пока не поддерживается. Профили в одном браузере не защищены друг от друга.

## Изменения 7 сентября 2026

- Объединённый экспорт сохраняет исторические заметки, уверенность памяти и зеркальные ответы обоих участников.
- Некорректные числовые поля импорта отклоняются до отображения.
- UI-тест использует установленный Playwright Chromium; альтернативный путь задаётся через RELATIONSHIP_OS_CHROMIUM.
