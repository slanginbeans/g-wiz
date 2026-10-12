// ---------- frame scrubber under the canvas ----------
const PLAY_SVG = '<i class="ic" data-ic="play"></i>', PAUSE_SVG = '<i class="ic" data-ic="pause"></i>';
function syncTl(){
  if (!frames.length) return;
  $('#tlSl').value = S.dcur; $('#tlNum').textContent = (S.dcur + 1) + ' / ' + docFrames();
  $('#tlPlay').innerHTML = S.playing ? PAUSE_SVG : PLAY_SVG; $('#tlPlay').setAttribute('aria-label', S.playing ? 'Pause' : 'Play');
}
// small ticks under the scrubber mark frames that have edits
function drawTlMarks(){
  const c = $('#tlMarks'); if (c && ANIM.on){ c.getContext('2d').clearRect(0, 0, c.width, c.height); return; } if (!c || frames.length < 2) return;
  const r = c.getBoundingClientRect(), w = Math.max(1, Math.round(r.width * dpr)), h = Math.round(14 * dpr);
  c.width = w; c.height = h; const g = c.getContext('2d'); g.clearRect(0, 0, w, h);
  g.fillStyle = themeCols ? themeCols.accent : '#d23a26';
  const n = frames.length, pad = 8 * dpr;
  for (let f = 0; f < n; f++){
    const m = masks[f]; let ed = false; for (let i = 0; i < m.length; i += 13) if (m[i] < 255){ ed = true; break; }
    if (!ed) continue;
    const x = pad + (w - 2 * pad) * (n === 1 ? 0 : f / (n - 1));
    g.fillRect(Math.round(x - dpr), h - 3 * dpr, Math.max(2, 2 * dpr), 3 * dpr);
  }
}
$('#tlSl').addEventListener('input', e => { stopPlay(); setFrame(+e.target.value); });
$('#tlPrev').addEventListener('click', () => { stopPlay(); setFrame((S.dcur + docFrames() - 1) % docFrames()); });
$('#tlNext').addEventListener('click', () => { stopPlay(); setFrame((S.dcur + 1) % docFrames()); });
$('#tlPlay').addEventListener('click', () => S.playing ? stopPlay() : play());
$('#timeline').addEventListener('wheel', e => {
  e.preventDefault(); if (docFrames() < 2) return; stopPlay();
  const step = (e.deltaY || e.deltaX) > 0 ? 1 : -1;
  setFrame((S.dcur + step + docFrames()) % docFrames());
}, { passive: false });
['pointerdown', 'wheel'].forEach(t => $('#timeline').addEventListener(t, e => e.stopPropagation()));
new ResizeObserver(() => drawTlMarks()).observe($('#timeline'));
