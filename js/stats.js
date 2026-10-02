// 紀錄頁：用 SVG 自繪，不帶圖表庫
const Stats = (() => {
  const $ = UI.$;
  const last30 = () => {
    const out = [];
    for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); out.push(Store.today(d)); }
    return out;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function barChart(el, labels, values, unit) {
    const W = 600, H = 150, pad = 24, max = Math.max(1, ...values);
    const bw = (W - pad) / values.length;
    const bars = values.map((v, i) => {
      const h = (v / max) * (H - pad - 10), x = pad + i * bw, y = H - pad - h;
      return `<rect x="${x + 1}" y="${y}" width="${Math.max(1, bw - 2)}" height="${h}" rx="2" fill="var(--accent-2)"><title>${labels[i]}：${v}${unit}</title></rect>`;
    }).join('');
    const ticks = [0, 7, 14, 21, 29].map(i => `<text x="${pad + i * bw + bw / 2}" y="${H - 6}" font-size="10" text-anchor="middle" fill="var(--muted)">${labels[i].slice(5)}</text>`).join('');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}"><text x="0" y="12" font-size="10" fill="var(--muted)">${max}${unit}</text>${bars}${ticks}</svg>`;
  }
  function lineChart(el, labels, values, unit) {
    const W = 600, H = 150, pad = 24, pts = values.filter(v => v != null);
    if (!pts.length) { el.innerHTML = '<p class="empty">還沒有資料</p>'; return; }
    const max = Math.max(1, ...pts), step = (W - pad * 2) / Math.max(1, values.length - 1);
    const xy = values.map((v, i) => v == null ? null : [pad + i * step, H - pad - (v / max) * (H - pad - 10)]);
    const path = xy.filter(Boolean).map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const dots = xy.map((p, i) => p ? `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--accent)"><title>${labels[i]}：${values[i]}${unit}</title></circle>` : '').join('');
    const ticks = labels.map((l, i) => `<text x="${pad + i * step}" y="${H - 6}" font-size="10" text-anchor="${i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}" fill="var(--muted)">${l}</text>`).join('');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}"><text x="0" y="12" font-size="10" fill="var(--muted)">${max}${unit}</text><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>${dots}${ticks}</svg>`;
  }
  function bars(el, rows, fmt) {
    if (!rows.length) { el.innerHTML = '<p class="empty">還沒有資料</p>'; return; }
    const max = Math.max(...rows.map(r => r.v));
    el.innerHTML = rows.map(r => `<div class="bar"><span>${esc(r.k)}</span><i style="width:${(r.v / max) * 100}%"></i><em>${fmt(r.v)}</em></div>`).join('');
  }

  function render() {
    const { sessions, games, breaths } = Store.get();
    const days = last30(), today = Store.today();
    const minsByDay = Object.fromEntries(days.map(d => [d, 0]));
    const distByDay = Object.fromEntries(days.map(d => [d, 0]));
    const reasons = {};
    sessions.forEach(s => {
      if (s.date in minsByDay) { minsByDay[s.date] += s.actual / 60; distByDay[s.date] += s.distractions.length; }
      s.distractions.forEach(x => (reasons[x.reason] = (reasons[x.reason] || 0) + 1));
    });
    const total30 = Object.values(minsByDay).reduce((a, b) => a + b, 0);
    const dist30 = Object.values(distByDay).reduce((a, b) => a + b, 0);
    const streak = Store.streak();
    $('#st-streak').textContent = streak; $('#hdr-streak').textContent = `🔥 ${streak} 天`;
    $('#st-today').textContent = Math.round(minsByDay[today]);
    $('#st-total').textContent = Math.round(total30);
    $('#st-rate').textContent = total30 >= 5 ? (dist30 / (total30 / 60)).toFixed(1) : '—';

    barChart($('#ch-minutes'), days, days.map(d => Math.round(minsByDay[d])), '分');

    // 週趨勢：近 4 週，每小時分心
    const weeks = [3, 2, 1, 0].map(w => {
      const slice = days.slice(29 - (w * 7 + 6), 30 - w * 7);
      const m = slice.reduce((a, d) => a + minsByDay[d], 0), c = slice.reduce((a, d) => a + distByDay[d], 0);
      return m ? +(c / (m / 60)).toFixed(1) : null;
    });
    lineChart($('#ch-dist'), ['4 週前', '3 週前', '2 週前', '本週'], weeks, '次/時');

    bars($('#ch-reasons'), Object.entries(reasons).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v), v => v + ' 次');

    const sch = games.filter(g => g.type === 'schulte'), str = games.filter(g => g.type === 'stroop');
    const avg = (arr, f) => arr.length ? arr.reduce((a, g) => a + f(g), 0) / arr.length : null;
    const grows = [];
    if (sch.length) grows.push({ k: '方格最佳', v: Math.min(...sch.map(g => g.ms)) / 1000, f: v => v.toFixed(1) + 's' },
      { k: '方格近5均', v: avg(sch.slice(-5), g => g.ms) / 1000, f: v => v.toFixed(1) + 's' });
    if (str.length) grows.push({ k: 'Stroop 最佳', v: Math.max(...str.map(g => g.correct)), f: v => v + '/20' },
      { k: 'Stroop 反應', v: avg(str.slice(-5), g => g.avgMs), f: v => Math.round(v) + 'ms' });
    const gEl = $('#ch-games');
    gEl.innerHTML = grows.length ? grows.map(r => `<div class="bar"><span>${r.k}</span><i style="width:100%"></i><em>${r.f(r.v)}</em></div>`).join('') : '<p class="empty">還沒玩過遊戲</p>';

    const log = [...sessions].sort((a, b) => b.start - a.start).slice(0, 15);
    $('#log-list').innerHTML = log.length ? log.map(s => `<li><span>${esc(s.task)} · ${Math.round(s.actual / 60)} 分 · 分心 ${s.distractions.length}${s.completed ? '' : ' · 提早'}</span><span>${s.date.slice(5)}</span></li>`).join('')
      : '<li class="empty">還沒有專注紀錄，去開始第一回吧</li>';
  }

  // 匯出／匯入／清除
  $('#btn-export').addEventListener('click', () => {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `focus-dojo-${Store.today()}.json` });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#file-import').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { Store.importJSON(await f.text()); UI.toast('匯入完成'); } catch (err) { UI.toast('匯入失敗：' + err.message); }
    e.target.value = '';
  });
  let armed = false;
  $('#btn-clear').addEventListener('click', e => {
    if (!armed) { armed = true; e.target.textContent = '再按一次確認清除'; setTimeout(() => { armed = false; e.target.textContent = '清除全部'; }, 3000); return; }
    Store.clear(); armed = false; e.target.textContent = '清除全部'; UI.toast('已清除');
  });

  document.addEventListener('store:change', render);
  return { render };
})();
