// ---------- brush ----------
let amt = new Float32Array(0), visited = new Uint8Array(0), queue = new Int32Array(0);
function scratch(n){ if (amt.length < n){ amt = new Float32Array(n); visited = new Uint8Array(n); queue = new Int32Array(n); } }
const brushR = () => Math.max(0.5, S.rel === 'screen' ? S.size / 2 / S.zoom : S.size / 2);

let stroke = null, strokeMark = null;
function beginStroke(ix, iy, restore, pointerType, shift){
  stopPlay();
  stroke = { restore, last: [ix, iy], t: performance.now(), touch: pointerType === 'touch', force: S.force || !!shift, samples: new Map() };
  if (S.hiStroke){ if (!strokeMark || strokeMark.length !== W * H) strokeMark = new Uint8Array(W * H); else strokeMark.fill(0); }
  beginOp();
  // each frame gets its own sampled color, so a background that changes color between frames is still matched
  for (const f of op.fs) stroke.samples.set(f, sampleAt(ix, iy, f));
  S.sample = stroke.samples.get(S.cur);
  dab(ix, iy);
}
function moveStroke(ix, iy){
  const [lx, ly] = stroke.last, dx = ix - lx, dy = iy - ly, dist = Math.hypot(dx, dy);
  const sp = Math.max(0.5, brushR() * 0.22);
  if (dist < sp) return;
  const steps = Math.floor(dist / sp);
  for (let k = 1; k <= steps; k++) dab(lx + dx * (k * sp / dist), ly + dy * (k * sp / dist));
  stroke.last = [lx + dx * (steps * sp / dist), ly + dy * (steps * sp / dist)];
}
function endStroke(){
  if (!stroke) return;
  const bb = op && op.x1 > op.x0 ? [op.x0, op.y0, op.x1, op.y1] : null, hadMark = S.hiStroke;
  stroke = null; endOp(); updateHud();
  if (hadMark && bb){ renderRect(bb[0], bb[1], bb[2], bb[3]); strokeMark && strokeMark.fill(0); }
}

