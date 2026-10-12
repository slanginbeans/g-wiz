// ---------- adjustments (preview on the canvas, apply to the layer) ----------
S.adj = { bright: 0, contrast: 0, sat: 0, hue: 0, temp: 0, gamma: 0, preset: 'none', levels: 4 };
const adjDefault = () => !S.adj.bright && !S.adj.contrast && !S.adj.sat && !S.adj.hue && !S.adj.temp && !S.adj.gamma && S.adj.preset === 'none';
function adjActive(){ return curPage === 'adjust' && !adjDefault(); }
function adjFn(){
  const A = S.adj, lut = new Uint8ClampedArray(256), cc = A.contrast * 2.55, cf = (259 * (cc + 255)) / (255 * (259 - cc)), ge = Math.pow(2, -A.gamma / 50);
  for (let v = 0; v < 256; v++){ let x = v + A.bright * 1.28; x = cf * (x - 128) + 128; x = 255 * Math.pow(Math.max(0, Math.min(255, x)) / 255, ge); lut[v] = x; }
  const s = 1 + A.sat / 100, t = A.temp * 0.6, ha = A.hue * Math.PI / 180, cs = Math.cos(ha), sn = Math.sin(ha);
  const M = [0.213 + cs * 0.787 - sn * 0.213, 0.715 - cs * 0.715 - sn * 0.715, 0.072 - cs * 0.072 + sn * 0.928,
             0.213 - cs * 0.213 + sn * 0.143, 0.715 + cs * 0.285 + sn * 0.140, 0.072 - cs * 0.072 - sn * 0.283,
             0.213 - cs * 0.213 - sn * 0.787, 0.715 - cs * 0.715 + sn * 0.715, 0.072 + cs * 0.928 + sn * 0.072];
  const lv = Math.max(2, A.levels | 0), step = 255 / (lv - 1), hue = A.hue !== 0, pre = A.preset;
  return (d, o) => {
    let r = lut[d[o]], g = lut[d[o + 1]], b = lut[d[o + 2]];
    if (t){ r += t; b -= t; }
    if (hue){ const R = r, G = g, B = b; r = M[0] * R + M[1] * G + M[2] * B; g = M[3] * R + M[4] * G + M[5] * B; b = M[6] * R + M[7] * G + M[8] * B; }
    if (s !== 1){ const l = 0.2126 * r + 0.7152 * g + 0.0722 * b; r = l + (r - l) * s; g = l + (g - l) * s; b = l + (b - l) * s; }
    if (pre !== 'none'){
      if (pre === 'gray'){ const l = 0.299 * r + 0.587 * g + 0.114 * b; r = g = b = l; }
      else if (pre === 'sepia'){ const R = r, G = g, B = b; r = 0.393 * R + 0.769 * G + 0.189 * B; g = 0.349 * R + 0.686 * G + 0.168 * B; b = 0.272 * R + 0.534 * G + 0.131 * B; }
      else if (pre === 'invert'){ r = 255 - r; g = 255 - g; b = 255 - b; }
      else if (pre === 'posterize'){ r = Math.round(r / step) * step; g = Math.round(g / step) * step; b = Math.round(b / step) * step; }
      else if (pre === 'threshold'){ const l = 0.299 * r + 0.587 * g + 0.114 * b; r = g = b = l >= 128 ? 255 : 0; }
    }
    d[o] = r; d[o + 1] = g; d[o + 2] = b;
  };
}
function adjustRect(d, x0, y0, x1, y1){ const fn = adjFn(); for (let y = y0; y < y1; y++) for (let x = x0, o = (y * W + x0) * 4; x < x1; x++, o += 4) fn(d, o); }
let adjRaf = 0;
function adjPreview(){ if (!adjRaf) adjRaf = requestAnimationFrame(() => { adjRaf = 0; if (W) renderRect(0, 0, W, H); }); }
[['aBright', 'bright', v => (v > 0 ? '+' : '') + v], ['aContrast', 'contrast', v => (v > 0 ? '+' : '') + v], ['aSat', 'sat', v => (v > 0 ? '+' : '') + v], ['aHue', 'hue', v => v + '°'], ['aTemp', 'temp', v => (v > 0 ? 'warmer ' : v < 0 ? 'cooler ' : '') + Math.abs(v)], ['aGamma', 'gamma', v => (v > 0 ? '+' : '') + v], ['aLevels', 'levels', v => v]]
  .forEach(([id, k, f]) => { const el = $('#' + id); const up = () => { S.adj[k] = +el.value; $('#' + id + 'Out').textContent = f(+el.value); adjPreview(); }; el.addEventListener('input', up); up(); });
