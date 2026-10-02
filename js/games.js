// 注意力小遊戲：舒爾特方格、Stroop
const Games = (() => {
  const $ = UI.$;
  UI.chips('#game-pick', 'game', g => {
    $('#game-schulte').hidden = g !== 'schulte';
    $('#game-stroop').hidden = g !== 'stroop';
  });

  // ---- 舒爾特方格 ----
  const Sch = (() => {
    let next = 1, t0 = 0, tick = null, wrong = 0, playing = false;
    const grid = $('#sch-grid');
    function build(shuffled) {
      const nums = [...Array(25)].map((_, i) => i + 1);
      if (shuffled) for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
      grid.innerHTML = nums.map(n => `<button data-n="${n}">${n}</button>`).join('');
    }
    function start() {
      build(true); next = 1; wrong = 0; playing = true; t0 = Date.now();
      $('#sch-result').textContent = ''; $('#sch-next').textContent = '下一個：1';
      $('#btn-sch').textContent = '重新開始';
      clearInterval(tick); tick = setInterval(() => ($('#sch-time').textContent = ((Date.now() - t0) / 1000).toFixed(1) + 's'), 100);
    }
    function tap(b) {
      if (!playing) return;
      const n = +b.dataset.n;
      if (n !== next) { wrong++; b.classList.add('wrong'); setTimeout(() => b.classList.remove('wrong'), 250); UI.vibrate(40); return; }
      b.classList.add('done'); next++;
      if (next > 25) {
        playing = false; clearInterval(tick);
        const ms = Date.now() - t0;
        $('#sch-time').textContent = (ms / 1000).toFixed(1) + 's';
        $('#sch-next').textContent = '完成';
        const best = Store.get().games.filter(g => g.type === 'schulte').reduce((m, g) => Math.min(m, g.ms), Infinity);
        Store.addGame({ date: Store.today(), type: 'schulte', ms, wrong });
        $('#sch-result').textContent = `${(ms / 1000).toFixed(1)} 秒，點錯 ${wrong} 次` + (ms < best ? ' 🎉 新紀錄' : '');
        UI.beep(784, .15, 2);
      } else $('#sch-next').textContent = `下一個：${next}`;
    }
    build(false);
    grid.addEventListener('click', e => { const b = e.target.closest('button'); b && tap(b); });
    $('#btn-sch').addEventListener('click', start);
    return {};
  })();

  // ---- Stroop ----
  const Str = (() => {
    const COLORS = { red: '紅', blue: '藍', green: '綠', yellow: '黃' };
    const keys = Object.keys(COLORS);
    const N = 20;
    let i = 0, correct = 0, rts = [], cur = null, shownAt = 0, playing = false;
    const word = $('#str-word');
    function next() {
      if (i >= N) return finish();
      const text = keys[Math.floor(Math.random() * 4)];
      // 70% 不一致（字義≠顏色）
      let ink = text;
      if (Math.random() < .7) { do { ink = keys[Math.floor(Math.random() * 4)]; } while (ink === text); }
      cur = ink; word.textContent = COLORS[text]; word.className = 'stroop-word ' + ink;
      shownAt = Date.now();
      $('#str-progress').textContent = `${i + 1} / ${N}`;
    }
    function answer(c) {
      if (!playing) return;
      rts.push(Date.now() - shownAt);
      if (c === cur) correct++;
      else { word.style.opacity = .3; setTimeout(() => (word.style.opacity = 1), 150); UI.vibrate(40); }
      $('#str-acc').textContent = `正確 ${correct}`;
      i++; next();
    }
    function start() {
      i = 0; correct = 0; rts = []; playing = true;
      $('#str-result').textContent = ''; $('#str-acc').textContent = '正確 0';
      $('#btn-str').textContent = '重新開始'; next();
    }
    function finish() {
      playing = false;
      const avg = Math.round(rts.reduce((a, b) => a + b, 0) / rts.length);
      Store.addGame({ date: Store.today(), type: 'stroop', correct, total: N, avgMs: avg });
      word.textContent = '—'; word.className = 'stroop-word';
      $('#str-result').textContent = `正確 ${correct}/${N}，平均反應 ${avg} ms`;
      $('#str-progress').textContent = '完成'; UI.beep(784, .15, 2);
    }
    $('#str-opts').addEventListener('click', e => { const b = e.target.closest('button'); b && answer(b.dataset.c); });
    $('#btn-str').addEventListener('click', start);
    return {};
  })();

  return {};
})();
