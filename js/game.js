// 遊戲化層：段位、徽章、每日試煉、語錄、主題、成果卡、挑戰連結、招式實驗
const Game = (() => {
  const $ = UI.$;
  const BELTS = [
    { id: 'white', name: '白帶', min: 0, accent: '#1f6f5f', accent2: '#2f9c86' },
    { id: 'yellow', name: '黃帶', min: 100, accent: '#b7791f', accent2: '#d9a441' },
    { id: 'green', name: '綠帶', min: 500, accent: '#2e7d32', accent2: '#4caf50' },
    { id: 'blue', name: '藍帶', min: 1500, accent: '#1f4e9c', accent2: '#3b7dd8' },
    { id: 'black', name: '黑帶', min: 4000, accent: '#1c1c1c', accent2: '#8a6d1f' },
  ];
  const DECAY_DAYS = 14, WARN_DAYS = 10;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const daysSince = date => { if (!date) return 0; const a = new Date(date + 'T00:00:00'), b = new Date(); b.setHours(0, 0, 0, 0); return Math.round((b - a) / 864e5); };

  // ---- 段位 ----
  function belt() {
    const total = Store.totalMin();
    let i = BELTS.findIndex((b, k) => total < (BELTS[k + 1]?.min ?? Infinity));
    const idle = daysSince(Store.lastCountedDate());
    const decayed = i > 0 && idle >= DECAY_DAYS;
    const shown = decayed ? i - 1 : i;
    const next = BELTS[i + 1];
    return { total, idx: i, shown, name: BELTS[shown].name, decayed, idle, next, toNext: next ? Math.ceil(next.min - total) : 0 };
  }
  function renderBelt() {
    const b = belt(), el = $('#belt-line');
    const warn = !b.decayed && b.idx > 0 && b.idle >= WARN_DAYS ? ` · 再 ${DECAY_DAYS - b.idle} 天不坐會降級` : '';
    el.innerHTML = `<b>${b.name}</b>${b.decayed ? '（降級中，回來坐即恢復）' : ''} · 累積 ${Math.round(b.total)} 分` + (b.next ? ` · 距${b.next.name} ${b.toNext} 分` : ' · 已至最高段') + warn;
    const pct = b.next ? Math.min(100, ((b.total - BELTS[b.idx].min) / (b.next.min - BELTS[b.idx].min)) * 100) : 100;
    $('#belt-bar').style.width = pct + '%';
  }

  // ---- 主題（依段位解鎖）----
  function applyTheme() {
    const id = Store.get().settings.theme || 'white';
    const b = BELTS.find(x => x.id === id) || BELTS[0];
    document.documentElement.style.setProperty('--accent', b.accent);
    document.documentElement.style.setProperty('--accent-2', b.accent2);
    document.querySelector('meta[name=theme-color]').content = b.accent;
  }
  function renderThemes() {
    const b = belt(), cur = Store.get().settings.theme;
    $('#theme-pick').innerHTML = BELTS.map((t, i) => `<button data-theme="${t.id}" class="${cur === t.id ? 'on' : ''}" ${i > b.idx ? 'disabled' : ''} style="--c:${t.accent2}"><i></i>${t.name}${i > b.idx ? ' 🔒' : ''}</button>`).join('');
  }

  // ---- 徽章 ----
  const BADGES = [
    ['first', '第一坐', '完成第一次計入的專注', d => d.sessions.some(Store.counts)],
    ['streak3', '連坐三日', '連續 3 天', () => Store.streak() >= 3],
    ['streak7', '連坐七日', '連續 7 天', () => Store.streak() >= 7],
    ['zero25', '清淨一坐', '25 分零分心', d => d.sessions.some(s => s.completed && s.actual >= 1500 && !s.distractions.length)],
    ['long60', '長坐', '完成 60 分一坐', d => d.sessions.some(s => s.completed && s.actual >= 3600)],
    ['early', '晨坐', '早上 7 點前開始', d => d.sessions.some(s => Store.counts(s) && new Date(s.start).getHours() < 7)],
    ['night', '夜坐', '晚上 10 點後開始', d => d.sessions.some(s => Store.counts(s) && new Date(s.start).getHours() >= 22)],
    ['park5', '停車高手', '累積停車 5 個念頭', d => d.sessions.reduce((a, s) => a + (s.parked || []).length, 0) >= 5],
    ['review10', '自省者', '10 坐有品質評分', d => d.sessions.filter(s => s.quality).length >= 10],
    ['intent5', '立意', '5 坐寫下意圖', d => d.sessions.filter(s => Store.counts(s) && (s.outcome || s.ifthen)).length >= 5],
    ['breath10', '吐納十回', '呼吸 10 次', d => d.breaths.length >= 10],
    ['stroop', '心如止水', 'Stroop 干擾量 <80 ms', d => d.games.some(g => g.type === 'stroop' && g.interference != null && g.interference < 80)],
    ['schulte', '眼明手快', '方格 25 秒內', d => d.games.some(g => g.type === 'schulte' && g.ms < 25000)],
    ['week', '週滿', '達成每週天數目標', d => Store.weekDone() >= d.settings.weekDays],
    ['trial7', '試煉七勝', '完成 7 次每日試煉', d => Object.keys(d.trials).length >= 7],
    ['exp3', '有效招式', '3 個招式驗證有效', d => d.sessions.filter(s => s.expResult === true).length >= 3],
    ['share', '以身作則', '分享過成果卡', d => !!d.badges.share],
    ['challenge', '赴約', '完成一次挑戰', d => d.sessions.some(s => s.challenge)],
    ['yellow', '黃帶', '累積 100 分', () => Store.totalMin() >= 100],
    ['green', '綠帶', '累積 500 分', () => Store.totalMin() >= 500],
    ['blue', '藍帶', '累積 1500 分', () => Store.totalMin() >= 1500],
    ['black', '黑帶', '累積 4000 分', () => Store.totalMin() >= 4000],
  ];
  function check() {
    const d = Store.get(); const got = [];
    BADGES.forEach(([id, name, , test]) => { if (!d.badges[id] && test(d)) { Store.earn(id); got.push(name); } });
    // 每日試煉
    const t = trial();
    if (!d.trials[Store.today()] && t.check(Store.todayCtx())) { Store.trialDone(Store.today()); got.push('試煉「' + t.name + '」'); UI.beep(880, .12, 3); }
    if (got.length) { UI.toast('🎖 獲得：' + got.join('、'), 3500); UI.vibrate([60, 40, 60, 40, 120]); }
    renderBelt(); renderTrial();
    return got;
  }
  function renderBadges() {
    const d = Store.get();
    $('#badge-grid').innerHTML = BADGES.map(([id, name, desc]) => `<div class="badge ${d.badges[id] ? 'got' : ''}"><b>${name}</b><span>${desc}</span>${d.badges[id] ? `<em>${d.badges[id].slice(5)}</em>` : ''}</div>`).join('');
    $('#badge-count').textContent = `${Object.keys(d.badges).length} / ${BADGES.length}`;
  }

  // ---- 每日試煉與語錄（依日期固定）----
  const seed = () => { const t = Store.today(); let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const trial = () => TRIALS[seed() % TRIALS.length];
  const quote = () => QUOTES[(seed() * 7) % QUOTES.length];
  function renderTrial() {
    const t = trial(), done = !!Store.get().trials[Store.today()];
    $('#trial-card').innerHTML = `<span class="tag">今日試煉</span><b>${t.name}</b><span>${t.desc}</span><em>${done ? '✔ 已達成' : '未達成'}</em>`;
    $('#trial-card').classList.toggle('done', done);
  }
  function renderQuote() { const [q, by] = quote(); $('#quote').innerHTML = `「${q}」<small>— ${by}</small>`; }

  // ---- 洞察解鎖（分心 10 次→時刻分布；30 次→黃金時段）----
  function renderInsights() {
    const ss = Store.get().sessions.filter(s => !s.aborted);
    const dist = ss.flatMap(s => s.distractions.map(x => ({ t: x.t, h: new Date(s.start).getHours() })));
    const el = $('#insights');
    const n = dist.length;
    let html = '';
    if (n < 10) html += `<p class="locked">🔒 累積 10 次分心後解鎖「你在第幾分鐘分心」（目前 ${n}）</p>`;
    else {
      const bins = [0, 0, 0, 0, 0]; dist.forEach(x => bins[Math.min(4, Math.floor(x.t / 300))]++);
      const max = Math.max(...bins);
      html += '<h4>你在第幾分鐘分心</h4>' + ['0–5', '5–10', '10–15', '15–20', '20+'].map((l, i) => `<div class="bar"><span>${l} 分</span><i style="width:${(bins[i] / max) * 100}%"></i><em>${bins[i]}</em></div>`).join('');
    }
    const counted = ss.filter(Store.counts);
    if (n < 30) html += `<p class="locked">🔒 累積 30 次分心後解鎖「黃金時段」（目前 ${n}）</p>`;
    else {
      const slots = { 早上: [0, 0], 下午: [0, 0], 晚上: [0, 0] };
      counted.forEach(s => { const h = new Date(s.start).getHours(); const k = h < 12 ? '早上' : h < 18 ? '下午' : '晚上'; slots[k][0] += s.actual / 60; slots[k][1] += s.distractions.length; });
      html += '<h4>黃金時段（每 25 分分心）</h4>' + Object.entries(slots).filter(([, v]) => v[0] >= 25).map(([k, v]) => `<div class="kv"><span>${k}</span><em>${(v[1] / (v[0] / 25)).toFixed(1)} 次</em></div>`).join('');
    }
    el.innerHTML = html;
  }

  // ---- 招式實驗：結束時選下回要試的招，下一坐結束時問有沒有效 ----
  function renderExperiment(lastId) {
    const d = Store.get();
    const prev = [...d.sessions].reverse().find(s => s.id !== lastId && s.experiment && s.expResult == null);
    const ask = $('#exp-ask');
    if (prev) { ask.hidden = false; ask.querySelector('span').textContent = `上回的招式「${prev.experiment}」有效嗎？`; ask.dataset.id = prev.id; }
    else ask.hidden = true;
    const sel = $('#exp-pick');
    sel.innerHTML = '<option value="">下回想試一招？（選填）</option>' + TIPS.map(t => `<option>${t.replace('下一坐試試：', '')}</option>`).join('') + '<option value="__custom">自己寫…</option>';
    $('#exp-custom').hidden = true; $('#exp-custom').value = '';
  }
  function renderMoves() {
    const ss = Store.get().sessions.filter(s => s.experiment && s.expResult != null);
    const ok = ss.filter(s => s.expResult), no = ss.filter(s => !s.expResult);
    $('#moves').innerHTML = ss.length ? (ok.length ? '<h4>有效招式</h4>' + [...new Set(ok.map(s => s.experiment))].map(x => `<div class="kv"><span>✔ ${esc(x)}</span></div>`).join('') : '') + (no.length ? '<h4>對我沒用</h4>' + [...new Set(no.map(s => s.experiment))].map(x => `<div class="kv"><span>✘ ${esc(x)}</span></div>`).join('') : '') : '<p class="empty">結束一坐時選「下回想試一招」，下一坐會問你有沒有效</p>';
  }

  // ---- 成果卡 ----
  async function shareCard(s) {
    const c = document.createElement('canvas'); c.width = c.height = 1080; const x = c.getContext('2d');
    const b = belt(), st = Store.get().settings;
    const bc = BELTS.find(t => t.id === st.theme) || BELTS[0];
    x.fillStyle = '#f6f4ef'; x.fillRect(0, 0, 1080, 1080);
    x.fillStyle = bc.accent; x.fillRect(0, 0, 1080, 220);
    x.fillStyle = '#fff'; x.font = 'bold 72px -apple-system, PingFang TC, Noto Sans TC, sans-serif'; x.fillText('專注道場', 80, 140);
    x.font = '40px -apple-system, PingFang TC, sans-serif'; x.fillText(st.name ? `${st.name} · ${b.name}` : b.name, 640, 140);
    x.fillStyle = '#1c1c1c'; x.font = 'bold 64px -apple-system, PingFang TC, sans-serif'; x.fillText(s.task.slice(0, 14), 80, 360);
    x.font = 'bold 200px -apple-system, sans-serif'; x.fillStyle = bc.accent; const numStr = String(Math.round(s.actual / 60)); x.fillText(numStr, 80, 620); const nw = x.measureText(numStr).width;
    x.font = '56px -apple-system, PingFang TC, sans-serif'; x.fillStyle = '#6b6b6b'; x.fillText('分鐘專注', 80 + nw + 30, 620);
    x.fillText(`分心 ${s.distractions.length} 次${s.quality ? ' · 品質 ' + '★'.repeat(s.quality) : ''}`, 80, 720);
    if (s.outcome) x.fillText(`做完：${s.outcome.slice(0, 18)}`, 80, 800);
    x.font = '36px -apple-system, PingFang TC, sans-serif'; x.fillStyle = '#9a9a96';
    x.fillText(`${s.date} · 累積 ${Math.round(b.total)} 分 · focus-dojo.pages.dev`, 80, 1000);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const file = new File([blob], `focus-${s.date}.png`, { type: 'image/png' });
    const link = challengeLink(s);
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: '專注道場', text: `${s.task} ${Math.round(s.actual / 60)} 分、分心 ${s.distractions.length} 次。來挑戰：${link}` }); Store.earn('share'); check(); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: file.name }); a.click();
    try { await navigator.clipboard.writeText(link); UI.toast('成果卡已下載，挑戰連結已複製'); } catch { UI.toast('成果卡已下載'); }
    Store.earn('share'); check();
  }

  // ---- 挑戰連結（無後端：成績編進網址）----
  const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
  function challengeLink(s) {
    const payload = { n: Store.get().settings.name || '一位同修', t: s.task.slice(0, 20), m: Math.round(s.actual / 60), d: s.distractions.length };
    return location.origin + location.pathname + '#c=' + b64(JSON.stringify(payload));
  }
  const PKEY = 'focus-dojo-challenge';
  let pending = null;
  try { pending = JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch {}
  const setPending = v => { pending = v; try { v ? localStorage.setItem(PKEY, JSON.stringify(v)) : localStorage.removeItem(PKEY); } catch {} };
  function readChallenge() {
    const m = location.hash.match(/#c=([\w-]+)/); if (!m) return;
    try {
      const c = JSON.parse(unb64(m[1])); if (!c.m) return;
      pending = c;
      $('#challenge').hidden = false;
      $('#challenge-text').textContent = `${c.n} 邀你挑戰：「${c.t}」${c.m} 分，分心 ${c.d} 次。接受就一起坐同樣時長，看誰分心少。`;
    } catch {}
    history.replaceState(null, '', location.pathname);
  }
  function acceptChallenge() {
    if (!pending) return;
    $('#task-input').value = pending.t; $('#minute-custom').value = pending.m; $('#minute-custom').dispatchEvent(new Event('input'));
    setPending(pending); $('#challenge').hidden = true; UI.toast('已接受，按開始專注');}
  function resolveChallenge(s) {
    if (!pending) return '';
    const win = s.distractions.length < pending.d, tie = s.distractions.length === pending.d;
    const r = { from: pending.n, theirD: pending.d, win };
    Store.updateSession(s.id, { challenge: r }); setPending(null);
    return win ? `你分心 ${s.distractions.length} 次，贏了 ${r.from} 的 ${r.theirD} 次 🏆` : tie ? `和 ${r.from} 打平，各 ${r.theirD} 次` : `${r.from} 分心 ${r.theirD} 次，這回他贏；再坐一回？`;
  }

  // ---- 自訂分心原因 ----
  function renderReasons() {
    const custom = Store.get().settings.customReasons || [];
    const box = $('#focus-running .reasons');
    box.querySelectorAll('[data-custom]').forEach(x => x.remove());
    custom.forEach(r => box.insertAdjacentHTML('beforeend', `<button data-reason="${esc(r)}" data-custom="1">✎ ${esc(r)}</button>`));
    box.style.gridTemplateColumns = `repeat(${Math.min(4, 4 + custom.length)}, 1fr)`;
    $('#custom-list').innerHTML = custom.map((r, i) => `<span class="chip">${esc(r)}<button data-del="${i}">×</button></span>`).join('') || '<span class="hint">還沒有自訂原因</span>';
  }

  // ---- 道場頁、入門 ----
  function renderDojo() {
    const st = Store.get().settings;
    $('#dojo-name').value = st.name; $('#dojo-mission').value = st.mission;
    $('#mission-line').textContent = st.mission ? `「${st.mission}」` : '';
    renderBelt(); renderThemes(); renderBadges(); renderInsights(); renderMoves(); renderReasons(); renderTrial();
  }
  function onboarding() {
    if (Store.get().settings.onboarded) return;
    $('#onboard').hidden = false;
  }

  // ---- 事件 ----
  $('#theme-pick').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; Store.setSetting('theme', b.dataset.theme); applyTheme(); renderThemes(); });
  $('#dojo-name').addEventListener('change', e => Store.setSetting('name', e.target.value.trim().slice(0, 12)));
  $('#dojo-mission').addEventListener('change', e => { Store.setSetting('mission', e.target.value.trim().slice(0, 40)); renderDojo(); });
  $('#custom-add').addEventListener('click', () => {
    const v = $('#custom-input').value.trim().slice(0, 6); if (!v) return;
    const c = Store.get().settings.customReasons || []; if (c.length >= 4 || c.includes(v)) return UI.toast('最多 4 個，且不可重複');
    Store.setSetting('customReasons', [...c, v]); $('#custom-input').value = ''; renderReasons();
  });
  $('#custom-list').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; const c = [...Store.get().settings.customReasons]; c.splice(+b.dataset.del, 1); Store.setSetting('customReasons', c); renderReasons(); });
  $('#onboard-go').addEventListener('click', () => {
    Store.setSetting('name', $('#ob-name').value.trim().slice(0, 12)); Store.setSetting('mission', $('#ob-mission').value.trim().slice(0, 40)); Store.setSetting('onboarded', true);
    $('#onboard').hidden = true; renderDojo();
  });
  $('#challenge-accept').addEventListener('click', acceptChallenge);
  $('#challenge-skip').addEventListener('click', () => { setPending(null); $('#challenge').hidden = true; });
  $('#exp-pick').addEventListener('change', e => { $('#exp-custom').hidden = e.target.value !== '__custom'; });
  $('#exp-ask').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Store.updateSession($('#exp-ask').dataset.id, { expResult: b.dataset.yes === '1' }); $('#exp-ask').hidden = true; check(); });

  applyTheme(); renderQuote(); readChallenge(); onboarding();
  document.addEventListener('store:change', () => { renderBelt(); renderTrial(); if ($('#view-dojo').classList.contains('active')) renderDojo(); });
  renderBelt(); renderTrial(); renderReasons();

  return {
    check, renderDojo, shareCard, resolveChallenge, renderExperiment,
    experimentValue() { const v = $('#exp-pick').value; return v === '__custom' ? $('#exp-custom').value.trim().slice(0, 40) : v; },
    tip() { return TIPS[Math.floor(Math.random() * TIPS.length)]; },
  };
})();
