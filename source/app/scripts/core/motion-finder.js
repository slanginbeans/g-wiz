// ---------- canvas overlays: auto-remove preview and motion finder ----------
const ovCanvas = document.createElement('canvas'); let ovOn = false, ovRaf = 0;
let autoPrevData = null, autoPrevT = 0;
function scheduleAutoPreview(){
  clearTimeout(autoPrevT);
  if (!S.autoPrev){ if (autoPrevData){ autoPrevData = null; requestOverlay(); } $('#aPrevStat').hidden = true; return; }
  autoPrevT = setTimeout(async () => {
    if (!W || !S.autoPrev || stroke || S.playing) return;
    const st0 = $('#aPrevStat'); st0.hidden = false; st0.textContent = 'Working…';
    if (CUT.method === 'ai'){
      const f0 = S.cur, L0 = AL;
      if (!(await aiReady([f0], t => { st0.textContent = t; }))) return;
      if (!W || !S.autoPrev || S.cur !== f0 || AL !== L0) return;   // something changed while it worked
    }
    const N = W * H, d = new Uint8Array(N), m = masks[S.cur];
    autoAmt(S.cur, d);
    // only show pixels this would actually change
    let n = 0; for (let i = 0; i < N; i++){ if (d[i] && m[i] > 255 - d[i]) n++; else d[i] = 0; }
    autoPrevData = d;
    const st = $('#aPrevStat'); st.hidden = false;
    st.textContent = n ? 'Would erase ' + (n * 100 / N).toFixed(1) + '% of ' + (frames.length > 1 ? 'this frame' : 'the picture') + ', shown in red.' : 'Nothing left to remove at this tolerance.';
    requestOverlay();
  }, CUT.method !== 'classic' ? 260 : 140);
}
function requestOverlay(){ if (!ovRaf) ovRaf = requestAnimationFrame(() => { ovRaf = 0; renderOverlay(); }); }
function renderOverlay(){
  const sel = S.mShow && motionSel, heat = S.mHeat && motion, ap = S.autoPrev && autoPrevData, hn = CUT.showHints && AL && AL.hints && AL.hints.length === W * H ? AL.hints : null;
  if (!W || !(sel || heat || ap || hn)){ ovOn = false; requestDraw(); return; }
  if (ovCanvas.width !== W || ovCanvas.height !== H){ ovCanvas.width = W; ovCanvas.height = H; }
  const g = ovCanvas.getContext('2d'), id = g.createImageData(W, H), d = id.data, N = W * H;
  const ac = hexToRgb(themeCols ? themeCols.accent : '#d23a26');
  for (let i = 0, p = 0; i < N; i++, p += 4){
    let r = 0, gg = 0, b = 0, a = 0;
    if (heat){ const v = motion[i] / 255; [r, gg, b] = heatColor(v); a = 140; }
    if (sel && motionSel[i]){ const t = 0.7; r = r * (1 - t) + 25 * t; gg = gg * (1 - t) + 205 * t; b = b * (1 - t) + 230 * t; a = Math.max(a, 120); }
    if (hn && hn[i]){ const t = 0.55; const hc = hn[i] === 1 ? [54, 213, 90] : [235, 40, 190]; r = r * (1 - t) + hc[0] * t; gg = gg * (1 - t) + hc[1] * t; b = b * (1 - t) + hc[2] * t; a = Math.max(a, 150); }
    if (ap && ap[i]){ const t = ap[i] / 255; r = r * (1 - t) + ac[0] * t; gg = gg * (1 - t) + ac[1] * t; b = b * (1 - t) + ac[2] * t; a = Math.max(a, 60 + 120 * t); }
    d[p] = r; d[p + 1] = gg; d[p + 2] = b; d[p + 3] = a;
  }
  g.putImageData(id, 0, 0); ovOn = true; requestDraw();
}
function heatColor(v){
  const stops = [[42, 109, 244], [24, 194, 176], [242, 208, 59], [240, 80, 58]];
  const x = Math.min(0.999, Math.max(0, v)) * 3, k = Math.floor(x), t = x - k, A = stops[k], B = stops[k + 1];
  return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
}
$('#aPrev').addEventListener('change', e => { S.autoPrev = e.target.checked; scheduleAutoPreview(); });

