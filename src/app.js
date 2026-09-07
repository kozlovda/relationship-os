(function(){
  'use strict';
  const Data = window.RelationshipOSData;
  const Core = window.RelationshipOSCore;
  const STORE_KEY = 'relationshipOS.v1';
  const app = document.getElementById('app');

  function emptyStore(){ return { activeProfileId:null, profiles:{}, importedPartners:{} }; }
  function loadStore(){
    try {
      const raw=localStorage.getItem(STORE_KEY); if(!raw) return emptyStore();
      const s=JSON.parse(raw); return s && s.profiles ? s : emptyStore();
    } catch { return emptyStore(); }
  }
  let store=loadStore();
  function saveStore(){ localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
  function activeProfile(){ return store.activeProfileId ? store.profiles[store.activeProfileId] : null; }
  function saveProfile(profile){ profile.updatedAt=new Date().toISOString(); store.profiles[profile.id]=profile; store.activeProfileId=profile.id; saveStore(); }

  function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function currentSection(profile){
    if(!profile) return '';
    if(profile.location.stage==='evolution') return 'evolution';
    if(profile.location.stage==='questionnaire'){
      const ids=Core.routeQuestionIds(profile);
      const id=ids[Math.max(0,Math.min(ids.length-1,profile.location.questionIndex||0))];
      const q=Data.questions.find(x=>x.id===id);
      return q ? q.section : 'care';
    }
    if(profile.location.stage==='mirror') return 'model';
    if(profile.location.stage==='result' || profile.location.stage==='compare') return 'result';
    return '';
  }

  function shell(content, profile){
    const p=profile;
    const progress=p?Core.computeProgress(p):null;
    const width=progress?progress.percent:0;
    const active=currentSection(p);
    const crumbs=[['evolution','Эволюция'],['care','Опыт и забота'],['repair','Конфликт'],['life','Жизнь'],['model','Проверка'],['result','Результат']];
    return `<div class="app-shell">
      ${p?`<header class="topbar">
        <div class="topbar-row"><div><div class="brand">Relationship OS</div><div class="profile-chip" data-testid="profile-name">${escapeHtml(p.name)} · ${p.route==='full'?'полный':'основной'} проход</div></div><div class="top-actions"><button class="reset-btn" id="profilesBtn" aria-label="Профили">Профили</button><button class="reset-btn" id="resetBtn" aria-label="Начать заново">Начать заново</button></div></div>
        <div class="progress-track" aria-label="Общий прогресс"><div class="progress-fill" style="width:${width}%"></div></div>
        <div class="progress-caption"><span data-testid="progress-label">${progress.overallAnswered} / ${progress.overallTotal} · ${progress.percent}% общего заполнения</span><span class="saved-state">✓ локально</span></div>
        <div class="crumbs" aria-label="Разделы">${crumbs.map(([id,label])=>`<span class="crumb ${active===id?'active':''}">${label}</span>`).join('')}</div>
      </header>`:''}
      ${content}
    </div>`;
  }

  function renderWelcome(){
    app.innerHTML=shell(`<main class="welcome"><section class="hero-card">
      <div class="eyebrow">Два самостоятельных голоса · одна общая карта</div>
      <h1>Relationship OS</h1>
      <p>Личный интерактивный опросник о том, как менялись отношения, как каждый из вас даёт и получает заботу и что помогает системе работать лучше. Ответы сохраняются только в этом браузере.</p>
      <form id="startForm">
        <div class="field"><label for="name">Имя</label><input id="name" name="name" type="text" autocomplete="name" placeholder="Например, Дмитрий" required></div>
        <fieldset class="field" style="border:0;padding:0"><legend class="legend">Маршрут</legend><div class="route-grid">
          <label class="route-option"><input type="radio" name="route" value="core" checked aria-label="Основной проход — 12 вопросов"><span><strong>Основной · 12</strong><small>Самые информативные вопросы для первого прохода.</small></span></label>
          <label class="route-option"><input type="radio" name="route" value="full" aria-label="Полный проход — 24 вопроса"><span><strong>Полный · 24</strong><small>Более глубокая карта потребностей, нагрузки и repair.</small></span></label>
        </div></fieldset>
        <button class="primary" type="submit">Начать</button>
      </form>
      ${Object.keys(store.profiles).length?`<button class="ghost" id="existingProfiles" style="width:100%;margin-top:10px">Сохранённые профили · ${Object.keys(store.profiles).length}</button>`:''}
      <div class="footer-note">Без аккаунта · без сервера · без отправки ответов</div>
    </section></main>`);
    document.getElementById('startForm').addEventListener('submit',e=>{
      e.preventDefault(); const fd=new FormData(e.currentTarget);
      const profile=Core.createProfile(fd.get('name'),fd.get('route'));
      profile.location.stage='evolution'; profile.location.periodIndex=0;
      saveProfile(profile); render();
    });
    const existing=document.getElementById('existingProfiles'); if(existing) existing.addEventListener('click',()=>renderProfileManager());
  }

  function renderProfileManager(){
    const profiles=Object.values(store.profiles).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    const cards=profiles.map(p=>{const pr=Core.computeProgress(p);return `<div class="profile-row"><div><strong>${escapeHtml(p.name)}</strong><span>${p.route==='full'?'Полный':'Основной'} маршрут · ${pr.questionAnswered}/${pr.questionTotal} вопросов · ${pr.percent}% общего заполнения</span></div><button class="secondary" data-open-profile="${escapeHtml(p.id)}">Открыть</button></div>`;}).join('');
    app.innerHTML=`<div class="app-shell"><main class="welcome"><section class="hero-card"><div class="eyebrow">Локально на этом устройстве</div><h1 style="font-size:42px">Профили на этом устройстве</h1><p>Каждый профиль хранится отдельно в браузере. Это удобно, если вы проходите опросник на одном iPad или Mac.</p><div class="profile-list">${cards||'<p class="hint">Сохранённых профилей пока нет.</p>'}</div><button class="primary" id="newProfile">Новый профиль</button>${store.activeProfileId?'<button class="ghost" id="profilesBack" style="width:100%;margin-top:10px">Назад</button>':''}</section></main></div>`;
    document.querySelectorAll('[data-open-profile]').forEach(btn=>btn.addEventListener('click',()=>{store.activeProfileId=btn.dataset.openProfile;saveStore();render();}));
    document.getElementById('newProfile').addEventListener('click',()=>{store.activeProfileId=null;saveStore();renderWelcome();});
    const back=document.getElementById('profilesBack'); if(back) back.addEventListener('click',()=>render());
  }

  function updateProgressUI(profile){
    const progress=Core.computeProgress(profile);
    const fill=document.querySelector('.progress-fill');
    if(fill) fill.style.width=`${progress.percent}%`;
    const label=document.querySelector('[data-testid="progress-label"]');
    if(label) label.textContent=`${progress.overallAnswered} / ${progress.overallTotal} · ${progress.percent}%`;
  }

  function bindReset(profile){
    const profilesBtn=document.getElementById('profilesBtn'); if(profilesBtn) profilesBtn.addEventListener('click',()=>renderProfileManager());
    const btn=document.getElementById('resetBtn'); if(!btn) return;
    btn.addEventListener('click',()=>{
      if(!confirm('Начать заново? Все ответы этого профиля на этом устройстве будут удалены.')) return;
      delete store.importedPartners[profile.id];
      const reset=Core.resetProfileData(profile); reset.location.stage='evolution'; reset.location.periodIndex=0; saveProfile(reset); saveStore(); render();
    });
  }

  function renderEvolution(profile){
    const index=Math.max(0,Math.min(Data.periods.length-1,profile.location.periodIndex||0));
    const period=Data.periods[index];
    const state=profile.longitudinal[period.id];
    const ratingRows=Data.periodDimensions.map(dim=>{
      const choices=[0,1,2,3,4].map(v=>`<label class="scale-choice"><input type="radio" name="rating-${dim.id}" value="${v}" data-dim="${dim.id}" aria-label="${escapeHtml(dim.label)} — ${v}" ${state.ratings[dim.id]===v?'checked':''}><span>${v}</span></label>`).join('');
      return `<fieldset class="dimension"><legend>${escapeHtml(dim.label)}</legend><div class="scale">${choices}</div></fieldset>`;
    }).join('');
    const confidence=state.confidence||'';
    const nextLabel=index===Data.periods.length-1?'К вопросам':'Дальше';
    app.innerHTML=shell(`<main><section class="card">
      <div class="period-intro"><div><div class="stage-badge">Эволюция отношений</div><h2>${escapeHtml(period.label)}</h2><p class="hint">${escapeHtml(period.hint)}</p></div><div class="period-count">${index+1} из ${Data.periods.length}</div></div>
      <p class="hint">Оцени по памяти каждый пункт от 0 до 4. Это не «оценка отношений» и не попытка доказать, как всё было объективно — нам важна именно твоя перспектива на этот этап.</p>
      <div class="scale-note"><span>0 · совсем не ощущалось</span><span>4 · ощущалось очень сильно</span></div>
      <div class="dimension-list">${ratingRows}</div>
      <div class="compact-grid">
        <div class="field"><label for="eraNote">Период / заметка</label><input id="eraNote" type="text" value="${escapeHtml(state.eraNote||'')}" placeholder="Например, первые месяцы вместе"></div>
        <div class="field"><label for="memoryConfidence">Уверенность в воспоминании</label><select id="memoryConfidence"><option value="">Не указывать</option><option value="low" ${confidence==='low'?'selected':''}>Низкая</option><option value="medium" ${confidence==='medium'?'selected':''}>Средняя</option><option value="high" ${confidence==='high'?'selected':''}>Высокая</option></select></div>
      </div>
      <div class="field"><label for="whatWorked">Что тогда работало особенно хорошо?</label><textarea id="whatWorked" placeholder="Короткий пример или несколько строк">${escapeHtml(state.notes.whatWorked||'')}</textarea></div>
      <div class="field"><label for="tension">Что было главным источником напряжения?</label><textarea id="tension" placeholder="Можно оставить пустым">${escapeHtml(state.notes.tension||'')}</textarea></div>
      <div class="field"><label for="changed">Что изменилось по сравнению с предыдущим этапом и почему, как тебе кажется?</label><textarea id="changed" placeholder="Для первого этапа можно описать, что было характерно именно тогда">${escapeHtml(state.notes.changed||'')}</textarea></div>
      <div class="autosave">Сохраняется локально на этом устройстве</div>
      <div class="nav-row">${index>0?'<button class="ghost" id="periodBack">Назад</button>':'<span></span>'}<button class="primary" id="periodNext">${nextLabel}</button></div>
    </section></main>`,profile);

    const persist=()=>{ saveProfile(profile); updateProgressUI(profile); };
    document.querySelectorAll('[data-dim]').forEach(input=>input.addEventListener('change',e=>{state.ratings[e.target.dataset.dim]=Number(e.target.value);persist();}));
    document.getElementById('eraNote').addEventListener('input',e=>{state.eraNote=e.target.value;persist();});
    document.getElementById('memoryConfidence').addEventListener('change',e=>{state.confidence=e.target.value;persist();});
    document.getElementById('whatWorked').addEventListener('input',e=>{state.notes.whatWorked=e.target.value;persist();});
    document.getElementById('tension').addEventListener('input',e=>{state.notes.tension=e.target.value;persist();});
    document.getElementById('changed').addEventListener('input',e=>{state.notes.changed=e.target.value;persist();});
    const back=document.getElementById('periodBack'); if(back) back.addEventListener('click',()=>{profile.location.periodIndex=index-1;saveProfile(profile);render();window.scrollTo(0,0);});
    document.getElementById('periodNext').addEventListener('click',()=>{
      if(index<Data.periods.length-1){profile.location.periodIndex=index+1;}
      else {profile.location.stage='questionnaire';profile.location.questionIndex=0;profile.location.episodeStep=0;}
      saveProfile(profile);render();window.scrollTo(0,0);
    });
    bindReset(profile);
  }

  function questionById(id){ return Data.questions.find(q=>q.id===id); }
  function sectionById(id){ return Data.sections.find(x=>x.id===id); }
  function optionValues(selected){
    return `<option value="">—</option>${[0,1,2,3,4].map(v=>`<option value="${v}" ${selected!==''&&selected!==null&&selected!==undefined&&Number(selected)===v?'selected':''}>${v}</option>`).join('')}`;
  }
  function nestedGet(obj,path){ return path.split('.').reduce((acc,key)=>acc && acc[key]!==undefined?acc[key]:undefined,obj); }
  function nestedSet(obj,path,value){
    const parts=path.split('.'); let cur=obj;
    parts.forEach((key,i)=>{ if(i===parts.length-1) cur[key]=value; else { if(!cur[key]||typeof cur[key]!=='object') cur[key]={}; cur=cur[key]; } });
  }
  function structuredAnswer(profile,q){
    if(!profile.answers[q.id] || typeof profile.answers[q.id]!=='object' || Array.isArray(profile.answers[q.id])) profile.answers[q.id]={};
    return profile.answers[q.id];
  }

  function renderNeedsMatrix(profile,q){
    const a=structuredAnswer(profile,q); if(!a.needs) a.needs={};
    const rows=Data.needs.map(need=>{
      const row=a.needs[need.id]||{};
      return `<div class="matrix-row"><div class="matrix-label">${escapeHtml(need.label)}</div><div class="matrix-controls">
        <div class="matrix-control"><label for="${need.id}-imp">Важность сейчас</label><select id="${need.id}-imp" data-path="needs.${need.id}.importanceNow" aria-label="${escapeHtml(need.label)} — важность сейчас">${optionValues(row.importanceNow)}</select></div>
        <div class="matrix-control"><label for="${need.id}-suf">Достаточность сейчас</label><select id="${need.id}-suf" data-path="needs.${need.id}.sufficiencyNow" aria-label="${escapeHtml(need.label)} — достаточность сейчас">${optionValues(row.sufficiencyNow)}</select></div>
        <div class="matrix-control"><label for="${need.id}-before">Достаточность раньше</label><select id="${need.id}-before" data-path="needs.${need.id}.sufficiencyBefore" aria-label="${escapeHtml(need.label)} — достаточность раньше">${optionValues(row.sufficiencyBefore)}</select></div>
      </div></div>`;
    }).join('');
    return `<div class="matrix">${rows}</div><div class="answer-grid two">
      <div class="field"><label for="memoryConfidenceQ04">Уверенность в колонке «раньше»</label><select id="memoryConfidenceQ04" data-path="memoryConfidence"><option value="">Не указывать</option><option value="low" ${a.memoryConfidence==='low'?'selected':''}>Низкая</option><option value="medium" ${a.memoryConfidence==='medium'?'selected':''}>Средняя</option><option value="high" ${a.memoryConfidence==='high'?'selected':''}>Высокая</option></select></div>
      <div class="field"><label for="priorityNote">Что сейчас важнее всего обсудить?</label><textarea id="priorityNote" data-path="priorityNote">${escapeHtml(a.priorityNote||'')}</textarea></div>
    </div>`;
  }

  function renderResource(profile,q){
    const a=structuredAnswer(profile,q); const energy=Number.isInteger(a.energy)?a.energy:null;
    const scale=[0,1,2,3,4].map(v=>`<label><input type="radio" name="energy" value="${v}" data-path="energy" aria-label="Сколько сил остаётся на общение — ${v}" ${energy===v?'checked':''}><span>${v}</span></label>`).join('');
    return `<div class="answer-grid"><div class="field"><label for="circumstances">До трёх обстоятельств, которые сейчас влияют сильнее всего</label><textarea id="circumstances" data-path="circumstances">${escapeHtml(a.circumstances||'')}</textarea></div>
      <div class="field"><label>Сколько сил остаётся на общение? 0 — почти нет, 4 — достаточно</label><div class="resource-scale">${scale}</div></div>
      <div class="field"><label for="temporary">Что кажется временным сейчас, а что встречалось и раньше?</label><textarea id="temporary" data-path="temporary">${escapeHtml(a.temporary||'')}</textarea></div></div>`;
  }

  function renderSupport(profile,q){
    const a=structuredAnswer(profile,q);
    const field=(id,label)=>`<div class="field"><label for="${id}">${label}</label><textarea id="${id}" data-path="${id}">${escapeHtml(a[id]||'')}</textarea></div>`;
    return `<div class="answer-grid"><h3>А. Когда трудно из-за чего-то вне отношений</h3><div class="answer-grid two">${field('outsideFirst','Что лучше сделать в первые несколько минут?')}${field('outsideLater','Что помогает позже?')}${field('outsideAvoid','Что сейчас не стоит делать?')}</div><h3>Б. Когда трудно из-за происходящего между нами</h3><div class="answer-grid two">${field('insideFirst','Что лучше сделать в первые несколько минут?')}${field('insideLater','Что помогает позже?')}${field('insideAvoid','Что сейчас не стоит делать?')}</div>${field('signalPhrase','Короткая фраза, которой я могу обозначить нужную поддержку')}</div>`;
  }

  function renderPause(profile,q){
    const a=structuredAnswer(profile,q);
    return `<div class="answer-grid">${[['mine','Когда пауза нужна мне'],['partner','Когда пауза нужна партнёру'],['shared','Общие условия паузы и срочные обязанности']].map(([id,label])=>`<div class="field"><label for="pause-${id}">${label}</label><textarea id="pause-${id}" data-path="${id}">${escapeHtml(a[id]||'')}</textarea></div>`).join('')}</div>`;
  }

  function renderDoneStates(profile,q){
    const a=structuredAnswer(profile,q);
    const rows=[['pauseToday','Разговор можно отложить на сегодня'],['contactRestored','Контакт между нами восстановлен'],['problemResolved','Сама проблема решена или есть достаточная договорённость'],['repairNeeds','Что помогает после обиды и что не заменяется словами']];
    return `<div class="answer-grid">${rows.map(([id,label])=>`<div class="field"><label for="done-${id}">${label}</label><textarea id="done-${id}" data-path="${id}">${escapeHtml(a[id]||'')}</textarea></div>`).join('')}</div>`;
  }

  function renderExperiment(profile,q){
    const a=structuredAnswer(profile,q);
    return `<div class="answer-grid two"><div class="field"><label for="experiment-request">Один запрос к партнёру</label><textarea id="experiment-request" data-path="request">${escapeHtml(a.request||'')}</textarea></div><div class="field"><label for="experiment-self">Один добровольный шаг с моей стороны</label><textarea id="experiment-self" data-path="selfStep">${escapeHtml(a.selfStep||'')}</textarea></div></div><p class="hint">Для каждого можно указать: ситуация → действие → ресурс → по какому признаку будет понятно, что помогло → как изменить попытку, если она не подходит.</p>`;
  }

  function renderEpisode(profile,q){
    const a=structuredAnswer(profile,q); const step=Math.max(0,Math.min(Data.episodeFields.length-1,profile.location.episodeStep||0)); const field=Data.episodeFields[step];
    const dots=Data.episodeFields.map((_,i)=>`<span class="step-dot ${i===step?'active':''}"></span>`).join('');
    return `<div class="episode-step"><strong>Шаг ${step+1} из ${Data.episodeFields.length}</strong><div class="step-dots" aria-hidden="true">${dots}</div></div><div class="field"><label for="episodeField">${escapeHtml(field.label)}</label>${field.hint?`<p class="hint">${escapeHtml(field.hint)}</p>`:''}<textarea id="episodeField" data-path="${field.id}" style="width:100%;min-height:210px;border:1px solid var(--line);border-radius:16px;padding:15px;line-height:1.55">${escapeHtml(a[field.id]||'')}</textarea></div>`;
  }

  function renderQuestionBody(profile,q){
    if(q.type==='needsMatrix') return renderNeedsMatrix(profile,q);
    if(q.type==='resource') return renderResource(profile,q);
    if(q.type==='support') return renderSupport(profile,q);
    if(q.type==='pause') return renderPause(profile,q);
    if(q.type==='doneStates') return renderDoneStates(profile,q);
    if(q.type==='experiment') return renderExperiment(profile,q);
    if(q.type==='episode') return renderEpisode(profile,q);
    const value=typeof profile.answers[q.id]==='string'?profile.answers[q.id]:'';
    return `<div class="answer-block"><label class="legend" for="questionAnswer">Мой ответ</label><textarea id="questionAnswer">${escapeHtml(value)}</textarea></div>`;
  }

  function persistQuestionInput(profile,q,target){
    if(target.id==='questionAnswer') profile.answers[q.id]=target.value;
    else if(target.dataset.path){
      const a=structuredAnswer(profile,q);
      let value=target.value;
      if(target.matches('select[data-path]') || target.matches('input[type="radio"][data-path]')) value=value===''?'':Number(value);
      nestedSet(a,target.dataset.path,value);
    }
    saveProfile(profile); updateProgressUI(profile);
    const qp=document.querySelector('[data-testid="question-progress"]');
    if(qp){const pr=Core.computeProgress(profile);qp.textContent=`Ответов: ${pr.questionAnswered} / ${pr.questionTotal}`;}
  }

  function moveQuestion(profile,delta){
    const ids=Core.routeQuestionIds(profile); const current=profile.location.questionIndex||0; const next=current+delta;
    profile.location.episodeStep=0;
    if(next<0){ profile.location.stage='evolution'; profile.location.periodIndex=Data.periods.length-1; }
    else if(next>=ids.length){ profile.location.stage='mirror'; }
    else profile.location.questionIndex=next;
    saveProfile(profile); render(); window.scrollTo(0,0);
  }

  function renderQuestionnaire(profile){
    const ids=Core.routeQuestionIds(profile); const index=Math.max(0,Math.min(ids.length-1,profile.location.questionIndex||0)); profile.location.questionIndex=index;
    const q=questionById(ids[index]); const section=sectionById(q.section); const pr=Core.computeProgress(profile);
    const isEpisode=q.type==='episode'; const episodeStep=profile.location.episodeStep||0;
    const backLabel='Назад'; const nextLabel=(isEpisode && episodeStep<Data.episodeFields.length-1)?'Дальше':(index===ids.length-1?'К результату':'Дальше');
    app.innerHTML=shell(`<main><section class="card question-card">
      <div class="question-head"><div><span class="question-id">${q.id}</span>${q.voluntary?'<span class="voluntary-chip">Можно пропустить</span>':''}</div><div class="question-meta"><div>${escapeHtml(section.label)}</div><div data-testid="question-progress">Ответов: ${pr.questionAnswered} / ${pr.questionTotal}</div></div></div>
      <h2>${escapeHtml(q.title)}</h2><p class="question-prompt">${escapeHtml(q.prompt)}</p><p class="question-subprompt">${escapeHtml(q.subprompt||'')}</p><div class="context-note">По умолчанию отвечай о последних 14 днях, если сам вопрос не просит другой период. Обычные предпочтения можно отдельно отличать от того, что нужно именно сейчас.</div>
      ${renderQuestionBody(profile,q)}
      <div class="autosave">Сохраняется после каждого изменения</div>
      <div class="question-nav"><button class="ghost" id="questionBack">${backLabel}</button><div class="right">${isEpisode?'<button class="skip-btn" id="skipEpisode">Пропустить весь Q12</button>':''}<button class="primary" id="questionNext">${nextLabel}</button></div></div>
    </section></main>`,profile);

    const inputs=document.querySelectorAll('#questionAnswer,[data-path]');
    inputs.forEach(el=>{const event=(el.tagName==='SELECT'||el.type==='radio')?'change':'input';el.addEventListener(event,e=>persistQuestionInput(profile,q,e.target));});
    document.getElementById('questionBack').addEventListener('click',()=>{
      if(isEpisode && episodeStep>0){profile.location.episodeStep=episodeStep-1;saveProfile(profile);render();}
      else moveQuestion(profile,-1);
    });
    document.getElementById('questionNext').addEventListener('click',()=>{
      if(isEpisode && episodeStep<Data.episodeFields.length-1){profile.location.episodeStep=episodeStep+1;saveProfile(profile);render();window.scrollTo(0,0);}
      else moveQuestion(profile,1);
    });
    const skip=document.getElementById('skipEpisode'); if(skip) skip.addEventListener('click',()=>moveQuestion(profile,1));
    bindReset(profile);
  }

  function renderMirror(profile){
    const items=Data.mirrorQuestions.map(m=>`<div class="mirror-item"><h3>${m.id}. ${escapeHtml(m.title)}</h3><p>${escapeHtml(m.prompt)}</p><label class="legend" for="mirror-${m.id}">${m.id} — мой ответ</label><textarea id="mirror-${m.id}" data-mirror="${m.id}">${escapeHtml(profile.mirrorAnswers[m.id]||'')}</textarea></div>`).join('');
    app.innerHTML=shell(`<main><section class="card"><div class="stage-badge">Перед чтением ответов партнёра</div><h2>Необязательный зеркальный блок</h2><p class="hint">Это не экзамен на чтение мыслей. Несовпадение — материал для уточнения, а не доказательство невнимательности. Можно пропустить весь блок.</p><div class="mirror-card">${items}</div><div class="nav-row"><button class="ghost" id="mirrorBack">Назад</button><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="skip-btn" id="mirrorSkip">Пропустить и показать результат</button><button class="primary" id="mirrorSave">Сохранить и показать результат</button></div></div></section></main>`,profile);
    document.querySelectorAll('[data-mirror]').forEach(el=>el.addEventListener('input',e=>{profile.mirrorAnswers[e.target.dataset.mirror]=e.target.value;saveProfile(profile);}));
    document.getElementById('mirrorBack').addEventListener('click',()=>{profile.location.stage='questionnaire';profile.location.questionIndex=Core.routeQuestionIds(profile).length-1;saveProfile(profile);render();});
    const finish=(completed)=>{profile.mirrorCompleted=completed;profile.location.stage='result';saveProfile(profile);render();window.scrollTo(0,0);};
    document.getElementById('mirrorSkip').addEventListener('click',()=>finish(false));
    document.getElementById('mirrorSave').addEventListener('click',()=>finish(true));
    bindReset(profile);
  }

  function sparklineSvg(profile,dim){
    const xs=[18,104,190,276]; const values=Data.periods.map(p=>profile.longitudinal[p.id].ratings[dim.id]);
    const points=values.map((v,i)=>Number.isInteger(v)?{x:xs[i],y:47-v*10,v}:null);
    const defined=points.filter(Boolean); const poly=defined.map(p=>`${p.x},${p.y}`).join(' ');
    const grid=[0,1,2,3,4].map(v=>`<line class="spark-grid" x1="10" x2="286" y1="${47-v*10}" y2="${47-v*10}"></line>`).join('');
    const circles=points.map(p=>p?`<circle class="spark-dot" cx="${p.x}" cy="${p.y}" r="4"><title>${p.v}/4</title></circle>`:'').join('');
    return `<svg class="spark" viewBox="0 0 296 56" role="img" aria-label="${escapeHtml(dim.label)} по четырём периодам">${grid}${defined.length>1?`<polyline class="spark-line" points="${poly}"></polyline>`:''}${circles}</svg>`;
  }

  function evolutionSummaryHtml(profile){
    const rows=Data.periodDimensions.map(dim=>{
      const vals=Data.periods.map(p=>profile.longitudinal[p.id].ratings[dim.id]);
      return `<div class="evo-row"><div><div class="evo-label">${escapeHtml(dim.label)}</div><div class="evo-values">${vals.map(v=>`<span>${Number.isInteger(v)?v:'—'}</span>`).join('')}</div></div>${sparklineSvg(profile,dim)}</div>`;
    }).join('');
    return `<div class="evolution-summary">${rows}</div>`;
  }

  function safeFilename(name){ return String(name||'result').trim().replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g,'-').replace(/^-+|-+$/g,'')||'result'; }
  function downloadText(filename,text,type='text/plain;charset=utf-8'){
    const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  async function copyText(text){
    try { if(navigator.clipboard && navigator.clipboard.writeText){await navigator.clipboard.writeText(text);return true;} } catch{}
    const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy');}catch{}ta.remove();return ok;
  }
  function setToast(message){const el=document.getElementById('toast');if(el)el.textContent=message;}

  function answerAccordions(profile){
    const ids=Core.routeQuestionIds(profile); const out=[];
    for(const id of ids){const q=questionById(id);const ans=profile.answers[id];if(!Core.isMeaningful(ans))continue;const md=Core.formatAnswerMarkdown(q,ans);out.push(`<details class="answer-accordion"><summary>${q.id}. ${escapeHtml(q.title)}</summary><div class="answer-content">${escapeHtml(md)}</div></details>`);}
    return out.length?out.join(''):'<p class="hint">Пока нет текстовых ответов для просмотра. Это нормально: неполное прохождение тоже можно экспортировать.</p>';
  }

  function renderResult(profile){
    const pr=Core.computeProgress(profile); const partner=store.importedPartners[profile.id];
    app.innerHTML=shell(`<main>
      <section class="result-hero"><div class="eyebrow">Личный результат · хранится на этом устройстве</div><h2>Мой результат</h2><p class="hint">Это карта твоих ответов, а не диагноз и не оценка качества отношений.</p><div class="result-stats"><span class="stat-chip">${pr.questionAnswered} / ${pr.questionTotal} вопросов с ответом</span><span class="stat-chip">${pr.longitudinalAnswered} / ${pr.longitudinalTotal} исторических оценок</span><span class="stat-chip">${profile.route==='full'?'Полный':'Основной'} маршрут</span></div></section>
      <section class="card result-section"><h3>Эволюция отношений</h3><p class="section-note">Четыре субъективных временных среза. Линии помогают увидеть форму изменения, но не объясняют его причину.</p>${evolutionSummaryHtml(profile)}</section>
      <section class="card result-section"><h3>Мои содержательные ответы</h3>${answerAccordions(profile)}</section>
      <section class="card result-section"><h3>Сохранить и передать</h3><div class="action-grid"><button id="downloadMd">Скачать Markdown</button><button id="downloadJson">Скачать JSON</button><button class="primary-action" id="copyChatGPT">Скопировать для ChatGPT</button><label class="file-action" for="partnerFile">Импортировать JSON партнёра<input id="partnerFile" type="file" accept="application/json,.json" aria-label="Импортировать JSON партнёра"></label></div><div class="privacy-box">Импортированный файл сравнивается только локально. Сайт не отправляет ответы ни в GitHub, ни в ChatGPT, ни на какой-либо сервер. Семантический смысл свободного текста здесь не оценивается.</div>${partner?`<button class="secondary" id="openCompare" style="margin-top:12px;width:100%">Сравнить с ${escapeHtml(partner.name)}</button>`:''}<div class="toast" id="toast" aria-live="polite"></div></section>
    </main>`,profile);
    document.getElementById('downloadMd').addEventListener('click',()=>downloadText(`${safeFilename(profile.name)}-relationship-os.md`,Core.buildMarkdown(profile),'text/markdown;charset=utf-8'));
    document.getElementById('downloadJson').addEventListener('click',()=>downloadText(`${safeFilename(profile.name)}-relationship-os.json`,Core.serializeProfile(profile),'application/json;charset=utf-8'));
    document.getElementById('copyChatGPT').addEventListener('click',async()=>{await copyText(Core.buildMarkdown(profile));setToast('Скопировано. Можно вставить в ChatGPT.');});
    document.getElementById('partnerFile').addEventListener('change',async e=>{const file=e.target.files&&e.target.files[0];if(!file)return;try{const partnerProfile=Core.parseImport(await file.text());if(partnerProfile.id===profile.id && partnerProfile.name===profile.name) throw new Error('Похоже, это тот же самый профиль, а не результат партнёра.');store.importedPartners[profile.id]=partnerProfile;profile.location.stage='compare';saveProfile(profile);saveStore();render();window.scrollTo(0,0);}catch(err){setToast(`Не удалось импортировать: ${err.message}`);e.target.value='';}});
    const open=document.getElementById('openCompare');if(open)open.addEventListener('click',()=>{profile.location.stage='compare';saveProfile(profile);render();});
    bindReset(profile);
  }

  function comparisonLongitudinalHtml(cmp){
    return Data.periods.map(period=>{const rows=cmp.longitudinal.filter(r=>r.periodId===period.id).map(r=>`<tr><td>${escapeHtml(r.dimensionLabel)}</td><td class="num">${r.a??'—'}</td><td class="num">${r.b??'—'}</td><td class="num delta-neutral">${r.delta===null?'—':r.delta===0?'совпало':`Δ ${Math.abs(r.delta)}`}</td></tr>`).join('');return `<div class="compare-period"><h4>${escapeHtml(period.label)}</h4><table class="compare-table"><thead><tr><th>Измерение</th><th>${escapeHtml(cmp.a.name)}</th><th>${escapeHtml(cmp.b.name)}</th><th>Разница</th></tr></thead><tbody>${rows}</tbody></table></div>`;}).join('');
  }

  function comparisonNeedsHtml(cmp){
    const has=cmp.needs.some(r=>Core.isMeaningful(r.a)||Core.isMeaningful(r.b)); if(!has)return '';
    const rows=cmp.needs.map(r=>`<tr><td>${escapeHtml(r.label)}</td><td>${r.a.importanceNow??'—'} / ${r.a.sufficiencyNow??'—'}</td><td>${r.b.importanceNow??'—'} / ${r.b.sufficiencyNow??'—'}</td></tr>`).join('');
    return `<section class="card result-section"><h3>Q04 · потребности</h3><p class="section-note">Формат в ячейке: важность сейчас / достаточность сейчас. Различие не означает, что один из вас прав.</p><table class="compare-table"><thead><tr><th>Потребность</th><th>${escapeHtml(cmp.a.name)}</th><th>${escapeHtml(cmp.b.name)}</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }

  function comparisonFreeTextHtml(cmp){
    const meaningful=cmp.freeText.filter(r=>r.a!=='_Не отвечено._'||r.b!=='_Не отвечено._');
    return `<div class="compare-free">${meaningful.map(r=>`<div class="compare-question"><h4>${r.questionId}. ${escapeHtml(r.title)}</h4><div class="compare-columns"><div class="voice"><strong>${escapeHtml(cmp.a.name)}</strong><div>${escapeHtml(r.a)}</div></div><div class="voice"><strong>${escapeHtml(cmp.b.name)}</strong><div>${escapeHtml(r.b)}</div></div></div></div>`).join('')}</div>`;
  }

  function renderCompare(profile){
    const partner=store.importedPartners[profile.id]; if(!partner){profile.location.stage='result';saveProfile(profile);return renderResult(profile);} const cmp=Core.compareProfiles(profile,partner);
    app.innerHTML=shell(`<main><section class="result-hero"><div class="eyebrow">Локальное детерминированное сравнение</div><h2>${escapeHtml(profile.name)} × ${escapeHtml(partner.name)}</h2><span class="neutral-chip">Без оценки совместимости</span><p class="hint" style="margin-top:12px">Числа сравниваются как числа. Свободные ответы просто поставлены рядом — приложение не пытается угадать их смысл без LLM.</p></section>
      <section class="card result-section"><h3>Эволюция отношений · две перспективы</h3>${comparisonLongitudinalHtml(cmp)}</section>
      ${comparisonNeedsHtml(cmp)}
      <section class="card result-section"><h3>Одинаковые вопросы · два голоса</h3><p class="section-note">Именно этот блок особенно полезно позже передать ChatGPT для смыслового сопоставления.</p>${comparisonFreeTextHtml(cmp)}</section>
      <section class="card result-section"><h3>Дальше</h3><div class="compare-actions"><button class="ghost" id="backResult">Назад к моему результату</button><button id="downloadCombined">Скачать объединённый Markdown</button><button class="primary" id="copyCombined">Скопировать оба результата для ChatGPT</button></div><div class="toast" id="toast" aria-live="polite"></div></section></main>`,profile);
    document.getElementById('backResult').addEventListener('click',()=>{profile.location.stage='result';saveProfile(profile);render();});
    document.getElementById('downloadCombined').addEventListener('click',()=>downloadText(`${safeFilename(profile.name)}-${safeFilename(partner.name)}-relationship-os.md`,Core.buildCombinedMarkdown(profile,partner),'text/markdown;charset=utf-8'));
    document.getElementById('copyCombined').addEventListener('click',async()=>{await copyText(Core.buildCombinedMarkdown(profile,partner));setToast('Оба результата скопированы для ChatGPT.');});
    bindReset(profile);
  }

  function render(){
    const p=activeProfile();
    if(!p || !p.location || p.location.stage==='welcome') return renderWelcome();
    if(p.location.stage==='evolution') return renderEvolution(p);
    if(p.location.stage==='questionnaire') return renderQuestionnaire(p);
    if(p.location.stage==='mirror') return renderMirror(p);
    if(p.location.stage==='result') return renderResult(p);
    if(p.location.stage==='compare') return renderCompare(p);
    return renderWelcome();
  }

  render();
})();
