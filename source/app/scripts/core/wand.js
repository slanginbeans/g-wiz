// ---------- magic wand ----------
async function wandAt(ix, iy, restore, noEdges){
  const px = Math.floor(ix), py = Math.floor(iy);
  if (px < 0 || py < 0 || px >= W || py >= H) return;
  stopPlay(); busy(true); await new Promise(r => setTimeout(r, 16));
  try {
    const N = W * H, amt8 = new Uint8Array(N), vis = new Uint8Array(N);
    let q = new Int32Array(1 << 16);
    let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
    beginOp();
    for (const f of op.fs){
      // every frame is flood-filled from its own pixels with its own sampled color
      const src = frames[f], cAmt = colorAmtFn(sampleAt(px, py, f), S.wtol);
      amt8.fill(0);
      let fx0 = W, fy0 = H, fx1 = -1, fy1 = -1;
      const mark = (gi, a) => { const v = (a * 255 + 0.5) | 0; if (v > amt8[gi]){ amt8[gi] = v; const x = gi % W, y = (gi / W) | 0; if (x < fx0) fx0 = x; if (x > fx1) fx1 = x; if (y < fy0) fy0 = y; if (y > fy1) fy1 = y; } };
      if (!S.wcontig){
        for (let gi = 0; gi < N; gi++){ const a = cAmt(src, gi * 4); if (a > 0) mark(gi, a); }
      } else {
        const useEdge = S.wedges && !noEdges, edge = useEdge ? ensureEdges(f, 0, 0, W, H) : null;
        const thr = edgeThr(S.wedge);
        vis.fill(0); let qh = 0, qt = 0;
        const push = v => { if (qt >= q.length){ if (qh > q.length / 2){ q.copyWithin(0, qh, qt); qt -= qh; qh = 0; } else { const nq = new Int32Array(q.length * 2); nq.set(q); q = nq; } } q[qt++] = v; };
        const s0 = py * W + px; vis[s0] = 1; push(s0);
        while (qh < qt){
          const gi = q[qh++];
          mark(gi, cAmt(src, gi * 4));
          const x = gi % W;
          const nb = [x > 0 ? gi - 1 : -1, x < W - 1 ? gi + 1 : -1, gi >= W ? gi - W : -1, gi + W < N ? gi + W : -1];
          for (const n of nb){
            if (n < 0 || vis[n]) continue; vis[n] = 1;
            const a = cAmt(src, n * 4); if (a <= 0) continue;
            if (useEdge && edge[n] >= thr){ mark(n, a); continue; }
            push(n);
          }
        }
      }
      if (fx1 < 0) continue;
      const m = masks[f];
      for (let y = fy0; y <= fy1; y++) for (let x = fx0, gi = y * W + fx0; x <= fx1; x++, gi++){
        const v = amt8[gi]; if (!v) continue;
        if (restore){ if (m[gi] < v) m[gi] = v; } else { const t = 255 - v; if (m[gi] > t) m[gi] = t; }
      }
      bx0 = Math.min(bx0, fx0); by0 = Math.min(by0, fy0); bx1 = Math.max(bx1, fx1); by1 = Math.max(by1, fy1);
    }
    if (bx1 < 0){ op = null; toast('Nothing matched there. Raise the tolerance.'); return; }
    touchOp(bx0, by0, bx1 + 1, by1 + 1); endOp(); renderRect(bx0, by0, bx1 + 1, by1 + 1);
  } finally { busy(false); }
}