// ---------- motion finder ----------
// Two methods:
//  plate  – build a background plate (per-pixel median of the frames) and compare each frame with it, so every
//           frame gets its own cut-out of whatever is not background.
//  pairs  – average change between neighboring frames; one map for the whole animation.
let motion = null, motionSel = null, motionT = 0, plate = null, pairMap = null, motionReady = false;
function resetMotion(){ motion = null; motionSel = null; plate = null; pairMap = null; motionReady = false; $('#mOpts').hidden = true; $('#mStat').textContent = ''; updateMotionHint(); requestOverlay(); }
function updateMotionHint(){
  $('#mModeHint').textContent = S.mMode === 'plate'
    ? 'Builds a picture of the unchanging background, then finds what differs from it in each frame. Best for a subject moving over a still background.'
    : 'Averages how much each pixel changes from frame to frame. Marks everywhere the subject travels, so the result is the same on every frame.';
}
function maxFilter(a, r){ const inv = new Uint8ClampedArray(a.length); for (let i = 0; i < a.length; i++) inv[i] = 255 - a[i]; const o = minFilter(inv, r); for (let i = 0; i < o.length; i++) o[i] = 255 - o[i]; return o; }
const pxDiff = (A, B, p) => { let d = Math.abs(A[p] - B[p]); const dg = Math.abs(A[p + 1] - B[p + 1]), db = Math.abs(A[p + 2] - B[p + 2]), da = Math.abs(A[p + 3] - B[p + 3]); if (dg > d) d = dg; if (db > d) d = db; if (da > d) d = da; return d; };
function buildPlate(){
  const n = frames.length, N = W * H, pick = [];
  const k = Math.min(n, 31); for (let j = 0; j < k; j++) pick.push(Math.round(j * (n - 1) / Math.max(1, k - 1)));
  const out = new Uint8ClampedArray(N * 4), v = new Uint8Array(k);
  for (let p = 0; p < N * 4; p++){
    for (let j = 0; j < k; j++) v[j] = frames[pick[j]][p];
    v.sort(); out[p] = v[k >> 1];
  }
  plate = out;
}
function buildPairs(){
  const n = frames.length, N = W * H, acc = new Float32Array(N), noise = S.mNoise;
  for (let f = 0; f < n; f++){
    const A = frames[f], B = frames[(f + 1) % n];
    for (let i = 0, p = 0; i < N; i++, p += 4){ if (A[p + 3] < 16 && B[p + 3] < 16) continue; const d = pxDiff(A, B, p); if (d > noise) acc[i] += d; }
  }
  // scale so the strongest 0.5% of pixels reach the top of the range
  let mx = 0; for (let i = 0; i < N; i++){ acc[i] /= n; if (acc[i] > mx) mx = acc[i]; }
  pairMap = new Uint8Array(N); if (mx <= 0) return;
  const hist = new Uint32Array(1024); for (let i = 0; i < N; i++) hist[Math.min(1023, (acc[i] / mx * 1023) | 0)]++;
  let cum = 0, top = mx; for (let k = 1023; k >= 0; k--){ cum += hist[k]; if (cum >= N * 0.005){ top = Math.max(1e-6, (k + 1) / 1024 * mx); break; } }
  for (let i = 0; i < N; i++) pairMap[i] = Math.min(255, acc[i] / top * 255);
}
function analyzeMotion(){ if (S.mMode === 'plate'){ if (!plate) buildPlate(); } else buildPairs(); motionReady = true; }
// 0..255 "how much this pixel is moving" for frame f
function motionMapFor(f){
  if (S.mMode === 'pairs') return pairMap;
  const N = W * H, A = frames[f], out = new Uint8Array(N), noise = S.mNoise;
  for (let i = 0, p = 0; i < N; i++, p += 4){ const d = pxDiff(A, plate, p); out[i] = d > noise ? Math.min(255, d * 2) : 0; }
  return out;
}
function selFor(map){
  const N = W * H, m = S.mSmooth > 0 ? boxBlur(map, S.mSmooth) : map, thr = S.mThr * 2.55, still = S.mTarget === 'still';
  let sel = new Uint8ClampedArray(N);
  for (let i = 0; i < N; i++){ const moving = m[i] > thr; sel[i] = (still ? !moving : moving) ? 255 : 0; }
  if (S.mGrow > 0) sel = maxFilter(sel, S.mGrow); else if (S.mGrow < 0) sel = minFilter(sel, -S.mGrow);
  return sel;
}
function updateMotionSel(){
  if (!motionReady) return;
  motion = motionMapFor(S.cur); motionSel = selFor(motion);
  const N = W * H; let n = 0; for (let i = 0; i < N; i++) if (motionSel[i]) n++;
  $('#mStat').textContent = (S.mTarget === 'still' ? 'Still' : 'Moving') + ' areas cover ' + (n * 100 / N).toFixed(1) + '% of ' + (S.mMode === 'plate' ? 'frame ' + (S.cur + 1) : 'every frame') + '.';
  requestOverlay();
}
async function runAnalysis(){
  if (!W || frames.length < 2) return;
  stopPlay(); busy(true); await new Promise(r => setTimeout(r, 16));
  try { analyzeMotion(); $('#mOpts').hidden = false; S.mShow = true; $('#mShow').checked = true; updateMotionSel(); }
  finally { busy(false); }
}
function scheduleMotion(reanalyze){
  clearTimeout(motionT);
  motionT = setTimeout(() => { if (!motionReady) return; if (reanalyze && S.mMode === 'pairs') buildPairs(); updateMotionSel(); }, reanalyze ? 200 : 60);
}
async function applyMotion(restore){
  if (!motionReady || op) return;
  stopPlay(); busy(true); await new Promise(r => setTimeout(r, 16));
  try {
    const N = W * H, shared = S.mMode === 'pairs' ? selFor(pairMap) : null;
    beginOp(frames.map((_, i) => i));
    for (const f of op.fs){
      const sel = shared || selFor(motionMapFor(f)), m = masks[f];
      for (let i = 0; i < N; i++){ if (!sel[i]) continue; m[i] = restore ? 255 : 0; }
    }
    touchOp(0, 0, W, H); endOp(); renderRect(0, 0, W, H);
    S.mShow = false; $('#mShow').checked = false; requestOverlay();
    toast((restore ? 'Restored ' : 'Erased ') + (S.mTarget === 'still' ? 'still' : 'moving') + ' areas on all ' + frames.length + ' frames.');
  } finally { busy(false); }
}
segBind('#mMode', 'k', v => { S.mMode = v; updateMotionHint(); if (motionReady){ busy(true); setTimeout(() => { try { analyzeMotion(); updateMotionSel(); } finally { busy(false); } }, 16); } });
updateMotionHint();
$('#mAnalyze').addEventListener('click', runAnalysis);
segBind('#mTarget', 't', v => { S.mTarget = v; updateMotionSel(); });
rangeBind('mThr', 'mThr', v => v + '%', () => scheduleMotion(false));
rangeBind('mNoise', 'mNoise', v => v === 0 ? 'Off' : v + ' levels', () => scheduleMotion(true));
rangeBind('mSmooth', 'mSmooth', v => v + ' px', () => scheduleMotion(false));
rangeBind('mGrow', 'mGrow', v => (v > 0 ? '+' : '') + v + ' px', () => scheduleMotion(false));
$('#mShow').addEventListener('change', e => { S.mShow = e.target.checked; requestOverlay(); });
$('#mHeat').addEventListener('change', e => { S.mHeat = e.target.checked; requestOverlay(); });
$('#mErase').addEventListener('click', () => applyMotion(false));
$('#mRestore').addEventListener('click', () => applyMotion(true));

