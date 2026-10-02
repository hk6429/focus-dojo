// 單一 localStorage key；所有資料走這裡
const Store = (() => {
  const KEY = 'focus-dojo-v1';
  const blank = () => ({ version: 1, sessions: [], breaths: [], games: [] });
  let data = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const d = JSON.parse(raw);
      if (!d || d.version !== 1) return blank();
      return Object.assign(blank(), d);
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

  return {
    today, uid,
    get: () => data,
    addSession(s) { data.sessions.push({ id: uid(), ...s }); save(); },
    addBreath(b) { data.breaths.push({ id: uid(), ...b }); save(); },
    addGame(g) { data.games.push({ id: uid(), ...g }); save(); },
    exportJSON() { return JSON.stringify(data, null, 2); },
    importJSON(text) {
      const d = JSON.parse(text);
      if (!d || d.version !== 1 || !Array.isArray(d.sessions)) throw new Error('格式不符');
      data = Object.assign(blank(), d); save();
    },
    clear() { data = blank(); save(); },
    // 連續天數：從今天（今天沒做則從昨天）往回數有完成專注的日子
    streak() {
      // 計入：完成，或實際專注 ≥ 5 分鐘
      const days = new Set(data.sessions.filter(s => s.completed || s.actual >= 300).map(s => s.date));
      let d = new Date(); d.setHours(0, 0, 0, 0);
      if (!days.has(today(d))) d.setDate(d.getDate() - 1);
      let n = 0;
      while (days.has(today(d))) { n++; d.setDate(d.getDate() - 1); }
      return n;
    },
  };
})();