$('#aPreset').addEventListener('change', e => { S.adj.preset = e.target.value; $('#aLevelsRow').hidden = e.target.value !== 'posterize'; adjPreview(); });
function adjReset(){ ['aBright', 'aContrast', 'aSat', 'aHue', 'aTemp', 'aGamma'].forEach(id => { $('#' + id).value = 0; $('#' + id).dispatchEvent(new Event('input')); }); $('#aPreset').value = 'none'; S.adj.preset = 'none'; $('#aLevelsRow').hidden = true; adjPreview(); }
function layerFrames(){ return (S.scopeAll && frames.length > 1) ? frames.map((_, i) => i) : [S.cur]; }
function applyPixels(fn, msg){
  if (!AL) return; if (AL.locked){ toast('The selected layer is locked.'); return; }
  const fs = layerFrames(), entry = paintSnapshot(fs, 0, 0, W, H);
  for (const f of fs) fn(frames[f], masks[f], f);
  pushPaint(entry); resetEdges(); invalidateRefine(); renderRect(0, 0, W, H); if (msg) toast(msg);
}
$('#aApply').addEventListener('click', () => { if (adjDefault()){ toast('Move a slider or choose a look first.'); return; } const fn = adjFn(); applyPixels(fr => { for (let o = 0; o < fr.length; o += 4) fn(fr, o); }, 'Adjusted the layer colors.'); adjReset(); });
$('#aReset').addEventListener('click', adjReset);
$('#aAuto').addEventListener('click', () => applyPixels((fr, m) => {
  const hist = new Uint32Array(256); let n = 0;
  for (let i = 0, o = 0; i < m.length; i++, o += 4){ if (fr[o + 3] * m[i] < 255 * 16) continue; hist[(0.299 * fr[o] + 0.587 * fr[o + 1] + 0.114 * fr[o + 2]) | 0]++; n++; }
  if (!n) return; let lo = 0, hi = 255, c = 0; while (lo < 255 && (c += hist[lo]) < n * 0.005) lo++; c = 0; while (hi > 0 && (c += hist[hi]) < n * 0.005) hi--;
  if (hi <= lo) return; const k = 255 / (hi - lo); for (let o = 0; o < fr.length; o += 4){ fr[o] = (fr[o] - lo) * k; fr[o + 1] = (fr[o + 1] - lo) * k; fr[o + 2] = (fr[o + 2] - lo) * k; }
}, 'Stretched the contrast.'));

