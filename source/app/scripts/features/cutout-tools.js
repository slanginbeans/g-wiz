// ===================== checking and refining a cut-out =====================

// ---------- check the result: backdrops and edge check ----------
// The backdrop behind the picture (preview only) can be switched right on the Remove background page, or with Q
// anywhere. Edge check paints every partly see-through pixel magenta, so leftover halos and soft fringes stand out.
S.edgeCheck = !!store.get('edgeCheck', false);
const BACKDROPS = ['checker', 'white', 'black', 'color'];
function syncBackdropButtons(){ $$('#aBgSeg [data-bg2]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.bg2 === S.bg))); }
function setBackdrop(v){
  if (v === 'color'){ S.bg = 'color'; $$('#bgSeg [data-bg]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.bg === 'color'))); }
  else { const b = $('#bgSeg [data-bg="' + v + '"]'); if (b) b.click(); }
  syncBackdropButtons(); requestDraw();
}
function cycleBackdrop(){
  const v = BACKDROPS[(BACKDROPS.indexOf(S.bg) + 1) % BACKDROPS.length]; setBackdrop(v);
  sbFlash('Backdrop: ' + { checker: 'checkerboard', white: 'white', black: 'black', color: 'custom color' }[v] + ' (preview only; Q switches).');
}
function setEdgeCheck(on){ S.edgeCheck = on; store.set('edgeCheck', on); $('#aEdgeCheck').checked = on; requestOverlay(); }
$$('#aBgSeg [data-bg2]').forEach(b => b.addEventListener('click', () => setBackdrop(b.dataset.bg2)));
$('#aBgColor').addEventListener('input', e => { S.bgColor = e.target.value; $('#bgColor').value = e.target.value; setBackdrop('color'); });
$$('#bgSeg [data-bg]').forEach(b => b.addEventListener('click', () => setTimeout(syncBackdropButtons, 0)));
$('#bgColor').addEventListener('input', () => { $('#aBgColor').value = S.bgColor; setTimeout(syncBackdropButtons, 0); });
$('#aEdgeCheck').checked = S.edgeCheck;
$('#aEdgeCheck').addEventListener('change', e => setEdgeCheck(e.target.checked));
syncBackdropButtons();
window.addEventListener('keydown', e => {
  const t = e.target;
  if (e.ctrlKey || e.metaKey || e.altKey || (t && (t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'))) return;
  if (anyModal && anyModal()) return;
  if (e.key === 'q' || e.key === 'Q'){ e.preventDefault(); cycleBackdrop(); }
});
{
  const vm = MENUS.viewm, at = vm.findIndex(it => it && it.c === 'bg:color');
  vm.splice(at + 1, 0, { l: 'Next backdrop', k: 'Q', c: 'bgCycle' }, { l: 'Edge check (show see-through pixels)', c: 'edgeCheck', ck: () => S.edgeCheck });
}

// ---------- refine edge brush ----------
// Paint along an edge that needs care (hair, fur, a soft or blurred outline). When the stroke ends, every pixel
// under it is re-cut on its own: its color is explained as a mix of a nearby subject color and a nearby
// background color, taken from the kept and the removed pixels just outside the stroke, and the share of the
// subject color becomes how much of the pixel is kept. The result is smoothed along the picture's edges.
let refineStroke = null;
CUT.refineSize = CUT.refineSize || 30;
function refineR(){ return Math.max(1, CUT.refineSize / 2 / (S.rel === 'screen' ? S.zoom : 1)); }
function refineDab(ix, iy){
  const R = refineStroke, r = refineR();
  const x0 = Math.max(0, Math.floor(ix - r)), y0 = Math.max(0, Math.floor(iy - r)), x1 = Math.min(W - 1, Math.ceil(ix + r)), y1 = Math.min(H - 1, Math.ceil(iy + r));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++){ const dx = x + 0.5 - ix, dy = y + 0.5 - iy; if (dx * dx + dy * dy <= r * r) R.mask[y * W + x] = 1; }
  R.x0 = Math.min(R.x0, x0); R.y0 = Math.min(R.y0, y0); R.x1 = Math.max(R.x1, x1 + 1); R.y1 = Math.max(R.y1, y1 + 1);
}
function refineDown(e, p){
  if (!W) return true;
  if (AL.locked){ toast('The selected layer is locked.'); return true; }
  const [ix, iy] = toImg(p);
  refineStroke = { mask: new Uint8Array(W * H), last: [ix, iy], x0: W, y0: H, x1: 0, y1: 0 };
  refineDab(ix, iy); requestOverlay(); return true;
}
function refineMove(e, p){
  if (!refineStroke) return false;
  const [ix, iy] = toImg(p), [lx, ly] = refineStroke.last, d = Math.hypot(ix - lx, iy - ly), st = Math.max(1, refineR() / 3), k = Math.ceil(d / st);
  for (let i = 1; i <= k; i++) refineDab(lx + (ix - lx) * i / k, ly + (iy - ly) * i / k);
  refineStroke.last = [ix, iy]; requestOverlay(); return true;
}
async function refineUp(){
  if (!refineStroke) return false;
  const R = refineStroke;
  busy(true); await new Promise(r => setTimeout(r, 16));
  try {
    const fs = targetFrames(); beginOp(fs);
    let changed = 0, why = '';
    for (const f of fs){ const res = refineFrame(f, R); changed += res.n; why = why || res.why; }
    refineStroke = null;
    if (!changed){ op = null; requestOverlay(); toast(why || 'Nothing to refine there.', 5000); return true; }
    touchOp(R.x0, R.y0, R.x1, R.y1); endOp(); renderRect(R.x0, R.y0, R.x1, R.y1); requestOverlay();
    sbFlash('Refined ' + changed.toLocaleString() + ' edge pixels' + (fs.length > 1 ? ' on ' + fs.length + ' frames' : '') + '. Undo if it is not better.');
  } finally { refineStroke = null; busy(false); }
  return true;
}
// re-cuts the pixels under stroke R on frame f; returns how many changed (and why not, when none did)
function refineFrame(f, R){
  const src = frames[f], m = masks[f], pad = Math.ceil(refineR() * 2 + 6);
  const bx0 = Math.max(0, R.x0 - pad), by0 = Math.max(0, R.y0 - pad), bx1 = Math.min(W, R.x1 + pad), by1 = Math.min(H, R.y1 + pad), bw = bx1 - bx0, bh = by1 - by0, n = bw * bh;
  if (bw < 2 || bh < 2) return { n: 0 };
  const strip = new Uint8Array(n), kind = new Uint8Array(n);   // kind: 1 = sure subject, 2 = sure background
  let nS = 0, nF = 0, nB = 0;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++){
    const i = y * bw + x, gi = (by0 + y) * W + bx0 + x;
    if (R.mask[gi]){ strip[i] = 1; nS++; continue; }
    const vis = src[gi * 4 + 3] * m[gi] / 255;
    if (m[gi] <= 10 || src[gi * 4 + 3] < 16){ kind[i] = 2; nB++; } else if (vis >= 240){ kind[i] = 1; nF++; }
  }
  if (!nS) return { n: 0 };
  if (!nB) return { n: 0, why: 'There is no removed background next to this stroke yet. Remove the background first, then paint along edges that need care.' };
  if (!nF) return { n: 0, why: 'There is no kept subject next to this stroke. Paint across the edge, so the stroke touches both the subject and the removed background.' };
  // nearest sure-subject and sure-background pixel for every stroke pixel (spreading inward from the stroke's rim)
  const near = k => {
    const src2 = new Int32Array(n).fill(-1); let q = new Int32Array(n), qh = 0, qt = 0;
    for (let i = 0; i < n; i++) if (kind[i] === k){ const x = i % bw; if ((x > 0 && strip[i - 1]) || (x < bw - 1 && strip[i + 1]) || (i >= bw && strip[i - bw]) || (i + bw < n && strip[i + bw])){ src2[i] = i; q[qt++] = i; } }
    while (qh < qt){ const i = q[qh++], x = i % bw;
      for (const j of [x > 0 ? i - 1 : -1, x < bw - 1 ? i + 1 : -1, i - bw, i + bw]){ if (j < 0 || j >= n || !strip[j] || src2[j] >= 0) continue; src2[j] = src2[i]; q[qt++] = j; } }
    return src2;
  };
  const nf = near(1);
  // the background under the stroke: the known background around it filled in smoothly (backgrounds are mostly
  // smooth: a gradient or a blurred scene), so each pixel is compared with the background right behind it
  const Bf = refineFill(src, kind, bx0, by0, bw, bh);
  const col = i => { const gi = ((by0 + ((i / bw) | 0)) * W + bx0 + i % bw) * 4; return [src[gi], src[gi + 1], src[gi + 2]]; };
  const alpha = new Float32Array(n), conf = new Float32Array(n), offs = [0, -4, 4, -4 * bw, 4 * bw, -3 - 3 * bw, 3 - 3 * bw, -3 + 3 * bw, 3 + 3 * bw];
  for (let i = 0; i < n; i++){
    if (!strip[i]) continue;
    // a few candidate subject colors from around the pixel, so a hair finds the hair color, not only the face's
    const Fs = new Set();
    for (const o of offs){ const j = i + o; if (j < 0 || j >= n || !strip[j]) continue; if (nf[j] >= 0) Fs.add(nf[j]); }
    if (!Fs.size || Bf[i * 3] < 0){ alpha[i] = -1; continue; }
    const C = col(i), B = [Bf[i * 3], Bf[i * 3 + 1], Bf[i * 3 + 2]]; let best = Infinity, ba = 0, bsep = 0;
    for (const fi of Fs){ const F = col(fi);
      {
        const vx = F[0] - B[0], vy = F[1] - B[1], vz = F[2] - B[2], L2 = vx * vx + vy * vy + vz * vz; if (L2 < 1) continue;
        let a = ((C[0] - B[0]) * vx + (C[1] - B[1]) * vy + (C[2] - B[2]) * vz) / L2; a = a < 0 ? 0 : a > 1 ? 1 : a;
        const rx = C[0] - B[0] - a * vx, ry = C[1] - B[1] - a * vy, rz = C[2] - B[2] - a * vz, err = (rx * rx + ry * ry + rz * rz) / L2;
        if (err < best){ best = err; ba = a; bsep = L2; }
      } }
    if (best === Infinity){ alpha[i] = -1; continue; }
    // a few percent either way is noise in the background or the subject, not a real mix
    alpha[i] = Math.min(1, Math.max(0, (ba - 0.08) / 0.84));
    // trust it when subject and background colors differ clearly and the mix explains the pixel well
    conf[i] = Math.min(1, Math.sqrt(bsep) / 40) * Math.exp(-best * 6);
  }
  // smooth along the picture's edges, inside the stroke only
  const G = new Float32Array(n), P = new Float32Array(n), Wt = new Float32Array(n);
  for (let i = 0; i < n; i++){ const C = col(i); G[i] = (C[0] * 0.299 + C[1] * 0.587 + C[2] * 0.114) / 255;
    const gi = (by0 + ((i / bw) | 0)) * W + bx0 + i % bw, old = m[gi] / 255;
    if (strip[i] && alpha[i] >= 0){ P[i] = alpha[i] * conf[i] + old * (1 - conf[i]); Wt[i] = 1; } else P[i] = kind[i] === 2 ? 0 : kind[i] === 1 ? 1 : old; }
  const Q = guidedGray(G, P, bw, bh, 1, 2e-3);
  let changed = 0;
  for (let i = 0; i < n; i++){
    if (!strip[i] || alpha[i] < 0) continue;
    const gi = (by0 + ((i / bw) | 0)) * W + bx0 + i % bw, v = Math.max(0, Math.min(255, Math.round(Q[i] * 255)));
    if (v !== m[gi]){ m[gi] = v; changed++; }
  }
  return { n: changed };
}
// push-pull fill: the colors of the known background pixels (kind 2) spread smoothly into the rest of the box.
// Returns RGB per pixel (-1 where nothing could be filled).
function refineFill(src, kind, bx0, by0, bw, bh){
  let w = bw, h = bh, c = new Float32Array(w * h * 3), wt = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ const i = y * w + x; if (kind[i] !== 2) continue; const gi = ((by0 + y) * W + bx0 + x) * 4; if (src[gi + 3] < 16) continue; c[i * 3] = src[gi]; c[i * 3 + 1] = src[gi + 1]; c[i * 3 + 2] = src[gi + 2]; wt[i] = 1; }
  const levels = [{ c, wt, w, h }];
  while (w > 1 || h > 1){
    const nw = Math.max(1, Math.ceil(w / 2)), nh = Math.max(1, Math.ceil(h / 2)), nc = new Float32Array(nw * nh * 3), nwt = new Float32Array(nw * nh), L = levels[levels.length - 1];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ const i = y * w + x, j = (y >> 1) * nw + (x >> 1), a = L.wt[i]; if (!a) continue; nwt[j] += a; nc[j * 3] += L.c[i * 3] * a; nc[j * 3 + 1] += L.c[i * 3 + 1] * a; nc[j * 3 + 2] += L.c[i * 3 + 2] * a; }
    for (let j = 0; j < nw * nh; j++) if (nwt[j]){ nc[j * 3] /= nwt[j]; nc[j * 3 + 1] /= nwt[j]; nc[j * 3 + 2] /= nwt[j]; nwt[j] = Math.min(1, nwt[j]); }
    levels.push({ c: nc, wt: nwt, w: nw, h: nh }); w = nw; h = nh;
  }
  // back up: a pixel without its own color takes the (bilinear) color of the coarser level
  for (let k = levels.length - 2; k >= 0; k--){
    const L = levels[k], U = levels[k + 1];
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++){
      const i = y * L.w + x; if (L.wt[i] >= 1) continue;
      const fx = Math.min(U.w - 1, Math.max(0, (x + 0.5) / 2 - 0.5)), fy = Math.min(U.h - 1, Math.max(0, (y + 0.5) / 2 - 0.5));
      const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(U.w - 1, x0 + 1), y1 = Math.min(U.h - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
      const a = L.wt[i];
      for (let ch = 0; ch < 3; ch++){
        const v = (U.c[(y0 * U.w + x0) * 3 + ch] * (1 - tx) + U.c[(y0 * U.w + x1) * 3 + ch] * tx) * (1 - ty) + (U.c[(y1 * U.w + x0) * 3 + ch] * (1 - tx) + U.c[(y1 * U.w + x1) * 3 + ch] * tx) * ty;
        L.c[i * 3 + ch] = L.c[i * 3 + ch] * a + v * (1 - a);
      }
      L.wt[i] = 1;
    }
  }
  const top = levels[levels.length - 1]; if (!top.wt[0]) return new Float32Array(bw * bh * 3).fill(-1);
  return levels[0].c;
}
// the brush outline
function drawRefineCursor(){
  const hv = S.hover; if (!hv || pan || S.space || S.tool !== 'refine') return;
  const rr = CUT.refineSize / 2 * (S.rel === 'screen' ? 1 : S.zoom);
  vctx.save(); vctx.beginPath(); vctx.arc(hv.x, hv.y, Math.max(1, rr), 0, Math.PI * 2);
  vctx.lineWidth = 3; vctx.strokeStyle = 'rgba(0,0,0,.5)'; vctx.stroke(); vctx.lineWidth = 1.5; vctx.strokeStyle = '#1edcff'; vctx.stroke(); vctx.restore();
}
TOOL_PAGE.refine = 'auto';
cutBind('aRefineSize', 'refineSize', v => v + ' px', () => requestDraw());
$('#aRefine').addEventListener('click', () => setTool('refine'));
function cutoutToolsCmd(c){
  if (c === 'bgCycle'){ cycleBackdrop(); return true; }
  if (c === 'edgeCheck'){ setEdgeCheck(!S.edgeCheck); return true; }
  return false;
}
// for the automatic tests: where the picture is on the screen
if (window.__GWIZ_TEST__) window.__gwizView = () => ({ zoom: S.zoom, panX: S.panX, panY: S.panY, bg: S.bg, edgeCheck: S.edgeCheck, tool: S.tool });
