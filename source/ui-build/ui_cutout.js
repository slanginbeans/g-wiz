// ===================== smart background removal =====================
// The classic remover floods inward from the border, comparing each pixel with the color it came from.
// The smart remover works the way dedicated cut-out tools do:
//   1. colors along the border (and any "remove" hints) are grouped into a few background colors (k-means, Lab);
//   2. everything that is not close to those colors seeds a foreground color model; both models are refined
//      a few times (the expectation-maximization idea behind GrabCut);
//   3. each pixel gets a background probability from the two models, which is smoothed with an edge-aware
//      guided filter so the decision follows the picture's real edges;
//   4. background must connect to the border (edges block leaks into the subject), enclosed gaps up to a chosen
//      size are cleared, and the soft map is refined once more at full resolution so hair and fur keep soft edges.
const CUT = Object.assign({ method: 'smart', k: 3, border: 4, detail: 3, soft: 25, holes: 3, contig: true, iters: 2, edge: 55, contrast: 50, showHints: true, hintSize: 40 }, store.get('cut', {}));
const saveCut = () => store.set('cut', CUT);

// ---------- color helpers ----------
const SRGB_LIN = new Float32Array(256);
for (let i = 0; i < 256; i++){ const c = i / 255; SRGB_LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
const labF = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
function rgb2lab(r, g, b, out, o){
  const R = SRGB_LIN[r], G = SRGB_LIN[g], B = SRGB_LIN[b];
  const fx = labF((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047), fy = labF(R * 0.2126 + G * 0.7152 + B * 0.0722), fz = labF((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  out[o] = 116 * fy - 16; out[o + 1] = 500 * (fx - fy); out[o + 2] = 200 * (fy - fz);
}
// perceptual color distance for the brush, wand and classic remover (used when "perceptual matching" is on)
function labDist(src, o, lab2){
  const t = labTmp; rgb2lab(src[o], src[o + 1], src[o + 2], t, 0);
  const dl = t[0] - lab2[0], da = t[1] - lab2[1], db = t[2] - lab2[2];
  return Math.sqrt(dl * dl + da * da + db * db) * 2.4;   // scaled so the tolerance sliders mean about the same as before
}
const labTmp = new Float32Array(3);

// ---------- small image helpers ----------
function boxF(src, w, h, r, norm){
  // mean over a (2r+1)² window, normalized at the borders by the window's real pixel count
  const t = new Float32Array(w * h), o = new Float32Array(w * h);
  for (let y = 0; y < h; y++){ const row = y * w; let s = 0; for (let k = -r; k <= r; k++) s += src[row + Math.min(w - 1, Math.max(0, k))];
    for (let x = 0; x < w; x++){ t[row + x] = s; s += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++){ let s = 0; for (let k = -r; k <= r; k++) s += t[Math.min(h - 1, Math.max(0, k)) * w + x];
    for (let y = 0; y < h; y++){ o[y * w + x] = s; s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
  if (norm) for (let i = 0; i < w * h; i++) o[i] /= norm[i];
  return o;
}
function boxNorm(w, h, r){ const ones = new Float32Array(w * h).fill(1); return boxF(ones, w, h, r, null); }
// edge-preserving smoothing of p guided by a gray image (He, Sun, Tang: "Guided Image Filtering")
function guidedGray(I, p, w, h, r, eps){
  const n = boxNorm(w, h, r), mI = boxF(I, w, h, r, n), mp = boxF(p, w, h, r, n), N = w * h;
  const II = new Float32Array(N), Ip = new Float32Array(N);
  for (let i = 0; i < N; i++){ II[i] = I[i] * I[i]; Ip[i] = I[i] * p[i]; }
  const cII = boxF(II, w, h, r, n), cIp = boxF(Ip, w, h, r, n), a = II, b = Ip;   // reuse buffers
  for (let i = 0; i < N; i++){ const vI = cII[i] - mI[i] * mI[i], cv = cIp[i] - mI[i] * mp[i]; a[i] = cv / (vI + eps); b[i] = mp[i] - a[i] * mI[i]; }
  const ma = boxF(a, w, h, r, n), mb = boxF(b, w, h, r, n), q = new Float32Array(N);
  for (let i = 0; i < N; i++) q[i] = ma[i] * I[i] + mb[i];
  return q;
}
// the color version: the guide is the 3-channel Lab image, which separates colors of equal brightness too
function guidedColor(lab, p, w, h, r, eps){
  const N = w * h, n = boxNorm(w, h, r), ch = [0, 1, 2].map(c => { const a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = lab[i * 3 + c] / 100; return a; });
  const m = ch.map(c => boxF(c, w, h, r, n)), mp = boxF(p, w, h, r, n);
  const prod = (A, B) => { const t = new Float32Array(N); for (let i = 0; i < N; i++) t[i] = A[i] * B[i]; return boxF(t, w, h, r, n); };
  const Ip = ch.map(c => prod(c, p)), v = [[0, 0], [0, 1], [0, 2], [1, 1], [1, 2], [2, 2]].map(([i, j]) => prod(ch[i], ch[j]));
  const a = [new Float32Array(N), new Float32Array(N), new Float32Array(N)], b = new Float32Array(N);
  for (let i = 0; i < N; i++){
    const rr = v[0][i] - m[0][i] * m[0][i] + eps, rg = v[1][i] - m[0][i] * m[1][i], rb = v[2][i] - m[0][i] * m[2][i];
    const gg = v[3][i] - m[1][i] * m[1][i] + eps, gb = v[4][i] - m[1][i] * m[2][i], bb = v[5][i] - m[2][i] * m[2][i] + eps;
    const c0 = Ip[0][i] - m[0][i] * mp[i], c1 = Ip[1][i] - m[1][i] * mp[i], c2 = Ip[2][i] - m[2][i] * mp[i];
    // solve the 3×3 symmetric system Σ a = cov
    const A = gg * bb - gb * gb, B = -(rg * bb - gb * rb), C = rg * gb - gg * rb, det = rr * A + rg * B + rb * C || 1e-9;
    const D = rr * bb - rb * rb, E = -(rr * gb - rg * rb), F = rr * gg - rg * rg;
    a[0][i] = (A * c0 + B * c1 + C * c2) / det; a[1][i] = (B * c0 + D * c1 + E * c2) / det; a[2][i] = (C * c0 + E * c1 + F * c2) / det;
    b[i] = mp[i] - a[0][i] * m[0][i] - a[1][i] * m[1][i] - a[2][i] * m[2][i];
  }
  const ma = a.map(x => boxF(x, w, h, r, n)), mb = boxF(b, w, h, r, n), q = new Float32Array(N);
  for (let i = 0; i < N; i++) q[i] = ma[0][i] * ch[0][i] + ma[1][i] * ch[1][i] + ma[2][i] * ch[2][i] + mb[i];
  return q;
}
// k-means in Lab over the listed pixel indexes; returns centers and a spread per cluster
function kmeans(lab, idx, k, init){
  if (!idx.length) return null;
  k = Math.max(1, Math.min(k, idx.length));
  let cen = init && init.length === k ? init.map(c => c.slice()) : null;
  if (!cen){
    // k-means++ style start: the first center is the mean, the rest are far from the ones chosen so far
    cen = []; let L = 0, A = 0, B = 0; for (const i of idx){ L += lab[i * 3]; A += lab[i * 3 + 1]; B += lab[i * 3 + 2]; }
    cen.push([L / idx.length, A / idx.length, B / idx.length]);
    const step = Math.max(1, Math.floor(idx.length / 4000));
    while (cen.length < k){
      let best = -1, bd = -1;
      for (let s = 0; s < idx.length; s += step){ const i = idx[s]; let dm = Infinity; for (const c of cen){ const d = (lab[i * 3] - c[0]) ** 2 + (lab[i * 3 + 1] - c[1]) ** 2 + (lab[i * 3 + 2] - c[2]) ** 2; if (d < dm) dm = d; } if (dm > bd){ bd = dm; best = i; } }
      cen.push([lab[best * 3], lab[best * 3 + 1], lab[best * 3 + 2]]);
    }
  }
  const sum = new Float64Array(k * 3), cnt = new Int32Array(k), sq = new Float64Array(k);
  for (let it = 0; it < 10; it++){
    sum.fill(0); cnt.fill(0); sq.fill(0);
    for (const i of idx){
      const L = lab[i * 3], A = lab[i * 3 + 1], B = lab[i * 3 + 2]; let bk = 0, bd = Infinity;
      for (let c = 0; c < k; c++){ const d = (L - cen[c][0]) ** 2 + (A - cen[c][1]) ** 2 + (B - cen[c][2]) ** 2; if (d < bd){ bd = d; bk = c; } }
      sum[bk * 3] += L; sum[bk * 3 + 1] += A; sum[bk * 3 + 2] += B; cnt[bk]++; sq[bk] += bd;
    }
    let moved = 0;
    for (let c = 0; c < k; c++){ if (!cnt[c]) continue; const nx = sum[c * 3] / cnt[c], ny = sum[c * 3 + 1] / cnt[c], nz = sum[c * 3 + 2] / cnt[c]; moved += Math.abs(nx - cen[c][0]) + Math.abs(ny - cen[c][1]) + Math.abs(nz - cen[c][2]); cen[c] = [nx, ny, nz]; }
    if (moved < 0.05) break;
  }
  return { cen: cen.filter((_, c) => cnt[c] > 0), spread: cen.map((_, c) => cnt[c] ? Math.sqrt(sq[c] / cnt[c]) : 0).filter((_, c) => cnt[c] > 0), n: idx.length };
}
function nearestDist(lab, i, model, out){
  const L = lab[i * 3], A = lab[i * 3 + 1], B = lab[i * 3 + 2]; let bd = Infinity;
  for (const c of model.cen){ const d = (L - c[0]) ** 2 + (A - c[1]) ** 2 + (B - c[2]) ** 2; if (d < bd) bd = d; }
  return Math.sqrt(bd);
}

// ---------- the smart remover ----------
let cutModels = null;   // models from the last run, reused as a warm start for the next frame
function smartAmt(f, out){
  const N = W * H, src = frames[f], hints = AL && AL.hints;
  const tol = 3 + CUT.atol * 0.55;                                     // Lab distance that still counts as "the background color"
  const sc = Math.min(1, 480 / Math.max(W, H)), w = Math.max(2, Math.round(W * sc)), h = Math.max(2, Math.round(H * sc)), n = w * h;
  // 1. a small working copy in Lab, with transparent pixels and hints carried along
  const lab = new Float32Array(n * 3), alpha = new Uint8Array(n), hint = new Uint8Array(n);
  for (let y = 0; y < h; y++){
    const sy0 = Math.floor(y / sc), sy1 = Math.max(sy0 + 1, Math.min(H, Math.floor((y + 1) / sc)));
    for (let x = 0; x < w; x++){
      const sx0 = Math.floor(x / sc), sx1 = Math.max(sx0 + 1, Math.min(W, Math.floor((x + 1) / sc))), i = y * w + x;
      // every source pixel in the cell is averaged, which also quiets sensor noise
      let r = 0, g = 0, b = 0, a = 0, cnt = 0, hv = 0;
      for (let yy = sy0; yy < sy1; yy++) for (let xx = sx0; xx < sx1; xx++){ const gi = yy * W + xx, o = gi * 4; r += src[o]; g += src[o + 1]; b += src[o + 2]; a += src[o + 3]; cnt++; if (hints && hints[gi]) hv = hints[gi]; }
      rgb2lab(Math.round(r / cnt), Math.round(g / cnt), Math.round(b / cnt), lab, i * 3); alpha[i] = a / cnt; hint[i] = hv;
    }
  }
  // 2. which border colors are really background? Group the border pixels; a group counts when it reaches a
  //    corner, runs along at least two sides, or covers a large share of the border. A subject that touches one
  //    side (a person cut off at the waist) is left alone that way.
  const bw = Math.max(1, Math.round(Math.min(w, h) * CUT.border / 100)), cornerR = Math.max(bw * 3, Math.round(Math.min(w, h) * 0.08));
  const isBorder = i => { const x = i % w, y = (i / w) | 0; return x < bw || y < bw || x >= w - bw || y >= h - bw; };
  const sideOf = i => { const x = i % w, y = (i / w) | 0; return y < bw ? 0 : x >= w - bw ? 1 : y >= h - bw ? 2 : 3; };
  const isCorner = i => { const x = i % w, y = (i / w) | 0; return (x < cornerR || x >= w - cornerR) && (y < cornerR || y >= h - cornerR); };
  const borderIdx = [], keepIdx = [], dropIdx = [];
  for (let i = 0; i < n; i++){
    if (hint[i] === 1){ keepIdx.push(i); continue; }
    if (hint[i] === 2){ dropIdx.push(i); continue; }
    if (alpha[i] >= 16 && isBorder(i)) borderIdx.push(i);
  }
  // colors painted with the "keep" hint can never be background, wherever else they appear
  const keepModel = keepIdx.length >= 4 ? kmeans(lab, keepIdx, 3, null) : null;
  const nearKeep = i => keepModel && nearestDist(lab, i, keepModel) < tol * 0.9;
  const bgSeed = dropIdx.slice();
  if (borderIdx.length){
    const grp = kmeans(lab, borderIdx, Math.max(CUT.k, 3) + 1, null), K = grp.cen.length;
    const cover = new Float64Array(K), sides = Array.from({ length: K }, () => [0, 0, 0, 0]), corner = new Uint8Array(K), sideTot = [0, 0, 0, 0];
    const assign = new Int32Array(borderIdx.length);
    borderIdx.forEach((i, k) => {
      const L = lab[i * 3], A = lab[i * 3 + 1], B = lab[i * 3 + 2]; let bk = 0, bd = Infinity;
      for (let c = 0; c < K; c++){ const d = (L - grp.cen[c][0]) ** 2 + (A - grp.cen[c][1]) ** 2 + (B - grp.cen[c][2]) ** 2; if (d < bd){ bd = d; bk = c; } }
      assign[k] = bk; cover[bk]++; const sd = sideOf(i); sides[bk][sd]++; sideTot[sd]++; if (isCorner(i)) corner[bk]++;
    });
    const ok = new Uint8Array(K);
    for (let c = 0; c < K; c++){
      const nSides = sides[c].filter((v, sd) => v >= sideTot[sd] * 0.08).length;
      ok[c] = (corner[c] >= 8 || nSides >= 2 || cover[c] >= borderIdx.length * 0.35) ? 1 : 0;
      if (keepModel && keepModel.cen.some(d => Math.sqrt((grp.cen[c][0] - d[0]) ** 2 + (grp.cen[c][1] - d[1]) ** 2 + (grp.cen[c][2] - d[2]) ** 2) < tol * 0.9)) ok[c] = 0;
    }
    if (!ok.some(v => v)) ok.fill(1);
    borderIdx.forEach((i, k) => { if (ok[assign[k]] && !nearKeep(i)) bgSeed.push(i); });
  }
  if (!bgSeed.length){ out.fill(0); return 0; }
  // 3. flood from those seeds through gently changing color (so gradients and shadows are followed), stopping at
  //    edges: that region is what the background model learns from
  const reach0 = new Uint8Array(n), seedOf = new Int32Array(n), tolL = tol * 0.8, innerL = tolL * 0.5;
  const edge = new Float32Array(n), thr = edgeThr(CUT.edge);
  {
    // Sobel on the Lab copy (a 5×5 average first when fine texture is to be ignored); scaled so a plain
    // 30-unit RGB step reads about 30, like the full-size edge map the eraser uses
    let E = lab;
    if (S.edgeWide){ E = new Float32Array(n * 3); const nrm = boxNorm(w, h, 2); for (let c = 0; c < 3; c++){ const ch = new Float32Array(n); for (let i = 0; i < n; i++) ch[i] = lab[i * 3 + c]; const bl = boxF(ch, w, h, 2, nrm); for (let i = 0; i < n; i++) E[i * 3 + c] = bl[i]; } }
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++){
      const i = y * w + x; let best = 0;
      for (let c = 0; c < 3; c++){
        const A = E[(i - w - 1) * 3 + c], B = E[(i - w) * 3 + c], C = E[(i - w + 1) * 3 + c], D = E[(i - 1) * 3 + c], F = E[(i + 1) * 3 + c], G = E[(i + w - 1) * 3 + c], Hh = E[(i + w) * 3 + c], K = E[(i + w + 1) * 3 + c];
        const gx = (C + 2 * F + K) - (A + 2 * D + G), gy = (G + 2 * Hh + K) - (A + 2 * B + C);
        const m = Math.abs(gx) + Math.abs(gy); if (m > best) best = m;
      }
      edge[i] = best * 0.7;
    }
  }
  {
    let qu = new Int32Array(n), qh = 0, qt = 0;
    for (const i of bgSeed){ if (!reach0[i]){ reach0[i] = 1; seedOf[i] = i; qu[qt++] = i; } }
    for (let i = 0; i < n; i++) if (alpha[i] < 16 && !reach0[i]){ reach0[i] = 1; seedOf[i] = i; qu[qt++] = i; }
    const dist = (i, j) => Math.sqrt((lab[i * 3] - lab[j * 3]) ** 2 + (lab[i * 3 + 1] - lab[j * 3 + 1]) ** 2 + (lab[i * 3 + 2] - lab[j * 3 + 2]) ** 2);
    while (qh < qt){
      const i = qu[qh++], x = i % w, s0 = seedOf[i];
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i + w < n ? i + w : -1];
      for (const j of nb){
        if (j < 0 || reach0[j] || hint[j] === 1) continue;
        if (keepModel && alpha[j] >= 16 && nearKeep(j)) continue;
        const d = alpha[j] < 16 ? 0 : dist(j, s0);
        if (d > tolL) continue;
        if (edge[j] >= thr && hint[j] !== 2) continue;
        reach0[j] = 1; seedOf[j] = d <= innerL ? j : s0; qu[qt++] = j;
      }
    }
  }
  // 4. background color model from the flooded region, subject model from the rest, refined together
  const bgIdx0 = []; for (let i = 0; i < n; i++) if (reach0[i] && alpha[i] >= 16) bgIdx0.push(i);
  let bg = kmeans(lab, bgIdx0.length > 20 ? bgIdx0 : bgSeed, CUT.k + 1, cutModels && cutModels.bg && cutModels.bg.cen.length === CUT.k + 1 ? cutModels.bg.cen : null);
  const dBg = new Float32Array(n), dFg = new Float32Array(n), p = new Float32Array(n);
  for (let i = 0; i < n; i++) dBg[i] = nearestDist(lab, i, bg);
  let fg = null;
  for (let it = 0; it <= CUT.iters; it++){
    const fgIdx = keepIdx.slice(), bgIdx = bgSeed.slice();
    for (let i = 0; i < n; i++){
      if (hint[i] || alpha[i] < 16) continue;
      if (it === 0){ if (nearKeep(i) || (!reach0[i] && dBg[i] > tol * 0.9)) fgIdx.push(i); else if (reach0[i]) bgIdx.push(i); }
      else { if (p[i] < 0.5 || nearKeep(i)) fgIdx.push(i); else bgIdx.push(i); }
    }
    if (fgIdx.length < 20) fg = null;
    else {
      fg = kmeans(lab, fgIdx, Math.min(6, CUT.k + 2), fg ? fg.cen : null);
      // a subject color that is really a background color is decided by where it is, not by the color models
      const near = c => bg.cen.some(d => Math.sqrt((c[0] - d[0]) ** 2 + (c[1] - d[1]) ** 2 + (c[2] - d[2]) ** 2) < tol * 0.9);
      const nearK = c => keepModel && keepModel.cen.some(d => Math.sqrt((c[0] - d[0]) ** 2 + (c[1] - d[1]) ** 2 + (c[2] - d[2]) ** 2) < tol * 0.9);
      const keep = fg.cen.map(c => !near(c) || nearK(c));
      fg.cen = fg.cen.filter((c, k) => keep[k]); fg.spread = fg.spread.filter((c, k) => keep[k]);
      if (!fg.cen.length) fg = null;
    }
    if (it > 0 || bgIdx.length !== bgIdx0.length){ bg = kmeans(lab, bgIdx, CUT.k + 1, bg.cen); for (let i = 0; i < n; i++) dBg[i] = nearestDist(lab, i, bg); }
    for (let i = 0; i < n; i++){
      const pb = Math.pow(2, -((dBg[i] / tol) ** 2));
      if (!fg){ p[i] = pb; continue; }
      dFg[i] = nearestDist(lab, i, fg);
      const pf = Math.pow(2, -((dFg[i] / tol) ** 2));
      // a pixel the flood reached gets a nudge toward background, one it could not reach a nudge toward subject
      const prior = reach0[i] ? 2.5 : 0.4;
      p[i] = (pb * prior + 1e-6) / (pb * prior + pf + 2e-6);
    }
  }
  cutModels = { bg, fg };
  // the hard facts stay fixed
  for (let i = 0; i < n; i++){ if (alpha[i] < 16 || hint[i] === 2) p[i] = 1; else if (hint[i] === 1) p[i] = 0; }
  // 4. edge-aware smoothing of the probabilities
  const r1 = Math.max(1, Math.round(CUT.detail * sc * 1.5)), eps1 = 1e-4 + (CUT.soft / 100) ** 2 * 0.08;
  let q = guidedColor(lab, p, w, h, r1, eps1);
  for (let i = 0; i < n; i++){ if (alpha[i] < 16 || hint[i] === 2) q[i] = 1; else if (hint[i] === 1) q[i] = 0; else q[i] = Math.min(1, Math.max(0, q[i])); }
  // 5. background has to connect to the border; edges block the way into the subject
  const reach = new Uint8Array(n);
  if (CUT.contig){
    let qu = new Int32Array(n), qh = 0, qt = 0;
    for (let i = 0; i < n; i++) if ((isBorder(i) && q[i] >= 0.5) || hint[i] === 2 || alpha[i] < 16){ reach[i] = 1; qu[qt++] = i; }
    while (qh < qt){
      const i = qu[qh++], x = i % w;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i + w < n ? i + w : -1];
      for (const j of nb){
        if (j < 0 || reach[j] || q[j] < 0.5) continue;
        if (edge[j] >= thr && q[j] < 0.9 && hint[j] !== 2) continue;   // a real edge: only sure background crosses it
        reach[j] = 1; qu[qt++] = j;
      }
    }
    // enclosed gaps that look like background are cleared up to the chosen size
    const maxHole = CUT.holes / 100 * n;
    if (maxHole > 0){
      const seen = new Uint8Array(n), comp = [];
      for (let s = 0; s < n; s++){
        if (seen[s] || reach[s] || q[s] < 0.5) continue;
        let h0 = 0, t0 = 0; comp.length = 0; seen[s] = 1; comp.push(s); let sum = 0;
        while (h0 < comp.length){ const i = comp[h0++], x = i % w; sum += q[i];
          const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i + w < n ? i + w : -1];
          for (const j of nb){ if (j < 0 || seen[j] || reach[j] || q[j] < 0.5) continue; seen[j] = 1; comp.push(j); } }
        if (comp.length <= maxHole && sum / comp.length >= 0.7) for (const i of comp) reach[i] = 1;
      }
    }
    for (let i = 0; i < n; i++) if (!reach[i]) q[i] = Math.min(q[i], 0.3);   // background color that the border cannot reach is part of the subject
  }
  if (window.__cutDebug) window.__cutDebug = { w, h, reach0: Array.from(reach0), p: Array.from(p), q: Array.from(q), edge: Array.from(edge), reach: Array.from(reach), bg: bg.cen, fg: fg && fg.cen };
  // 6. back to full size, with one more edge-aware pass against the real pixels so fine detail is kept
  const up = new Float32Array(N), G = new Float32Array(N);
  for (let y = 0; y < H; y++){
    const fy = Math.min(h - 1, Math.max(0, (y + 0.5) * sc - 0.5)), y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < W; x++){
      const fx = Math.min(w - 1, Math.max(0, (x + 0.5) * sc - 0.5)), x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), tx = fx - x0, gi = y * W + x;
      up[gi] = (q[y0 * w + x0] * (1 - tx) + q[y0 * w + x1] * tx) * (1 - ty) + (q[y1 * w + x0] * (1 - tx) + q[y1 * w + x1] * tx) * ty;
      const o = gi * 4; G[gi] = (src[o] * 0.299 + src[o + 1] * 0.587 + src[o + 2] * 0.114) / 255;
    }
  }
  let full = up;
  if (sc < 1 && N <= 24e6){ const r2 = Math.max(1, Math.round(CUT.detail / Math.max(sc, 0.25))); full = guidedGray(G, up, W, H, Math.min(24, r2), 1e-4 + (CUT.soft / 100) ** 2 * 0.03); }
  // 6b. a band along the boundary is unmixed pixel by pixel: how far does each color sit between the nearest
  //     subject color and the nearest background color? That is what keeps single hairs and soft fur edges.
  if (fg && fg.cen.length){
    const bandR = Math.max(2, Math.round(CUT.detail * 1.2));
    const dS = new Float32Array(n).fill(1e9);
    for (let i = 0; i < n; i++){ const x = i % w, y = (i / w) | 0, qi = q[i] >= 0.5; if ((x > 0 && (q[i - 1] >= 0.5) !== qi) || (x < w - 1 && (q[i + 1] >= 0.5) !== qi) || (y > 0 && (q[i - w] >= 0.5) !== qi) || (y < h - 1 && (q[i + w] >= 0.5) !== qi)) dS[i] = 0; }
    for (let i = 0; i < n; i++){ const x = i % w; if (x > 0) dS[i] = Math.min(dS[i], dS[i - 1] + 1); if (i >= w) dS[i] = Math.min(dS[i], dS[i - w] + 1); }
    for (let i = n - 1; i >= 0; i--){ const x = i % w; if (x < w - 1) dS[i] = Math.min(dS[i], dS[i + 1] + 1); if (i + w < n) dS[i] = Math.min(dS[i], dS[i + w] + 1); }
    // busy areas on the subject side of the boundary (hair, fur, lace) are unmixed too, not just the boundary line
    const inBand = new Uint8Array(n);
    { const Lc = new Float32Array(n), L2 = new Float32Array(n); for (let i = 0; i < n; i++){ Lc[i] = lab[i * 3]; L2[i] = Lc[i] * Lc[i]; }
      const nrm = boxNorm(w, h, 2), mL = boxF(Lc, w, h, 2, nrm), mL2 = boxF(L2, w, h, 2, nrm), far = Math.max(bandR * 6, 25);
      for (let i = 0; i < n; i++){ const sd = Math.sqrt(Math.max(0, mL2[i] - mL[i] * mL[i])); inBand[i] = dS[i] <= bandR || (sd > 6 && q[i] < 0.5 && dS[i] <= far) ? 1 : 0; } }
    const lt = new Float32Array(3), bgC = bg.cen, fgC = fg.cen;
    for (let y = 0; y < H; y++){
      const sy = Math.min(h - 1, Math.floor(y * sc));
      for (let x = 0; x < W; x++){
        const sx = Math.min(w - 1, Math.floor(x * sc)); if (!inBand[sy * w + sx]) continue;
        const gi = y * W + x, o = gi * 4; if (src[o + 3] < 16) continue;
        rgb2lab(src[o], src[o + 1], src[o + 2], lt, 0);
        let B = bgC[0], bd = Infinity; for (const c of bgC){ const d = (lt[0] - c[0]) ** 2 + (lt[1] - c[1]) ** 2 + (lt[2] - c[2]) ** 2; if (d < bd){ bd = d; B = c; } }
        let F = fgC[0], fd = Infinity; for (const c of fgC){ const d = (lt[0] - c[0]) ** 2 + (lt[1] - c[1]) ** 2 + (lt[2] - c[2]) ** 2; if (d < fd){ fd = d; F = c; } }
        const vx = B[0] - F[0], vy = B[1] - F[1], vz = B[2] - F[2], L2 = vx * vx + vy * vy + vz * vz;
        if (L2 < tol * tol) continue;   // the two colors are too alike to tell apart here; keep the map's answer
        const px = lt[0] - F[0], py = lt[1] - F[1], pz = lt[2] - F[2];
        let a = (px * vx + py * vy + pz * vz) / L2; a = a < 0 ? 0 : a > 1 ? 1 : a;
        const rx = px - a * vx, ry = py - a * vy, rz = pz - a * vz, resid = Math.sqrt(rx * rx + ry * ry + rz * rz);
        const conf = Math.pow(2, -((resid / tol) ** 2));   // how well the color fits a mix of those two
        full[gi] = full[gi] * (1 - conf) + a * conf;
      }
    }
  }
  // 7. contrast: how sharply the soft map turns into erased / kept
  const width = 0.04 + (1 - CUT.contrast / 100) * 0.9, lo = 0.5 - width / 2;
  let count = 0;
  for (let gi = 0; gi < N; gi++){
    let v = (full[gi] - lo) / width; v = v < 0 ? 0 : v > 1 ? 1 : v;
    const o = gi * 4; if (src[o + 3] < 16) v = 1;
    if (hints){ const hv = hints[gi]; if (hv === 1) v = 0; else if (hv === 2) v = 1; }
    const a = (v * 255 + 0.5) | 0; out[gi] = a; if (a) count++;
  }
  return count;
}

// ---------- hint brushes (mark subject / mark background) ----------
function hintsOf(){ if (!AL) return null; if (!AL.hints || AL.hints.length !== W * H) AL.hints = new Uint8Array(W * H); return AL.hints; }
let hintStroke = null;
function hintDab(ix, iy, v){
  const hs = hintsOf(); if (!hs) return;
  const r = Math.max(1, CUT.hintSize / 2 / (S.rel === 'screen' ? S.zoom : 1));
  const x0 = Math.max(0, Math.floor(ix - r)), y0 = Math.max(0, Math.floor(iy - r)), x1 = Math.min(W - 1, Math.ceil(ix + r)), y1 = Math.min(H - 1, Math.ceil(iy + r));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++){ const dx = x + 0.5 - ix, dy = y + 0.5 - iy; if (dx * dx + dy * dy <= r * r) hs[y * W + x] = v; }
}
function hintDown(e, p){
  if (!W) return true; const [ix, iy] = toImg(p);
  const v = S.tool === 'hintKeep' ? 1 : 2;
  hintStroke = { v: e.altKey ? 0 : (e.button === 2 ? (v === 1 ? 2 : 1) : v), last: [ix, iy] };
  hintDab(ix, iy, hintStroke.v); requestOverlay(); return true;
}
function hintMove(e, p){
  if (!hintStroke) return false; const [ix, iy] = toImg(p), [lx, ly] = hintStroke.last;
  const d = Math.hypot(ix - lx, iy - ly), st = Math.max(1, CUT.hintSize / 6 / (S.rel === 'screen' ? S.zoom : 1)), k = Math.ceil(d / st);
  for (let i = 1; i <= k; i++) hintDab(lx + (ix - lx) * i / k, ly + (iy - ly) * i / k, hintStroke.v);
  hintStroke.last = [ix, iy]; requestOverlay(); return true;
}
function hintUp(){ if (!hintStroke) return false; hintStroke = null; scheduleAutoPreview(); return true; }
function clearHints(){ if (AL && AL.hints){ AL.hints = null; requestOverlay(); scheduleAutoPreview(); sbFlash('Hints cleared.'); } }
function drawHintCursor(){
  const hv = S.hover; if (!hv || pan || S.space || (S.tool !== 'hintKeep' && S.tool !== 'hintDrop')) return;
  const rr = CUT.hintSize / 2 * (S.rel === 'screen' ? 1 : S.zoom);
  vctx.save(); vctx.beginPath(); vctx.arc(hv.x, hv.y, Math.max(1, rr), 0, Math.PI * 2);
  vctx.lineWidth = 3; vctx.strokeStyle = 'rgba(0,0,0,.5)'; vctx.stroke(); vctx.lineWidth = 1.5; vctx.strokeStyle = S.tool === 'hintKeep' ? '#36d55a' : '#eb28be'; vctx.stroke(); vctx.restore();
}