// ---------- effects ----------
function premul(fr, m){ const N = m.length, p = new Float32Array(N * 4); for (let i = 0, o = 0; i < N; i++, o += 4){ const a = fr[o + 3] * m[i] / 255 / 255; p[o] = fr[o] * a; p[o + 1] = fr[o + 1] * a; p[o + 2] = fr[o + 2] * a; p[o + 3] = a; } return p; }
function unpremul(p, fr, m){ for (let i = 0, o = 0; i < m.length; i++, o += 4){ const a = p[o + 3]; if (a > 1e-4){ fr[o] = p[o] / a; fr[o + 1] = p[o + 1] / a; fr[o + 2] = p[o + 2] / a; } fr[o + 3] = a * 255; m[i] = 255; } }
function boxPass(p, w, h, r){
  if (r < 1) return; const t = new Float32Array(p.length), d = 2 * r + 1;
  for (let y = 0; y < h; y++) for (let c = 0; c < 4; c++){
    let s = 0; for (let k = -r; k <= r; k++) s += p[(y * w + clamp(k, 0, w - 1)) * 4 + c];
    for (let x = 0; x < w; x++){ t[(y * w + x) * 4 + c] = s / d; s += p[(y * w + Math.min(w - 1, x + r + 1)) * 4 + c] - p[(y * w + Math.max(0, x - r)) * 4 + c]; }
  }
  for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++){
    let s = 0; for (let k = -r; k <= r; k++) s += t[(clamp(k, 0, h - 1) * w + x) * 4 + c];
    for (let y = 0; y < h; y++){ p[(y * w + x) * 4 + c] = s / d; s += t[(Math.min(h - 1, y + r + 1) * w + x) * 4 + c] - t[(Math.max(0, y - r) * w + x) * 4 + c]; }
  }
}
const gaussBlur = (p, w, h, r) => { const b = Math.max(1, Math.round(r / 1.7)); boxPass(p, w, h, b); boxPass(p, w, h, b); boxPass(p, w, h, b); };
rangeBind('eBlur', 'eBlur', v => v + ' px'); rangeBind('eSharp', 'eSharp', v => v + '%'); rangeBind('ePix', 'ePix', v => v + ' px');
rangeBind('eOut', 'eOut', v => v + ' px'); rangeBind('eShBlur', 'eShBlur', v => v + ' px'); rangeBind('eShOp', 'eShOp', v => v + '%');
$('#eBlurBtn').addEventListener('click', () => applyPixels((fr, m) => { const p = premul(fr, m); gaussBlur(p, W, H, S.eBlur); unpremul(p, fr, m); }, 'Blurred the layer.'));
$('#eSharpBtn').addEventListener('click', () => applyPixels((fr, m) => {
  const p = premul(fr, m), b = p.slice(); gaussBlur(b, W, H, 2); const k = S.eSharp / 100;
  for (let o = 0; o < p.length; o += 4){ const a = p[o + 3]; if (a <= 0) continue; for (let c = 0; c < 3; c++) p[o + c] = clamp(p[o + c] + k * (p[o + c] - b[o + c]), 0, 255 * a); }
  unpremul(p, fr, m);
}, 'Sharpened the layer.'));
$('#ePixBtn').addEventListener('click', () => applyPixels((fr, m) => {
  const n = S.ePix, p = premul(fr, m);
  for (let by = 0; by < H; by += n) for (let bx = 0; bx < W; bx += n){
    const s = [0, 0, 0, 0]; let c = 0;
    for (let y = by; y < Math.min(H, by + n); y++) for (let x = bx; x < Math.min(W, bx + n); x++){ const o = (y * W + x) * 4; s[0] += p[o]; s[1] += p[o + 1]; s[2] += p[o + 2]; s[3] += p[o + 3]; c++; }
    for (let y = by; y < Math.min(H, by + n); y++) for (let x = bx; x < Math.min(W, bx + n); x++){ const o = (y * W + x) * 4; p[o] = s[0] / c; p[o + 1] = s[1] / c; p[o + 2] = s[2] / c; p[o + 3] = s[3] / c; }
  }
  unpremul(p, fr, m);
}, 'Pixelated the layer.'));
// distance from every pixel to the nearest solid pixel (two-pass chamfer)
function distanceMap(alpha, w, h){
  const INF = 1e9, d = new Float32Array(w * h); for (let i = 0; i < w * h; i++) d[i] = alpha[i] >= 128 ? 0 : INF;
  const D = Math.SQRT2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ const i = y * w + x; let v = d[i]; if (x) v = Math.min(v, d[i - 1] + 1); if (y){ v = Math.min(v, d[i - w] + 1); if (x) v = Math.min(v, d[i - w - 1] + D); if (x < w - 1) v = Math.min(v, d[i - w + 1] + D); } d[i] = v; }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--){ const i = y * w + x; let v = d[i]; if (x < w - 1) v = Math.min(v, d[i + 1] + 1); if (y < h - 1){ v = Math.min(v, d[i + w] + 1); if (x < w - 1) v = Math.min(v, d[i + w + 1] + D); if (x) v = Math.min(v, d[i + w - 1] + D); } d[i] = v; }
  return d;
}
$('#eOutBtn').addEventListener('click', () => {
  if (!AL) return; if (AL.locked){ toast('The selected layer is locked.'); return; }
  const r = S.eOut, nw = W + 2 * r + 2, nh = H + 2 * r + 2, c = S.c1, ox = r + 1, nf = [], nm = [];
  busy(true);
  try {
    for (let f = 0; f < frames.length; f++){
      const vis = layerVisible(AL, f), a = new Uint8ClampedArray(nw * nh);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) a[(y + ox) * nw + x + ox] = vis[(y * W + x) * 4 + 3];
      const dm = distanceMap(a, nw, nh), out = new Uint8ClampedArray(nw * nh * 4);
      for (let i = 0; i < nw * nh; i++){ const cov = clamp(r + 0.5 - dm[i], 0, 1) * c.a; if (cov <= 0) continue; const o = i * 4; out[o] = c.r; out[o + 1] = c.g; out[o + 2] = c.b; out[o + 3] = cov; }
      const g = toCanvas(out, nw, nh).getContext('2d', { willReadFrequently: true }); g.drawImage(toCanvas(vis, W, H), ox, ox);
      nf.push(g.getImageData(0, 0, nw, nh).data); nm.push(new Uint8Array(nw * nh).fill(255));
    }
    replaceActive(nf, nm, nw, nh, AL.x - ox, AL.y - ox, 'Added a ' + r + ' px outline.');
  } finally { busy(false); }
});
$('#eShBtn').addEventListener('click', () => {
  if (!AL) return;
  const b = S.eShBlur, pad = b * 2 + 2, nw = W + 2 * pad, nh = H + 2 * pad, c = S.c2, k = S.eShOp / 100, fr = [];
  busy(true);
  try {
    for (let f = 0; f < frames.length; f++){
      const vis = layerVisible(AL, f), p = new Float32Array(nw * nh * 4);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){ p[((y + pad) * nw + x + pad) * 4 + 3] = vis[(y * W + x) * 4 + 3] / 255; }
      if (b) gaussBlur(p, nw, nh, b);
      const out = new Uint8ClampedArray(nw * nh * 4);
      for (let i = 0; i < nw * nh; i++){ const o = i * 4; out[o] = c.r; out[o + 1] = c.g; out[o + 2] = c.b; out[o + 3] = p[o + 3] * 255 * k * c.a / 255; }
      fr.push(out);
    }
    const L = newLayerObj(nw, nh, fr, delays, AL.name + ' shadow');
    L.x = AL.x - pad + (+$('#eShX').value || 0); L.y = AL.y - pad + (+$('#eShY').value || 0);
    addLayer(L, true); toast('Added a shadow layer below "' + AL.name + '".');
  } finally { busy(false); }
});
