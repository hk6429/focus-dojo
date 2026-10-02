// 專注計時：以結束時刻為準，背景也不漂移
const Timer = (() => {
  const $ = UI.$;
  let plannedMin = 25, endAt = 0, startAt = 0, tick = null, distractions = [], task = '', running = false;
  const CIRC = 2 * Math.PI * 90;

  const getMin = UI.chips('#minute-chips', 'min', v => { plannedMin = +v; $('#minute-custom').value = ''; });
  $('#minute-custom').addEventListener('input', e => {
    const v = +e.target.value;
    if (v >= 1 && v <= 180) { plannedMin = v; UI.$$('#minute-chips button').forEach(b => b.classList.remove('on')); }
  });

  function show(which) {
    ['setup', 'running', 'done'].forEach(k => ($(`#focus-${k}`).hidden = k !== which));
  }
  function render() {
    const left = (endAt - Date.now()) / 1000;
    $('#run-clock').textContent = UI.mmss(left);
    const total = plannedMin * 60;
    $('#ring-fg').style.strokeDashoffset = CIRC * (1 - Math.max(0, left) / total);
    document.title = running ? `${UI.mmss(left)} · 專注道場` : '專注道場';
    if (left <= 0) finish(true);
  }
  function start() {
    task = $('#task-input').value.trim() || '未命名任務';
    plannedMin = +(getMin() || plannedMin);
    distractions = []; startAt = Date.now(); endAt = startAt + plannedMin * 60000; running = true;
    $('#run-task').textContent = task; $('#run-dist').textContent = '0';
    $('#ring-fg').style.strokeDashoffset = 0;
    show('running'); render(); tick = setInterval(render, 500);
    UI.beep(520, .1);
  }
  function distract(reason) {
    if (!running) return;
    distractions.push({ t: Math.round((Date.now() - startAt) / 1000), reason });
    $('#run-dist').textContent = distractions.length;
    UI.vibrate(30);
  }
  function stop() { running = false; clearInterval(tick); tick = null; document.title = '專注道場'; }
  function finish(completed) {
    if (!running) return;
    stop();
    const actual = Math.min(plannedMin * 60, Math.round((Date.now() - startAt) / 1000));
    Store.addSession({ date: Store.today(), start: startAt, task, planned: plannedMin * 60, actual, completed, distractions });
    $('#done-summary').textContent = `${task} · 專注 ${Math.round(actual / 60)} 分鐘 · 分心 ${distractions.length} 次` + (completed ? '' : '（提早結束）');
    show('done');
    UI.beep(784, .2, completed ? 3 : 1); UI.vibrate([80, 60, 80]);
  }
  function abort() {
    if (!running) return;
    stop(); show('setup'); UI.toast('已放棄，這回不計入');
  }

  $('#btn-start').addEventListener('click', start);
  $('#btn-finish').addEventListener('click', () => finish(false));
  $('#btn-abort').addEventListener('click', abort);
  $('#btn-again').addEventListener('click', () => show('setup'));
  $('#focus-running .reasons').addEventListener('click', e => {
    const b = e.target.closest('button'); b && distract(b.dataset.reason);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running) distract('離開畫面');
  });
  window.addEventListener('beforeunload', e => { if (running) { e.preventDefault(); e.returnValue = ''; } });

  return { isRunning: () => running };
})();
