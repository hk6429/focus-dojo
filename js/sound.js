// 環境音：Web Audio 現場生成（白噪音／棕噪音／雨聲），沒有音檔；只在計時中播放
const Sound = (() => {
  let ctx = null, src = null, gain = null, rainTimer = null, type = 'off';
  const bufFor = (kind) => {
    const sr = ctx.sampleRate, len = sr * 4, buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') d[i] = w * .25;
        else { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } // 棕噪音
      }
    }
    return buf;
  };
  function start(kind, vol) {
    stop(); type = kind; if (kind === 'off') return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      gain = ctx.createGain(); gain.gain.value = vol; gain.connect(ctx.destination);
      src = ctx.createBufferSource(); src.buffer = bufFor(kind === 'white' ? 'white' : 'brown'); src.loop = true;
      if (kind === 'rain') {
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; src.connect(lp); lp.connect(gain);
        const drop = () => { // 隨機雨滴：短促高頻噪音
          if (type !== 'rain') return;
          const d = ctx.createBufferSource(); d.buffer = bufFor('white');
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2500 + Math.random() * 4000; bp.Q.value = 6;
          const g = ctx.createGain(); const t = ctx.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.5 + Math.random() * .4, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + .08);
          d.connect(bp); bp.connect(g); g.connect(gain); d.start(t); d.stop(t + .1);
          rainTimer = setTimeout(drop, 40 + Math.random() * 160);
        };
        drop();
      } else src.connect(gain);
      src.start();
    } catch {}
  }
  function stop() { clearTimeout(rainTimer); try { src && src.stop(); } catch {} src = null; type = 'off'; }
  function setVol(v) { if (gain) gain.gain.value = v; }
  return { start, stop, setVol, current: () => type };
})();