async function removeSpecks(){
  if (!W) return; stopPlay(); busy(true); await new Promise(r => setTimeout(r, 16));
  try {
    const N = W * H, minSize = Math.max(8, Math.round(N * +$('#speck').value));
    const lab = new Uint8Array(N); let comp = new Int32Array(1 << 14), removed = 0;
    let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
    beginOp();
    for (const f of op.fs){
      const src = frames[f], m = masks[f]; lab.fill(0);
      const solid = gi => src[gi * 4 + 3] * m[gi] >= 255 * 24;
      for (let s0 = 0; s0 < N; s0++){
        if (lab[s0] || !solid(s0)) continue;
        let n = 0, qh = 0; lab[s0] = 1; comp[n++] = s0;
        while (qh < n){
          const gi = comp[qh++], x = gi % W, y = (gi / W) | 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){
            if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            const j = yy * W + xx; if (lab[j] || !solid(j)) continue; lab[j] = 1;
            if (n >= comp.length){ const nc = new Int32Array(comp.length * 2); nc.set(comp); comp = nc; } comp[n++] = j;
          }
        }
        if (n >= minSize) continue;
        removed++;
        for (let k = 0; k < n; k++){
          const gi = comp[k], x = gi % W, y = (gi / W) | 0;
          // take the faint halo around the speck with it
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){ const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (j === gi || !solid(j)) m[j] = 0; }
          m[gi] = 0;
          if (x - 1 < bx0) bx0 = Math.max(0, x - 1); if (x + 1 > bx1) bx1 = Math.min(W - 1, x + 1); if (y - 1 < by0) by0 = Math.max(0, y - 1); if (y + 1 > by1) by1 = Math.min(H - 1, y + 1);
        }
      }
    }
    if (!removed){ op = null; toast('No specks found at that size.'); return; }
    touchOp(bx0, by0, bx1 + 1, by1 + 1); endOp(); renderRect(bx0, by0, bx1 + 1, by1 + 1);
    toast('Removed ' + removed + (removed === 1 ? ' speck.' : ' specks.'));
  } finally { busy(false); }
}
$('#autoBtn').addEventListener('click', autoRemove);
$('#speckBtn').addEventListener('click', removeSpecks);
