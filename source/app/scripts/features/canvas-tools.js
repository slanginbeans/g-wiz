// ---------- crop, track and magnifier tools on the canvas ----------
S.track = null;
let boxDrag = null;
// crop boxes live in canvas coordinates; the stabilizer's track box lives in the active layer's coordinates
function screenRect(r, local){ const ox = local ? LX() : 0, oy = local ? LY() : 0; return { x0: S.panX + (r.x + ox) * S.zoom, y0: S.panY + (r.y + oy) * S.zoom, x1: S.panX + (r.x + ox + r.w) * S.zoom, y1: S.panY + (r.y + oy + r.h) * S.zoom }; }
function boxHit(r, p, local){
  if (!r) return 'new';
  const s = screenRect(r, local), mx = (s.x0 + s.x1) / 2, my = (s.y0 + s.y1) / 2, tol = HIT_TOL(), near = (a, b) => Math.abs(a - b) <= tol;
  const pts = { nw: [s.x0, s.y0], n: [mx, s.y0], ne: [s.x1, s.y0], e: [s.x1, my], se: [s.x1, s.y1], s: [mx, s.y1], sw: [s.x0, s.y1], w: [s.x0, my] };
  for (const [k, [hx, hy]] of Object.entries(pts)) if (near(p.x, hx) && near(p.y, hy)) return k;
  if (p.x > s.x0 && p.x < s.x1 && p.y > s.y0 && p.y < s.y1) return 'move';
  return 'new';
}
const HIT_CURSOR = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', move: 'move', new: 'crosshair' };
function boxStart(kind, p){
  const r = kind === 'crop' ? (S.crop && !cropIsFull(S.crop) ? S.crop : null) : S.track;
  const [ix, iy] = kind === 'crop' ? toDoc(p) : toImg(p);
  boxDrag = { kind, mode: boxHit(r, p, kind !== 'crop'), ix, iy, start: r ? { ...r } : null };
}
function boxMove(p){
  const d = boxDrag, BW = d.kind === 'crop' ? DocW : W, BH = d.kind === 'crop' ? DocH : H;
  let [ix, iy] = d.kind === 'crop' ? toDoc(p) : toImg(p); ix = clamp(ix, 0, BW); iy = clamp(iy, 0, BH);
  const ar = d.kind === 'crop' ? aspectRatio() : 0;
  let r;
  if (d.mode === 'new' || !d.start){
    let x0 = Math.min(d.ix, ix), y0 = Math.min(d.iy, iy), w = Math.abs(ix - d.ix), h = Math.abs(iy - d.iy);
    if (ar){ if (w / Math.max(h, 1e-6) > ar) w = h * ar; else h = w / ar; x0 = ix < d.ix ? d.ix - w : d.ix; y0 = iy < d.iy ? d.iy - h : d.iy; }
    r = { x: x0, y: y0, w, h };
  } else if (d.mode === 'move'){
    const s = d.start; r = { x: clamp(s.x + ix - d.ix, 0, BW - s.w), y: clamp(s.y + iy - d.iy, 0, BH - s.h), w: s.w, h: s.h };
  } else {
    const s = d.start; let x0 = s.x, y0 = s.y, x1 = s.x + s.w, y1 = s.y + s.h;
    if (d.mode.includes('w')) x0 = Math.min(ix, x1 - 1); if (d.mode.includes('e')) x1 = Math.max(ix, x0 + 1);
    if (d.mode.includes('n')) y0 = Math.min(iy, y1 - 1); if (d.mode.includes('s')) y1 = Math.max(iy, y0 + 1);
    if (ar){ const w = x1 - x0; if (d.mode === 'n' || d.mode === 's'){ const nw = (y1 - y0) * ar; x1 = x0 + nw; } else { const nh = w / ar; if (d.mode.includes('n')) y0 = y1 - nh; else y1 = y0 + nh; } }
    r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  r.x = clamp(Math.round(r.x), 0, BW - 1); r.y = clamp(Math.round(r.y), 0, BH - 1);
  r.w = clamp(Math.round(r.w), 1, BW - r.x); r.h = clamp(Math.round(r.h), 1, BH - r.y);
  if (d.kind === 'crop'){ S.crop = r; syncCropUI(); } else { S.track = r; requestDraw(); }
}
function boxEnd(){
  const d = boxDrag; boxDrag = null; if (!d) return;
  const r = d.kind === 'crop' ? S.crop : S.track;
  if (r && (r.w < 3 || r.h < 3) && d.mode === 'new'){ if (d.kind === 'crop'){ S.crop = null; syncCropUI(); } else S.track = null; }
  if (d.kind === 'track'){ if (S.track){ segSet('#sArea', 'a', 'box'); S.stabArea = 'box'; } updateTrackHint(); resetStabResult(); }
  requestDraw();
}
// draw the track box and crop handles (called from draw)
function drawToolBoxes(){
  drawXfHandles(); drawDrawCursor(); positionTextEdit(); drawAnimOverlay(); drawPixelOverlay();
  if (S.track && (S.tool === 'track' || curPage === 'stab')){
    const s = screenRect(S.track, true);
    vctx.save(); vctx.lineWidth = 1; vctx.setLineDash([4, 3]);
    vctx.strokeStyle = '#000'; vctx.strokeRect(s.x0 + 0.5, s.y0 + 0.5, s.x1 - s.x0, s.y1 - s.y0);
    vctx.lineDashOffset = 4; vctx.strokeStyle = '#ffff00'; vctx.strokeRect(s.x0 + 0.5, s.y0 + 0.5, s.x1 - s.x0, s.y1 - s.y0);
    vctx.restore();
    vctx.fillStyle = '#ffff00'; vctx.font = '11px Tahoma, sans-serif'; vctx.fillText('Track', s.x0 + 3, s.y0 - 4 > 10 ? s.y0 - 4 : s.y0 + 12);
  }
  if (S.tool === 'crop' && S.crop && !cropIsFull(S.crop)){
    const s = screenRect(S.crop), mx = (s.x0 + s.x1) / 2, my = (s.y0 + s.y1) / 2;
    for (const [hx, hy] of [[s.x0, s.y0], [mx, s.y0], [s.x1, s.y0], [s.x1, my], [s.x1, s.y1], [mx, s.y1], [s.x0, s.y1], [s.x0, my]]){
      vctx.fillStyle = '#000080'; vctx.fillRect(Math.round(hx) - 3, Math.round(hy) - 3, 7, 7);
      vctx.strokeStyle = '#fff'; vctx.lineWidth = 1; vctx.strokeRect(Math.round(hx) - 2.5, Math.round(hy) - 2.5, 6, 6);
    }
  }
}
