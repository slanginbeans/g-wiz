// ---------- copy a frame's mask ----------
function copyMask(to){
  if (frames.length < 2) return;
  stopPlay();
  const targets = to === 'next' ? [(S.cur + 1) % frames.length] : frames.map((_, i) => i).filter(i => i !== S.cur);
  const srcM = masks[S.cur];
  beginOp(targets); targets.forEach(f => masks[f].set(srcM)); touchOp(0, 0, W, H); endOp();
  toast(to === 'next' ? 'Mask copied to frame ' + (targets[0] + 1) + '.' : 'Mask copied to all ' + targets.length + ' other frames.');
  if (to === 'next') setFrame(targets[0]);
}

// ---------- filmstrip ----------
let thumbs = [], thumbQ = new Set(), thumbT = 0;
function buildStrip(){
  const strip = $('#strip'); strip.textContent = ''; thumbs = [];
  const nTh = ANIM.on ? docFrames() : frames.length, tW = ANIM.on ? DocW : W, tH = ANIM.on ? DocH : H;
  strip.hidden = nTh < 2 && !ANIM.on;
  if (nTh < 2 && !ANIM.on) return;
  const th = 52, tw = Math.max(16, Math.min(120, Math.round(tW * th / tH)));
  for (let i0 = 0; i0 < nTh; i0++) (i => {
    const b = document.createElement('button'); b.className = 'thumb'; b.type = 'button';
    b.setAttribute('aria-label', 'Frame ' + (i + 1)); b.title = 'Frame ' + (i + 1);
    const c = document.createElement('canvas'); c.width = tw; c.height = th;
    const n = document.createElement('span'); n.className = 'tnum'; n.textContent = i + 1;
    const dot = document.createElement('span'); dot.className = 'tdot'; dot.hidden = true; dot.title = 'Edited';
    b.append(c, n, dot); b.addEventListener('click', () => { stopPlay(); setFrame(i); });
    strip.appendChild(b); thumbs.push({ b, c, dot });
  })(i0);
  thumbsDirty(thumbs.map((_, i) => i)); markThumb();
}
function thumbsDirty(fs){ scheduleLayerThumb(); if (!thumbs.length) return; (ANIM.on && frames.length !== thumbs.length ? thumbs.map((_, i) => i) : fs).forEach(f => thumbQ.add(f)); clearTimeout(thumbT); thumbT = setTimeout(flushThumbs, 120); }
function flushThumbs(){
  const t0 = performance.now();
  for (const f of thumbQ){
    thumbQ.delete(f); drawThumb(f);
    if (performance.now() - t0 > 30){ thumbT = setTimeout(flushThumbs, 16); return; }
  }
}
function drawThumb(f){
  if (ANIM.on) return drawDocThumb(f);
  const t = thumbs[f]; if (!t) return;
  const tw = t.c.width, th = t.c.height, g = t.c.getContext('2d'), id = g.createImageData(tw, th), d = id.data;
  const src = frames[f], m = masks[f];
  for (let y = 0; y < th; y++){ const sy = Math.min(H - 1, (y * H / th) | 0); for (let x = 0; x < tw; x++){ const sx = Math.min(W - 1, (x * W / tw) | 0), i = sy * W + sx, p = i * 4, o = (y * tw + x) * 4; d[o] = src[p]; d[o + 1] = src[p + 1]; d[o + 2] = src[p + 2]; d[o + 3] = (src[p + 3] * m[i] * S.opacity / 100) / 255; } }
  g.putImageData(id, 0, 0);
  let edited = false; for (let i = 0; i < m.length; i += 7) if (m[i] < 255){ edited = true; break; }
  if (!edited) for (let i = 0; i < m.length; i++) if (m[i] < 255){ edited = true; break; }
  t.dot.hidden = !edited;
}
function markThumb(){
  const cf = ANIM.on ? S.dcur : S.cur;
  thumbs.forEach((t, i) => t.b.setAttribute('aria-current', String(i === cf)));
  const t = thumbs[cf]; if (t) t.b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
