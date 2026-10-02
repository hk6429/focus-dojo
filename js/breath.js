// 呼吸引導：4-7-8 或方塊呼吸，圓圈隨階段縮放
const Breath = (() => {
  const $ = UI.$;
  const MODES = {
    '478': [['吸氣', 4, 1.6], ['憋住', 7, 1.6], ['吐氣', 8, 1]],
    'box': [['吸氣', 4, 1.6], ['憋住', 4, 1.6], ['吐氣', 4, 1], ['停住', 4, 1]],
  };
  let mode = '478', total = 60, running = false, timer = null, phaseTimer = null, endAt = 0;
  const getMode = UI.chips('#breath-mode', 'mode', v => (mode = v));
  const getLen = UI.chips('#breath-len', 'sec', v => (total = +v));
  const circle = $('#breath-circle'), phaseEl = $('#breath-phase'), leftEl = $('#breath-left');

  function setPhase(i) {
    const seq = MODES[mode], [name, sec, scale] = seq[i % seq.length];
    phaseEl.textContent = `${name} ${sec}`;
    circle.style.transitionDuration = sec + 's';
    circle.style.transform = `scale(${scale})`;
    let n = sec;
    const cd = setInterval(() => { n--; if (n > 0) phaseEl.textContent = `${name} ${n}`; else clearInterval(cd); }, 1000);
    phaseTimer = setTimeout(() => { clearInterval(cd); if (running) setPhase(i + 1); }, sec * 1000);
    UI.beep(name === '吸氣' ? 440 : 330, .08);
  }
  function start() {
    mode = getMode() || mode; total = +(getLen() || total);
    running = true; endAt = Date.now() + total * 1000;
    $('#btn-breath').textContent = '停止';
    setPhase(0);
    timer = setInterval(() => {
      const left = Math.ceil((endAt - Date.now()) / 1000);
      leftEl.textContent = `剩餘 ${UI.mmss(left)}`;
      if (left <= 0) stop(true);
    }, 250);
  }
  function stop(done) {
    const spent = total - Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    running = false; clearInterval(timer); clearTimeout(phaseTimer);
    circle.style.transitionDuration = '1s'; circle.style.transform = 'scale(1)';
    phaseEl.textContent = done ? '完成' : '準備'; leftEl.textContent = '';
    $('#btn-breath').textContent = '開始呼吸';
    if (spent >= 20) { Store.addBreath({ date: Store.today(), mode, seconds: done ? total : spent }); }
    if (done) { UI.beep(660, .2, 2); UI.toast('呼吸完成，去專注吧'); }
  }
  $('#btn-breath').addEventListener('click', () => (running ? stop(false) : start()));
  return {};
})();
