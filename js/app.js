// 分頁切換、PWA 註冊
(() => {
  const tabs = UI.$('.tabs');
  function go(view) {
    UI.$$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
    UI.$$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
    if (view === 'stats') Stats.render();
    try { localStorage.setItem('focus-dojo-tab', view); } catch {}
  }
  tabs.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (Timer.isRunning() && b.dataset.view !== 'focus') { UI.toast('計時中，先完成或放棄'); return; }
    go(b.dataset.view);
  });
  let saved = 'focus';
  try { saved = localStorage.getItem('focus-dojo-tab') || 'focus'; } catch {}
  go(saved === 'stats' ? 'stats' : 'focus');
  Stats.render();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