// ---------- the page ----------
PAGE_INFO.auto = ['Remove background', 'auto'];
TOOL_PAGE.hintKeep = 'auto'; TOOL_PAGE.hintDrop = 'auto';
function cutBind(id, key, fmt, after){
  const el = $('#' + id), out = $('#' + id + 'Out'); if (!el) return;
  el.value = CUT[key]; if (out) out.textContent = fmt(CUT[key]);
  el.addEventListener('input', () => { CUT[key] = +el.value; if (out) out.textContent = fmt(CUT[key]); saveCut(); cutModels = null; if (after) after(); scheduleAutoPreview(); });
}
CUT.atol = S.atol;
$('#atol').addEventListener('input', () => { CUT.atol = S.atol; cutModels = null; });
cutBind('aEdge', 'edge', v => v + '%'); cutBind('aK', 'k', v => v === 1 ? '1 color' : v + ' colors'); cutBind('aBorder', 'border', v => v + '%');
cutBind('aDetail', 'detail', v => v + ' px'); cutBind('aSoft', 'soft', v => v + '%'); cutBind('aHoles', 'holes', v => v === 0 ? 'Keep all' : 'up to ' + v + '%');
cutBind('aIters', 'iters', v => v === 0 ? 'Quick' : v + (v === 1 ? ' pass' : ' passes')); cutBind('aContrast', 'contrast', v => v + '%');
cutBind('aHintSize', 'hintSize', v => v + ' px', () => requestDraw());
$('#aContig').checked = CUT.contig; $('#aContig').addEventListener('change', e => { CUT.contig = e.target.checked; saveCut(); scheduleAutoPreview(); });
$('#aShowHints').checked = CUT.showHints; $('#aShowHints').addEventListener('change', e => { CUT.showHints = e.target.checked; saveCut(); requestOverlay(); });
segSet('#aMethod', 'v', CUT.method);
segBind('#aMethod', 'v', v => { CUT.method = v; saveCut(); $$('[data-am]').forEach(el => el.hidden = !el.dataset.am.split(' ').includes(v)); scheduleAutoPreview(); });
$$('[data-am]').forEach(el => el.hidden = !el.dataset.am.split(' ').includes(CUT.method));
$('#aHintKeep').addEventListener('click', () => setTool('hintKeep'));
$('#aHintDrop').addEventListener('click', () => setTool('hintDrop'));
$('#aHintClear').addEventListener('click', clearHints);
$('#aPreset').addEventListener('change', e => {
  const v = e.target.value; if (!v) return;
  const P = {
    plain: { atol: 22, edge: 55, k: 2, border: 4, detail: 3, soft: 25, holes: 3, iters: 1, contrast: 50 },
    busy: { atol: 30, edge: 45, k: 5, border: 6, detail: 2, soft: 15, holes: 2, iters: 3, contrast: 60 },
    hair: { atol: 26, edge: 40, k: 3, border: 4, detail: 6, soft: 10, holes: 1, iters: 2, contrast: 25 },
    product: { atol: 18, edge: 65, k: 2, border: 3, detail: 2, soft: 30, holes: 8, iters: 1, contrast: 75 },
    logo: { atol: 12, edge: 80, k: 1, border: 2, detail: 1, soft: 40, holes: 20, iters: 0, contrast: 95 }
  }[v];
  Object.assign(CUT, P); S.atol = P.atol; $('#atol').value = P.atol; $('#atolOut').textContent = P.atol + '%';
  [['aEdge', 'edge'], ['aK', 'k'], ['aBorder', 'border'], ['aDetail', 'detail'], ['aSoft', 'soft'], ['aHoles', 'holes'], ['aIters', 'iters'], ['aContrast', 'contrast']].forEach(([id, k]) => { $('#' + id).value = CUT[k]; $('#' + id).dispatchEvent(new Event('input')); });
  e.target.value = ''; sbFlash('Preset applied. Turn on the preview to see the result before removing.');
});
// perceptual color matching for the brush, wand and classic remover
S.labMatch = !!store.get('labMatch', false);
$('#labMatch').checked = S.labMatch; $('#labMatch').addEventListener('change', e => { S.labMatch = e.target.checked; store.set('labMatch', S.labMatch); });
S.edgeWide = !!store.get('edgeWide', false);
$('#edgeWide').checked = S.edgeWide; $('#edgeWide').addEventListener('change', e => { S.edgeWide = e.target.checked; store.set('edgeWide', S.edgeWide); resetEdges(); });
