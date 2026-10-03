// 紀錄頁：用 SVG 自繪，不帶圖表庫
const Stats = (() => {
  const $ = UI.$;
  const MIN_SAMPLE = 60; // 分鐘；分心率至少要這麼多樣本才顯示
  const last30 = () => {
    const out = [];
    for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); out.push(Store.today(d)); }
    return out;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const W = 360, H = 130, pad = 22, FS = 11;

  function barChart(el, labels, values, unit) {
    const max = Math.max(1, ...values), bw = (W - pad) / values.length;
    const bars = values.map((v, i) => {
      const h = (v / max) * (H - pad - 14), x = pad + i * bw, y = H - pad - h;
      return `<rect x="${(x + 1).toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="var(--accent-2)"><title>${labels[i]}：${v}${unit}</title></rect>`;
    }).join('');
    const ticks = [0, 10, 20, 29].map((i, k) => `<text x="${(pad + i * bw + bw / 2).toFixed(1)}" y="${H - 6}" font-size="${FS}" text-anchor="${k === 3 ? 'end' : 'middle'}" fill="var(--muted)">${labels[i].slice(5)}</text>`).join('');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}"><text x="0" y="12" font-size="${FS}" fill="var(--muted)">${max}${unit}</text>${bars}${ticks}</svg>`;
  }
  function lineChart(el, labels, values, unit) {
    const pts = values.filter(v => v != null);
    if (!pts.length) { el.innerHTML = '<p class="empty">資料不足：每週累積 60 分鐘以上才會畫點</p>'; return; }
    const max = Math.max(1, ...pts), step = (W - pad * 2) / Math.max(1, values.length - 1);
    const xy = values.map((v, i) => v == null ? null : [pad + i * step, H - pad - (v / max) * (H - pad - 14)]);
    const path = xy.filter(Boolean).map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const dots = xy.map((p, i) => p ? `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="var(--accent)"><title>${labels[i]}：${values[i]}${unit}</title></circle>` : '').join('');
    const ticks = labels.map((l, i) => `<text x="${(pad + i * step).toFixed(1)}" y="${H - 6}" font-size="${FS}" text-anchor="${i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}" fill="var(--muted)">${l}</text>`).join('');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}"><text x="0" y="12" font-size="${FS}" fill="var(--muted)">${max}${unit}</text><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>${dots}${ticks}</svg>`;
  }
  function bars(el, rows, fmt) {
    if (!rows.length) { el.innerHTML = '<p class="empty">還沒有資料</p>'; return; }
    const max = Math.max(...rows.map(r => r.v));
    el.innerHTML = rows.map(r => `<div class="bar"><span>${esc(r.k)}</span><i style="width:${(r.v / max) * 100}%"></i><em>${fmt(r.v)}</em></div>`).join('');
  }

  function render() {
    const { sessions, games } = Store.get();
    const days = last30(), today = Store.today();
    const minsByDay = Object.fromEntries(days.map(d => [d, 0]));
    const distByDay = Object.fromEntries(days.map(d => [d, 0]));
    const reasons = {}; let awayCount = 0;
    sessions.forEach(s => {
      if (s.aborted) return;
      if (s.date in minsByDay) { minsByDay[s.date] += s.actual / 60; distByDay[s.date] += s.distractions.length; awayCount += (s.away || []).length; }
      s.distractions.forEach(x => (reasons[x.reason] = (reasons[x.reason] || 0) + 1));
    });
    const total30 = Object.values(minsByDay).reduce((a, b) => a + b, 0);
    const dist30 = Object.values(distByDay).reduce((a, b) => a + b, 0);
    const streak = Store.streak();
    $('#st-streak').textContent = streak; $('#hdr-streak').textContent = `🔥 ${streak} 天`;
    $('#st-today').textContent = Math.round(minsByDay[today]);
    $('#st-total').textContent = Math.round(total30);
    const rateEl = $('#st-rate');
    if (total30 >= MIN_SAMPLE) { rateEl.textContent = (dist30 / (total30 / 25)).toFixed(1); rateEl.nextElementSibling.textContent = '每 25 分分心'; }
    else { rateEl.textContent = '—'; rateEl.nextElementSibling.textContent = `還需 ${Math.ceil(MIN_SAMPLE - total30)} 分`; }

    barChart($('#ch-minutes'), days, days.map(d => Math.round(minsByDay[d])), '分');

    const weeks = [3, 2, 1, 0].map(w => {
      const slice = days.slice(29 - (w * 7 + 6), 30 - w * 7);
      const m = slice.reduce((a, d) => a + minsByDay[d], 0), c = slice.reduce((a, d) => a + distByDay[d], 0);
      return m >= MIN_SAMPLE ? +(c / (m / 25)).toFixed(1) : null;
    });
    lineChart($('#ch-dist'), ['4 週前', '3 週前', '2 週前', '本週'], weeks, '次/25分');

    const rrows = Object.entries(reasons).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
    bars($('#ch-reasons'), rrows, v => v + ' 次');
    $('#away-note').textContent = awayCount ? `另有 ${awayCount} 次離開畫面未算分心` : '';

    const sch = games.filter(g => g.type === 'schulte'), str = games.filter(g => g.type === 'stroop' && g.interference != null);
    const avg = (arr, f) => arr.length ? arr.reduce((a, g) => a + f(g), 0) / arr.length : null;
    const rows = [];
    if (sch.length) rows.push(['方格最快', (Math.min(...sch.map(g => g.ms)) / 1000).toFixed(1) + 's'], ['方格近 5 次', (avg(sch.slice(-5), g => g.ms) / 1000).toFixed(1) + 's']);
    if (str.length) rows.push(['Stroop 干擾量近 5 次', Math.round(avg(str.slice(-5), g => g.interference)) + ' ms'], ['Stroop 最佳干擾量', Math.min(...str.map(g => g.interference)) + ' ms']);
    $('#ch-games').innerHTML = rows.length ? rows.map(([k, v]) => `<div class="kv"><span>${k}</span><em>${v}</em></div>`).join('') : '<p class="empty">還沒做過狀態檢測</p>';

    const log = [...sessions].sort((a, b) => b.start - a.start).slice(0, 15);
    $('#log-list').innerHTML = log.length ? log.map(s => `<li><span>${esc(s.task)} · ${Math.round(s.actual / 60)} 分 · 分心 ${s.distractions.length}${s.aborted ? ' · 放棄' : s.completed ? '' : ' · 提早'}</span><span>${s.date.slice(5)}</span></li>`).join('')
      : '<li class="empty">還沒有專注紀錄，去開始第一回吧</li>';
  }

  // 匯出／匯入／清除
  $('#btn-export').addEventListener('click', async () => {
    const name = `focus-dojo-${Store.today()}.json`, text = Store.exportJSON();
    try {
      const file = new File([text], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); UI.toast('已分享備份'); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); UI.toast('已下載 ' + name);
  });
  $('#file-import').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { Store.importJSON(await f.text()); UI.toast('匯入完成'); } catch (err) { UI.toast('匯入失敗：' + err.message); }
    e.target.value = '';
  });
  $('#btn-clear').addEventListener('click', () => { $('#clear-confirm').hidden = false; $('#btn-clear').hidden = true; });
  $('#btn-clear-no').addEventListener('click', () => { $('#clear-confirm').hidden = true; $('#btn-clear').hidden = false; });
  $('#btn-clear-yes').addEventListener('click', () => { Store.clear(); $('#clear-confirm').hidden = true; $('#btn-clear').hidden = false; UI.toast('已清除'); });

  document.addEventListener('store:change', render);
  return { render };
})();
