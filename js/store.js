// 單一 localStorage key；所有資料走這裡
const Store = (() => {
  const KEY = 'focus-dojo-v1';
  const blank = () => ({ version: 1, sessions: [], breaths: [], games: [], badges: {}, trials: {}, settings: { dailyMin: 50, weekDays: 5, name: '', mission: '', theme: 'white', dark: 'auto', customReasons: [], onboarded: false } });
  let data = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const d = JSON.parse(raw);
      if (!d || d.version !== 1) return blank();
      const o = Object.assign(blank(), d); o.settings = Object.assign(blank().settings, d.settings || {}); return o;
    } catch { return blank(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.warn('save failed', e); }
    document.dispatchEvent(new CustomEvent('store:change'));
  }
  const today = (d = new Date()) => {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  // 唯一的計入規則：沒放棄，且實際專注 ≥ 5 分鐘（背景時間已扣除）
  const MIN_SEC = 300;
  const counts = s => !s.aborted && s.actual >= MIN_SEC;
  const median = arr => { if (!arr.length) return null; const a = [...arr].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

  return {
    today, uid, counts, median, MIN_SEC,
    get: () => data,
    addSession(s) { const o = { id: uid(), ...s }; data.sessions.push(o); save(); return o.id; },
    updateSession(id, patch) { const s = data.sessions.find(x => x.id === id); if (s) { Object.assign(s, patch); save(); } },
    setSetting(k, v) { data.settings[k] = v; save(); },
    earn(id) { if (data.badges[id]) return false; data.badges[id] = today(); save(); return true; },
    trialDone(date) { if (data.trials[date]) return false; data.trials[date] = true; save(); return true; },
    // 累積計入分鐘（段位依據）
    totalMin() { return data.sessions.filter(counts).reduce((a, s) => a + s.actual / 60, 0); },
    lastCountedDate() { const d = data.sessions.filter(counts).map(s => s.date).sort(); return d[d.length - 1] || null; },
    todayCtx() { const t = today(); return { sessions: data.sessions.filter(s => s.date === t && counts(s)), breaths: data.breaths.filter(b => b.date === t), games: data.games.filter(g => g.date === t) }; },
    todayMin() { const t = today(); return data.sessions.filter(s => s.date === t && counts(s)).reduce((a, s) => a + s.actual / 60, 0); },
    lastNote() { const s = [...data.sessions].reverse().find(x => x.note); return s ? s.note : ''; },
    // 本週（週一起）有計入回合的天數
    weekDone() {
      const days = new Set(data.sessions.filter(counts).map(s => s.date));
      const d = new Date(); d.setHours(0, 0, 0, 0);
      const dow = (d.getDay() + 6) % 7; // 週一=0
      let n = 0;
      for (let i = 0; i <= dow; i++) { const x = new Date(d); x.setDate(d.getDate() - i); if (days.has(today(x))) n++; }
      return n;
    },
    addBreath(b) { data.breaths.push({ id: uid(), ...b }); save(); },
    addGame(g) { data.games.push({ id: uid(), ...g }); save(); },
    exportJSON() { return JSON.stringify(data, null, 2); },
    // 每坐一列，可直接進試算表
    exportCSV() {
      const head = ['date', 'start', 'task', 'planned_min', 'actual_min', 'completed', 'counted', 'aborted', 'distractions', 'away_sec', 'quality', 'note', 'experiment'];
      const rows = data.sessions.map(s => [s.date, new Date(s.start).toISOString(), s.task, Math.round(s.planned / 60), +(s.actual / 60).toFixed(1), s.completed ? 1 : 0, counts(s) ? 1 : 0, s.aborted ? 1 : 0, s.distractions.length, (s.away || []).reduce((a, x) => a + x.sec, 0), s.quality || '', s.note || '', s.experiment || '']);
      return '﻿' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\n');
    },
    importJSON(text) {
      const d = JSON.parse(text);
      if (!d || d.version !== 1 || !Array.isArray(d.sessions)) throw new Error('格式不符');
      data = Object.assign(blank(), d); data.settings = Object.assign(blank().settings, d.settings || {}); save();
    },
    clear() { data = blank(); save(); },
    streak() {
      const days = new Set(data.sessions.filter(counts).map(s => s.date));
      let d = new Date(); d.setHours(0, 0, 0, 0);
      if (!days.has(today(d))) d.setDate(d.getDate() - 1);
      let n = 0;
      while (days.has(today(d))) { n++; d.setDate(d.getDate() - 1); }
      return n;
    },
    // 漸進建議：只看計入的回合，以近 3 回計畫長度中位數為基準
    suggest() {
      const recent = data.sessions.filter(counts).slice(-3);
      if (recent.length < 2) return null;
      const base = Math.round(median(recent.map(s => s.planned / 60)) / 5) * 5;
      const last2 = recent.slice(-2);
      if (last2.every(s => !s.completed)) return { min: Math.max(10, base - 5), why: `最近 2 回 ${base} 分沒做滿` };
      if (recent.length === 3 && recent.every(s => s.completed && s.distractions.length <= 2)) return { min: Math.min(90, base + 5), why: `最近 3 回 ${base} 分都做滿且分心 ≤2` };
      return null;
    },
  };
})();
