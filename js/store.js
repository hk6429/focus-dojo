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
  // 計入連續天數／統計的回合：沒放棄，且完成或實際 ≥ 5 分鐘
  const counts = s => !s.aborted && (s.completed || s.actual >= 300);

  return {
    today, uid, counts,
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
    streak() {
      const days = new Set(data.sessions.filter(counts).map(s => s.date));
      let d = new Date(); d.setHours(0, 0, 0, 0);
      if (!days.has(today(d))) d.setDate(d.getDate() - 1);
      let n = 0;
      while (days.has(today(d))) { n++; d.setDate(d.getDate() - 1); }
      return n;
    },
    // 漸進建議：近 3 回全完成且分心 ≤2 → +5；近 2 回放棄或提早 → −5
    suggest(currentMin) {
      const recent = data.sessions.slice(-3);
      if (recent.length < 2) return null;
      const last2 = recent.slice(-2);
      if (last2.every(s => s.aborted || !s.completed)) return { min: Math.max(10, currentMin - 5), why: '最近 2 回沒做完' };
      if (recent.length === 3 && recent.every(s => s.completed && s.distractions.length <= 2)) return { min: Math.min(90, currentMin + 5), why: '最近 3 回都完成且分心 ≤2' };
      return null;
    },
  };
})();
