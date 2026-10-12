// ---------- free transform (Move tool) ----------
var XF = null;
const rectQuad = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
function xfBegin(){
  if (!AL || XF) return;
  if (AL.locked){ toast('The selected layer is locked.'); return; }
  saveActive();
  XF = { quad: rectQuad(AL.x, AL.y, W, H), drag: null, pv: null, pvKey: '' };
  requestDraw();
}
function xfCancel(silent){ if (!XF) return; XF = null; requestDraw(); if (!silent) sbFlash('Transform cancelled.'); }
function quadIsAffine(q){ return Math.abs(q[0][0] + q[2][0] - q[1][0] - q[3][0]) < 0.02 && Math.abs(q[0][1] + q[2][1] - q[1][1] - q[3][1]) < 0.02; }
function quadIsTranslate(q){ return Math.abs(q[1][0] - q[0][0] - W) < 0.01 && Math.abs(q[1][1] - q[0][1]) < 0.01 && Math.abs(q[3][1] - q[0][1] - H) < 0.01 && Math.abs(q[3][0] - q[0][0]) < 0.01 && quadIsAffine(q); }
// homography mapping layer pixels (0..W, 0..H) onto the quad
function homography(w, h, q){
  const src = [[0, 0], [w, 0], [w, h], [0, h]], A = [], b = [];
  for (let i = 0; i < 4; i++){
    const [x, y] = src[i], [u, v] = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  for (let c = 0; c < 8; c++){
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r++){ if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
  }
  const hh = b.map((v, i) => v / A[i][i]);
  return [hh[0], hh[1], hh[2], hh[3], hh[4], hh[5], hh[6], hh[7], 1];
}
function inv3(m){
  const [a, b, c, d, e, f, g, h, i] = m, A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
// resample one frame + mask through the quad into a new bitmap covering its bounding box
function warpFrame(src, m, w, h, Hinv, bx, by, nw, nh, scale, nearest){
  const out = new Uint8ClampedArray(nw * nh * 4), om = m ? new Uint8Array(nw * nh) : null;
  for (let y = 0; y < nh; y++){
    const py = by + (y + 0.5) / scale;
    for (let x = 0; x < nw; x++){
      const px = bx + (x + 0.5) / scale;
      const zz = Hinv[6] * px + Hinv[7] * py + Hinv[8], sx = (Hinv[0] * px + Hinv[1] * py + Hinv[2]) / zz, sy = (Hinv[3] * px + Hinv[4] * py + Hinv[5]) / zz;
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const di = y * nw + x, o = di * 4;
      if (nearest){ const si = (sy | 0) * w + (sx | 0); out[o] = src[si * 4]; out[o + 1] = src[si * 4 + 1]; out[o + 2] = src[si * 4 + 2]; out[o + 3] = src[si * 4 + 3]; if (om) om[di] = m[si]; continue; }
      const fx = sx - 0.5, fy = sy - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      let pa = 0, pr = 0, pg = 0, pb = 0, pm = 0, win = 0;
      for (let k = 0; k < 4; k++){
        const xx = Math.min(w - 1, Math.max(0, x0 + (k & 1))), yy = Math.min(h - 1, Math.max(0, y0 + (k >> 1)));
        const wgt = ((k & 1) ? tx : 1 - tx) * ((k >> 1) ? ty : 1 - ty), si = yy * w + xx, a = src[si * 4 + 3] * wgt;
        pa += a; pr += src[si * 4] * a; pg += src[si * 4 + 1] * a; pb += src[si * 4 + 2] * a; if (m) pm += m[si] * wgt; win += wgt;
      }
      if (pa > 0){ out[o] = pr / pa; out[o + 1] = pg / pa; out[o + 2] = pb / pa; out[o + 3] = pa; }
      if (om) om[di] = pm / win;
    }
  }
  return [out, om];
}
function quadBox(q){ const xs = q.map(p => p[0]), ys = q.map(p => p[1]); const x0 = Math.floor(Math.min(...xs)), y0 = Math.floor(Math.min(...ys)); return [x0, y0, Math.ceil(Math.max(...xs)) - x0, Math.ceil(Math.max(...ys)) - y0]; }
function xfDrawPreview(g){
  const q = XF.quad, z = S.zoom, dx = S.panX, dy = S.panY;
  if (quadIsAffine(q)){
    g.save();
    const ax = (q[1][0] - q[0][0]) / W, ay = (q[1][1] - q[0][1]) / W, bx = (q[3][0] - q[0][0]) / H, by = (q[3][1] - q[0][1]) / H;
    g.transform(ax * z, ay * z, bx * z, by * z, dx + q[0][0] * z, dy + q[0][1] * z);
    g.imageSmoothingEnabled = true; g.drawImage(imgCanvas, 0, 0);
    g.restore(); return;
  }
  const key = q.map(p => p.join(',')).join(';');
  if (XF.pvKey !== key){
    const [bx, by, bw, bh] = quadBox(q), sc = Math.min(1, Math.sqrt(250000 / Math.max(1, bw * bh)));
    const nw = Math.max(1, Math.round(bw * sc)), nh = Math.max(1, Math.round(bh * sc));
    const Hinv = inv3(homography(W, H, q.map(([x, y]) => [x, y])));
    const [out] = warpFrame(disp.data, null, W, H, Hinv, bx, by, nw, nh, sc, true);
    XF.pv = { c: toCanvas(out, nw, nh), bx, by, bw, bh }; XF.pvKey = key;
  }
  const p = XF.pv; g.imageSmoothingEnabled = true; g.drawImage(p.c, dx + p.bx * z, dy + p.by * z, p.bw * z, p.bh * z);
}
function xfCommit(){
  if (!XF) return; const q = XF.quad; XF = null;
  if (quadIsTranslate(q)){
    const nx = Math.round(q[0][0]), ny = Math.round(q[0][1]);
    if (nx !== AL.x || ny !== AL.y){ const before = captureDoc(); AL.x = nx; AL.y = ny; pushLayersUndo(before); syncLayerProps(); }
    requestDraw(); return;
  }
  const [bx, by, bw, bh] = quadBox(q);
  if (bw * bh > 60e6 || bw < 1 || bh < 1){ toast('That transform is too large.'); requestDraw(); return; }
  busy(true);
  try {
    const Hinv = inv3(homography(W, H, q));
    const res = frames.map((f, i) => warpFrame(f, masks[i], W, H, Hinv, bx, by, bw, bh, 1, false));
    geomCommit(res.map(r => r[0]), res.map(r => r[1]), bw, bh, 'Transformed the layer.', bx, by);
  } finally { busy(false); }
}
function xfHandles(){
  const z = S.zoom, s = XF.quad.map(([x, y]) => [S.panX + x * z, S.panY + y * z]);
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const e = [mid(s[0], s[1]), mid(s[1], s[2]), mid(s[2], s[3]), mid(s[3], s[0])];
  const c = [(s[0][0] + s[2][0]) / 2, (s[0][1] + s[2][1]) / 2];
  const nx = e[0][0] - c[0], ny = e[0][1] - c[1], nl = Math.hypot(nx, ny) || 1;
  const rot = [e[0][0] + nx / nl * 22, e[0][1] + ny / nl * 22];
  return { s, e, c, rot };
}
function pointInQuad(p, s){ let inside = false; for (let i = 0, j = 3; i < 4; j = i++){ const [xi, yi] = s[i], [xj, yj] = s[j]; if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) inside = !inside; } return inside; }
function xfHit(p){
  const h = xfHandles(), tol = HIT_TOL(), near = (a) => Math.abs(p.x - a[0]) <= tol && Math.abs(p.y - a[1]) <= tol;
  if (Math.hypot(p.x - h.rot[0], p.y - h.rot[1]) <= tol + 1) return 'rot';
  for (let i = 0; i < 4; i++) if (near(h.s[i])) return 'c' + i;
  for (let i = 0; i < 4; i++) if (near(h.e[i])) return 'e' + i;
  if (pointInQuad(p, h.s)) return 'move';
  return 'outside';
}
const XF_CURSOR = { c0: 'nwse-resize', c2: 'nwse-resize', c1: 'nesw-resize', c3: 'nesw-resize', e0: 'ns-resize', e2: 'ns-resize', e1: 'ew-resize', e3: 'ew-resize', move: 'move', rot: 'grab', outside: 'default' };
function topLayerAt(dxp, dyp){
  for (let k = layers.length - 1; k >= 0; k--){
    const L = layers[k]; if (!L.visible) continue;
    const lx = Math.floor(dxp - L.x), ly = Math.floor(dyp - L.y);
    if (lx < 0 || ly < 0 || lx >= L.W || ly >= L.H) continue;
    const fr = lfr(L), ms = L === AL ? masks : L.masks, fi = S.dcur % fr.length, i = ly * L.W + lx;
    if (fr[fi][i * 4 + 3] * ms[fi][i] > 255 * 20) return L;
  }
  return null;
}
function xfDown(e, p){
  if (!AL) return;
  if (!XF){
    // a press on the selected layer's handles always transforms it; elsewhere Auto pick selects the layer under the pointer
    XF = { quad: rectQuad(AL.x, AL.y, W, H) }; const m0 = xfHit(p); XF = null;
    if (m0 === 'move' || m0 === 'outside'){ const [dx0, dy0] = toDoc(p), hitL = topLayerAt(dx0, dy0); if (hitL && hitL !== AL && S.xAuto) activateLayer(hitL); }
    xfBegin(); if (!XF) return;
  }
  let mode = xfHit(p);
  if (mode === 'outside'){
    const [dx0, dy0] = toDoc(p), hitL = topLayerAt(dx0, dy0);
    if (hitL && hitL !== AL){ xfCommit(); activateLayer(hitL); xfBegin(); if (!XF) return; mode = 'move'; }
    else mode = 'rot';
  }
  const [mx, my] = toDoc(p);
  XF.drag = { mode, start: XF.quad.map(q => q.slice()), mx, my, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, ang: null };
  if (mode === 'rot'){ const c = quadCenter(XF.quad); XF.drag.ang = Math.atan2(my - c[1], mx - c[0]); }
}
const quadCenter = q => [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4];
function solve2(e1, e2, v){ const det = e1[0] * e2[1] - e1[1] * e2[0]; if (Math.abs(det) < 1e-9) return [1, 1]; return [(v[0] * e2[1] - v[1] * e2[0]) / det, (e1[0] * v[1] - e1[1] * v[0]) / det]; }
function xfMove(e, p){
  if (!XF || !XF.drag) return;
  const d = XF.drag, [mx, my] = toDoc(p), st = d.start, q = st.map(c => c.slice());
  const shift = e.shiftKey, ctrl = e.ctrlKey || e.metaKey;
  if (d.mode === 'move'){
    let ox = mx - d.mx, oy = my - d.my;
    if (shift){ if (Math.abs(ox) > Math.abs(oy)) oy = 0; else ox = 0; }
    for (const c of q){ c[0] += ox; c[1] += oy; }
  } else if (d.mode === 'rot'){
    const c = quadCenter(st); let a = Math.atan2(my - c[1], mx - c[0]) - d.ang;
    if (shift) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
    const cs = Math.cos(a), sn = Math.sin(a);
    st.forEach((s, i) => { const x = s[0] - c[0], y = s[1] - c[1]; q[i][0] = c[0] + x * cs - y * sn; q[i][1] = c[1] + x * sn + y * cs; });
  } else if (d.mode[0] === 'c'){
    const k = +d.mode[1];
    if (ctrl){ q[k][0] = st[k][0] + mx - d.mx; q[k][1] = st[k][1] + my - d.my; }
    else {
      const an = st[(k + 2) % 4], e1 = [st[(k + 3) % 4][0] - an[0], st[(k + 3) % 4][1] - an[1]], e2 = [st[(k + 1) % 4][0] - an[0], st[(k + 1) % 4][1] - an[1]];
      let [al, be] = solve2(e1, e2, [mx - an[0], my - an[1]]);
      if (shift){ const s = (Math.abs(al) + Math.abs(be)) / 2; al = Math.sign(al || 1) * s; be = Math.sign(be || 1) * s; }
      q[(k + 2) % 4] = an.slice(); q[(k + 3) % 4] = [an[0] + al * e1[0], an[1] + al * e1[1]];
      q[k] = [an[0] + al * e1[0] + be * e2[0], an[1] + al * e1[1] + be * e2[1]]; q[(k + 1) % 4] = [an[0] + be * e2[0], an[1] + be * e2[1]];
    }
  } else if (d.mode[0] === 'e'){
    const i = +d.mode[1], j = (i + 1) % 4, ip = (i + 3) % 4, jp = (j + 1) % 4;
    if (ctrl){
      const along = [st[j][0] - st[i][0], st[j][1] - st[i][1]], len2 = along[0] ** 2 + along[1] ** 2 || 1;
      const t = ((mx - d.mx) * along[0] + (my - d.my) * along[1]) / len2;
      q[i] = [st[i][0] + t * along[0], st[i][1] + t * along[1]]; q[j] = [st[j][0] + t * along[0], st[j][1] + t * along[1]];
    } else {
      const dv = [st[i][0] - st[ip][0], st[i][1] - st[ip][1]], al = [st[jp][0] - st[ip][0], st[jp][1] - st[ip][1]];
      const [a] = solve2(dv, al, [mx - st[ip][0], my - st[ip][1]]);
      q[i] = [st[ip][0] + a * dv[0], st[ip][1] + a * dv[1]]; q[j] = [st[jp][0] + a * dv[0], st[jp][1] + a * dv[1]];
    }
  }
  XF.quad = q; requestDraw();
  const b = quadBox(q); sbSet('Layer ' + Math.round(b[2]) + ' × ' + Math.round(b[3]) + ' px · Enter applies, Esc cancels');
}
function xfUp(){ if (XF) XF.drag = null; }
function xfNudge(dx, dy){
  if (!AL || AL.locked) return;
  if (XF){ for (const c of XF.quad){ c[0] += dx; c[1] += dy; } requestDraw(); return; }
  const before = captureDoc(); AL.x += dx; AL.y += dy; pushLayersUndo(before); syncLayerProps(); requestDraw();
}
function drawXfHandles(){
  if (!XF){
    if (S.tool === 'move' && AL){
      const z = S.zoom, x0 = S.panX + AL.x * z, y0 = S.panY + AL.y * z;
      vctx.save(); vctx.setLineDash([4, 3]); vctx.strokeStyle = '#000'; vctx.strokeRect(x0 + 0.5, y0 + 0.5, W * z, H * z);
      vctx.lineDashOffset = 3.5; vctx.strokeStyle = '#fff'; vctx.strokeRect(x0 + 0.5, y0 + 0.5, W * z, H * z); vctx.restore();
    }
    return;
  }
  const h = xfHandles();
  vctx.save();
  vctx.beginPath(); h.s.forEach((p, i) => i ? vctx.lineTo(p[0], p[1]) : vctx.moveTo(p[0], p[1])); vctx.closePath();
  vctx.strokeStyle = '#000'; vctx.lineWidth = 3; vctx.stroke(); vctx.strokeStyle = '#fff'; vctx.lineWidth = 1; vctx.stroke();
  vctx.beginPath(); vctx.moveTo(h.e[0][0], h.e[0][1]); vctx.lineTo(h.rot[0], h.rot[1]); vctx.strokeStyle = '#000080'; vctx.stroke();
  for (const p of [...h.s, ...h.e]){ vctx.fillStyle = '#000080'; vctx.fillRect(Math.round(p[0]) - 3, Math.round(p[1]) - 3, 7, 7); vctx.strokeStyle = '#fff'; vctx.strokeRect(Math.round(p[0]) - 2.5, Math.round(p[1]) - 2.5, 6, 6); }
  vctx.beginPath(); vctx.arc(h.rot[0], h.rot[1], 5, 0, Math.PI * 2); vctx.fillStyle = '#ffffff'; vctx.fill(); vctx.strokeStyle = '#000080'; vctx.lineWidth = 2; vctx.stroke();
  vctx.restore();
}
// numeric transform from the panel
function xfFromNumbers(){
  if (!AL) return; if (XF) xfCancel(true);
  const X = +$('#xX').value, Y = +$('#xY').value, nw = Math.max(1, +$('#xW').value), nh = Math.max(1, +$('#xH').value);
  const rot = (+$('#xRot').value || 0) * Math.PI / 180, kx = Math.tan((+$('#xSkX').value || 0) * Math.PI / 180), ky = Math.tan((+$('#xSkY').value || 0) * Math.PI / 180);
  const cx = X + nw / 2, cy = Y + nh / 2, cs = Math.cos(rot), sn = Math.sin(rot);
  const q = [[-nw / 2, -nh / 2], [nw / 2, -nh / 2], [nw / 2, nh / 2], [-nw / 2, nh / 2]].map(([x, y]) => { const sx = x + kx * y, sy = y + ky * x; return [cx + sx * cs - sy * sn, cy + sx * sn + sy * cs]; });
  XF = { quad: q, drag: null }; xfCommit();
  $('#xRot').value = 0; $('#xSkX').value = 0; $('#xSkY').value = 0;
}
function xfScaleTo(mode){
  if (!AL) return; if (XF) xfCancel(true);
  const s = mode === 'fit' ? Math.min(DocW / W, DocH / H) : Math.max(DocW / W, DocH / H);
  const nw = W * s, nh = H * s; XF = { quad: rectQuad((DocW - nw) / 2, (DocH - nh) / 2, nw, nh), drag: null }; xfCommit();
}
function layerCenter(){ if (!AL) return; const before = captureDoc(); AL.x = Math.round((DocW - W) / 2); AL.y = Math.round((DocH - H) / 2); pushLayersUndo(before); syncLayerProps(); requestDraw(); }
function layerTrim(){
  if (!AL) return; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  frames.forEach((src, f) => { const m = masks[f]; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){ const i = y * W + x; if (src[i * 4 + 3] * m[i] > 255 * 2){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } } });
  if (x1 < 0){ toast('The layer is empty.'); return; }
  if (x0 === 0 && y0 === 0 && x1 === W - 1 && y1 === H - 1){ toast('The layer is already trimmed.'); return; }
  const nf = frames.map(f => cropPx(f, x0, y0, x1 + 1, y1 + 1)), nm = masks.map(m => cropM(m, x0, y0, x1 + 1, y1 + 1));
  geomCommit(nf, nm, x1 - x0 + 1, y1 - y0 + 1, 'Trimmed the layer to its visible pixels.', AL.x + x0, AL.y + y0);
}
// grow the layer to cover the canvas (and itself), padding with transparency
function layerExpand(quiet){
  if (!AL) return false;
  const x0 = Math.min(0, AL.x), y0 = Math.min(0, AL.y), x1 = Math.max(DocW, AL.x + W), y1 = Math.max(DocH, AL.y + H);
  const nw = x1 - x0, nh = y1 - y0; if (nw === W && nh === H) return false;
  const ox = AL.x - x0, oy = AL.y - y0;
  const nf = frames.map(f => { const o = new Uint8ClampedArray(nw * nh * 4); for (let y = 0; y < H; y++) o.set(f.subarray(y * W * 4, (y + 1) * W * 4), ((y + oy) * nw + ox) * 4); return o; });
  const nm = masks.map(m => { const o = new Uint8Array(nw * nh).fill(255); for (let y = 0; y < H; y++) o.set(m.subarray(y * W, (y + 1) * W), (y + oy) * nw + ox); return o; });
  geomCommit(nf, nm, nw, nh, quiet ? null : 'Expanded the layer to the canvas.', x0, y0);
  return true;
}
// cut the layer to a shape (works on the mask, so the Restore brush can bring pixels back)
function shapePath(g, kind, w, h){
  g.beginPath();
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
  if (kind === 'ellipse') g.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (kind === 'circle') g.arc(cx, cy, r, 0, Math.PI * 2);
  else if (kind === 'rrect'){ const k = Math.min(w, h) * 0.18; g.moveTo(k, 0); g.arcTo(w, 0, w, h, k); g.arcTo(w, h, 0, h, k); g.arcTo(0, h, 0, 0, k); g.arcTo(0, 0, w, 0, k); g.closePath(); }
  else if (kind === 'star'){ for (let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 0.45 : 1; g.lineTo(cx + Math.cos(a) * w / 2 * rr, cy + Math.sin(a) * h / 2 * rr + h * 0.04); } g.closePath(); }
  else if (kind === 'heart'){ g.moveTo(cx, h * 0.95); g.bezierCurveTo(-w * 0.15, h * 0.55, w * 0.08, -h * 0.12, cx, h * 0.22); g.bezierCurveTo(w * 0.92, -h * 0.12, w * 1.15, h * 0.55, cx, h * 0.95); g.closePath(); }
  else if (kind === 'triangle'){ g.moveTo(cx, 0); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); }
  else if (kind === 'hexagon'){ for (let i = 0; i < 6; i++){ const a = i * Math.PI / 3; g.lineTo(cx + Math.cos(a) * w / 2, cy + Math.sin(a) * h / 2); } g.closePath(); }
  else if (kind === 'diamond'){ g.moveTo(cx, 0); g.lineTo(w, cy); g.lineTo(cx, h); g.lineTo(0, cy); g.closePath(); }
}
function shapeLayer(){
  if (!AL) return; if (AL.locked){ toast('The selected layer is locked.'); return; }
  const kind = $('#kShape').value, feather = +$('#kFeather').value, inv = $('#kInvert').checked;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true });
  const pad = feather * 1.5;
  g.save(); g.translate(pad, pad); shapePath(g, kind, W - pad * 2, H - pad * 2); g.fillStyle = '#000'; g.fill(); g.restore();
  const cov = g.getImageData(0, 0, W, H).data;
  if (feather){
    let a = new Uint8ClampedArray(W * H); for (let i = 0; i < W * H; i++) a[i] = cov[i * 4 + 3];
    const r = Math.max(1, Math.round(feather)); a = boxBlur(boxBlur(boxBlur(a, r), r), r);
    for (let i = 0; i < W * H; i++) cov[i * 4 + 3] = a[i];
  }
  beginOp(frames.map((_, i) => i));
  for (const f of op.fs){ const m = masks[f]; for (let i = 0; i < W * H; i++){ let a = cov[i * 4 + 3]; if (inv) a = 255 - a; m[i] = (m[i] * a + 127) / 255; } }
  touchOp(0, 0, W, H); endOp(); renderRect(0, 0, W, H); toast('Cut the layer to a ' + $('#kShape').selectedOptions[0].textContent.toLowerCase() + '.');
}
