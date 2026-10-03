// 紀錄頁：用 SVG 自繪，不帶圖表庫；所有統計只算計入的回合
const Stats = (() => {
  const $ = UI.$;
  const MIN_SAMPLE = 60; // 分鐘；分心率至少要這麼多樣本才顯示
  const last30 = () => {
    const out = [];
    for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); out.push(Store.today(d)); }
    return out;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const W = 360, H = 130, pad = 24, FS = 12;

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
      if (!Store.counts(s)) return;
      if (s.date in minsByDay) { minsByDay[s.date] += s.actual / 60; distByDay[s.date] += s.distractions.length; awayCount += (s.away || []).length; }
      s.distractions.forEach(x => (reasons[x.reason] = (reasons[x.reason] || 0) + 1));
    });
    const total30 = Object.values(minsByDay).reduce((a, b) => a + b, 0);
    const dist30 = Object.values(distByDay).reduce((a, b) => a + b, 0);
    $('#st-streak').textContent = Store.streak();
    $('#st-today').textContent = Math.round(minsByDay[today]);
    const qs = sessions.filter(s => Store.counts(s) && s.quality && s.date in minsByDay).map(s => s.quality);
    $('#st-quality').textContent = qs.length ? (qs.reduce((x, y) => x + y, 0) / qs.length).toFixed(1) + '★' : '—';
    const st = Store.get().settings; $('#set-daily').value = st.dailyMin; $('#set-week').value = st.weekDays;
    $('#hdr-streak').textContent = `本週 ${Store.weekDone()}/${st.weekDays} 天`;
    const rateEl = $('#st-rate');
    if (total30 >= MIN_SAMPLE) { rateEl.textContent = (dist30 / (total30 / 60)).toFixed(1); rateEl.nextElementSibling.textContent = '每小時分心'; }
    else { rateEl.textContent = '—'; rateEl.nextElementSibling.textContent = `還需 ${Math.ceil(MIN_SAMPLE - total30)} 分才算`; }

    barChart($('#ch-minutes'), days, days.map(d => Math.round(minsByDay[d])), '分');

    const weeks = [3, 2, 1, 0].map(w => {
      const slice = days.slice(29 - (w * 7 + 6), 30 - w * 7);
      const m = slice.reduce((a, d) => a + minsByDay[d], 0), c = slice.reduce((a, d) => a + distByDay[d], 0);
      return m >= MIN_SAMPLE ? +(c / (m / 60)).toFixed(1) : null;
    });
    lineChart($('#ch-dist'), ['4 週前', '3 週前', '2 週前', '本週'], weeks, '次/時');

    const rrows = Object.entries(reasons).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
    bars($('#ch-reasons'), rrows, v => v + ' 次');
    $('#away-note').textContent = awayCount ? `另有 ${awayCount} 次離開畫面，時間已扣除、未算分心` : '';

    const sch = games.filter(g => g.type === 'schulte'), str = games.filter(g => g.type === 'stroop' && g.interference != null);
    const avg = (arr, f) => arr.length ? arr.reduce((a, g) => a + f(g), 0) / arr.length : null;
    const rows = [];
    if (sch.length) rows.push(['找數字 最快', (Math.min(...sch.map(g => g.ms)) / 1000).toFixed(1) + ' 秒'], ['找數字 近 5 次', (avg(sch.slice(-5), g => g.ms) / 1000).toFixed(1) + ' 秒']);
    if (str.length) rows.push(['顏色反應 干擾量近 5 次', Math.round(avg(str.slice(-5), g => g.interference)) + ' ms'], ['顏色反應 最佳', Math.min(...str.map(g => g.interference)) + ' ms']);
    $('#ch-games').innerHTML = rows.length ? rows.map(([k, v]) => `<div class="kv"><span>${k}</span><em>${v}</em></div>`).join('') : '<p class="empty">還沒做過狀態檢測</p>';

    const log = [...sessions].sort((a, b) => b.start - a.start).slice(0, 15);
    const tag = s => s.aborted ? ' · 放棄' : !Store.counts(s) ? ' · 未滿 5 分' : s.completed ? '' : ' · 提早';
    $('#log-list').innerHTML = log.length ? log.map(s => `<li><span>${esc(s.task)} · ${Math.round(s.actual / 60)} 分 · 分心 ${s.distractions.length}${tag(s)}${s.quality ? ' · ' + '★'.repeat(s.quality) : ''}</span><span>${s.date.slice(5)}</span></li>`).join('')
      : '<li class="empty">還沒有專注紀錄，去開始第一回吧</li>';
  }

  $('#set-daily').addEventListener('change', e => { const v = +e.target.value; if (v >= 10 && v <= 600) Store.setSetting('dailyMin', v); });
  $('#set-week').addEventListener('change', e => { const v = +e.target.value; if (v >= 1 && v <= 7) Store.setSetting('weekDays', v); });

  // 匯出／匯入／清除
  async function exportFile(name, text, type) {
    try {
      const file = new File([text], name, { type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); UI.toast('已分享 ' + name); return; }
    } catch (e) { if (e.name === 'AbortError') { UI.toast('已取消'); return; } }
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); UI.toast('已下載 ' + name);
  }
  $('#btn-export').addEventListener('click', () => exportFile(`focus-dojo-${Store.today()}.json`, Store.exportJSON(), 'application/json'));
  $('#btn-csv').addEventListener('click', () => exportFile(`focus-dojo-${Store.today()}.csv`, Store.exportCSV(), 'text/csv'));
  $('#file-import').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { Store.importJSON(await f.text()); Game.check(); UI.toast('還原完成'); } catch (err) { UI.toast('還原失敗：' + err.message); }
    e.target.value = '';
  });
  $('#btn-clear').addEventListener('click', () => { $('#clear-confirm').hidden = false; $('#btn-clear').hidden = true; });
  $('#btn-clear-no').addEventListener('click', () => { $('#clear-confirm').hidden = true; $('#btn-clear').hidden = false; });
  $('#btn-clear-yes').addEventListener('click', () => { Store.clear(); $('#clear-confirm').hidden = true; $('#btn-clear').hidden = false; UI.toast('已清除'); });

  document.addEventListener('store:change', render);
  return { render };
})();
