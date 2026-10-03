// 專注計時：以結束時刻為準，進行中狀態落地 localStorage，可續算
const Timer = (() => {
  const $ = UI.$;
  const RUN_KEY = 'focus-dojo-run';
  const CIRC = 2 * Math.PI * 90;
  let run = null;          // {task, outcome, ifthen, plannedMin, startAt, endAt, distractions, away, parked}
  let tick = null, leftAt = 0, restTick = null, lastId = null, parkTimer = null;
  let plannedMin = 25;

  const getMin = UI.chips('#minute-chips', 'min', v => { plannedMin = +v; $('#minute-custom').value = ''; });
  $('#minute-custom').addEventListener('input', e => {
    const v = +e.target.value;
    if (v >= 1 && v <= 180) { plannedMin = v; UI.$$('#minute-chips button').forEach(b => b.classList.remove('on')); }
  });

  const persist = () => { try { run ? localStorage.setItem(RUN_KEY, JSON.stringify(run)) : localStorage.removeItem(RUN_KEY); } catch {} };
  function show(which) {
    ['setup', 'running', 'done'].forEach(k => ($(`#focus-${k}`).hidden = k !== which));
    if (which === 'setup') { renderSuggest(); renderGoal(); }
  }
  function renderGoal() {
    const done = Math.round(Store.todayMin()), goal = Store.get().settings.dailyMin;
    $('#goal-line').innerHTML = done >= goal ? `今天 <b>${done}</b>／${goal} 分，目標達成 ✔` : `今天 <b>${done}</b>／${goal} 分，還差 ${goal - done} 分`;
    $('#hdr-streak').textContent = `本週 ${Store.weekDone()}/${Store.get().settings.weekDays} 天`;
  }
  function renderSuggest() {
    const s = Store.suggest(plannedMin), el = $('#suggest');
    if (!s) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `${s.why}，試試 <b>${s.min} 分</b>？<button class="link" data-min="${s.min}">採用</button>`;
  }
  $('#suggest').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    plannedMin = +b.dataset.min; $('#minute-custom').value = plannedMin;
    UI.$$('#minute-chips button').forEach(x => x.classList.toggle('on', +x.dataset.min === plannedMin));
    $('#suggest').hidden = true;
  });

  function render() {
    if (!run) return;
    const left = (run.endAt - Date.now()) / 1000;
    $('#run-clock').textContent = UI.mmss(left);
    $('#ring-fg').style.strokeDashoffset = CIRC * (1 - Math.max(0, left) / (run.plannedMin * 60));
    document.title = `${UI.mmss(left)} · 專注道場`;
    if (left <= 0) finish(true);
  }
  function begin(r) {
    run = r; persist();
    $('#run-task').textContent = run.task; $('#run-dist').textContent = run.distractions.length;
    const il = $('#run-intent'); il.hidden = !(run.outcome || run.ifthen);
    il.textContent = [run.outcome && `做完：${run.outcome}`, run.ifthen && `若分心：${run.ifthen}`].filter(Boolean).join(' · ');
    $('#btn-finish').textContent = '提早結束';
    show('running'); render(); clearInterval(tick); tick = setInterval(render, 500);
  }
  function start() {
    const task = $('#task-input').value.trim() || '未命名任務';
    plannedMin = +(getMin() || plannedMin);
    const now = Date.now();
    const outcome = $('#outcome-input').value.trim(), ifthen = $('#ifthen-input').value.trim();
    begin({ task, outcome, ifthen, plannedMin, startAt: now, endAt: now + plannedMin * 60000, distractions: [], away: [], parked: [] });
    UI.beep(520, .1);
  }
  function distract(reason) {
    if (!run) return;
    run.distractions.push({ t: Math.round((Date.now() - run.startAt) / 1000), reason });
    $('#run-dist').textContent = run.distractions.length; persist();
    UI.vibrate(30);
    // 停車場：記下念頭，結束再處理；8 秒沒寫自動收起
    $('#park').hidden = false; $('#park-input').value = '';
    clearTimeout(parkTimer); parkTimer = setTimeout(() => ($('#park').hidden = true), 8000);
  }
  function park() {
    const v = $('#park-input').value.trim();
    if (v && run) { (run.parked ||= []).push(v); persist(); UI.toast('已停車，結束再處理'); }
    $('#park').hidden = true; clearTimeout(parkTimer);
  }
  function stop() { clearInterval(tick); tick = null; document.title = '專注道場'; $('#away-ask').hidden = true; $('#park').hidden = true; }
  function finish(completed) {
    if (!run) return;
    stop();
    const actual = Math.min(run.plannedMin * 60, Math.round((Date.now() - run.startAt) / 1000));
    const s = { date: Store.today(), start: run.startAt, task: run.task, outcome: run.outcome, ifthen: run.ifthen, planned: run.plannedMin * 60, actual, completed, distractions: run.distractions, away: run.away, parked: run.parked || [] };
    lastId = Store.addSession(s);
    UI.$$('#stars button').forEach(b => b.classList.remove('on')); $('#review-note').value = '';
    const pk = s.parked; $('#parked').hidden = !pk.length;
    $('#parked-list').innerHTML = pk.map(x => `<li>${x.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</li>`).join('');
    const mins = Math.round(actual / 60);
    $('#done-title').textContent = completed ? '完成 ✔' : '提早結束';
    $('#done-summary').textContent = `${run.task} · 專注 ${mins} 分鐘 · 分心 ${run.distractions.length} 次`;
    $('#done-note').textContent = Store.counts(s) ? `本週 ${Store.weekDone()} 天 · 今天 ${Math.round(Store.todayMin())}／${Store.get().settings.dailyMin} 分` : '做滿 5 分鐘或做完才算進每週天數';
    run = null; persist();
    show('done');
    UI.beep(784, .2, completed ? 3 : 1); UI.vibrate([80, 60, 80]);
  }
  function abort() {
    if (!run) return;
    stop();
    const actual = Math.round((Date.now() - run.startAt) / 1000);
    Store.addSession({ date: Store.today(), start: run.startAt, task: run.task, planned: run.plannedMin * 60, actual, completed: false, aborted: true, distractions: run.distractions, away: run.away });
    run = null; persist(); show('setup'); UI.toast('已放棄，不計入統計');
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
  let armed = false;
  $('#btn-finish').addEventListener('click', e => {
    if (!armed) { armed = true; e.target.textContent = '確定結束？'; setTimeout(() => { armed = false; if (run) e.target.textContent = '提早結束'; }, 4000); return; }
    armed = false; finish(false);
  });
  $('#btn-abort').addEventListener('click', abort);
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
    Store.updateSession(lastId, { quality: +b.dataset.q });
  });
  $('#review-note').addEventListener('change', e => lastId && Store.updateSession(lastId, { note: e.target.value.trim() }));
  $('#focus-done .next-row').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    clearInterval(restTick); $('#rest-box').hidden = true; $('#btn-rest').hidden = false; show('setup');
    document.querySelector(`.tabs button[data-view="${b.dataset.go}"]`).click();
  });
  document.addEventListener('store:change', () => { if ($('#focus-setup').hidden === false) renderGoal(); });
  $('#focus-running .reasons').addEventListener('click', e => {
    const b = e.target.closest('button'); b && distract(b.dataset.reason);
  });

  // 離開畫面：<10 秒忽略；≥10 秒回來時問一句，另存 away，不直接混進分心
  document.addEventListener('visibilitychange', () => {
    if (!run) return;
    if (document.hidden) { leftAt = Date.now(); return; }
    if (!leftAt) return;
    const sec = Math.round((Date.now() - leftAt) / 1000); leftAt = 0;
    if (sec < 10) return;
    run.away.push({ t: Math.round((Date.now() - run.startAt) / 1000), sec }); persist();
    $('#away-text').textContent = `剛才離開 ${sec} 秒，是分心嗎？`;
    $('#away-ask').hidden = false;
  });
  $('#away-ask').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.yes) distract('離開畫面');
    $('#away-ask').hidden = true;
  });
  window.addEventListener('beforeunload', e => { if (run) { e.preventDefault(); e.returnValue = ''; } });

  // 續算：重開頁面時若有進行中的回合
  (() => {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); } catch {}
    if (!saved) { renderSuggest(); renderGoal(); return; }
    if (saved.endAt <= Date.now()) { run = saved; finish(true); UI.toast('上回計時已在背景完成'); }
    else { begin(saved); UI.toast('接續上回計時'); }
  })();

  return { isRunning: () => !!run };
})();
