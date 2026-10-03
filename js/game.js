// 遊戲化層：段位、徽章、今日小任務、語錄、主題、成果卡、同坐邀約、招式實驗
const Game = (() => {
  const $ = UI.$;
  const BELTS = [
    { id: 'white', name: '白帶', min: 0, accent: '#1f6f5f', accent2: '#2f9c86' },
    { id: 'yellow', name: '黃帶', min: 100, accent: '#b7791f', accent2: '#d9a441' },
    { id: 'green', name: '綠帶', min: 500, accent: '#2e7d32', accent2: '#4caf50' },
    { id: 'blue', name: '藍帶', min: 1500, accent: '#1f4e9c', accent2: '#3b7dd8' },
    { id: 'black', name: '黑帶', min: 4000, accent: '#1c1c1c', accent2: '#8a6d1f' },
  ];
  const DECAY_DAYS = 14, WARN_DAYS = 12;
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
    el.innerHTML = `<b>${b.name}</b>${b.decayed ? '（暫時往回一格，回來坐一次就恢復）' : ''} · 累積 ${Math.round(b.total)} 分鐘` + (b.next ? ` · 距${b.next.name}還差 ${b.toNext} 分鐘` : ' · 已至最高段');
    const pct = b.next ? Math.min(100, ((b.total - BELTS[b.idx].min) / (b.next.min - BELTS[b.idx].min)) * 100) : 100;
    $('#belt-bar').style.width = pct + '%';
  }

  // ---- 主題（依段位解鎖）＋深淺色 ----
  function applyTheme() {
    const st = Store.get().settings;
    const b = BELTS.find(x => x.id === (st.theme || 'white')) || BELTS[0];
    document.documentElement.style.setProperty('--accent', b.accent);
    document.documentElement.style.setProperty('--accent-2', b.accent2);
    document.querySelector('meta[name=theme-color]').content = b.accent;
    const dark = st.dark || 'auto';
    if (dark === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = dark;
  }
  function renderThemes() {
    const b = belt(), st = Store.get().settings;
    $('#theme-pick').innerHTML = BELTS.map((t, i) => `<button data-theme="${t.id}" class="${st.theme === t.id ? 'on' : ''}" ${i > b.idx ? 'disabled' : ''} style="--c:${t.accent2}"><i></i>${t.name}${i > b.idx ? ' 🔒' : ''}</button>`).join('');
    UI.$$('#dark-pick button').forEach(x => x.classList.toggle('on', x.dataset.dark === (st.dark || 'auto')));
    const note = $('#decay-note');
    if (b.decayed) note.textContent = `已 ${b.idle} 天沒坐，段位暫時往回一格；回來坐一次就恢復。`;
    else if (b.idx > 0 && b.idle >= WARN_DAYS) note.textContent = `已 ${b.idle} 天沒坐；超過 ${DECAY_DAYS} 天段位會暫時往回一格，回來坐一次就恢復。`;
    else note.textContent = '';
  }

  // ---- 徽章：只獎勵「有沒有做、做了幾次」，不獎勵自我申報的分心次數 ----
  const BADGES = [
    ['first', '🌱', '第一坐', '第一次做滿 5 分鐘', d => d.sessions.some(Store.counts)],
    ['ten', '🪑', '十坐', '累積 10 坐計入', d => d.sessions.filter(Store.counts).length >= 10],
    ['streak3', '🔥', '連坐三日', '連續 3 天', () => Store.streak() >= 3],
    ['streak7', '🔥', '連坐七日', '連續 7 天', () => Store.streak() >= 7],
    ['long60', '⏳', '長坐', '做滿 60 分一坐', d => d.sessions.some(s => Store.counts(s) && s.completed && s.actual >= 3600)],
    ['early', '🌅', '晨坐', '早上 7 點前開始一坐', d => d.sessions.some(s => Store.counts(s) && new Date(s.start).getHours() < 7)],
    ['park5', '🅿️', '停車高手', '計入的回合裡停車 5 個念頭', d => d.sessions.filter(Store.counts).reduce((a, s) => a + (s.parked || []).length, 0) >= 5],
    ['review10', '🪞', '自省者', '10 坐有品質評分', d => d.sessions.filter(s => Store.counts(s) && s.quality).length >= 10],
    ['intent5', '🎯', '立意', '5 坐寫下意圖', d => d.sessions.filter(s => Store.counts(s) && (s.outcome || s.ifthen)).length >= 5],
    ['breath10', '🌬', '吐納十回', '呼吸 10 次，每次 ≥1 分', d => d.breaths.filter(b => b.seconds >= 60).length >= 10],
    ['stroop5', '🎨', '色字五回', '做過 5 次顏色反應（正確 ≥36）', d => d.games.filter(g => g.type === 'stroop' && g.correct >= 36).length >= 5],
    ['schulte5', '🔢', '找數五回', '做過 5 次找數字（點錯 ≤2）', d => d.games.filter(g => g.type === 'schulte' && g.wrong <= 2).length >= 5],
    ['week', '📅', '週滿', '達成每週天數目標', d => Store.weekDone() >= d.settings.weekDays],
    ['trial7', '✅', '任務七勝', '完成 7 次今日小任務', d => Object.keys(d.trials).length >= 7],
    ['exp3', '🧪', '有效招式', '3 個招式驗證有效', d => d.sessions.filter(s => s.expResult === true).length >= 3],
    ['share', '📤', '以身作則', '分享過成果卡', d => !!d.badges.share],
    ['together', '🤝', '同坐', '完成一次同坐邀約', d => d.sessions.some(s => s.challenge)],
    ['yellow', '🟡', '黃帶', '累積 100 分鐘', () => Store.totalMin() >= 100],
    ['green', '🟢', '綠帶', '累積 500 分鐘', () => Store.totalMin() >= 500],
    ['blue', '🔵', '藍帶', '累積 1500 分鐘', () => Store.totalMin() >= 1500],
    ['black', '⚫', '黑帶', '累積 4000 分鐘', () => Store.totalMin() >= 4000],
    ['hundred', '💯', '百坐', '累積 100 坐計入', d => d.sessions.filter(Store.counts).length >= 100],
  ];
  function check() {
    const d = Store.get(); const got = [];
    BADGES.forEach(([id, , name, , test]) => { if (!d.badges[id] && test(d)) { Store.earn(id); got.push(name); } });
    const t = trial();
    if (!d.trials[Store.today()] && t.check(Store.todayCtx())) { Store.trialDone(Store.today()); got.push('小任務「' + t.name + '」'); UI.beep(880, .12, 3); }
    if (got.length) { UI.toast('🎖 獲得：' + got.join('、'), 3500); UI.vibrate([60, 40, 60, 40, 120]); }
    renderBelt(); renderTrial();
    return got;
  }
  function renderBadges() {
    const d = Store.get();
    $('#badge-grid').innerHTML = BADGES.map(([id, icon, name, desc]) => `<div class="badge ${d.badges[id] ? 'got' : ''}"><i>${icon}</i><b>${name}</b><span>${desc}</span>${d.badges[id] ? `<em>${d.badges[id].slice(5)}</em>` : ''}</div>`).join('');
    $('#badge-count').textContent = `${Object.keys(d.badges).length} / ${BADGES.length}`;
  }

  // ---- 今日小任務與語錄（依日期固定）----
  const seed = () => { const t = Store.today(); let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const trial = () => TRIALS[seed() % TRIALS.length];
  const quote = () => QUOTES[(seed() * 7) % QUOTES.length];
  function renderTrial() {
    const t = trial(), done = !!Store.get().trials[Store.today()];
    $('#trial-card').innerHTML = `<span class="tag">今日小任務</span><b>${t.name}</b><span>${t.desc}</span><em>${done ? '✔ 達成' : '進行中'}</em>`;
    $('#trial-card').classList.toggle('done', done);
  }
  function renderQuote() { const [q, by] = quote(); $('#quote').innerHTML = `「${q}」<small>— ${by}</small>`; }

  // ---- 洞察：依計畫長度動態分桶；黃金時段按 2 小時、累積 300 分鐘解鎖；時長比較 ----
  function renderInsights() {
    const ss = Store.get().sessions.filter(Store.counts);
    const dist = ss.flatMap(s => s.distractions.map(x => ({ t: x.t })));
    const n = dist.length, total = Store.totalMin();
    let html = '';
    if (n < 10) html += `<p class="locked">🔒 累積 10 次分心後解鎖「你在第幾分鐘分心」（目前 ${n}）</p>`;
    else {
      const maxP = Math.max(...ss.map(s => s.planned)), nb = Math.min(9, Math.max(1, Math.ceil(maxP / 600)));
      const bins = Array(nb).fill(0); dist.forEach(x => bins[Math.min(nb - 1, Math.floor(x.t / 600))]++);
      const max = Math.max(...bins);
      html += '<h4>你在第幾分鐘分心</h4>' + bins.map((v, i) => `<div class="bar"><span>${i * 10}–${i === nb - 1 && maxP > nb * 600 ? '' : (i + 1) * 10}${i === nb - 1 && maxP > nb * 600 ? '+' : ''} 分</span><i style="width:${(v / max) * 100}%"></i><em>${v}</em></div>`).join('');
    }
    if (total < 300) html += `<p class="locked">🔒 累積 300 分鐘後解鎖「黃金時段」（目前 ${Math.round(total)}）</p>`;
    else {
      const slots = {};
      ss.forEach(s => { const h = Math.floor(new Date(s.start).getHours() / 2) * 2; (slots[h] ||= [0, 0]); slots[h][0] += s.actual / 60; slots[h][1] += s.distractions.length; });
      const rows = Object.entries(slots).filter(([, v]) => v[0] >= 50).sort((a, b) => +a[0] - +b[0]);
      html += '<h4>黃金時段（每小時分心次數，累積 ≥50 分的時段）</h4>' + (rows.length ? rows.map(([k, v]) => `<div class="kv"><span>${k}–${+k + 2} 時</span><em>${(v[1] / (v[0] / 60)).toFixed(1)} 次</em></div>`).join('') : '<p class="empty">還沒有單一時段累積到 50 分</p>');
    }
    const groups = {};
    ss.forEach(s => { const k = Math.round(s.planned / 60); (groups[k] ||= []).push(s); });
    const rows = Object.entries(groups).filter(([, v]) => v.length >= 3).sort((a, b) => +a[0] - +b[0]);
    if (rows.length) {
      html += '<h4>哪個長度最適合你</h4><div class="kv head"><span>長度</span><em>做滿率 · 每小時分心 · 品質</em></div>' + rows.map(([k, v]) => {
        const done = v.filter(s => s.completed).length, mins = v.reduce((a, s) => a + s.actual / 60, 0), d = v.reduce((a, s) => a + s.distractions.length, 0);
        const q = v.filter(s => s.quality); const qa = q.length ? (q.reduce((a, s) => a + s.quality, 0) / q.length).toFixed(1) + '★' : '—';
        return `<div class="kv"><span>${k} 分（${v.length} 坐）</span><em>${Math.round(done / v.length * 100)}% · ${(d / (mins / 60)).toFixed(1)} · ${qa}</em></div>`;
      }).join('');
    } else html += `<p class="locked">🔒 同一長度做 3 坐以上，會比較「哪個長度最適合你」</p>`;
    $('#insights').innerHTML = html;
  }

  // ---- 招式實驗 ----
  function renderExperiment(lastId, counted) {
    const d = Store.get();
    const prev = counted && [...d.sessions].reverse().find(s => s.id !== lastId && s.experiment && s.expResult == null);
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

  // ---- 成果卡：先預覽，再分享；可隱藏任務名 ----
  let shareS = null, shareBlob = null;
  function drawCard(s, hideTask, story) {
    const c = document.createElement('canvas'); c.width = 1080; c.height = story ? 1920 : 1080; const x = c.getContext('2d');
    const b = belt(), st = Store.get().settings;
    const bc = BELTS.find(t => t.id === st.theme) || BELTS[0];
    const top = story ? 420 : 0, F = '-apple-system, PingFang TC, Noto Sans TC, sans-serif';
    x.fillStyle = '#f6f4ef'; x.fillRect(0, 0, 1080, c.height);
    x.fillStyle = bc.accent; x.fillRect(0, top, 1080, 220);
    x.fillStyle = '#fff'; x.font = 'bold 72px ' + F; x.fillText('專注道場', 80, top + 140);
    x.font = '40px ' + F; x.fillText(st.name ? `${st.name} · ${b.name}` : b.name, 640, top + 140);
    x.fillStyle = '#1c1c1c'; x.font = 'bold 64px ' + F; x.fillText(hideTask ? '一段專注' : (s.subject ? s.subject + ' · ' : '') + s.task.slice(0, 12), 80, top + 360);
    x.font = 'bold 200px ' + F; x.fillStyle = bc.accent; const numStr = String(Math.round(s.actual / 60)); x.fillText(numStr, 80, top + 620); const nw = x.measureText(numStr).width;
    x.font = '56px ' + F; x.fillStyle = '#6b6b6b'; x.fillText('分鐘專注', 80 + nw + 30, top + 620);
    x.fillText(`分心 ${s.distractions.length} 次${s.quality ? ' · 品質 ' + '★'.repeat(s.quality) : ''}`, 80, top + 720);
    const got = Object.keys(Store.get().badges).length;
    x.fillText(`本週 ${Store.weekDone()} 天 · 徽章 ${got} 枚`, 80, top + 800);
    x.font = '36px ' + F; x.fillStyle = '#9a9a96';
    x.fillText(`${s.date} · 累積 ${Math.round(b.total)} 分 · focus-dojo.pages.dev`, 80, top + 1000);
    return c;
  }
  async function renderCard() {
    const c = drawCard(shareS, $('#share-hide').checked, ($('#card-format button.on') || {}).dataset?.fmt === 'story');
    $('#card-img').src = c.toDataURL('image/png');
    shareBlob = await new Promise(r => c.toBlob(r, 'image/png'));
  }
  function openShare(s) {
    shareS = s; const box = $('#share-box');
    box.hidden = !box.hidden; if (box.hidden) return;
    renderCard().then(() => box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }
  const summaryLine = s => `${s.date.slice(5).replace('-', '/')} ${new Date(s.start).toTimeString().slice(0, 5)} ${s.task} ${Math.round(s.actual / 60)}分 分心${s.distractions.length}${s.quality ? ' ★' + s.quality : ''}`;
  async function sendCard() {
    if (!shareS || !shareBlob) return;
    const file = new File([shareBlob], `focus-${shareS.date}.png`, { type: 'image/png' });
    const link = inviteLink(shareS), st = Store.get().settings;
    const text = `${st.name || '我'}坐了 ${Math.round(shareS.actual / 60)} 分鐘，邀你同坐一回：${link}`;
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: '專注道場', text }); UI.toast('已分享'); Store.earn('share'); check(); return; }
    } catch (e) { if (e.name === 'AbortError') { UI.toast('已取消分享'); return; } }
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(shareBlob), download: file.name }); a.click();
    try { await navigator.clipboard.writeText(text); UI.toast('成果卡已下載，邀約文字已複製'); } catch { UI.toast('成果卡已下載'); }
    Store.earn('share'); check();
  }
  async function copySummary() {
    if (!shareS) return;
    try { await navigator.clipboard.writeText(summaryLine(shareS)); UI.toast('已複製一行摘要'); } catch { UI.toast('複製失敗，請長按卡片下方文字'); }
  }

  // ---- 同坐邀約（無後端；只帶稱呼與分鐘數，不比輸贏）----
  const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
  const clampMin = m => Math.min(180, Math.max(5, Math.round(+m || 0)));
  function inviteLink(s) {
    const payload = { n: (Store.get().settings.name || '一位同修').slice(0, 12), m: clampMin(Math.max(5, s.actual / 60)) };
    return location.origin + location.pathname + '#c=' + b64(JSON.stringify(payload));
  }
  const PKEY = 'focus-dojo-challenge';
  let pending = null, offer = null;
  try { pending = JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch {}
  const setPending = v => { pending = v; try { v ? localStorage.setItem(PKEY, JSON.stringify(v)) : localStorage.removeItem(PKEY); } catch {} };
  function readChallenge() {
    const m = location.hash.match(/#c=([\w-]+)/); if (!m) return;
    try {
      const c = JSON.parse(unb64(m[1]));
      const mins = clampMin(c.m); if (!Number.isFinite(+c.m) || +c.m < 5 || +c.m > 180) throw 0;
      offer = { n: String(c.n || '一位同修').slice(0, 12), m: mins };
      $('#challenge').hidden = false;
      $('#challenge-text').textContent = `${offer.n} 邀你同坐 ${offer.m} 分鐘。接受後一起坐同樣時長，不比輸贏，坐滿就算赴約。`;
    } catch { UI.toast('這個邀約連結無效'); }
    history.replaceState(null, '', location.pathname);
  }
  function acceptChallenge() {
    if (!offer) return;
    $('#minute-custom').value = offer.m; $('#minute-custom').dispatchEvent(new Event('input'));
    setPending(offer); offer = null; $('#challenge').hidden = true; UI.toast('已接受，寫下任務後按開始');
  }
  function resolveChallenge(s) {
    if (!pending) return '';
    if (s.planned !== pending.m * 60) return '';
    const from = pending.n, m = pending.m; setPending(null);
    if (!Store.counts(s)) return `這回和 ${from} 的同坐沒坐滿 5 分，下次再約。`;
    Store.updateSession(s.id, { challenge: { from, m } });
    return `和 ${from} 同坐 ${m} 分完成 🤝`;
  }

  // ---- 自訂分心原因 ----
  function renderReasons() {
    const custom = Store.get().settings.customReasons || [];
    const box = $('#focus-running .reasons');
    box.querySelectorAll('[data-custom]').forEach(x => x.remove());
    custom.forEach(r => box.insertAdjacentHTML('beforeend', `<button data-reason="${esc(r)}" data-custom="1">✎ ${esc(r)}</button>`));
    $('#custom-list').innerHTML = custom.map((r, i) => `<span class="chip">${esc(r)}<button data-del="${i}">×</button></span>`).join('') || '<span class="hint">還沒有自訂原因</span>';
  }

  // ---- 道場頁、入門 ----
  function renderDojo() {
    const st = Store.get().settings;
    $('#dojo-name').value = st.name; $('#dojo-mission').value = st.mission;
    $('#mission-line').textContent = st.mission ? `「${st.mission}」` : '';
    renderBelt(); renderThemes(); renderBadges(); renderInsights(); renderMoves(); renderReasons(); renderTrial(); renderSubjectsBlocks();
  }
  function onboarding() {
    if (Store.get().settings.onboarded) return;
    $('#onboard').hidden = false;
  }

  // ---- 事件 ----
  $('#theme-pick').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; Store.setSetting('theme', b.dataset.theme); applyTheme(); renderThemes(); });
  $('#dark-pick').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Store.setSetting('dark', b.dataset.dark); applyTheme(); renderThemes(); });
  $('#dojo-name').addEventListener('change', e => Store.setSetting('name', e.target.value.trim().slice(0, 12)));
  $('#dojo-mission').addEventListener('change', e => { Store.setSetting('mission', e.target.value.trim().slice(0, 40)); renderDojo(); });
  const addReason = v => {
    v = v.trim().slice(0, 6); if (!v) return false;
    const c = Store.get().settings.customReasons || []; if (c.length >= 4 || c.includes(v)) { UI.toast('最多 4 個，且不可重複'); return false; }
    Store.setSetting('customReasons', [...c, v]); return true;
  };
  $('#custom-add').addEventListener('click', () => { if (addReason($('#custom-input').value)) { $('#custom-input').value = ''; renderReasons(); } });
  $('#custom-list').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; const c = [...Store.get().settings.customReasons]; c.splice(+b.dataset.del, 1); Store.setSetting('customReasons', c); renderReasons(); });
  $('#ob-reasons').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const on = UI.$$('#ob-reasons button.on');
    if (!b.classList.contains('on') && on.length >= 4) return UI.toast('最多選 4 個');
    b.classList.toggle('on');
  });
  $('#onboard-go').addEventListener('click', () => {
    Store.setSetting('name', $('#ob-name').value.trim().slice(0, 12)); Store.setSetting('mission', $('#ob-mission').value.trim().slice(0, 40));
    Store.setSetting('customReasons', UI.$$('#ob-reasons button.on').map(b => b.dataset.r).slice(0, 4));
    Store.setSetting('onboarded', true);
    $('#onboard').hidden = true; renderDojo();
  });
  $('#challenge-accept').addEventListener('click', acceptChallenge);
  $('#challenge-skip').addEventListener('click', () => { offer = null; $('#challenge').hidden = true; });
  $('#exp-pick').addEventListener('change', e => { $('#exp-custom').hidden = e.target.value !== '__custom'; });
  $('#exp-ask').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Store.updateSession($('#exp-ask').dataset.id, { expResult: b.dataset.yes === '1' }); $('#exp-ask').hidden = true; check(); });
  $('#share-hide').addEventListener('change', renderCard);
  UI.chips('#card-format', 'fmt', renderCard);
  // ---- 科目／排程編輯 ----
  function renderSubjectsBlocks() {
    const st = Store.get().settings;
    $('#subject-list').innerHTML = (st.subjects || []).map((r, i) => `<span class="chip">${esc(r)}<button data-del="${i}">×</button></span>`).join('') || '<span class="hint">還沒有科目</span>';
    const blocks = [...(st.blocks || [])].sort((a, b) => a.time.localeCompare(b.time));
    $('#block-list').innerHTML = blocks.length ? blocks.map(b => `<div class="kv"><span>⏰ ${b.time} · ${b.min} 分</span><em><button class="link" data-del-block="${b.time}">移除</button></em></div>`).join('') : '<p class="empty">還沒有排程</p>';
    $('#btn-notify').hidden = !('Notification' in window) || Notification.permission === 'granted' || !blocks.length;
  }
  $('#subject-add').addEventListener('click', () => {
    const v = $('#subject-input').value.trim().slice(0, 6); if (!v) return;
    const c = Store.get().settings.subjects || []; if (c.length >= 8 || c.includes(v)) return UI.toast('最多 8 個，且不可重複');
    Store.setSetting('subjects', [...c, v]); $('#subject-input').value = ''; renderSubjectsBlocks();
  });
  $('#subject-list').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; const c = [...Store.get().settings.subjects]; c.splice(+b.dataset.del, 1); Store.setSetting('subjects', c); renderSubjectsBlocks(); });
  $('#block-add').addEventListener('click', () => {
    const time = $('#block-time').value, min = Math.min(180, Math.max(5, +$('#block-min').value || 25));
    if (!time) return UI.toast('先選時間');
    const c = (Store.get().settings.blocks || []).filter(b => b.time !== time); if (c.length >= 6) return UI.toast('最多 6 段');
    Store.setSetting('blocks', [...c, { time, min }]); renderSubjectsBlocks();
  });
  $('#block-list').addEventListener('click', e => { const b = e.target.closest('[data-del-block]'); if (!b) return; Store.setSetting('blocks', Store.get().settings.blocks.filter(x => x.time !== b.dataset.delBlock)); renderSubjectsBlocks(); });
  $('#btn-notify').addEventListener('click', async () => { try { const p = await Notification.requestPermission(); UI.toast(p === 'granted' ? '到點會通知你（頁面要開著）' : '沒有開啟通知'); } catch {} renderSubjectsBlocks(); });
  // 到點通知：頁面開著時每 30 秒檢查一次，同一段一天只提醒一次
  setInterval(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date(), hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const b = (Store.get().settings.blocks || []).find(x => x.time === hm); if (!b) return;
    const k = 'fd-notified-' + Store.today() + '-' + hm; if (localStorage.getItem(k)) return; localStorage.setItem(k, '1');
    try { new Notification('專注道場', { body: `排程時間到：${b.min} 分鐘一坐`, tag: k }); } catch {}
  }, 30000);
  $('#share-send').addEventListener('click', sendCard);
  $('#share-copy').addEventListener('click', copySummary);

  applyTheme(); renderQuote(); readChallenge(); onboarding();
  document.addEventListener('store:change', () => { renderBelt(); renderTrial(); if ($('#view-dojo').classList.contains('active')) renderDojo(); });
  renderBelt(); renderTrial(); renderReasons();

  return {
    check, renderDojo, openShare, resolveChallenge, renderExperiment,
    experimentValue() { const v = $('#exp-pick').value; return v === '__custom' ? $('#exp-custom').value.trim().slice(0, 40) : v; },
    tip() { return TIPS[Math.floor(Math.random() * TIPS.length)]; },
  };
})();
