// ---------- crop & rotate ----------
S.crop = null; S.rotA = 0; S.rotAll = true;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ASPECTS = { '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '16:9': 16 / 9, '9:16': 9 / 16, '3:2': 1.5, '2:3': 2 / 3 };
const rotTargets = () => (S.rotAll || frames.length < 2) ? frames.map((_, i) => i) : [S.cur];
const rotExpands = () => rotTargets().length === frames.length && $('#rexp').checked;
// resample one frame and its mask; positive degrees turn clockwise
function resampleFrame(src, m, nw, nh, deg, flip){
  const out = new Uint8ClampedArray(nw * nh * 4), om = new Uint8Array(nw * nh).fill(255);
  if (flip){
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++){
      const sx = flip === 'h' ? W - 1 - x : x, sy = flip === 'v' ? H - 1 - y : y, si = sy * W + sx, di = y * nw + x;
      out[di * 4] = src[si * 4]; out[di * 4 + 1] = src[si * 4 + 1]; out[di * 4 + 2] = src[si * 4 + 2]; out[di * 4 + 3] = src[si * 4 + 3]; om[di] = m[si];
    }
    return [out, om];
  }
  const rad = deg * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
  const exact = Math.abs(Math.round(deg / 90) * 90 - deg) < 1e-9;
  const hw = nw / 2, hh = nh / 2, sw = W / 2, sh = H / 2;
  for (let y = 0; y < nh; y++){
    const dy = y + 0.5 - hh;
    for (let x = 0; x < nw; x++){
      const dx = x + 0.5 - hw, sx = c * dx + s * dy + sw, sy = -s * dx + c * dy + sh, di = y * nw + x, o = di * 4;
      if (exact){
        const ix = Math.floor(sx + 1e-6), iy = Math.floor(sy + 1e-6);
        if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
        const si = iy * W + ix;
        out[o] = src[si * 4]; out[o + 1] = src[si * 4 + 1]; out[o + 2] = src[si * 4 + 2]; out[o + 3] = src[si * 4 + 3]; om[di] = m[si];
        continue;
      }
      const fx = sx - 0.5, fy = sy - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      let pa = 0, pr = 0, pg = 0, pb = 0, pm = 0, win = 0;
      for (let k = 0; k < 4; k++){
        const xx = x0 + (k & 1), yy = y0 + (k >> 1); if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const wgt = ((k & 1) ? tx : 1 - tx) * ((k >> 1) ? ty : 1 - ty), si = yy * W + xx, a = src[si * 4 + 3] * wgt;
        pa += a; pr += src[si * 4] * a; pg += src[si * 4 + 1] * a; pb += src[si * 4 + 2] * a; pm += m[si] * wgt; win += wgt;
      }
      if (pa > 0){ out[o] = pr / pa; out[o + 1] = pg / pa; out[o + 2] = pb / pa; out[o + 3] = pa; }
      if (win > 0) om[di] = pm / win;
    }
  }
  return [out, om];
}
function transformFrames(deg, flip){
  if (!W || op) return;
  stopPlay();
  const fs = rotTargets(), all = fs.length === frames.length;
  let nw = W, nh = H;
  if (!flip && all){
    const quarter = Math.abs(Math.round(deg / 90) * 90 - deg) < 1e-9;
    if (quarter || $('#rexp').checked){
      const r = deg * Math.PI / 180, ac = Math.abs(Math.cos(r)), as = Math.abs(Math.sin(r));
      nw = Math.max(1, Math.round(W * ac + H * as)); nh = Math.max(1, Math.round(W * as + H * ac));
    }
  }
  const nf = frames.slice(), nm = masks.slice();
  for (const f of fs){ const [a, b] = resampleFrame(frames[f], masks[f], nw, nh, deg, flip); nf[f] = a; nm[f] = b; }
  const what = flip ? (flip === 'h' ? 'Flipped horizontally' : 'Flipped vertically')
    : 'Rotated ' + Math.abs(+deg.toFixed(1)) + '° ' + (deg > 0 ? 'clockwise' : 'counter-clockwise');
  const scope = frames.length > 1 ? (all ? ' on all ' + frames.length + ' frames.' : ' on frame ' + (S.cur + 1) + ' only.') : '.';
  geomCommit(nf, nm, nw, nh, what + scope);
}
function geomCommit(nf, nm, nw, nh, msg, nx, ny){
  pushUndo({ geom: true, W, H, frames: frames.slice(), masks: masks.slice(), x: AL.x, y: AL.y, dw: DocW, dh: DocH, lid: AL.id });
  redoStack.length = 0; updateUndoUI();
  const follow = nx == null && docFollows();
  if (nx == null){ nx = AL.x + Math.round((W - nw) / 2); ny = AL.y + Math.round((H - nh) / 2); }
  W = nw; H = nh; frames = nf; masks = nm;
  if (follow){ nx = 0; ny = 0; DocW = nw; DocH = nh; }
  AL.x = nx; AL.y = ny;
  saveActive(); reinitDims(follow); renderLayersPanel(); syncLayerProps(); if (msg) toast(msg);
}
function reinitDims(refit){
  imgCanvas.width = W; imgCanvas.height = H; imgCtx = imgCanvas.getContext('2d'); disp = imgCtx.createImageData(W, H); saveActive();
  resetEdges(); refCache = null; S.cur = Math.min(S.cur, frames.length - 1); S.track = null; resetStabResult();
  $('#fdims').textContent = W + ' × ' + H + ' px' + (frames.length > 1 ? ' · ' + frames.length + ' frames' : '');
  setupAnim(); resetGeoUI(); resetMotion(); if (refit) fit(); renderRect(0, 0, W, H); updateFmtUI(); invalidateRefine(); updateHud();
}
function resetGeoUI(){ S.crop = null; setAngle(0); syncCropUI(); updateRotScopeHint(); }
function setAngle(v){
  v = clamp(Math.round((+v || 0) * 10) / 10, -180, 180); S.rotA = v;
  $('#rang').value = v; if (document.activeElement !== $('#rangN')) $('#rangN').value = v;
  $('#rApply').disabled = !v; requestDraw();
}
function updateRotScopeHint(){
  const all = S.rotAll || frames.length < 2;
  $('#rotScopeHint').textContent = all ? 'Every frame turns together, so the animation stays in sync.' : 'Only frame ' + (S.cur + 1) + ' turns. All frames share one canvas size, so the canvas keeps its size and corners outside it are cut off.';
  $('#rexpRow').hidden = !all;
}
[['cropL', 'l'], ['cropR', 'r'], ['cropT', 't'], ['cropB', 'b']].forEach(([id, k]) => $('#' + id).addEventListener('input', e => cropInput(k, e.target.value)));
[['cropX', 'x'], ['cropY', 'y'], ['cropW', 'w'], ['cropH', 'h']].forEach(([id, k]) => {
  const el = $('#' + id);
  el.addEventListener('change', e => cropInput(k, e.target.value));
  el.addEventListener('keydown', e => { if (e.key === 'Enter'){ cropInput(k, e.target.value); e.target.blur(); } });
  el.addEventListener('blur', syncCropUI);
});
$('#caspect').addEventListener('change', setAspect);
$('#cFit').addEventListener('click', fitContent);
$('#cReset').addEventListener('click', () => { $('#caspect').value = 'free'; S.crop = null; syncCropUI(); });
$('#cApply').addEventListener('click', applyCrop);
$('#rotL').addEventListener('click', () => rotRun(-90));
$('#rotR').addEventListener('click', () => rotRun(90));
$('#flipH').addEventListener('click', () => rotRun(0, 'h'));
$('#flipV').addEventListener('click', () => rotRun(0, 'v'));
segBind('#rotTarget', 'v', v => { S.rotTarget = v; requestDraw(); });
$('#rang').addEventListener('input', e => setAngle(e.target.value));
$('#rangN').addEventListener('change', e => setAngle(e.target.value));
$('#rangN').addEventListener('keydown', e => { if (e.key === 'Enter'){ setAngle(e.target.value); e.target.blur(); } });
$('#rexp').addEventListener('change', requestDraw);
$('#rReset').addEventListener('click', () => setAngle(0));
$('#rApply').addEventListener('click', () => { if (S.rotA) rotRun(S.rotA); });
segBind('#rotScope', 'r', v => { S.rotAll = v === 'all'; updateRotScopeHint(); requestDraw(); });
