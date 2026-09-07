const test = require('node:test');
const assert = require('node:assert/strict');
const Data = require('../src/data.js');
const Core = require('../src/core.js');

test('createProfile builds symmetric empty profile with four periods', () => {
  const p = Core.createProfile('Дмитрий', 'core', { id: 'p1', now: '2026-09-06T12:00:00.000Z' });
  assert.equal(p.schemaVersion, 1);
  assert.equal(p.name, 'Дмитрий');
  assert.equal(p.route, 'core');
  assert.deepEqual(Object.keys(p.longitudinal), Data.periods.map(x => x.id));
  for (const period of Data.periods) {
    assert.equal(Object.keys(p.longitudinal[period.id].ratings).length, Data.periodDimensions.length);
    assert.ok(Object.values(p.longitudinal[period.id].ratings).every(v => v === null));
  }
  assert.deepEqual(p.answers, {});
  assert.deepEqual(p.mirrorAnswers, {});
});

test('computeProgress counts only route questions and answered longitudinal dimensions', () => {
  const p = Core.createProfile('Тест', 'core', { id: 'p1', now: '2026-09-06T12:00:00.000Z' });
  p.longitudinal.beginning.ratings.emotionalCloseness = 4;
  p.answers.Q01 = 'Хочу больше спокойного времени вместе';
  p.answers.Q05 = 'Я приготовил ужин, чтобы снять нагрузку';
  const progress = Core.computeProgress(p);
  assert.equal(progress.questionTotal, 12);
  assert.equal(progress.questionAnswered, 2);
  assert.equal(progress.longitudinalTotal, Data.periods.length * Data.periodDimensions.length);
  assert.equal(progress.longitudinalAnswered, 1);
  assert.equal(progress.overallAnswered, 3);
  assert.equal(progress.overallTotal, 52);
});

test('parseImport accepts valid export and rejects incompatible data', () => {
  const p = Core.createProfile('Настя', 'full', { id: 'n1', now: '2026-09-06T12:00:00.000Z' });
  p.answers.Q01 = 'Больше близости';
  const json = Core.serializeProfile(p);
  const parsed = Core.parseImport(json);
  assert.equal(parsed.name, 'Настя');
  assert.equal(parsed.answers.Q01, 'Больше близости');
  assert.throws(() => Core.parseImport('{"hello":"world"}'), /Relationship OS/);
  assert.throws(() => Core.parseImport('not-json'), /JSON/);
});

test('resetProfileData preserves identity and route but clears answers and ratings', () => {
  const p = Core.createProfile('Дима', 'full', { id: 'p1', now: '2026-09-06T12:00:00.000Z' });
  p.answers.Q01 = 'x';
  p.longitudinal.afterBirth.ratings.teamFeeling = 4;
  const reset = Core.resetProfileData(p, { now: '2026-09-06T13:00:00.000Z' });
  assert.equal(reset.id, 'p1');
  assert.equal(reset.name, 'Дима');
  assert.equal(reset.route, 'full');
  assert.deepEqual(reset.answers, {});
  assert.equal(reset.longitudinal.afterBirth.ratings.teamFeeling, null);
  assert.equal(reset.updatedAt, '2026-09-06T13:00:00.000Z');
});

