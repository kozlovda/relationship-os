from pathlib import Path
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'relationship-os.html'

LOCAL_STORAGE_POLYFILL = r"""() => {
  const data = {};
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: k => Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null,
      setItem: (k, v) => { data[k] = String(v); },
      removeItem: k => { delete data[k]; },
      clear: () => { for (const k in data) delete data[k]; },
      _dump: () => JSON.parse(JSON.stringify(data))
    }
  });
}"""


def main():
    if not HTML.exists():
        raise AssertionError('relationship-os.html has not been built')
    html = HTML.read_text(encoding='utf-8')
    with sync_playwright() as p:
        launch_options = {'headless': True}
        if os.environ.get('RELATIONSHIP_OS_CHROMIUM'):
            launch_options['executable_path'] = os.environ['RELATIONSHIP_OS_CHROMIUM']
        browser = p.chromium.launch(**launch_options)
        page = browser.new_page(viewport={"width": 390, "height": 844})
        requests, errors = [], []
        page.on('request', lambda request: requests.append(request.url))
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('about:blank')
        page.evaluate(LOCAL_STORAGE_POLYFILL)
        page.set_content(html)

        assert page.get_by_role('heading', name='Relationship OS').is_visible()
        page.get_by_label('Имя').fill('Дмитрий')
        page.get_by_label('Основной проход — 12 вопросов').check()
        page.get_by_role('button', name='Начать').click()
        assert page.get_by_text('Начало отношений', exact=True).is_visible()
        assert 'Дмитрий' in page.locator('[data-testid="profile-name"]').inner_text()

        # Simulated reload: re-run the single-file app in the same origin/window.
        page.set_content(html)
        assert page.get_by_text('Начало отношений', exact=True).is_visible()
        assert 'Дмитрий' in page.locator('[data-testid="profile-name"]').inner_text()

        # Reset clears answer state but keeps the local profile identity.
        page.on('dialog', lambda dialog: dialog.accept())
        page.get_by_role('button', name='Начать заново').click()
        assert page.get_by_text('Начало отношений', exact=True).is_visible()

        # Longitudinal flow: same dimensions for all four periods, autosaved.
        page.get_by_label('Эмоциональная близость — 4').check()
        page.get_by_label('Ощущение «мы одна команда» — 3').check()
        page.get_by_label('Период / заметка').fill('Первые месяцы вместе')
        page.get_by_label('Уверенность в воспоминании').select_option('high')
        page.get_by_label('Что тогда работало особенно хорошо?').fill('Много времени вдвоём')
        page.get_by_role('button', name='Дальше').click()
        assert page.get_by_text('Перед беременностью', exact=True).is_visible()

        # Re-render preserves the previous period data.
        page.get_by_role('button', name='Назад').click()
        assert page.get_by_label('Эмоциональная близость — 4').is_checked()
        assert page.get_by_label('Период / заметка').input_value() == 'Первые месяцы вместе'
        page.get_by_role('button', name='Дальше').click()

        # The four periods are navigable in order.
        page.get_by_role('button', name='Дальше').click()
        assert page.get_by_text('Во время беременности', exact=True).is_visible()
        page.get_by_role('button', name='Дальше').click()
        assert page.get_by_text('После рождения Алисы', exact=True).is_visible()

        # Core questionnaire: one reflective question per screen, autosave and category progress.
        page.get_by_role('button', name='К вопросам').click()
        assert page.get_by_text('Q01', exact=True).is_visible()
        assert page.get_by_role('heading', name='Что должно стать лучше').is_visible()
        assert page.locator('.crumb.active').inner_text() == 'Опыт и забота'
        page.get_by_label('Мой ответ').fill('Больше спокойного времени вдвоём')
        page.get_by_role('button', name='Дальше').click()
        assert page.get_by_text('Q02', exact=True).is_visible()
        assert '1 / 12' in page.locator('[data-testid="question-progress"]').inner_text()
        page.get_by_role('button', name='Назад').click()
        assert page.get_by_label('Мой ответ').input_value() == 'Больше спокойного времени вдвоём'

        # Navigate core route to Q12 and verify its dedicated 8-step episode wizard.
        page.get_by_role('button', name='Дальше').click()  # Q02
        for _ in range(6):
            page.get_by_role('button', name='Дальше').click()
        assert page.get_by_text('Q12', exact=True).is_visible()
        assert page.get_by_text('Шаг 1 из 8', exact=True).is_visible()
        page.get_by_label('Дата и тема').fill('Вчера — разговор вечером')
        page.get_by_role('button', name='Дальше').click()
        assert page.get_by_text('Шаг 2 из 8', exact=True).is_visible()

        # Finish the core route, use the optional mirror block, and reach personal results.
        page.get_by_role('button', name='Пропустить весь Q12').click()
        while not page.get_by_text('Q24', exact=True).count():
            page.get_by_role('button', name='Дальше').click()
        page.get_by_label('Один запрос к партнёру').fill('Один вечер без бытовых задач')
        page.get_by_role('button', name='К результату').click()
        assert page.get_by_role('heading', name='Необязательный зеркальный блок').is_visible()
        page.get_by_label('M01 — мой ответ').fill('Думаю, Настя попросит больше времени на разговор')
        page.get_by_role('button', name='Сохранить и показать результат').click()
        assert page.get_by_role('heading', name='Мой результат').is_visible()
        assert page.get_by_role('button', name='Скачать Markdown').is_visible()
        assert page.get_by_role('button', name='Скачать JSON').is_visible()
        assert page.get_by_role('button', name='Скопировать для ChatGPT').is_visible()
        assert page.get_by_label('Импортировать JSON партнёра').is_visible()
        assert page.get_by_text('Эволюция отношений', exact=True).is_visible()

        # Exercise the real download buttons; these are synthetic test answers.
        import json
        with page.expect_download() as exported:
            page.get_by_role('button', name='Скачать JSON', exact=True).click()
        payload = json.loads(Path(exported.value.path()).read_text())
        assert payload['profile']['answers']['Q01'] == 'Больше спокойного времени вдвоём'
        with page.expect_download() as exported:
            page.get_by_role('button', name='Скачать Markdown', exact=True).click()
        assert 'Много времени вдвоём' in Path(exported.value.path()).read_text()

        # Import a second independent result and compare locally without an LLM.
        own_store = page.evaluate("JSON.parse(localStorage.getItem('relationshipOS.v1'))")
        own = own_store['profiles'][own_store['activeProfileId']]
        import copy, json
        partner = copy.deepcopy(own)
        partner['id'] = 'partner-nastya'
        partner['name'] = 'Настя'
        partner['answers']['Q01'] = 'Мне важно больше спокойных разговоров'
        partner['longitudinal']['beginning']['ratings']['emotionalCloseness'] = 2
        partner_payload = json.dumps({'app':'relationship-os','schemaVersion':1,'profile':partner}, ensure_ascii=False).encode('utf-8')
        page.get_by_label('Импортировать JSON партнёра').set_input_files({
            'name': 'nastya-relationship-os.json',
            'mimeType': 'application/json',
            'buffer': partner_payload,
        })
        page.get_by_role('heading', name='Дмитрий × Настя').wait_for(state='visible')
        assert page.get_by_role('heading', name='Дмитрий × Настя').is_visible()
        assert page.get_by_text('Без оценки совместимости', exact=True).is_visible()
        assert page.get_by_role('button', name='Скопировать оба результата для ChatGPT').is_visible()
        assert page.get_by_text('Мне важно больше спокойных разговоров', exact=True).is_visible()
        with page.expect_download() as exported:
            page.get_by_role('button', name='Скачать объединённый Markdown', exact=True).click()
        combined = Path(exported.value.path()).read_text()
        assert 'Много времени вдвоём' in combined
        assert 'Думаю, Настя попросит больше времени на разговор' in combined
        assert 'Мне важно больше спокойных разговоров' in combined

        # Starting over also removes the locally imported partner comparison for that profile.
        page.get_by_role('button', name='Начать заново').click()
        reset_store = page.evaluate("JSON.parse(localStorage.getItem('relationshipOS.v1'))")
        assert reset_store['importedPartners'] == {}

        # A separate full-route profile exposes Q04 matrix and voluntary Q19.
        page.evaluate('localStorage.clear()')
        page.set_content(html)
        page.get_by_label('Имя').fill('Настя')
        page.get_by_label('Полный проход — 24 вопроса').check()
        page.get_by_role('button', name='Начать').click()
        for _ in range(3): page.get_by_role('button', name='Дальше').click()
        page.get_by_role('button', name='К вопросам').click()
        for _ in range(3): page.get_by_role('button', name='Дальше').click()
        assert page.get_by_text('Q04', exact=True).is_visible()
        page.get_by_label('Чувствовать, что мой внутренний опыт понимают — важность сейчас').select_option('4')
        page.get_by_label('Чувствовать, что мой внутренний опыт понимают — достаточность сейчас').select_option('2')
        assert page.get_by_label('Чувствовать, что мой внутренний опыт понимают — важность сейчас').input_value() == '4'

        # Jump through remaining questions; Q12 may be skipped as a whole.
        while not page.get_by_text('Q19', exact=True).count():
            if page.get_by_role('button', name='Пропустить весь Q12').count():
                page.get_by_role('button', name='Пропустить весь Q12').click()
            else:
                page.get_by_role('button', name='Дальше').click()
        assert page.get_by_text('Можно пропустить', exact=True).is_visible()

        # Multiple local profiles can coexist on the same device and be switched explicitly.
        page.get_by_role('button', name='Профили').click()
        assert page.get_by_role('heading', name='Профили на этом устройстве').is_visible()
        assert page.get_by_text('Настя', exact=True).is_visible()
        page.get_by_role('button', name='Новый профиль').click()
        page.get_by_label('Имя').fill('Второй профиль')
        page.get_by_label('Основной проход — 12 вопросов').check()
        page.get_by_role('button', name='Начать').click()
        page.get_by_role('button', name='Профили').click()
        assert page.get_by_text('Настя', exact=True).is_visible()
        assert page.get_by_text('Второй профиль', exact=True).is_visible()

        assert requests == [], f'Unexpected network requests: {requests}'
        assert errors == [], f'Browser errors: {errors}'
        browser.close()

if __name__ == '__main__':
    main()
    print('UI smoke: PASS')
