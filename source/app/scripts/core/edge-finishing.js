// ---------- edge finishing ----------
const refineOn = () => S.shrink > 0 || S.soft > 0 || S.defringe;
let refCache = null, refT = 0;
function invalidateRefine(){
  scheduleAutoPreview();
  refCache = null; clearTimeout(refT);
  if (!refineOn()) return;
  refT = setTimeout(() => {
    if (!W || !refineOn() || S.playing) return;
    if (stroke){ invalidateRefine(); return; }
    const so = S.opacity; S.opacity = 100; try { refCache = { f: S.cur, data: finalRGBA(S.cur) }; } finally { S.opacity = so; } renderRect(0, 0, W, H);
  }, 90);
}
function minFilter(a, r){
  const t = new Uint8ClampedArray(a.length), o = new Uint8ClampedArray(a.length);
  for (let y = 0; y < H; y++){ const row = y * W; for (let x = 0; x < W; x++){ let mn = 255; for (let k = Math.max(0, x - r), e = Math.min(W - 1, x + r); k <= e; k++){ const v = a[row + k]; if (v < mn) mn = v; } t[row + x] = mn; } }
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++){ let mn = 255; for (let k = Math.max(0, y - r), e = Math.min(H - 1, y + r); k <= e; k++){ const v = t[k * W + x]; if (v < mn) mn = v; } o[y * W + x] = mn; }
  return o;
}
function boxBlur(a, r){
  const t = new Float32Array(a.length), o = new Uint8ClampedArray(a.length), d = 2 * r + 1;
  for (let y = 0; y < H; y++){ const row = y * W; let s = 0; for (let k = -r; k <= r; k++) s += a[row + Math.min(W - 1, Math.max(0, k))];
    for (let x = 0; x < W; x++){ t[row + x] = s / d; s += a[row + Math.min(W - 1, x + r + 1)] - a[row + Math.max(0, x - r)]; } }
  for (let x = 0; x < W; x++){ let s = 0; for (let k = -r; k <= r; k++) s += t[Math.min(H - 1, Math.max(0, k)) * W + x];
    for (let y = 0; y < H; y++){ o[y * W + x] = s / d; s += t[Math.min(H - 1, y + r + 1) * W + x] - t[Math.max(0, y - r) * W + x]; } }
  return o;
}
// final pixels for a frame: mask, edge finishing, then whole-picture opacity
function finalRGBA(fi){
  const src = frames[fi], m = masks[fi], N = W * H, op = S.opacity / 100;
  let a = new Uint8ClampedArray(N);
  for (let i = 0; i < N; i++) a[i] = (src[i * 4 + 3] * m[i] + 127) / 255;
  if (S.shrink > 0) a = minFilter(a, S.shrink);
  if (S.soft > 0){ const b = boxBlur(boxBlur(a, S.soft), Math.max(1, S.soft >> 1)); for (let i = 0; i < N; i++) if (b[i] < a[i]) a[i] = b[i]; }
  const out = new Uint8ClampedArray(N * 4);
  for (let i = 0, p = 0; i < N; i++, p += 4){ out[p] = src[p]; out[p + 1] = src[p + 1]; out[p + 2] = src[p + 2]; out[p + 3] = a[i] * op + 0.5; }
  if (S.defringe){
    const R = 3;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
      const i = y * W + x, ai = a[i]; if (ai === 0 || ai >= 250) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = Math.max(0, y - R); yy <= Math.min(H - 1, y + R); yy++) for (let xx = Math.max(0, x - R); xx <= Math.min(W - 1, x + R); xx++){
        const j = yy * W + xx; if (a[j] < 250) continue; const q = j * 4; r += src[q]; g += src[q + 1]; b += src[q + 2]; n++;
      }
      if (n){ const p = i * 4; out[p] = r / n; out[p + 1] = g / n; out[p + 2] = b / n; }
    }
  }
  return out;
}

