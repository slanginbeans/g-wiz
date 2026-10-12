// ---------- stabilize ----------
S.stabRef = 'chain'; S.stabArea = 'all'; S.stabRad = 16; S.stabSmooth = 0; S.stabVis = false; S.stabPrev = true;
let stab = null;   // { T: [[x,y]...] measured content position per frame, C: [[x,y]...] correction }
function resetStabResult(){ stab = null; $('#sOpts').hidden = true; $('#sStat').textContent = ''; requestDraw(); }
function updateTrackHint(){
  $('#sAreaHint').textContent = S.stabArea === 'box'
    ? (S.track ? 'Tracking the yellow box (' + S.track.w + ' × ' + S.track.h + ' px). Pick something that should stay still.' : 'Choose the Track box tool (T) and drag a box around something that should stay still.')
    : 'Measures the shift of the whole picture.';
}
// grayscale + weight pyramid level for frame f at scale sc
function stabLevel(f, sc){
  const sw = Math.max(8, Math.round(W * sc)), sh = Math.max(8, Math.round(H * sc));
  const g = new Float32Array(sw * sh), w = new Float32Array(sw * sh), src = frames[f], m = masks[f];
  const fx = W / sw, fy = H / sh;
  for (let y = 0; y < sh; y++){
    const y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
    for (let x = 0; x < sw; x++){
      const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx));
      let sg = 0, sa = 0, n = 0;
      for (let yy = y0; yy < y1; yy += Math.max(1, (y1 - y0) >> 1)) for (let xx = x0; xx < x1; xx += Math.max(1, (x1 - x0) >> 1)){
        const i = yy * W + xx, p = i * 4;
        let a = src[p + 3] / 255; if (S.stabVis) a *= m[i] / 255;
        sg += (src[p] * 0.299 + src[p + 1] * 0.587 + src[p + 2] * 0.114) * a; sa += a; n++;
      }
      const j = y * sw + x; w[j] = sa / n; g[j] = sa > 0 ? sg / sa : 0;
    }
  }
  return { g, w, sw, sh, sc: sw / W };
}
// best shift of `cur` against `ref` inside box (in level pixels), searching dx,dy in [cx-r, cx+r]
function stabSearch(ref, cur, box, cx, cy, r){
  let best = Infinity, bx = cx, by = cy; const costs = new Map();
  const { sw, sh } = ref;
  let refW = 0; for (let y = box.y0; y < box.y1; y++) for (let x = box.x0; x < box.x1; x++) refW += ref.w[y * sw + x];
  for (let dy = cy - r; dy <= cy + r; dy++) for (let dx = cx - r; dx <= cx + r; dx++){
    let sum = 0, ws = 0;
    const xa = Math.max(box.x0, -dx), xb = Math.min(box.x1, sw - dx), ya = Math.max(box.y0, -dy), yb = Math.min(box.y1, sh - dy);
    for (let y = ya; y < yb; y++){
      const ro = y * sw, co = (y + dy) * sw + dx;
      for (let x = xa; x < xb; x++){ const wv = ref.w[ro + x] * cur.w[co + x]; if (wv <= 0) continue; sum += wv * Math.abs(ref.g[ro + x] - cur.g[co + x]); ws += wv; }
    }
    const c = ws > refW * 0.3 && ws > 0 ? sum / ws : Infinity;
    costs.set(dx + ',' + dy, c);
    if (c < best){ best = c; bx = dx; by = dy; }
  }
  // sub-pixel refinement with a parabola through the neighbours
  const sub = (a, b, c) => { const d = a - 2 * b + c; return (isFinite(a) && isFinite(c) && d > 0) ? Math.max(-0.5, Math.min(0.5, (a - c) / (2 * d))) : 0; };
  const C = (x, y) => costs.has(x + ',' + y) ? costs.get(x + ',' + y) : Infinity;
  return [bx + sub(C(bx - 1, by), best, C(bx + 1, by)), by + sub(C(bx, by - 1), best, C(bx, by + 1))];
}
function stabEstimate(a, b){
  // a, b: pyramids {lo, hi} for reference and current frame
  const boxFor = (L) => {
    const rad = Math.ceil(S.stabRad * L.sc) + 1;
    if (S.stabArea === 'box' && S.track){
      const t = S.track;
      return { x0: clamp(Math.floor(t.x * L.sc), 0, L.sw - 1), y0: clamp(Math.floor(t.y * L.sc), 0, L.sh - 1), x1: clamp(Math.ceil((t.x + t.w) * L.sc), 1, L.sw), y1: clamp(Math.ceil((t.y + t.h) * L.sc), 1, L.sh) };
    }
    return { x0: Math.min(rad, L.sw >> 2), y0: Math.min(rad, L.sh >> 2), x1: L.sw - Math.min(rad, L.sw >> 2), y1: L.sh - Math.min(rad, L.sh >> 2) };
  };
  const rLo = Math.max(1, Math.ceil(S.stabRad * a.lo.sc));
  const [lx, ly] = stabSearch(a.lo, b.lo, boxFor(a.lo), 0, 0, rLo);
  const k = a.hi.sc / a.lo.sc;
  const [hx, hy] = stabSearch(a.hi, b.hi, boxFor(a.hi), Math.round(lx * k), Math.round(ly * k), 2);
  return [hx / a.hi.sc, hy / a.hi.sc];
}
async function analyzeStab(){
  if (!W || frames.length < 2) return;
  stopPlay(); busy(true); await new Promise(r => setTimeout(r, 16));
  try {
    const n = frames.length, hiSc = Math.min(1, 480 / Math.max(W, H)), loSc = hiSc / 4;
    const pyr = f => ({ hi: stabLevel(f, hiSc), lo: stabLevel(f, loSc) });
    const T = [[0, 0]]; let prev = pyr(0); const first = prev;
    for (let f = 1; f < n; f++){
      const cur = pyr(f);
      if (S.stabRef === 'first'){ T.push(stabEstimate(first, cur)); }
      else { const [dx, dy] = stabEstimate(prev, cur); T.push([T[f - 1][0] + dx, T[f - 1][1] + dy]); }
      prev = cur;
      if (f % 8 === 0){ sbSet('Measuring shake… frame ' + (f + 1) + ' of ' + n); await new Promise(r => setTimeout(r, 0)); }
    }
    stab = { T, C: null };
    updateStabCorrection();
    $('#sOpts').hidden = false;
    sbFlash('Shake measured on ' + n + ' frames.');
  } finally { busy(false); }
}
function updateStabCorrection(){
  if (!stab) return;
  const T = stab.T, n = T.length, k = S.stabSmooth;
  const target = [];
  if (k === 0){ let mx = 0, my = 0; T.forEach(([x, y]) => { mx += x; my += y; }); for (let f = 0; f < n; f++) target.push([mx / n, my / n]); }
  else for (let f = 0; f < n; f++){ let sx = 0, sy = 0, c = 0; for (let j = Math.max(0, f - k); j <= Math.min(n - 1, f + k); j++){ sx += T[j][0]; sy += T[j][1]; c++; } target.push([sx / c, sy / c]); }
  stab.S = target;
  stab.C = T.map((t, f) => {
    let cx = target[f][0] - t[0], cy = target[f][1] - t[1];
    // whole pixels: round the target and the measured position separately so every frame lands on the same grid
    if ($('#sWhole').checked){ cx = Math.round(target[f][0]) - Math.round(t[0]); cy = Math.round(target[f][1]) - Math.round(t[1]); }
    return [cx, cy];
  });
  let mx = 0; stab.C.forEach(([x, y]) => { mx = Math.max(mx, Math.hypot(x, y)); });
  let jitter = 0; T.forEach((t, f) => { if (f) jitter = Math.max(jitter, Math.hypot(t[0] - T[f - 1][0], t[1] - T[f - 1][1])); });
  $('#sStat').textContent = 'Largest correction ' + mx.toFixed(1) + ' px · biggest frame-to-frame jump ' + jitter.toFixed(1) + ' px';
  drawStabGraph(); requestDraw();
}
function drawStabGraph(){
  const c = $('#sGraph'); if (!c || !stab) return;
  const g = c.getContext('2d'), w = c.width, h = c.height, T = stab.T, Sm = stab.S, n = T.length;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  let lim = 1; T.forEach(([x, y]) => { lim = Math.max(lim, Math.abs(x), Math.abs(y)); }); Sm.forEach(([x, y]) => { lim = Math.max(lim, Math.abs(x), Math.abs(y)); });
  const X = f => 6 + (w - 12) * (n === 1 ? 0 : f / (n - 1)), Y = v => h / 2 - v / lim * (h / 2 - 8);
  g.strokeStyle = '#c0c0c0'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, h / 2 + 0.5); g.lineTo(w, h / 2 + 0.5); g.stroke();
  g.strokeStyle = '#808080'; g.setLineDash([3, 3]); g.beginPath(); const cx = Math.round(X(S.cur)) + 0.5; g.moveTo(cx, 0); g.lineTo(cx, h); g.stroke(); g.setLineDash([]);
  const line = (arr, i, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); arr.forEach((p, f) => { const xx = X(f), yy = Y(p[i]); f ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }); g.stroke(); };
  line(T, 0, '#0000ff', 1.5); line(T, 1, '#ff0000', 1.5); line(Sm, 0, '#000080', 4); line(Sm, 1, '#800000', 4);
  g.fillStyle = '#000'; g.font = '18px Tahoma, sans-serif'; g.fillText('±' + lim.toFixed(1) + ' px', 8, 20);
}
function stabOffset(){ return (stab && stab.C && S.stabPrev && curPage === 'stab' && stab.C.length === frames.length) ? stab.C[S.cur] : null; }
function applyStab(){
  if (!stab || !stab.C || op) return;
  stopPlay();
  const C = stab.C, mode = $('#sEdge').value, n = frames.length;
  const nf = [], nm = [];
  for (let f = 0; f < n; f++){
    const [cx, cy] = C[f], src = frames[f], m = masks[f], out = new Uint8ClampedArray(W * H * 4), om = new Uint8Array(W * H).fill(255);
    const whole = Number.isInteger(cx) && Number.isInteger(cy);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
      let sx = x - cx, sy = y - cy; const di = y * W + x, o = di * 4;
      if (mode === 'extend'){ sx = clamp(sx, 0, W - 1); sy = clamp(sy, 0, H - 1); }
      if (whole){
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        const si = sy * W + sx; out[o] = src[si * 4]; out[o + 1] = src[si * 4 + 1]; out[o + 2] = src[si * 4 + 2]; out[o + 3] = src[si * 4 + 3]; om[di] = m[si];
        continue;
      }
      const x0 = Math.floor(sx), y0 = Math.floor(sy), tx = sx - x0, ty = sy - y0;
      let pa = 0, pr = 0, pg = 0, pb = 0, pm = 0, win = 0;
      for (let k = 0; k < 4; k++){
        const xx = x0 + (k & 1), yy = y0 + (k >> 1); if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const wgt = ((k & 1) ? tx : 1 - tx) * ((k >> 1) ? ty : 1 - ty), si = yy * W + xx, a = src[si * 4 + 3] * wgt;
        pa += a; pr += src[si * 4] * a; pg += src[si * 4 + 1] * a; pb += src[si * 4 + 2] * a; pm += m[si] * wgt; win += wgt;
      }
      if (pa > 0){ out[o] = pr / pa; out[o + 1] = pg / pa; out[o + 2] = pb / pa; out[o + 3] = pa; }
      if (win > 0) om[di] = pm / win;
    }
    nf.push(out); nm.push(om);
  }
  let nw = W, nh = H, rx = 0, ry = 0;
  if (mode === 'crop'){
    let x0 = 0, y0 = 0, x1 = W, y1 = H;
    C.forEach(([cx, cy]) => { x0 = Math.max(x0, Math.ceil(cx)); y0 = Math.max(y0, Math.ceil(cy)); x1 = Math.min(x1, Math.floor(W + cx)); y1 = Math.min(y1, Math.floor(H + cy)); });
    if (x1 - x0 < 4 || y1 - y0 < 4){ toast('The shake is too large to crop to a shared area. Choose another edge option.', 5000); return; }
    rx = x0; ry = y0; nw = x1 - x0; nh = y1 - y0;
    for (let f = 0; f < n; f++){ nf[f] = cropRGBA(nf[f], [x0, y0, x1, y1]).slice(); nm[f] = cropM(nm[f], x0, y0, x1, y1); }
  }
  geomCommit(nf, nm, nw, nh, 'Stabilized ' + n + ' frames' + (mode === 'crop' ? ', cropped to ' + nw + ' × ' + nh + ' px.' : '.'));
}
segBind('#sRef', 's', v => { S.stabRef = v; resetStabResult(); });
segBind('#sArea', 'a', v => { S.stabArea = v; updateTrackHint(); resetStabResult(); if (v === 'box' && !S.track) setTool('track'); });
rangeBind('sRad', 'stabRad', v => v + ' px', () => resetStabResult());
rangeBind('sSmooth', 'stabSmooth', v => v === 0 ? 'Lock' : v + ' frames', () => updateStabCorrection());
$('#sVis').addEventListener('change', e => { S.stabVis = e.target.checked; resetStabResult(); });
$('#sWhole').addEventListener('change', updateStabCorrection);
$('#sPrev').addEventListener('change', e => { S.stabPrev = e.target.checked; requestDraw(); });
$('#sAnalyze').addEventListener('click', analyzeStab);
$('#sApply').addEventListener('click', applyStab);
updateTrackHint();
