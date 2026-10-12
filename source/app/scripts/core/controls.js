// ---------- controls ----------
const MODE_HINTS = {
  smart: 'Samples the color under the brush center and erases similar colors, but stops at strong edges. Best for backgrounds that touch the subject.',
  color: 'Erases colors close to the sampled one anywhere inside the brush, even past edges. Good for gaps between hair or leaves.',
  edges: 'Erases everything from the brush center up to the nearest strong edge, whatever its color.',
  plain: 'Erases everything under the brush. Use it for clean-up away from the subject.'
};
function segBind(id, attr, fn){ $$(id + ' button').forEach(b => b.addEventListener('click', () => { $$(id + ' button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); fn(b.dataset[attr]); })); }
function segSet(id, attr, val){ $$(id + ' button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset[attr] === val))); }
function setTool(t){
  if (stroke) endStroke();
  beforeToolChange(t);
  S.tool = t; $$('.tool').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  $('#brushTitle').textContent = t === 'restore' ? 'Restore brush' : 'Eraser';
  showPage(TOOL_PAGE[t] || 'brush');
  setCursor(); updateModeUI(); updateHud(); requestDraw();
}
function updateModeUI(){
  const restore = S.tool === 'restore';
  const needColor = !restore && (S.mode === 'smart' || S.mode === 'color'), needEdge = S.mode === 'smart' || S.mode === 'edges';
  $$('[data-need="color"]').forEach(el => el.hidden = !needColor);
  $$('[data-need="edge"]').forEach(el => el.hidden = !needEdge);
  $('#modeHint').textContent = restore ? (needEdge ? 'Paints the original pixels back, stopping at strong edges so the background stays erased.' : 'Paints the original pixels back.') : MODE_HINTS[S.mode];
}
function setSize(v){ S.size = Math.max(2, Math.min(500, v | 0)); $('#size').value = S.size; updateHud(); requestDraw(); }
function setViewMode(v){ S.viewMode = v; segSet('#viewSeg', 'v', v); renderRect(0, 0, W, H); }
function rangeBind(id, key, fmt, after){
  const el = $('#' + id), out = $('#' + id + 'Out');
  const upd = () => { S[key] = +el.value; if (out) out.textContent = fmt(S[key]); after && after(); };
  el.addEventListener('input', upd); upd();
}
$$('.tool').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
segBind('#modeSeg', 'm', v => { S.mode = v; updateModeUI(); updateHud(); });
segBind('#relSeg', 'r', v => {
  // keep the brush the same physical size on screen when switching
  const rImg = brushR(); S.rel = v; setSize(Math.round(v === 'screen' ? rImg * 2 * S.zoom : rImg * 2)); updateRelHint();
});
function updateRelHint(){ $('#relHint').textContent = S.rel === 'screen' ? 'The brush stays the same size on screen, so zooming in erases finer detail.' : 'The brush covers a fixed number of image pixels and grows on screen as you zoom in.'; }
segBind('#sampSeg', 's', v => S.samp = v);
segBind('#viewSeg', 'v', v => setViewMode(v));
segBind('#scopeSeg', 'a', v => { S.scopeAll = v === 'all'; updateScopeHint(); });
function updateScopeHint(){ $('#scopeHint').textContent = S.scopeAll
  ? 'Each stroke runs on every frame, but edges and colors are detected separately in each one, so a moving subject is cut out frame by frame.'
  : 'Only the frame you are looking at changes. Step through frames with the filmstrip, or with , and . on the keyboard.'; }
updateScopeHint();
$('#prevFr').addEventListener('click', () => { stopPlay(); setFrame((S.dcur + docFrames() - 1) % docFrames()); });
$('#nextFr').addEventListener('click', () => { stopPlay(); setFrame((S.dcur + 1) % docFrames()); });
$('#copyNext').addEventListener('click', () => copyMask('next'));
$('#copyAll').addEventListener('click', () => copyMask('all'));
rangeBind('size', 'size', v => v, () => { updateHud(); requestDraw(); });
rangeBind('hard', 'hard', v => v + '%', requestDraw);
rangeBind('tol', 'tol', v => v + '%');
rangeBind('edge', 'edge', v => v + '%');
rangeBind('wtol', 'wtol', v => v + '%');
rangeBind('wedge', 'wedge', v => v + '%');
rangeBind('q', 'q', v => v + '%');
let opacRaf = 0;
rangeBind('opac', 'opacity', v => v + '%', () => {
  if (!W || opacRaf) return;
  opacRaf = requestAnimationFrame(() => { opacRaf = 0; invalidateRefine(); renderRect(0, 0, W, H); thumbsDirty(frames.map((_, i) => i)); updateFmtUI(); });
});
$('#wcontig').addEventListener('change', e => S.wcontig = e.target.checked);
$('#ghost').addEventListener('change', e => { S.ghost = e.target.checked; renderRect(0, 0, W, H); });
$('#hiStroke').addEventListener('change', e => { S.hiStroke = e.target.checked; });
$('#force').addEventListener('change', e => { S.force = e.target.checked; updateHud(); requestDraw(); });
$('#wedges').addEventListener('change', e => S.wedges = e.target.checked);
$('#undoBtn').addEventListener('click', undo);
$('#redoBtn').addEventListener('click', redo);
$('#zoomIn').addEventListener('click', () => stepZoom(1));
$('#zoomOut').addEventListener('click', () => stepZoom(-1));
$('#zoomVal').addEventListener('click', fit);
$('#zoom1').addEventListener('click', () => setZoom(1));
$('#resetBtn').addEventListener('click', () => {
  if (!W) return; stopPlay();
  beginOp(frames.map((_, i) => i)); masks.forEach(m => m.fill(255)); touchOp(0, 0, W, H); endOp(); renderRect(0, 0, W, H);
  toast('All edits cleared. Undo brings them back.');
});
$$('#bgSeg [data-bg]').forEach(b => b.addEventListener('click', () => { S.bg = b.dataset.bg; $$('#bgSeg [data-bg]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); requestDraw(); }));
$('#bgColor').addEventListener('input', e => { S.bgColor = e.target.value; S.bg = 'color'; $$('#bgSeg [data-bg]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.bg === 'color'))); requestDraw(); });
