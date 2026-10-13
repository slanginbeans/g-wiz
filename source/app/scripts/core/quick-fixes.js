// ---------- quick fixes ----------
// Works out how strongly each pixel of frame f would be erased by automatic background removal (0..255 in out).
function autoAmt(f, out){
  const N = W * H, seed = new Int32Array(N), vis = new Uint8Array(N);
  let q = new Int32Array(1 << 16), qh = 0, qt = 0;
  if (CUT.method === 'smart' || CUT.method === 'ai') return smartAmt(f, out, CUT.method === 'ai');
  const tol = 6 + S.atol * 1.6, inner = tol * 0.5, span = tol - inner, thr = edgeThr(CUT.edge);
  const src = frames[f], edge = ensureEdges(f, 0, 0, W, H);
  out.fill(0);
  const push = v => { if (qt >= q.length){ if (qh > q.length / 2){ q.copyWithin(0, qh, qt); qt -= qh; qh = 0; } else { const nq = new Int32Array(q.length * 2); nq.set(q); q = nq; } } q[qt++] = v; };
  // the background is whatever color dominates the image border
  const border = [];
  for (let x = 0; x < W; x++){ border.push(x, (H - 1) * W + x); }
  for (let y = 1; y < H - 1; y++){ border.push(y * W, y * W + W - 1); }
  const hist = new Map(); let total = 0;
  const key = gi => { const p = gi * 4; return ((src[p] >> 4) << 8) | ((src[p + 1] >> 4) << 4) | (src[p + 2] >> 4); };
  for (const gi of border){ if (src[gi * 4 + 3] < 128) continue; const k = key(gi); hist.set(k, (hist.get(k) || 0) + 1); total++; }
  const dom = new Set(); let best = -1, bestN = 0;
  for (const [k, n] of hist){ if (n >= total * 0.06) dom.add(k); if (n > bestN){ bestN = n; best = k; } }
  if (best >= 0) dom.add(best);
  const near = k => { if (dom.has(k)) return true; const r = k >> 8, g = (k >> 4) & 15, b = k & 15;
    for (const d of dom){ if (Math.abs((d >> 8) - r) <= 1 && Math.abs(((d >> 4) & 15) - g) <= 1 && Math.abs((d & 15) - b) <= 1) return true; } return false; };
  for (const gi of border){
    if (vis[gi]) continue;
    if (src[gi * 4 + 3] < 128 || near(key(gi))){ vis[gi] = 1; seed[gi] = gi; out[gi] = 255; push(gi); }
  }
  let count = 0;
  while (qh < qt){
    const gi = q[qh++], s0 = seed[gi], x = gi % W, sp = s0 * 4;
    const nb = [x > 0 ? gi - 1 : -1, x < W - 1 ? gi + 1 : -1, gi >= W ? gi - W : -1, gi + W < N ? gi + W : -1];
    for (const n of nb){
      if (n < 0 || vis[n]) continue;
      const p = n * 4; let a;
      if (src[p + 3] < 16) a = 1;
      else { const dr = src[p] - src[sp], dg = src[p + 1] - src[sp + 1], db = src[p + 2] - src[sp + 2]; const d = Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9); a = d <= inner ? 1 : d >= tol ? 0 : 1 - (d - inner) / span; }
      if (a <= 0) continue;
      vis[n] = 1; const v = (a * 255 + 0.5) | 0; if (v > out[n]) out[n] = v;
      if (edge[n] >= thr) continue;          // rim of the subject: partly erased, not crossed
      seed[n] = a >= 1 ? n : s0;              // follow gentle gradients in the background
      push(n);
    }
  }
  for (let i = 0; i < N; i++) if (out[i]) count++;
  return count;
}
// Blends each frame's removal amounts with the same pixels of up to two frames before and after it, where the
// picture is the same there (so a still background or subject stops flickering, and a moving one is not smeared).
function steadyAmounts(fs, amts){
  const N = W * H, k = CUT.aiSmooth / 100, out = amts.map(() => new Uint8Array(N)), s2 = 2 * 20 * 20;
  for (let a = 0; a < fs.length; a++){
    const fa = frames[fs[a]], o = out[a];
    for (let i = 0; i < N; i++){
      const p = i * 4; let sum = amts[a][i], wsum = 1;
      for (let d = -2; d <= 2; d++){
        const b = a + d; if (!d || b < 0 || b >= fs.length) continue;
        const fb = frames[fs[b]], dr = fa[p] - fb[p], dg = fa[p + 1] - fb[p + 1], db = fa[p + 2] - fb[p + 2];
        const w = Math.pow(k, Math.abs(d)) * Math.exp(-(dr * dr + dg * dg + db * db) / s2);
        sum += w * amts[b][i]; wsum += w;
      }
      o[i] = Math.round(sum / wsum);
    }
  }
  for (let a = 0; a < fs.length; a++) amts[a].set(out[a]);
}
async function autoRemove(){
  if (!W) return; stopPlay(); busy(true); await new Promise(r => setTimeout(r, 16));
  try {
    if (CUT.method === 'ai' && !(await aiReady(targetFrames()))) return;
    const N = W * H;
    let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
    beginOp();
    // with the AI and "Steady across frames", every frame is worked out first and then steadied against its neighbors
    const steady = CUT.method === 'ai' && CUT.aiSmooth > 0 && op.fs.length > 2 && N * op.fs.length <= 256e6;
    const amts = steady ? op.fs.map(f => { const a = new Uint8Array(N); autoAmt(f, a); return a; }) : null;
    if (steady) steadyAmounts(op.fs, amts);
    const amt8 = steady ? null : new Uint8Array(N);
    for (let k = 0; k < op.fs.length; k++){
      const f = op.fs[k], amt = steady ? amts[k] : (autoAmt(f, amt8), amt8);
      const m = masks[f], amt8_ = amt;
      for (let gi = 0; gi < N; gi++){ const v = amt8_[gi]; if (!v) continue; const t = 255 - v; if (m[gi] > t){ m[gi] = t; const x = gi % W, y = (gi / W) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; } }
    }
    if (bx1 < 0){ op = null; toast('No background found along the border. Raise the tolerance or use the wand.', 4000); return; }
    const nf = op.fs.length;
    touchOp(bx0, by0, bx1 + 1, by1 + 1); endOp(); renderRect(bx0, by0, bx1 + 1, by1 + 1);
    toast('Background removed' + (nf > 1 ? ' on ' + nf + ' frames' : '') + '. Undo if it took too much.');
  } finally { busy(false); }
}
