// 開工前狀態檢測：舒爾特方格、Stroop
const Games = (() => {
  const $ = UI.$;
  UI.chips('#game-pick', 'game', g => {
    $('#game-schulte').hidden = g !== 'schulte';
    $('#game-stroop').hidden = g !== 'stroop';
  });
  const flash = (el, cls, ms = 600) => { el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); UI.vibrate(40); };

  // ---- 舒爾特方格 ----
  (() => {
    let next = 1, t0 = 0, tick = null, wrong = 0, playing = false;
    const grid = $('#sch-grid');
    function build(shuffled) {
      const nums = [...Array(25)].map((_, i) => i + 1);
      if (shuffled) for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
      grid.innerHTML = nums.map(n => `<button data-n="${n}">${n}</button>`).join('');
    }
    function start() {
      build(true); grid.classList.remove('idle'); next = 1; wrong = 0; playing = true; t0 = Date.now();
      $('#sch-result').textContent = ''; $('#sch-next').textContent = '下一個：1';
      $('#btn-sch').textContent = '重新開始';
      clearInterval(tick); tick = setInterval(() => ($('#sch-time').textContent = ((Date.now() - t0) / 1000).toFixed(1) + 's'), 100);
    }
    function tap(b) {
      if (!playing) return;
      const n = +b.dataset.n;
      if (n !== next) { wrong++; flash(b, 'wrong'); return; }
      b.classList.add('done'); next++;
      if (next > 25) {
        playing = false; clearInterval(tick);
        const ms = Date.now() - t0;
        $('#sch-time').textContent = (ms / 1000).toFixed(1) + 's';
        $('#sch-next').textContent = '完成';
        const best = Store.get().games.filter(g => g.type === 'schulte').reduce((m, g) => Math.min(m, g.ms), Infinity);
        Store.addGame({ date: Store.today(), type: 'schulte', ms, wrong });
        $('#sch-result').textContent = `${(ms / 1000).toFixed(1)} 秒，點錯 ${wrong} 次` + (ms < best ? ' · 最快一次' : '');
        UI.beep(784, .15, 2);
      } else $('#sch-next').textContent = `下一個：${next}`;
    }
    build(true); grid.classList.add('idle');
    grid.addEventListener('click', e => { const b = e.target.closest('button'); b && tap(b); });
    $('#btn-sch').addEventListener('click', start);
  })();

  // ---- Stroop：一致／不一致各半，40 題，注視點，回報干擾量 ----
  (() => {
    const COLORS = { red: '紅', blue: '藍', green: '綠', yellow: '黃' };
    const keys = Object.keys(COLORS);
    const N = 40;
    let trials = [], i = 0, cur = null, shownAt = 0, playing = false, waiting = false, results = [];
    const word = $('#str-word');
    function plan() {
      trials = [];
      for (let k = 0; k < N; k++) {
        const text = keys[Math.floor(Math.random() * 4)];
        let ink = text;
        if (k % 2) { do { ink = keys[Math.floor(Math.random() * 4)]; } while (ink === text); }
        trials.push({ text, ink, cong: ink === text });
      }
      for (let a = trials.length - 1; a > 0; a--) { const b = Math.floor(Math.random() * (a + 1)); [trials[a], trials[b]] = [trials[b], trials[a]]; }
    }
    function next() {
      if (i >= N) return finish();
      waiting = true; word.textContent = '+'; word.className = 'stroop-word fix';
      $('#str-progress').textContent = `${i + 1} / ${N}`;
      setTimeout(() => {
        if (!playing) return;
        cur = trials[i]; word.textContent = COLORS[cur.text]; word.className = 'stroop-word ' + cur.ink;
        shownAt = Date.now(); waiting = false;
      }, 400);
    }
    function answer(c) {
      if (!playing || waiting) return;
      const rt = Date.now() - shownAt, ok = c === cur.ink;
      results.push({ cong: cur.cong, ok, rt });
      if (!ok) flash(word, 'miss');
      $('#str-acc').textContent = `正確 ${results.filter(r => r.ok).length}`;
      i++; next();
    }
    function start() {
      plan(); i = 0; results = []; playing = true;
      $('#str-result').textContent = ''; $('#str-acc').textContent = '正確 0';
      $('#btn-str').textContent = '重新開始'; next();
    }
    function finish() {
      playing = false;
      const valid = results.filter(r => r.ok && r.rt >= 150 && r.rt <= 3000);
      const avg = arr => arr.length ? Math.round(arr.reduce((a, r) => a + r.rt, 0) / arr.length) : null;
      const cong = avg(valid.filter(r => r.cong)), incong = avg(valid.filter(r => !r.cong));
      const correct = results.filter(r => r.ok).length;
      const interference = cong != null && incong != null ? incong - cong : null;
      Store.addGame({ date: Store.today(), type: 'stroop', correct, total: N, congMs: cong, incongMs: incong, interference });
      word.textContent = '—'; word.className = 'stroop-word';
      $('#str-result').innerHTML = `正確 ${correct}/${N}<br>一致 ${cong ?? '—'} ms · 不一致 ${incong ?? '—'} ms<br>干擾量 <b>${interference ?? '—'} ms</b><small>（越小代表抑制越穩）</small>`;
      $('#str-progress').textContent = '完成'; UI.beep(784, .15, 2);
    }
    $('#str-opts').addEventListener('click', e => { const b = e.target.closest('button'); b && answer(b.dataset.c); });
    $('#btn-str').addEventListener('click', start);
  })();

  return {};
})();
