const UI = {
  $: s => document.querySelector(s),
  $$: s => [...document.querySelectorAll(s)],
  toast(msg, ms = 1800) {
    const t = UI.$('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(UI._tt); UI._tt = setTimeout(() => (t.hidden = true), ms);
  },
  // 單選 chips：點誰誰亮，回傳目前 data-* 值
  chips(sel, attr, onChange) {
    const box = UI.$(sel);
    box.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      onChange && onChange(b.dataset[attr]);
    });
    return () => (box.querySelector('button.on') || {}).dataset?.[attr];
  },
  mmss(sec) {
    sec = Math.max(0, Math.round(sec));
    return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  },
  beep(freq = 660, dur = .18, times = 1) {
    try {
      const ctx = UI._ctx || (UI._ctx = new (window.AudioContext || window.webkitAudioContext)());
      for (let i = 0; i < times; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = freq; o.connect(g); g.connect(ctx.destination);
        const t = ctx.currentTime + i * (dur + .1);
        g.gain.setValueAtTime(.001, t); g.gain.exponentialRampToValueAtTime(.3, t + .02);
        g.gain.exponentialRampToValueAtTime(.001, t + dur);
        o.start(t); o.stop(t + dur + .02);
      }
    } catch {}
  },
  vibrate(p) { try { navigator.vibrate && navigator.vibrate(p); } catch {} },
};
