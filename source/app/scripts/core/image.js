// ---------- image state ----------
function setImage(res, name){
  const bytesNeeded = res.frames.length * res.w * res.h * 5;
  if (bytesNeeded > (IS_IOS ? 0.5e9 : 1.6e9) || (IS_IOS && res.w * res.h > MAX_PIXELS)){ toast('That image is too large to edit here (' + res.frames.length + ' frames of ' + res.w + '×' + res.h + ').', 5000); return false; }
  stopPlay();
  if (typeof autoBeforeSwitch === 'function' && W) autoBeforeSwitch();
  W = res.w; H = res.h; frames = res.frames; delays = res.delays.slice();
  masks = frames.map(() => new Uint8Array(W * H).fill(255));
  S.cur = 0; S.name = name; S.sample = null;
  imgCanvas = document.createElement('canvas'); imgCanvas.width = W; imgCanvas.height = H;
  imgCtx = imgCanvas.getContext('2d');
  disp = imgCtx.createImageData(W, H);
  initDocFromGlobals(name);
  resetEdges(); undoStack.length = 0; redoStack.length = 0; undoBytes = 0; updateUndoUI();
  $('#fname').textContent = name; document.title = name + ' - G-WIZ'; S.track = null; resetStabResult();
  $('#fdims').textContent = W + ' × ' + H + ' px' + (frames.length > 1 ? ' · ' + frames.length + ' frames' : '');
  $('#sampleNote').hidden = name !== 'sample-cactus';
  setupAnim(); resetGeoUI(); resetMotion();
  fit(); renderRect(0, 0, W, H); updateFmtUI(); scheduleAutoPreview();
  return true;
}

// display composition
function renderRect(x0, y0, x1, y1){
  if (!W) return;
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1));
  if (x1 <= x0 || y1 <= y0) return;
  const src = frames[S.cur], m = masks[S.cur], d = disp.data, mode = S.viewMode, op = 1;
  const rc = (mode === 'result' && refCache && refCache.f === S.cur) ? refCache.data : null;
  const ac = hexToRgb(themeCols ? themeCols.accent : '#d23a26');
  const ghost = S.ghost && mode === 'result' ? 0.15 : 0;
  const hl = stroke && S.hiStroke && strokeMark ? strokeMark : null, hc = stroke && stroke.restore ? [52, 199, 120] : [255, 176, 32];
  for (let y = y0; y < y1; y++){
    let i = y * W + x0, p = i * 4;
    for (let x = x0; x < x1; x++, i++, p += 4){
      const a = src[p + 3];
      if (rc){ d[p] = rc[p]; d[p + 1] = rc[p + 1]; d[p + 2] = rc[p + 2]; d[p + 3] = rc[p + 3]; }
      else if (mode === 'result'){ d[p] = src[p]; d[p + 1] = src[p + 1]; d[p + 2] = src[p + 2]; d[p + 3] = (a * m[i] * op + 127) / 255; }
      else if (mode === 'original'){ d[p] = src[p]; d[p + 1] = src[p + 1]; d[p + 2] = src[p + 2]; d[p + 3] = a; }
      else { const t = 0.62 * (1 - m[i] / 255); d[p] = src[p] + (ac[0] - src[p]) * t; d[p + 1] = src[p + 1] + (ac[1] - src[p + 1]) * t; d[p + 2] = src[p + 2] + (ac[2] - src[p + 2]) * t; d[p + 3] = Math.max(a, m[i] < 255 ? 160 : 0); }
      if (ghost){ const ga = a * ghost; if (d[p + 3] < ga) d[p + 3] = ga; }
      if (hl && hl[i]){
        const t = 0.6 * hl[i] / 255;
        if (!rc && mode === 'result'){ d[p] = src[p]; d[p + 1] = src[p + 1]; d[p + 2] = src[p + 2]; }
        d[p] += (hc[0] - d[p]) * t; d[p + 1] += (hc[1] - d[p + 1]) * t; d[p + 2] += (hc[2] - d[p + 2]) * t;
        d[p + 3] = Math.max(d[p + 3], a * 0.85);
      }
    }
  }
  if (adjActive()) adjustRect(d, x0, y0, x1, y1);
  imgCtx.putImageData(disp, 0, 0, x0, y0, x1 - x0, y1 - y0);
  if (S.edgeCheck) requestOverlay();
  requestDraw();
}
function hexToRgb(h){ h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