test('buildMarkdown includes four-period history and questionnaire answers', () => {
  const p = Core.createProfile('Дмитрий', 'core', { id: 'p1', now: '2026-09-06T12:00:00.000Z' });
  p.longitudinal.beginning.ratings.emotionalCloseness = 4;
  p.longitudinal.beginning.notes.whatWorked = 'Много разговаривали';
  p.answers.Q01 = 'Больше времени вдвоём';
  const md = Core.buildMarkdown(p);
  assert.match(md, /# Relationship OS — Дмитрий/);
  assert.match(md, /Начало отношений/);
  assert.match(md, /Эмоциональная близость \| 4\/4/);
  assert.match(md, /Q01/);
  assert.match(md, /Больше времени вдвоём/);
});

test('compareProfiles compares structured data and preserves free text side-by-side without semantic score', () => {
  const a = Core.createProfile('Дима', 'full', { id: 'a', now: '2026-09-06T12:00:00.000Z' });
  const b = Core.createProfile('Настя', 'full', { id: 'b', now: '2026-09-06T12:00:00.000Z' });
  a.longitudinal.beginning.ratings.emotionalCloseness = 4;
  b.longitudinal.beginning.ratings.emotionalCloseness = 3;
  a.answers.Q01 = 'Мне нужно больше совместного времени';
  b.answers.Q01 = 'Мне важно больше разговоров';
  a.answers.Q04 = { needs: { understood: { importanceNow: 3, sufficiencyNow: 2 } } };
  b.answers.Q04 = { needs: { understood: { importanceNow: 4, sufficiencyNow: 1 } } };
  const cmp = Core.compareProfiles(a, b);
  const row = cmp.longitudinal.find(r => r.periodId === 'beginning' && r.dimensionId === 'emotionalCloseness');
  assert.deepEqual({ a: row.a, b: row.b, delta: row.delta }, { a: 4, b: 3, delta: 1 });
  const need = cmp.needs.find(r => r.needId === 'understood');
  assert.equal(need.a.importanceNow, 3);
  assert.equal(need.b.importanceNow, 4);
  const free = cmp.freeText.find(r => r.questionId === 'Q01');
  assert.equal(free.a, 'Мне нужно больше совместного времени');
  assert.equal(free.b, 'Мне важно больше разговоров');
  assert.equal('compatibilityScore' in cmp, false);
  assert.equal('semanticScore' in cmp, false);
});

test('buildCombinedMarkdown contains both independent voices and no compatibility scoring', () => {
  const a = Core.createProfile('Дмитрий', 'core', { id: 'a', now: '2026-09-06T12:00:00.000Z' });
  const b = Core.createProfile('Настя', 'core', { id: 'b', now: '2026-09-06T12:00:00.000Z' });
  a.answers.Q01 = 'Больше времени вдвоём';
  b.answers.Q01 = 'Больше спокойных разговоров';
  const md = Core.buildCombinedMarkdown(a, b);
  assert.match(md, /Relationship OS — Дмитрий × Настя/);
  assert.match(md, /Больше времени вдвоём/);
  assert.match(md, /Больше спокойных разговоров/);
  assert.doesNotMatch(md, /совместимост(?:ь|и)\s*[:=]\s*\d/i);
  assert.match(md, /не вычисляй «совместимость»/i);
});

test('structured questionnaire answers export with human-readable labels', () => {
  const p = Core.createProfile('Дмитрий', 'core', { id: 'a', now: '2026-09-06T12:00:00.000Z' });
  p.answers.Q10 = {
    outsideFirst: 'Сначала обнять',
    insideFirst: 'Сначала услышать друг друга',
    signalPhrase: 'Мне сейчас нужен контакт'
  };
  p.answers.Q12 = { dateTopic: '5 сентября — разговор', observable: 'Мы повысили голос' };
  const md = Core.buildMarkdown(p);
  assert.match(md, /В первые минуты, если причина вне отношений: Сначала обнять/);
  assert.match(md, /Короткая фраза для запроса поддержки: Мне сейчас нужен контакт/);
  assert.match(md, /Дата и тема: 5 сентября — разговор/);
  assert.doesNotMatch(md, /outsideFirst:/);
});

test('combined export preserves historical context and mirror answers from both voices', () => {
  const a = Core.createProfile('Test A');
  const b = Core.createProfile('Test B');
  a.longitudinal.beginning.eraNote = 'A era marker';
  a.longitudinal.beginning.confidence = 'low';
  a.longitudinal.beginning.notes.whatWorked = 'A historical marker';
  b.longitudinal.afterBirth.notes.changed = 'B change marker';
  a.mirrorAnswers.M01 = 'A mirror marker';
  b.mirrorAnswers.M02 = 'B mirror marker';
  const md = Core.buildCombinedMarkdown(a, b);
  for (const marker of ['A era marker', 'low', 'A historical marker', 'B change marker', 'A mirror marker', 'B mirror marker']) assert.ok(md.includes(marker), `Missing ${marker}`);
});

test('import rejects malformed numeric cells before comparison renders them', () => {
  for (const invalid of ['<img src=x onerror=alert(1)>', -1, 5, 1.5, {}, true]) {
    const p = Core.createProfile('Synthetic test', 'full');
    p.answers.Q04 = { needs: { understood: { importanceNow: invalid } } };
    assert.throws(() => Core.parseImport(Core.serializeProfile(p)), /Relationship OS/);
  }
  const p = Core.createProfile('Synthetic test');
  p.longitudinal.beginning.ratings.emotionalCloseness = 99;
  assert.throws(() => Core.parseImport(Core.serializeProfile(p)), /Relationship OS/);
});
