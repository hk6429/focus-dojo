// 專注計時：以結束時刻為準，進行中狀態落地 localStorage，可續算；背景時間不計入
const Timer = (() => {
  const $ = UI.$;
  const RUN_KEY = 'focus-dojo-run';
  const CIRC = 2 * Math.PI * 90;
  const MIN_PLAN = 5, MAX_PLAN = 180;
  let run = null;          // {task, outcome, ifthen, plannedMin, startAt, endAt, distractions, away, parked, lastSeen}
  let tick = null, leftAt = 0, restTick = null, lastId = null, lastSession = null, lastPersist = 0, wake = null;
  let plannedMin = 25;

  const getMin = UI.chips('#minute-chips', 'min', v => { plannedMin = +v; const c = $('#minute-custom'); c.value = ''; c.classList.remove('on'); });
  $('#minute-custom').addEventListener('input', e => {
    const v = +e.target.value;
    if (v >= MIN_PLAN && v <= MAX_PLAN) { plannedMin = v; UI.$$('#minute-chips button').forEach(b => b.classList.remove('on')); e.target.classList.add('on'); }
    else e.target.classList.remove('on');
  });
  $('#minute-custom').addEventListener('blur', e => { const v = +e.target.value; if (e.target.value && v < MIN_PLAN) { e.target.value = MIN_PLAN; e.target.dispatchEvent(new Event('input')); UI.toast(`最少 ${MIN_PLAN} 分鐘才算一坐`); } });

  const persist = () => { try { run ? localStorage.setItem(RUN_KEY, JSON.stringify(run)) : localStorage.removeItem(RUN_KEY); } catch {} };
  function show(which) {
    ['setup', 'running', 'done'].forEach(k => ($(`#focus-${k}`).hidden = k !== which));
    $('.belt-wrap').hidden = which === 'running';
    if (which === 'setup') { renderSuggest(); renderGoal(); renderLastNote(); renderSubjects(); renderNextBlock(); $('.intent').open = Store.get().sessions.filter(Store.counts).length < 5; }
  }
  // 科目 chips（道場頁設定）
  let subject = '';
  function renderSubjects() {
    const list = Store.get().settings.subjects || [], box = $('#subject-chips');
    box.hidden = !list.length; if (!list.includes(subject)) subject = '';
    box.innerHTML = list.map(s => `<button data-s="${s.replace(/"/g, '&quot;')}" class="${s === subject ? 'on' : ''}">${s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</button>`).join('');
  }
  $('#subject-chips').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; subject = subject === b.dataset.s ? '' : b.dataset.s; renderSubjects(); });
  // 每日排程：顯示下一段，±15 分內可一鍵採用
  function renderNextBlock() {
    const blocks = [...(Store.get().settings.blocks || [])].sort((a, b) => a.time.localeCompare(b.time)), el = $('#next-block');
    if (!blocks.length) { el.hidden = true; return; }
    const now = new Date(), cur = now.getHours() * 60 + now.getMinutes();
    const mins = b => { const [h, m] = b.time.split(':').map(Number); return h * 60 + m; };
    const due = blocks.find(b => Math.abs(mins(b) - cur) <= 15), next = blocks.find(b => mins(b) > cur + 15);
    el.hidden = false;
    if (due) el.innerHTML = `⏰ 現在是排程時段 <b>${due.time}</b> · ${due.min} 分 <button class="link" data-min="${due.min}">照排程開始</button>`;
    else if (next) el.innerHTML = `下一段排程：<b>${next.time}</b> · ${next.min} 分`;
    else el.innerHTML = `今天的排程都過了，明天 <b>${blocks[0].time}</b> 見`;
  }
  $('#next-block').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    plannedMin = +b.dataset.min; $('#minute-custom').value = plannedMin; $('#minute-custom').classList.add('on');
    UI.$$('#minute-chips button').forEach(x => x.classList.toggle('on', +x.dataset.min === plannedMin));
    $('#task-input').focus();
  });
  setInterval(() => { if (!$('#focus-setup').hidden) renderNextBlock(); }, 60000);
  document.addEventListener('store:change', () => { if (!$('#focus-setup').hidden) { renderSubjects(); renderNextBlock(); } });
  // 環境音
  const soundSel = UI.chips('#sound-pick', 'sound', v => { Store.setSetting('sound', v); run && Sound.start(v, Store.get().settings.soundVol); });
  $('#sound-vol').addEventListener('input', e => { Store.setSetting('soundVol', +e.target.value); Sound.setVol(+e.target.value); });
  function syncSoundUI() { const st = Store.get().settings; UI.$$('#sound-pick button').forEach(b => b.classList.toggle('on', b.dataset.sound === (st.sound || 'off'))); $('#sound-vol').value = st.soundVol; }
  function renderGoal() {
    const done = Math.round(Store.todayMin()), goal = Store.get().settings.dailyMin;
    $('#goal-line').innerHTML = done >= goal ? `今天 <b>${done}</b>／${goal} 分，目標達成 ✔` : `今天 <b>${done}</b>／${goal} 分，還差 ${goal - done} 分`;
    $('#hdr-streak').textContent = `本週 ${Store.weekDone()}/${Store.get().settings.weekDays} 天`;
  }
  function renderLastNote() {
    const n = Store.lastNote(), el = $('#last-note');
    el.hidden = !n; el.textContent = n ? `上回你說：「${n}」` : '';
  }
  function renderSuggest() {
    const s = Store.suggest(), el = $('#suggest');
    if (!s || s.min === plannedMin) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `${s.why}，試試 <b>${s.min} 分</b>？<button class="link" data-min="${s.min}">採用</button>`;
  }
  $('#suggest').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    plannedMin = +b.dataset.min; $('#minute-custom').value = plannedMin; $('#minute-custom').classList.add('on');
    UI.$$('#minute-chips button').forEach(x => x.classList.toggle('on', +x.dataset.min === plannedMin));
    $('#suggest').hidden = true;
  });

  function render() {
    if (!run) return;
    const now = Date.now();
    if (!document.hidden) { run.lastSeen = now; if (now - lastPersist > 5000) { persist(); lastPersist = now; } }
    const left = (run.endAt - now) / 1000;
    $('#run-clock').textContent = UI.mmss(left);
    $('#ring-fg').style.strokeDashoffset = CIRC * (1 - Math.max(0, left) / (run.plannedMin * 60));
    document.title = `${UI.mmss(left)} · 專注道場`;
    if (left <= 0) finish(true);
  }
  async function lockScreen() { try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch {} }
  function begin(r) {
    run = r; run.lastSeen ||= Date.now(); persist();
    $('#run-task').textContent = run.task; $('#run-dist').textContent = run.distractions.length;
    const il = $('#run-intent'); il.hidden = !(run.outcome || run.ifthen);
    il.textContent = [run.outcome && `做完：${run.outcome}`, run.ifthen && `若分心：${run.ifthen}`].filter(Boolean).join(' · ');
    $('#end-confirm').hidden = true; $('#end-row').hidden = false; $('#park-input').value = '';
    $('#ring-fg').classList.remove('done');
    show('running'); render(); clearInterval(tick); tick = setInterval(render, 500); lockScreen();
    syncSoundUI(); const st = Store.get().settings; if (st.sound && st.sound !== 'off') Sound.start(st.sound, st.soundVol);
  }
  function start() {
    const task = $('#task-input').value.trim() || '未命名任務';
    plannedMin = +(getMin() || plannedMin);
    const now = Date.now();
    const outcome = $('#outcome-input').value.trim(), ifthen = $('#ifthen-input').value.trim();
    begin({ task, subject, outcome, ifthen, plannedMin, startAt: now, endAt: now + plannedMin * 60000, distractions: [], away: [], parked: [], lastSeen: now });
    UI.beep(520, .1);
  }
  function distract(reason) {
    if (!run) return;
    run.distractions.push({ t: Math.round((Date.now() - run.startAt) / 1000), reason });
    $('#run-dist').textContent = run.distractions.length; persist();
    UI.vibrate(30);
    const r = $('#ring-fg'); r.classList.add('flash'); setTimeout(() => r.classList.remove('flash'), 500);
    $('#park-input').focus({ preventScroll: true });
  }
  function park() {
    const v = $('#park-input').value.trim();
    if (v && run) { (run.parked ||= []).push(v); persist(); UI.toast('已停車，結束再處理'); }
    $('#park-input').value = '';
  }
  function stop() { clearInterval(tick); tick = null; document.title = '專注道場'; $('#away-ask').hidden = true; try { wake && wake.release(); } catch {} wake = null; Sound.stop(); }
  // 實際專注秒數：最後一次看到畫面為止，再扣掉 ≥10 秒的離開時段
  function actualSec(r, endTs) {
    const seen = Math.min(endTs, r.lastSeen || endTs);
    const away = (r.away || []).reduce((a, x) => a + x.sec, 0);
    return Math.max(0, Math.min(r.plannedMin * 60, Math.round((seen - r.startAt) / 1000) - away));
  }
  function finish(completed, bg) {
    if (!run) return;
    stop();
    const actual = actualSec(run, bg ? run.endAt : Date.now());
    completed = completed && actual >= run.plannedMin * 60 - 5;
    const s = { date: Store.today(), start: run.startAt, task: run.task, subject: run.subject || '', outcome: run.outcome, ifthen: run.ifthen, planned: run.plannedMin * 60, actual, completed, distractions: run.distractions, away: run.away, parked: run.parked || [] };
    lastId = Store.addSession(s); s.id = lastId; lastSession = s;
    const counted = Store.counts(s);
    $('#done-challenge').textContent = Game.resolveChallenge(s);
    $('#tip-line').textContent = counted ? Game.tip() : '';
    Game.renderExperiment(lastId, counted);
    setTimeout(() => Game.check(), 50);
    UI.$$('#stars button').forEach(b => b.classList.remove('on')); $('#review-note').value = '';
    $('#review').hidden = !counted; $('#btn-share').hidden = !counted; $('#share-box').hidden = true; $('#exp-wrap').hidden = !counted;
    const pk = s.parked; $('#parked').hidden = !pk.length;
    $('#parked-list').innerHTML = pk.map(x => `<li>${x.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</li>`).join('');
    const mins = Math.floor(actual / 60), secs = actual % 60;
    const awaySec = (run.away || []).reduce((a, x) => a + x.sec, 0);
    if (completed) { $('#done-title').textContent = '完成 ✔'; $('#done-summary').textContent = `${run.task} · 專注 ${mins} 分鐘 · 分心 ${run.distractions.length} 次`; }
    else if (counted) { $('#done-title').textContent = '提早結束，有算 ✔'; $('#done-summary').textContent = `${run.task} · 專注 ${mins} 分鐘 · 分心 ${run.distractions.length} 次`; }
    else { $('#done-title').textContent = '先記下來就好'; $('#done-summary').textContent = `這次坐了 ${mins} 分 ${secs} 秒。下次做滿 ${Store.MIN_SEC / 60} 分鐘，就會算進今天。`; }
    $('#done-note').textContent = (counted ? `本週 ${Store.weekDone()} 天 · 今天 ${Math.round(Store.todayMin())}／${Store.get().settings.dailyMin} 分` : '') + (awaySec >= 10 ? `（離開畫面 ${awaySec} 秒不計入）` : '') + (bg && !completed ? ' 背景時間不計入' : '');
    run = null; persist();
    show('done');
    if (completed) { $('#ring-fg').classList.add('done'); UI.beep(784, .2, 3); UI.vibrate([80, 60, 80]); }
    else UI.beep(660, .15, 1);
  }
  function abort() {
    if (!run) return;
    stop();
    const actual = actualSec(run, Date.now());
    Store.addSession({ date: Store.today(), start: run.startAt, task: run.task, subject: run.subject || '', planned: run.plannedMin * 60, actual, completed: false, aborted: true, distractions: run.distractions, away: run.away });
    run = null; persist(); show('setup'); UI.toast('這回不算，下次再來');
  }

  // 休息計時
  function rest(min) {
    const end = Date.now() + min * 60000, el = $('#rest-clock');
    $('#rest-box').hidden = false; $('#btn-rest').hidden = true;
    clearInterval(restTick);
    restTick = setInterval(() => {
      const left = (end - Date.now()) / 1000; el.textContent = UI.mmss(left);
      if (left <= 0) { clearInterval(restTick); el.textContent = '休息結束'; UI.beep(660, .2, 2); UI.vibrate([80, 60, 80]); }
    }, 500);
  }

  $('#btn-start').addEventListener('click', start);
  // 放棄／提早結束：都走固定的確認列，不自動復原
  let pendingEnd = null;
  function askEnd(kind) {
    pendingEnd = kind;
    $('#end-confirm-text').textContent = kind === 'abort' ? '確定放棄？這回不會留下任何紀錄分數。' : (run && actualSec(run, Date.now()) >= Store.MIN_SEC ? '確定提早結束？已坐的分鐘會算進去。' : `確定結束？未滿 ${Store.MIN_SEC / 60} 分鐘，這回只會記下、不計分。`);
    $('#end-row').hidden = true; $('#end-confirm').hidden = false;
  }
  $('#btn-abort').addEventListener('click', () => askEnd('abort'));
  $('#btn-finish').addEventListener('click', () => askEnd('finish'));
  $('#end-cancel').addEventListener('click', () => { pendingEnd = null; $('#end-confirm').hidden = true; $('#end-row').hidden = false; });
  $('#end-ok').addEventListener('click', () => { const k = pendingEnd; pendingEnd = null; $('#end-confirm').hidden = true; $('#end-row').hidden = false; k === 'abort' ? abort() : finish(false); });
  $('#btn-again').addEventListener('click', () => { clearInterval(restTick); $('#rest-box').hidden = true; $('#btn-rest').hidden = false; show('setup'); });
  $('#btn-rest').addEventListener('click', () => {
    const n = Store.get().sessions.filter(s => s.date === Store.today() && Store.counts(s)).length;
    rest(n > 0 && n % 4 === 0 ? 15 : 5);
  });
  $('#park-save').addEventListener('click', park);
  $('#park-input').addEventListener('keydown', e => e.key === 'Enter' && park());
  $('#stars').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !lastId) return;
    UI.$$('#stars button').forEach(x => x.classList.toggle('on', x === b));
    Store.updateSession(lastId, { quality: +b.dataset.q }); Game.check();
  });
  const saveExp = () => { const v = Game.experimentValue(); if (lastId && v) Store.updateSession(lastId, { experiment: v }); };
  $('#exp-pick').addEventListener('change', saveExp); $('#exp-custom').addEventListener('change', saveExp);
  $('#btn-share').addEventListener('click', () => lastSession && Game.openShare(Store.get().sessions.find(x => x.id === lastId) || lastSession));
  $('#review-note').addEventListener('change', e => lastId && Store.updateSession(lastId, { note: e.target.value.trim() }));
  $('#focus-done .next-row').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    clearInterval(restTick); $('#rest-box').hidden = true; $('#btn-rest').hidden = false; show('setup');
    document.querySelector(`.tabs button[data-view="${b.dataset.go}"]`).click();
  });
  document.addEventListener('store:change', renderGoal);
  $('#focus-running .reasons').addEventListener('click', e => {
    const b = e.target.closest('button'); b && distract(b.dataset.reason);
  });

  // 離開畫面：<10 秒忽略；≥10 秒記 away（從實際分鐘扣除），回來問一句是不是分心
  document.addEventListener('visibilitychange', () => {
    if (!run) return;
    if (document.hidden) { leftAt = Date.now(); persist(); return; }
    if (!leftAt) return;
    const sec = Math.round((Date.now() - leftAt) / 1000); leftAt = 0;
    if (sec < 10) return;
    run.away.push({ t: Math.round((Date.now() - run.startAt) / 1000), sec }); run.lastSeen = Date.now(); persist();
    $('#away-text').textContent = `剛才離開 ${sec} 秒（不計入專注），是分心嗎？`;
    $('#away-ask').hidden = false;
    lockScreen();
  });
  $('#away-ask').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.yes) distract('離開畫面');
    $('#away-ask').hidden = true;
  });
  window.addEventListener('beforeunload', e => { if (run) { persist(); e.preventDefault(); e.returnValue = ''; } });

  // 續算：重開頁面時若有進行中的回合
  (() => {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); } catch {}
    if (!saved) { show('setup'); return; }
    if (saved.endAt <= Date.now()) { run = saved; finish(true, true); UI.toast('上回計時已結束，只算有看著畫面的時間'); }
    else { begin(saved); UI.toast('接續上回計時'); }
  })();

  return { isRunning: () => !!run };
})();
