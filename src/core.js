(function (root, factory) {
  const Data = typeof module === 'object' && module.exports ? require('./data.js') : root.RelationshipOSData;
  const value = factory(Data);
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.RelationshipOSCore = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Data) {
  const APP_ID = 'relationship-os';

  function isoNow() { return new Date().toISOString(); }
  function makeId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function createLongitudinal() {
    const result = {};
    for (const period of Data.periods) {
      const ratings = {};
      for (const dim of Data.periodDimensions) ratings[dim.id] = null;
      result[period.id] = {
        eraNote: '',
        ratings,
        confidence: '',
        notes: { whatWorked: '', tension: '', changed: '' }
      };
    }
    return result;
  }

  function createProfile(name, route = 'core', options = {}) {
    const now = options.now || isoNow();
    return {
      app: APP_ID,
      schemaVersion: Data.schemaVersion,
      id: options.id || makeId(),
      name: String(name || '').trim() || 'Без имени',
      route: route === 'full' ? 'full' : 'core',
      createdAt: options.createdAt || now,
      updatedAt: now,
      location: { stage: 'welcome', periodIndex: 0, questionIndex: 0, episodeStep: 0 },
      longitudinal: createLongitudinal(),
      answers: {},
      mirrorAnswers: {},
      mirrorCompleted: false
    };
  }

  function isMeaningful(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number' || typeof value === 'boolean') return true;
    if (Array.isArray(value)) return value.some(isMeaningful);
    if (typeof value === 'object') return Object.values(value).some(isMeaningful);
    return false;
  }

  function routeQuestionIds(profile) {
    return profile.route === 'full' ? Data.fullQuestionIds : Data.coreQuestionIds;
  }

  function computeProgress(profile) {
    const ids = routeQuestionIds(profile);
    const questionAnswered = ids.reduce((n, id) => n + (isMeaningful(profile.answers && profile.answers[id]) ? 1 : 0), 0);
    const longitudinalTotal = Data.periods.length * Data.periodDimensions.length;
    let longitudinalAnswered = 0;
    for (const period of Data.periods) {
      const state = profile.longitudinal && profile.longitudinal[period.id];
      for (const dim of Data.periodDimensions) {
        if (state && Number.isInteger(state.ratings && state.ratings[dim.id])) longitudinalAnswered++;
      }
    }
    return {
      questionAnswered,
      questionTotal: ids.length,
      longitudinalAnswered,
      longitudinalTotal,
      overallAnswered: questionAnswered + longitudinalAnswered,
      overallTotal: ids.length + longitudinalTotal,
      percent: Math.round(((questionAnswered + longitudinalAnswered) / (ids.length + longitudinalTotal)) * 100)
    };
  }

  function serializeProfile(profile) {
    return JSON.stringify({
      app: APP_ID,
      schemaVersion: Data.schemaVersion,
      exportedAt: isoNow(),
      profile
    }, null, 2);
  }

  function validateProfile(profile) {
    if (!profile || typeof profile !== 'object') throw new Error('Это не результат Relationship OS.');
    if (profile.app !== APP_ID || profile.schemaVersion !== Data.schemaVersion) throw new Error('Несовместимый файл Relationship OS.');
    if (!profile.id || !profile.name || !['core', 'full'].includes(profile.route)) throw new Error('В файле Relationship OS отсутствуют обязательные поля.');
    if (!profile.longitudinal || !profile.answers || typeof profile.answers !== 'object') throw new Error('В файле Relationship OS отсутствуют ответы.');
    for (const period of Data.periods) {
      if (!profile.longitudinal[period.id] || !profile.longitudinal[period.id].ratings) throw new Error(`В файле Relationship OS отсутствует период ${period.label}.`);
      for (const dim of Data.periodDimensions) validateRating(profile.longitudinal[period.id].ratings[dim.id]);
    }
    const needs = profile.answers.Q04 && profile.answers.Q04.needs;
    if (needs) {
      for (const need of Data.needs) {
        const cell = needs[need.id];
        if (!cell) continue;
        for (const field of ['importanceNow', 'sufficiencyNow', 'sufficiencyBefore']) validateRating(cell[field]);
      }
    }
    return profile;
  }

  function validateRating(value) {
    if (value === null || value === undefined) return;
    if (!Number.isInteger(value) || value < 0 || value > 4) throw new Error('Relationship OS: оценка должна быть целым числом от 0 до 4 или пропуском.');
  }

  function parseImport(jsonText) {
    let parsed;
    try { parsed = JSON.parse(jsonText); }
    catch (e) { throw new Error('Не удалось прочитать JSON-файл.'); }
    const profile = parsed && parsed.profile ? parsed.profile : parsed;
    return validateProfile(profile);
  }

  function resetProfileData(profile, options = {}) {
    const reset = createProfile(profile.name, profile.route, {
      id: profile.id,
      createdAt: profile.createdAt,
      now: options.now || isoNow()
    });
    return reset;
  }

  function formatScalar(value) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
    return String(value);
  }

  function flattenObject(value, prefix = '') {
    const lines = [];
    if (!value || typeof value !== 'object') return [formatScalar(value)];
    for (const [key, val] of Object.entries(value)) {
      const label = prefix ? `${prefix}.${key}` : key;
      if (val && typeof val === 'object' && !Array.isArray(val)) lines.push(...flattenObject(val, label));
      else if (isMeaningful(val)) lines.push(`${label}: ${formatScalar(val)}`);
    }
    return lines.length ? lines : ['—'];
  }

  function formatAnswerMarkdown(question, answer) {
    if (!isMeaningful(answer)) return '_Не отвечено._';
    if (typeof answer === 'string') return answer.trim();
    if (question && question.type === 'needsMatrix' && answer.needs) {
      const lines = [];
      for (const need of Data.needs) {
        const row = answer.needs[need.id] || {};
        if (!isMeaningful(row)) continue;
        lines.push(`- **${need.label}:** важность сейчас ${formatScalar(row.importanceNow)}; достаточность сейчас ${formatScalar(row.sufficiencyNow)}; раньше ${formatScalar(row.sufficiencyBefore)}`);
      }
      if (answer.memoryConfidence) lines.push(`- Уверенность в воспоминании: ${answer.memoryConfidence}`);
      if (answer.priorityNote) lines.push(`- Важнее обсудить: ${answer.priorityNote}`);
      return lines.join('\n') || '_Не отвечено._';
    }
    if (question && typeof answer === 'object') {
      const labelsByType = {
        resource: {
          circumstances: 'Обстоятельства, влияющие на ресурс',
          energy: 'Силы на общение (0–4)',
          temporary: 'Что временно сейчас, а что встречалось раньше'
        },
        support: {
          outsideFirst: 'В первые минуты, если причина вне отношений',
          outsideLater: 'Позже, если причина вне отношений',
          outsideAvoid: 'Чего лучше не делать, если причина вне отношений',
          insideFirst: 'В первые минуты, если причина между нами',
          insideLater: 'Позже, если причина между нами',
          insideAvoid: 'Чего лучше не делать, если причина между нами',
          signalPhrase: 'Короткая фраза для запроса поддержки'
        },
        pause: {
          mine: 'Когда пауза нужна мне',
          partner: 'Когда пауза нужна партнёру',
          shared: 'Общие условия паузы и срочные обязанности'
        },
        doneStates: {
          pauseToday: 'Разговор можно отложить на сегодня',
          contactRestored: 'Контакт между нами восстановлен',
          problemResolved: 'Проблема решена или есть достаточная договорённость',
          repairNeeds: 'Что помогает после обиды и что не заменяется словами'
        },
        experiment: {
          request: 'Один запрос к партнёру',
          selfStep: 'Один добровольный шаг с моей стороны'
        }
      };
      let labels = labelsByType[question.type] || null;
      if (question.type === 'episode') labels = Object.fromEntries(Data.episodeFields.map(f => [f.id, f.label]));
      if (labels) {
        const lines = [];
        for (const [key, label] of Object.entries(labels)) {
          if (isMeaningful(answer[key])) lines.push(`- ${label}: ${formatScalar(answer[key])}`);
        }
        return lines.join('\n') || '_Не отвечено._';
      }
    }
    return flattenObject(answer).map(x => `- ${x}`).join('\n');
  }

  function buildMarkdown(profile) {
    validateProfile(profile);
    const out = [];
    out.push(`# Relationship OS — ${profile.name}`);
    out.push('');
    out.push(`- Маршрут: ${profile.route === 'full' ? 'Полный (24)' : 'Основной (12)'}`);
    out.push(`- Обновлено: ${profile.updatedAt}`);
    out.push('');
    out.push('## Эволюция отношений');
    for (const period of Data.periods) {
      const state = profile.longitudinal[period.id];
      out.push('');
      out.push(`### ${period.label}`);
      if (state.eraNote) out.push(`Период / заметка: ${state.eraNote}`);
      out.push('');
      for (const dim of Data.periodDimensions) {
        const v = state.ratings[dim.id];
        out.push(`- ${dim.label} | ${Number.isInteger(v) ? `${v}/4` : '—'}`);
      }
      if (state.confidence) out.push(`- Уверенность в воспоминании: ${state.confidence}`);
      if (state.notes.whatWorked) out.push(`- Что работало: ${state.notes.whatWorked}`);
      if (state.notes.tension) out.push(`- Что создавало напряжение: ${state.notes.tension}`);
      if (state.notes.changed) out.push(`- Что изменилось / почему мне так кажется: ${state.notes.changed}`);
    }
    out.push('');
    out.push('## Relationship OS сейчас');
    const ids = routeQuestionIds(profile);
    for (const id of ids) {
      const q = Data.questions.find(x => x.id === id);
      out.push('');
      out.push(`### ${q.id}. ${q.title}`);
      out.push(formatAnswerMarkdown(q, profile.answers[id]));
    }
    if (isMeaningful(profile.mirrorAnswers)) {
      out.push('');
      out.push('## Необязательный зеркальный блок');
      for (const mq of Data.mirrorQuestions) {
        if (!isMeaningful(profile.mirrorAnswers[mq.id])) continue;
        out.push(`### ${mq.id}. ${mq.title}`);
        out.push(formatAnswerMarkdown(null, profile.mirrorAnswers[mq.id]));
      }
    }
    out.push('');
    out.push('---');
    out.push('Ответы являются личным описанием опыта, а не диагнозом или объективным протоколом отношений.');
    return out.join('\n');
  }

  function getNeedCell(profile, needId) {
    const q04 = profile.answers && profile.answers.Q04;
    const cell = q04 && q04.needs && q04.needs[needId];
    return cell ? {
      importanceNow: cell.importanceNow ?? null,
      sufficiencyNow: cell.sufficiencyNow ?? null,
      sufficiencyBefore: cell.sufficiencyBefore ?? null
    } : { importanceNow: null, sufficiencyNow: null, sufficiencyBefore: null };
  }

  function comparableDelta(a, b) {
    return Number.isInteger(a) && Number.isInteger(b) ? a - b : null;
  }

  function compareProfiles(a, b) {
    validateProfile(a); validateProfile(b);
    const longitudinal = [];
    for (const period of Data.periods) {
      for (const dim of Data.periodDimensions) {
        const av = a.longitudinal[period.id].ratings[dim.id];
        const bv = b.longitudinal[period.id].ratings[dim.id];
        longitudinal.push({
          periodId: period.id, periodLabel: period.label,
          dimensionId: dim.id, dimensionLabel: dim.label,
          a: Number.isInteger(av) ? av : null,
          b: Number.isInteger(bv) ? bv : null,
          delta: comparableDelta(av, bv)
        });
      }
    }
    const needs = Data.needs.map(need => ({
      needId: need.id,
      label: need.label,
      a: getNeedCell(a, need.id),
      b: getNeedCell(b, need.id)
    }));
    const freeText = Data.questions.map(q => ({
      questionId: q.id,
      title: q.title,
      a: formatAnswerMarkdown(q, a.answers[q.id]),
      b: formatAnswerMarkdown(q, b.answers[q.id])
    }));
    return {
      schemaVersion: 1,
      a: { id: a.id, name: a.name, route: a.route },
      b: { id: b.id, name: b.name, route: b.route },
      longitudinal,
      needs,
      freeText,
      note: 'Свободный текст показан рядом без семантической оценки. Числовые различия не являются оценкой совместимости.'
    };
  }

  function buildCombinedMarkdown(a, b) {
    const cmp = compareProfiles(a, b);
    const out = [`# Relationship OS — ${a.name} × ${b.name}`, '', '> Два независимых результата для совместного анализа. Не считать различия автоматически проблемой.', '', '## Структурированное сравнение эволюции'];
    for (const period of Data.periods) {
      out.push('', `### ${period.label}`, '', `| Измерение | ${a.name} | ${b.name} |`, '|---|---:|---:|');
      for (const row of cmp.longitudinal.filter(x => x.periodId === period.id)) out.push(`| ${row.dimensionLabel} | ${row.a ?? '—'} | ${row.b ?? '—'} |`);
    }
    out.push('', '## Ответы по одинаковым вопросам');
    for (const row of cmp.freeText) {
      out.push('', `### ${row.questionId}. ${row.title}`, '', `**${a.name}:**`, row.a, '', `**${b.name}:**`, row.b);
    }
    out.push('', '## Полные индивидуальные результаты', '', '> Ниже сохранены исторические заметки, уверенность памяти и зеркальные ответы каждого участника.', '', buildMarkdown(a), '', buildMarkdown(b));
    out.push('', '## Инструкция для ChatGPT', 'Сопоставь две перспективы симметрично. Отделяй факты, самоописание, интерпретации и неизвестное. Не вычисляй «совместимость» и не назначай виноватого. Ищи совпадения, расхождения, возможные ошибки перевода и 1–2 небольших взаимно согласуемых эксперимента.');
    return out.join('\n');
  }

  return {
    APP_ID,
    createProfile,
    computeProgress,
    serializeProfile,
    parseImport,
    validateProfile,
    resetProfileData,
    buildMarkdown,
    compareProfiles,
    buildCombinedMarkdown,
    isMeaningful,
    routeQuestionIds,
    formatAnswerMarkdown
  };
});
