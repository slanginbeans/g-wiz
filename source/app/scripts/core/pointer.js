// ---------- pointer input ----------
const pointers = new Map(); let pan = null, pinch = null;
function local(e){ const r = view.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
const toImg = (p) => [(p.x - S.panX) / S.zoom - LX(), (p.y - S.panY) / S.zoom - LY()];
const toDoc = (p) => [(p.x - S.panX) / S.zoom, (p.y - S.panY) / S.zoom];
function setCursor(){
  view.style.cursor = (pan ? 'grabbing' : (S.space || S.tool === 'hand') ? 'grab' : S.tool === 'zoom' ? 'zoom-in' : S.tool === 'text' ? 'text' : S.tool === 'move' ? 'default' : (S.tool === 'erase' || S.tool === 'restore') ? 'none' : 'crosshair');
}
view.addEventListener('contextmenu', e => e.preventDefault());
view.addEventListener('pointerdown', e => {
  view.setPointerCapture(e.pointerId);
  const p = local(e); pointers.set(e.pointerId, p);
  if (pointers.size === 2){
    if (stroke){ if (stroke.touch && performance.now() - stroke.t < 300){ stroke = null; cancelOp(); } else endStroke(); }
    pan = null; gestureStarted();
    const [a, b] = [...pointers.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: S.zoom, img: toDoc(mid) };
    return;
  }
  if (pointers.size > 2 || !W) return;
  if (S.tool === 'zoom' && !S.space && e.button !== 1){ setZoom(S.zoom * ((e.button === 2 || e.altKey) ? 0.5 : 2), p.x, p.y); return; }
  if (!S.space && e.button !== 1 && handleToolDown(e, p)){ e.preventDefault(); requestDraw(); return; }
  if (e.button === 1 || e.button === 2 || S.space || S.tool === 'hand'){ pan = { x: p.x, y: p.y, px: S.panX, py: S.panY }; setCursor(); requestDraw(); e.preventDefault(); return; }
  if (e.button !== 0) return;
  const [ix, iy] = toImg(p);
  if (S.tool === 'crop' || S.tool === 'track'){ boxStart(S.tool, p); return; }
  if (S.tool === 'wand'){ wandAt(ix, iy, e.altKey, e.shiftKey); return; }
  beginStroke(ix, iy, S.tool === 'restore' || e.altKey, e.pointerType, e.shiftKey);
});
view.addEventListener('pointermove', e => {
  const p = local(e);
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
  if (pinch && pointers.size >= 2){
    const [a, b] = [...pointers.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const z = Math.min(64, Math.max(0.02, pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0));
    S.zoom = z; S.panX = mid.x - pinch.img[0] * z; S.panY = mid.y - pinch.img[1] * z; setZoom(z, mid.x, mid.y);
    return;
  }
  S.hover = e.pointerType === 'touch' && !stroke ? null : { x: p.x, y: p.y, alt: e.altKey, shift: e.shiftKey };
  if (stroke) stroke.force = S.force || e.shiftKey;
  { const q = toImg(p); updatePos(q[0], q[1]); }
  if (pan){ S.panX = pan.px + p.x - pan.x; S.panY = pan.py + p.y - pan.y; requestDraw(); return; }
  if (boxDrag){ boxMove(p); return; }
  if (handleToolMove(e, p)){ requestDraw(); return; }
  if ((S.tool === 'crop' || S.tool === 'track') && !S.space){ const r = S.tool === 'crop' ? (S.crop && !cropIsFull(S.crop) ? S.crop : null) : S.track; view.style.cursor = HIT_CURSOR[boxHit(r, p, S.tool === 'track')]; }
  if (stroke){
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ce of (evs.length ? evs : [e])){ const [ix, iy] = toImg(local(ce)); moveStroke(ix, iy); }
  }
  requestDraw();
});
function upHandler(e){
  pointers.delete(e.pointerId);
  if (boxDrag) boxEnd();
  handleToolUp(e);
  if (pinch){ if (pointers.size < 2) pinch = null; return; }
  if (stroke && pointers.size === 0) endStroke();
  if (pan && pointers.size === 0){ pan = null; setCursor(); }
  if (e.pointerType === 'touch') S.hover = null;
  requestDraw();
}
view.addEventListener('pointerup', upHandler);
view.addEventListener('pointercancel', upHandler);
view.addEventListener('pointerleave', () => { if (!stroke && !pan){ S.hover = null; requestDraw(); } });
view.addEventListener('wheel', e => {
  e.preventDefault();
  const p = local(e);
  let dy = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
  if (e.altKey){ setSize(Math.round(S.size * Math.exp(-dy * 0.002))); S.hover = { x: p.x, y: p.y }; requestDraw(); return; }
  setZoom(S.zoom * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)), p.x, p.y);
}, { passive: false });
