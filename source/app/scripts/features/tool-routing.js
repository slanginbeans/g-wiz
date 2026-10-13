// ---------- pointer routing for the new tools ----------
const NEW_TOOLS = ['move', 'fill', 'picker', 'text', 'hintKeep', 'hintDrop', 'refine', ...DRAW_TOOLS, ...SHAPE_TOOLS];
function handleToolDown(e, p){
  const t = S.tool; if (!NEW_TOOLS.includes(t)) return false;
  if (!W) return true;
  if (t === 'picker' || (e.altKey && (DRAW_TOOLS.includes(t) || SHAPE_TOOLS.includes(t) || t === 'fill'))){ pickColorAt(p, e.button === 2); return true; }
  if (t === 'move'){ if (e.button === 0) xfDown(e, p); return true; }
  if (t === 'hintKeep' || t === 'hintDrop') return hintDown(e, p);
  if (t === 'refine') return refineDown(e, p);
  if (t === 'text'){ if (e.button === 0) textClick(p); return true; }
  if (AL.locked){ toast('The selected layer is locked. Unlock it in the Layers panel to draw on it.'); return true; }
  if (t === 'fill'){ fillAt(p, e.button === 2); return true; }
  if (e.button !== 0 && e.button !== 2) return false;
  beginDraw(e, p); return true;
}
function handleToolMove(e, p){
  if (XF && XF.drag){ xfMove(e, p); return true; }
  if (hintStroke){ hintMove(e, p); return true; }
  if (refineStroke){ refineMove(e, p); return true; }
  if (DS.active){ moveDraw(e); return true; }
  if (S.tool === 'move' && XF && !S.space){ const m = xfHit(p); view.style.cursor = XF_CURSOR[m] || 'default'; }
  return false;
}
function handleToolUp(e){ if (hintStroke){ hintUp(); return true; } if (refineStroke){ refineUp(); return true; } if (XF && XF.drag){ xfUp(); return true; } if (DS.active){ endDraw(); return true; } return false; }
function beforeToolChange(t){
  if (XF && t !== 'move') xfCommit();
  if (TE && t !== 'text') textCommit();
  if (DRAW_TOOLS.includes(t)) setTimeout(() => loadDrawUI(t), 0);
  if (SHAPE_TOOLS.includes(t)) setTimeout(() => loadShapeUI(t), 0);
}
// brush outline for the drawing tools
function drawDrawCursor(){
  drawHintCursor(); drawRefineCursor();
  const hv = S.hover; if (!hv || pan || S.space || DS.active && DS.tool === 'air' && false) return;
  const t = S.tool; let size = 0;
  if (DRAW_TOOLS.includes(t)) size = S.draw[t].size; else return;
  const r = Math.max(1, size * S.zoom / 2);
  vctx.save();
  if (t === 'marker' && (S.draw.marker.style === 'chisel' || S.draw.marker.style === 'dry')){ vctx.beginPath(); vctx.ellipse(hv.x, hv.y, r, Math.max(1, r * 0.32), S.draw.marker.angle * Math.PI / 180, 0, Math.PI * 2); }
  else if (t === 'pencil' && S.draw.pencil.style === 'square'){ vctx.beginPath(); vctx.rect(hv.x - r, hv.y - r, r * 2, r * 2); }
  else { vctx.beginPath(); vctx.arc(hv.x, hv.y, r, 0, Math.PI * 2); }
  vctx.lineWidth = 2.5; vctx.strokeStyle = 'rgba(0,0,0,.5)'; vctx.stroke(); vctx.lineWidth = 1; vctx.strokeStyle = '#fff'; vctx.stroke();
  vctx.restore();
}
