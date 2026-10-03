// 開工前狀態檢測：找數字（舒爾特方格）、顏色反應（Stroop）；結果都和自己近 10 次比
const Games = (() => {
  const $ = UI.$;
  UI.chips('#game-pick', 'game', g => {
    $('#game-schulte').hidden = g !== 'schulte';
    $('#game-stroop').hidden = g !== 'stroop';
  });
  const flash = (el, cls, ms = 500) => { el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); UI.vibrate(40); UI.beep(220, .08); };
  // 相對解讀：和近 10 次（不含本次）中位數比
  function relative(prev, cur, fmt) {
    if (prev.length < 2) return '多做幾次後，這裡會告訴你今天比平常快或慢。';
    const m = Store.median(prev), pct = Math.round((cur - m) / m * 100);
    if (Math.abs(pct) < 5) return `和你平常差不多（近 ${prev.length} 次中位 ${fmt(m)}）。`;
    return pct < 0 ? `比你平常快 ${-pct}%（中位 ${fmt(m)}），狀態不錯，可以直接坐。` : `比你平常慢 ${pct}%（中位 ${fmt(m)}），先做輕的事或呼吸 1 分鐘再坐。`;
  }

  // ---- 找數字（舒爾特方格）----
  (() => {
    let next = 1, t0 = 0, tick = null, wrong = 0, playing = false, lastTap = 0;
    const grid = $('#sch-grid');
    function build(shuffled) {
      const nums = [...Array(25)].map((_, i) => i + 1);
      if (shuffled) for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
      grid.innerHTML = nums.map(n => `<button data-n="${n}">${n}</button>`).join('');
    }
    function start() {
      build(true); grid.classList.remove('idle'); next = 1; wrong = 0; playing = true; t0 = Date.now(); lastTap = 0;
      $('#sch-result').textContent = ''; $('#sch-next').textContent = '下一個：1';
      $('#btn-sch').textContent = '重新開始';
      clearInterval(tick); tick = setInterval(() => ($('#sch-time').textContent = ((Date.now() - t0) / 1000).toFixed(1) + 's'), 100);
    }
    function tap(b) {
      if (!playing) return;
      const now = Date.now(); if (now - lastTap < 150) return; lastTap = now; // 連點不算
      const n = +b.dataset.n;
      if (n !== next) { wrong++; flash(b, 'wrong'); return; }
      b.classList.add('done'); next++;
      if (next > 25) {
        playing = false; clearInterval(tick);
        const ms = Date.now() - t0;
        $('#sch-time').textContent = (ms / 1000).toFixed(1) + 's';
        $('#sch-next').textContent = '完成';
        const prev = Store.get().games.filter(g => g.type === 'schulte').slice(-10).map(g => g.ms);
        Store.addGame({ date: Store.today(), type: 'schulte', ms, wrong }); Game.check();
        $('#sch-result').innerHTML = `${(ms / 1000).toFixed(1)} 秒，點錯 ${wrong} 次<br><small>${relative(prev, ms, v => (v / 1000).toFixed(1) + ' 秒')}</small>`;
        UI.beep(784, .15, 2);
      } else $('#sch-next').textContent = `下一個：${next}`;
    }
    build(true); grid.classList.add('idle');
    grid.addEventListener('click', e => { const b = e.target.closest('button'); b && tap(b); });
    $('#btn-sch').addEventListener('click', start);
  })();

  // ---- 顏色反應（Stroop）：40 題各半、注視點；正確 ≥36 且各條件 ≥15 有效題才算干擾量 ----
  (() => {
    const COLORS = { red: '紅', blue: '藍', green: '綠', yellow: '黃' };
    const keys = Object.keys(COLORS);
    const N = 40, MIN_OK = 36, MIN_VALID = 15;
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
    function answer(c, btn) {
      if (!playing || waiting) return;
      const rt = Date.now() - shownAt, ok = c === cur.ink;
      results.push({ cong: cur.cong, ok, rt });
      if (!ok) flash(btn, 'wrong');
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
      const vc = valid.filter(r => r.cong), vi = valid.filter(r => !r.cong);
      const avg = arr => arr.length ? Math.round(arr.reduce((a, r) => a + r.rt, 0) / arr.length) : null;
      const correct = results.filter(r => r.ok).length;
      const gate = correct >= MIN_OK && vc.length >= MIN_VALID && vi.length >= MIN_VALID;
      const cong = gate ? avg(vc) : null, incong = gate ? avg(vi) : null;
      const interference = gate ? incong - cong : null;
      const prev = Store.get().games.filter(g => g.type === 'stroop' && g.interference != null).slice(-10).map(g => g.interference);
      Store.addGame({ date: Store.today(), type: 'stroop', correct, total: N, congMs: cong, incongMs: incong, interference }); Game.check();
      word.textContent = '—'; word.className = 'stroop-word';
      $('#str-result').innerHTML = gate
        ? `正確 ${correct}/${N}<br>一致 ${cong} ms · 不一致 ${incong} ms<br>干擾量 <b>${interference} ms</b><br><small>${relative(prev, interference, v => Math.round(v) + ' ms')} 單次波動大，看趨勢就好。</small>`
        : `正確 ${correct}/${N}<br><small>正確率不足 ${MIN_OK}/${N} 或有效題數不夠，這次不算干擾量。放慢一點、看顏色不看字，再試一次。</small>`;
      $('#str-progress').textContent = '完成'; UI.beep(784, .15, 2);
    }
    $('#str-opts').addEventListener('click', e => { const b = e.target.closest('button'); b && answer(b.dataset.c, b); });
    $('#btn-str').addEventListener('click', start);
  })();

  return {};
})();