function dab(cx, cy){
  const r = brushR();
  const x0 = Math.max(0, Math.floor(cx - r)), y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(W - 1, Math.ceil(cx + r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  if (x0 > x1 || y0 > y1) return;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  scratch(bw * bh);
  const restore = stroke.restore, mode = stroke.force ? 'plain' : S.mode;
  const useColor = !restore && (mode === 'smart' || mode === 'color');
  const useEdge = mode === 'smart' || mode === 'edges';
  const fs = op ? op.fs : [S.cur];
  let plainDone = false;
  for (const f of fs){
    // detection runs on each frame's own pixels; plain brushing is identical for every frame, so compute it once
    if (useColor && S.samp === 'cont'){ const s = sampleAt(cx, cy, f); if (s) stroke.samples.set(f, s); }
    if (f === S.cur && useColor) S.sample = stroke.samples.get(f);
    if (!(useColor || useEdge) && plainDone){ applyFrame(f, x0, y0, bw, bh, restore); continue; }
    computeAmt(f, cx, cy, r, x0, y0, x1, y1, useColor, useEdge);
    plainDone = true;
    applyFrame(f, x0, y0, bw, bh, restore);
  }
  touchOp(x0, y0, x0 + bw, y0 + bh);
  renderRect(x0, y0, x0 + bw, y0 + bh);
}

function computeAmt(f, cx, cy, r, x0, y0, x1, y1, useColor, useEdge){
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, n = bw * bh, r2 = r * r, src = frames[f];
  amt.fill(0, 0, n);
  const sc = useColor ? stroke.samples.get(f) : null;
  const cAmt = sc ? colorAmtFn(sc, S.tol) : null;
  const hard = Math.min(0.999, S.hard / 100);
  const fall = (lx, ly) => {
    const dx = x0 + lx + 0.5 - cx, dy = y0 + ly + 0.5 - cy, d2 = dx * dx + dy * dy;
    if (d2 > r2 + 0.25) return 0;
    const t = Math.sqrt(d2) / r; if (t <= hard) return 1;
    const u = Math.min(1, (t - hard) / (1 - hard)); return 1 - u * u * (3 - 2 * u);
  };
  if (!useEdge){
    for (let ly = 0; ly < bh; ly++) for (let lx = 0; lx < bw; lx++){
      let a = fall(lx, ly); if (a <= 0) continue;
      if (cAmt) a *= cAmt(src, ((y0 + ly) * W + x0 + lx) * 4);
      amt[ly * bw + lx] = a;
    }
    return;
  }
  const edge = ensureEdges(f, x0, y0, x1 + 1, y1 + 1);
  const thr = edgeThr(S.edge), thr2 = Math.min(255, thr * 2.2);
  visited.fill(0, 0, n);
  let qh = 0, qt = 0;
  const gidx = l => (y0 + ((l / bw) | 0)) * W + x0 + (l % bw);
  const passable = (l) => { const gi = gidx(l); if (edge[gi] >= thr) return false; return !cAmt || cAmt(src, gi * 4) > 0; };
  const ccx = Math.min(x1, Math.max(x0, Math.floor(cx))) - x0, ccy = Math.min(y1, Math.max(y0, Math.floor(cy))) - y0;
  const c0 = ccy * bw + ccx;
  if (passable(c0)){ visited[c0] = 1; queue[qt++] = c0; }
  else {
    const rs = Math.max(1.5, r * 0.2);
    for (let ly = Math.max(0, Math.floor(ccy - rs)); ly <= Math.min(bh - 1, Math.ceil(ccy + rs)); ly++)
      for (let lx = Math.max(0, Math.floor(ccx - rs)); lx <= Math.min(bw - 1, Math.ceil(ccx + rs)); lx++){
        const l = ly * bw + lx; if ((lx - ccx) ** 2 + (ly - ccy) ** 2 > rs * rs) continue;
        if (passable(l)){ visited[l] = 1; queue[qt++] = l; }
      }
  }
  while (qh < qt){
    const l = queue[qh++], lx = l % bw, ly = (l / bw) | 0;
    const fl = fall(lx, ly); if (fl <= 0) continue;
    const gi = gidx(l);
    amt[l] = cAmt ? fl * cAmt(src, gi * 4) : fl;
    const nb = [lx > 0 ? l - 1 : -1, lx < bw - 1 ? l + 1 : -1, ly > 0 ? l - bw : -1, ly < bh - 1 ? l + bw : -1];
    for (const q of nb){
      if (q < 0 || visited[q]) continue; visited[q] = 1;
      const fq = fall(q % bw, (q / bw) | 0); if (fq <= 0) continue;
      if (passable(q)){ queue[qt++] = q; continue; }
      // rim pixel: sits on the edge itself; take a partial amount so cut-outs keep soft edges
      const gq = gidx(q);
      if (cAmt){ const ca = cAmt(src, gq * 4); if (ca > 0) amt[q] = Math.max(amt[q], fq * ca); }
      else { const e = edge[gq]; amt[q] = Math.max(amt[q], fq * Math.max(0, Math.min(1, (thr2 - e) / (thr2 - thr))) * 0.6); }
    }
  }
}

function applyFrame(f, x0, y0, bw, bh, restore){
  const m = masks[f], mark = (f === S.cur && stroke && S.hiStroke) ? strokeMark : null;
  for (let ly = 0; ly < bh; ly++){
    const row = (y0 + ly) * W + x0, lr = ly * bw;
    for (let lx = 0; lx < bw; lx++){
      const a = amt[lr + lx]; if (a <= 0.004) continue;
      const v = (a * 255 + 0.5) | 0, gi = row + lx;
      if (restore){ if (m[gi] < v) m[gi] = v; } else { const t = 255 - v; if (m[gi] > t) m[gi] = t; }
      if (mark && v > mark[gi]) mark[gi] = v;
    }
  }
}
