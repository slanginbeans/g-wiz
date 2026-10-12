import re, base64, io, json, sys
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))   # works from any folder
from PIL import Image
sys.path.insert(0, '.')
import icons, icons2
VERSION = '1.6.1'
src = open('base_app.html', encoding='utf-8').read()
scripts = re.findall(r'<script>(.*?)</script>', src, re.S)
codecs, app = scripts[0], scripts[1]

def rep(a, b, c=1):
    global app
    n = app.count(a)
    assert n == c, (a[:90], n)
    app = app.replace(a, b)

# play / pause icons
rep("""$('#playBtn').innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';""", """$('#playBtn').innerHTML = '<i class="ic" data-ic="pause"></i>';""")
rep("""$('#playBtn').innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';""", """$('#playBtn').innerHTML = '<i class="ic" data-ic="play"></i>';""")
rep("""const PLAY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>', PAUSE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';""",
    """const PLAY_SVG = '<i class="ic" data-ic="play"></i>', PAUSE_SVG = '<i class="ic" data-ic="pause"></i>';""")
# tools -> option pages
rep("  $$('.sec[data-for]').forEach(s => s.hidden = !s.dataset.for.split(' ').includes(t));\n  $('#brushTitle').textContent = t === 'restore' ? 'Restore brush' : 'Eraser';",
    "  $('#brushTitle').textContent = t === 'restore' ? 'Restore brush' : 'Eraser';\n  showPage(TOOL_PAGE[t] || 'brush');")
rep("function setTool(t){\n  if (stroke) endStroke();", "function setTool(t){\n  if (stroke) endStroke();\n  beforeToolChange(t);")
# hud -> status bar + tool options box
rep("  $('#sizeOut').textContent = S.size + (S.rel === 'screen' ? ' screen px' : ' image px');\n}",
    "  $('#sizeOut').textContent = S.size + (S.rel === 'screen' ? ' screen px' : ' image px');\n  updateStatus(); renderToolOpts();\n}")
rep("function toast(msg, ms = 2600){ const t = $('#toast');", "function toast(msg, ms = 2600){ try { sbFlash(msg, Math.max(ms, 4000)); } catch (e) {} const t = $('#toast');")

# ===== layers: the active layer is bound to the old globals =====
rep("const imgCanvas = document.createElement('canvas');", "let imgCanvas = document.createElement('canvas');")
rep("  imgCanvas.width = W; imgCanvas.height = H;\n  imgCtx = imgCanvas.getContext('2d');\n  disp = imgCtx.createImageData(W, H);\n",
    "  imgCanvas = document.createElement('canvas'); imgCanvas.width = W; imgCanvas.height = H;\n  imgCtx = imgCanvas.getContext('2d');\n  disp = imgCtx.createImageData(W, H);\n  initDocFromGlobals(name);\n")
# renderRect: picture opacity is applied when layers are combined; live adjustments preview here
rep("const src = frames[S.cur], m = masks[S.cur], d = disp.data, mode = S.viewMode, op = S.opacity / 100;",
    "const src = frames[S.cur], m = masks[S.cur], d = disp.data, mode = S.viewMode, op = 1;")
rep("  imgCtx.putImageData(disp, 0, 0, x0, y0, x1 - x0, y1 - y0);\n  requestDraw();\n}",
    "  if (adjActive()) adjustRect(d, x0, y0, x1, y1);\n  imgCtx.putImageData(disp, 0, 0, x0, y0, x1 - x0, y1 - y0);\n  requestDraw();\n}")
rep("    refCache = { f: S.cur, data: finalRGBA(S.cur) }; renderRect(0, 0, W, H);",
    "    const so = S.opacity; S.opacity = 100; try { refCache = { f: S.cur, data: finalRGBA(S.cur) }; } finally { S.opacity = so; } renderRect(0, 0, W, H);")
# coordinates
rep("const toImg = (p) => [(p.x - S.panX) / S.zoom, (p.y - S.panY) / S.zoom];",
    "const toImg = (p) => [(p.x - S.panX) / S.zoom - LX(), (p.y - S.panY) / S.zoom - LY()];\nconst toDoc = (p) => [(p.x - S.panX) / S.zoom, (p.y - S.panY) / S.zoom];")
rep("pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: S.zoom, img: toImg(mid) };", "pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: S.zoom, img: toDoc(mid) };")
rep("  const z = Math.min((cw - 40) / W, (ch - 40) / H, 4);\n  S.zoom = z; S.panX = (cw - W * z) / 2; S.panY = (ch - H * z) / 2;",
    "  const z = Math.min((cw - 40) / DocW, (ch - 40) / DocH, 4);\n  S.zoom = z; S.panX = (cw - DocW * z) / 2; S.panY = (ch - DocH * z) / 2;")
# drawing: every layer, the active one at its offset
rep("  const x = S.panX, y = S.panY, w = W * S.zoom, h = H * S.zoom;\n  const vx0", "  const x = S.panX + LX() * S.zoom, y = S.panY + LY() * S.zoom, w = W * S.zoom, h = H * S.zoom;\n  const vx0")
i0 = app.index("  if (S.rotA){\n    // live rotation preview around the image center")
i1 = app.index("  if (S.zoom >= 14){", i0)
app = app[:i0] + "  drawDocument(bgFill, x, y, w, h);\n" + app[i1:]
rep("  if (S.crop && !cropIsFull(S.crop) && !S.rotA){\n    const c = S.crop,",
    "  if (S.crop && !cropIsFull(S.crop) && !S.rotA){\n    const x = S.panX, y = S.panY, w = DocW * S.zoom, h = DocH * S.zoom;\n    const c = S.crop,")
rep("  // cursor\n  const hv = S.hover;", "  drawToolBoxes();\n  // cursor\n  const hv = S.hover;")
# pointer handling: zoom, crop / track boxes, layer + drawing tools
rep("  if (pointers.size > 2 || !W) return;\n  if (e.button === 1 || e.button === 2 || S.space || S.tool === 'hand'){",
    "  if (pointers.size > 2 || !W) return;\n  if (S.tool === 'zoom' && !S.space && e.button !== 1){ setZoom(S.zoom * ((e.button === 2 || e.altKey) ? 0.5 : 2), p.x, p.y); return; }\n  if (!S.space && e.button !== 1 && handleToolDown(e, p)){ e.preventDefault(); requestDraw(); return; }\n  if (e.button === 1 || e.button === 2 || S.space || S.tool === 'hand'){")
rep("  const [ix, iy] = toImg(p);\n  if (S.tool === 'wand'){", "  const [ix, iy] = toImg(p);\n  if (S.tool === 'crop' || S.tool === 'track'){ boxStart(S.tool, p); return; }\n  if (S.tool === 'wand'){")
rep("  if (pan){ S.panX = pan.px + p.x - pan.x; S.panY = pan.py + p.y - pan.y; requestDraw(); return; }",
    "  { const q = toImg(p); updatePos(q[0], q[1]); }\n  if (pan){ S.panX = pan.px + p.x - pan.x; S.panY = pan.py + p.y - pan.y; requestDraw(); return; }\n  if (boxDrag){ boxMove(p); return; }\n  if (handleToolMove(e, p)){ requestDraw(); return; }\n  if ((S.tool === 'crop' || S.tool === 'track') && !S.space){ const r = S.tool === 'crop' ? (S.crop && !cropIsFull(S.crop) ? S.crop : null) : S.track; view.style.cursor = HIT_CURSOR[boxHit(r, p, S.tool === 'track')]; }")
rep("function upHandler(e){\n  pointers.delete(e.pointerId);", "function upHandler(e){\n  pointers.delete(e.pointerId);\n  if (boxDrag) boxEnd();\n  handleToolUp(e);")
rep("view.style.cursor = (pan ? 'grabbing' : (S.space || S.tool === 'hand') ? 'grab' : S.tool === 'wand' ? 'crosshair' : 'none');",
    "view.style.cursor = (pan ? 'grabbing' : (S.space || S.tool === 'hand') ? 'grab' : S.tool === 'zoom' ? 'zoom-in' : S.tool === 'text' ? 'text' : S.tool === 'move' ? 'default' : (S.tool === 'erase' || S.tool === 'restore') ? 'none' : 'crosshair');")
rep("const t = e.target, typing = t && (t.tagName === 'SELECT' || (t.tagName === 'INPUT'", "const t = e.target, typing = t && (t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT'")
# undo across layers
rep("function entryBytes(e){ return e.geom ?", "function entryBytes(e){ if (e.kind === 'layers') return 4096; if (e.paint) return e.data.reduce((s, d) => s + d.length, 0) + e.mdata.reduce((s, d) => s + d.length, 0); return e.geom ?")
rep("function pushUndo(e){ undoStack.push(e);", "function pushUndo(e){ if (e.lid === undefined) e.lid = AL ? AL.id : null; undoStack.push(e);")
rep("""function swapEntry(e){ invalidateRefine();
  if (e.geom){ const cur = { geom: true, W, H, frames, masks }; W = e.W; H = e.H; frames = e.frames; masks = e.masks; reinitDims(); return cur; }
  const cur =""", """function swapEntry(e){ invalidateRefine();
  if (e.kind === 'layers') return swapLayersEntry(e);
  ensureActive(e.lid);
  if (e.paint) return swapPaintEntry(e);
  if (e.geom){
    const cur = { geom: true, W, H, frames, masks, x: AL.x, y: AL.y, dw: DocW, dh: DocH, lid: AL.id };
    const refit = e.dw != null && (e.dw !== DocW || e.dh !== DocH);
    W = e.W; H = e.H; frames = e.frames; masks = e.masks;
    if (e.x != null){ AL.x = e.x; AL.y = e.y; DocW = e.dw; DocH = e.dh; }
    saveActive(); reinitDims(refit); renderLayersPanel(); syncLayerProps(); return cur;
  }
  const cur =""")
rep("function undo(){ if (op || !undoStack.length) return;", "function undo(){ if (XF) xfCancel(true); if (TE) textCancel(); if (op || DS.active || !undoStack.length) return;")
rep("function redo(){ if (op || !redoStack.length) return;", "function redo(){ if (XF) xfCancel(true); if (TE) textCancel(); if (op || DS.active || !redoStack.length) return;")
rep("function thumbsDirty(fs){ if (!thumbs.length) return;", "function thumbsDirty(fs){ scheduleLayerThumb(); if (!thumbs.length) return;")
# geometry changes on the active layer keep its center (and the canvas follows a lone full-size layer)
rep("""function geomCommit(nf, nm, nw, nh, msg){
  pushUndo({ geom: true, W, H, frames: frames.slice(), masks: masks.slice() });
  redoStack.length = 0; updateUndoUI();
  W = nw; H = nh; frames = nf; masks = nm;
  reinitDims(); if (msg) toast(msg);
}
function reinitDims(){""", """function geomCommit(nf, nm, nw, nh, msg, nx, ny){
  pushUndo({ geom: true, W, H, frames: frames.slice(), masks: masks.slice(), x: AL.x, y: AL.y, dw: DocW, dh: DocH, lid: AL.id });
  redoStack.length = 0; updateUndoUI();
  const follow = nx == null && docFollows();
  if (nx == null){ nx = AL.x + Math.round((W - nw) / 2); ny = AL.y + Math.round((H - nh) / 2); }
  W = nw; H = nh; frames = nf; masks = nm;
  if (follow){ nx = 0; ny = 0; DocW = nw; DocH = nh; }
  AL.x = nx; AL.y = ny;
  saveActive(); reinitDims(follow); renderLayersPanel(); syncLayerProps(); if (msg) toast(msg);
}
function reinitDims(refit){""")
rep("  imgCanvas.width = W; imgCanvas.height = H; imgCtx = imgCanvas.getContext('2d'); disp = imgCtx.createImageData(W, H);\n  resetEdges();",
    "  imgCanvas.width = W; imgCanvas.height = H; imgCtx = imgCanvas.getContext('2d'); disp = imgCtx.createImageData(W, H); saveActive();\n  resetEdges();")
rep("  setupAnim(); resetGeoUI(); resetMotion(); fit(); renderRect(0, 0, W, H); updateFmtUI(); invalidateRefine(); updateHud();",
    "  setupAnim(); resetGeoUI(); resetMotion(); if (refit) fit(); renderRect(0, 0, W, H); updateFmtUI(); invalidateRefine(); updateHud();")
# the old single-image crop helpers are replaced by canvas-wide ones in ui_layers.js
rep("function aspectRatio(){ const v = $('#caspect').value; return v === 'orig' ? W / H", "function aspectRatio_old(){ const v = $('#caspect').value; return v === 'orig' ? W / H")
rep("const curCrop = () =>", "const curCrop_old = () =>")
rep("const cropIsFull = c =>", "const cropIsFull_old = c =>")
for fn in ['syncCropUI', 'cropInput', 'setAspect', 'fitContent', 'applyCrop']:
    rep('function ' + fn + '(', 'function ' + fn + '_old(')
# rotate: the whole picture or the selected layer
rep("""$('#rotL').addEventListener('click', () => transformFrames(-90));
$('#rotR').addEventListener('click', () => transformFrames(90));
$('#flipH').addEventListener('click', () => transformFrames(0, 'h'));
$('#flipV').addEventListener('click', () => transformFrames(0, 'v'));""", """$('#rotL').addEventListener('click', () => rotRun(-90));
$('#rotR').addEventListener('click', () => rotRun(90));
$('#flipH').addEventListener('click', () => rotRun(0, 'h'));
$('#flipV').addEventListener('click', () => rotRun(0, 'v'));
segBind('#rotTarget', 'v', v => { S.rotTarget = v; requestDraw(); });""")
rep("$('#rApply').addEventListener('click', () => { if (S.rotA) transformFrames(S.rotA); });", "$('#rApply').addEventListener('click', () => { if (S.rotA) rotRun(S.rotA); });")
# frames: the document timeline runs as long as the longest layer
rep("function setupAnim(){\n  const multi = frames.length > 1;", "function setupAnim(){\n  const multi = docFrames() > 1;")
rep("$('#frameSl').max = Math.max(0, frames.length - 1); $('#frameSl').value = S.cur;", "$('#frameSl').max = Math.max(0, docFrames() - 1); $('#frameSl').value = S.dcur;")
rep("$('#tlSl').max = Math.max(0, frames.length - 1); syncTl();", "$('#tlSl').max = Math.max(0, docFrames() - 1); syncTl();")
rep("  const d = delays[S.cur]; const ms = (d >= 2 ? d : 10) * 10;\n  $('#frameInfo').textContent = 'Frame ' + (S.cur + 1) + ' of ' + frames.length + ' · ' + ms + ' ms';",
    "  const d = docDelay(S.dcur); const ms = (d >= 2 ? d : 10) * 10;\n  $('#frameInfo').textContent = 'Frame ' + (S.dcur + 1) + ' of ' + docFrames() + ' · ' + ms + ' ms';")
rep("function setFrame(i){ S.cur = i; invalidateRefine();", "function setFrame(i){ S.dcur = i; S.cur = i % frames.length; refreshOtherAnimated(); invalidateRefine();")
rep("function tick(){ if (!S.playing) return; const d = delays[S.cur];", "function tick(){ if (!S.playing) return; const d = docDelay(S.dcur);")
rep("  $('#tlSl').value = S.cur; $('#tlNum').textContent = (S.cur + 1) + ' / ' + frames.length;", "  $('#tlSl').value = S.dcur; $('#tlNum').textContent = (S.dcur + 1) + ' / ' + docFrames();")
rep("  e.preventDefault(); if (frames.length < 2) return; stopPlay();", "  e.preventDefault(); if (docFrames() < 2) return; stopPlay();")
lines = app.split('\n')
for k, ln in enumerate(lines):
    if 'setFrame((S.cur' in ln:
        lines[k] = ln.replace('S.cur', 'S.dcur').replace('frames.length', 'docFrames()')
app = '\n'.join(lines)
# loading: projects, and extra images become layers
rep("async function loadFile(file){", "async function loadFile(file, asLayer){")
rep("    const base = (file.name || 'pasted-image').replace(/\\.[^.]+$/, '') || 'image';\n    let res = null;",
    "    const base = (file.name || 'pasted-image').replace(/\\.[^.]+$/, '') || 'image';\n    if (isProjectBytes(buf)){ await openProject(buf, base); return; }\n    let res = null;")
rep("    if (setImage(res, base)) toast(", "    if (asLayer && W){ busy(false); await addLayerFromRes(res, base); }\n    else if (setImage(res, base)) toast(")
rep("const f = e.dataTransfer?.files?.[0]; if (f) loadFile(f); });", "const fl = [...(e.dataTransfer?.files || [])]; if (fl.length) (async () => { FIT.batch = fl.length; FIT.choice = null; try { for (const f of fl) await loadFile(f, !!W); } finally { FIT.batch = 0; FIT.choice = null; } })(); });")
rep("if (it){ e.preventDefault(); loadFile(it.getAsFile()); }", "if (it){ e.preventDefault(); loadFile(it.getAsFile(), !!W); }")
# export: the combined picture
rep("function updateScaleOut(){ const s = S.scale / 100; $('#scaleOut').textContent = S.scale + '% · ' + Math.max(1, Math.round(W * s)) + '×' + Math.max(1, Math.round(H * s)) + ' px'; }",
    "function updateScaleOut(){ const s = S.scale / 100; $('#scaleOut').textContent = S.scale + '% · ' + Math.max(1, Math.round(DocW * s)) + '×' + Math.max(1, Math.round(DocH * s)) + ' px'; }")
rep("  const f = $('#fmt').value, multi = frames.length > 1;\n  $('#qRow')", "  const f = $('#fmt').value, multi = docFrames() > 1;\n  $('#qRow')")
rep("  const s = S.scale / 100, multi = $('#fmt').value === 'gif' && frames.length > 1 && $('#gifAll').checked;\n  $('#sdInfo').textContent = t.desc + ' · ' + Math.max(1, Math.round(W * s)) + ' × ' + Math.max(1, Math.round(H * s))",
    "  const s = S.scale / 100, multi = $('#fmt').value === 'gif' && docFrames() > 1 && $('#gifAll').checked;\n  $('#sdInfo').textContent = t.desc + ' · ' + Math.max(1, Math.round(DocW * s)) + ' × ' + Math.max(1, Math.round(DocH * s))")
rep("""  const f = $('#fmt').value, trim = $('#trim').checked, n = frames.length;
  const anim = f === 'gif' && n > 1 && $('#gifAll').checked;
  let idxs = [], dl = [];
  if (anim){
    const step = +$('#gskip').value, speed = +$('#gspeed').value;
    for (let i = 0; i < n; i += step){ idxs.push(i); let sum = 0; for (let k = i; k < Math.min(n, i + step); k++) sum += delays[k] >= 2 ? delays[k] : 10; dl.push(Math.max(2, Math.round(sum / speed))); }
  } else { idxs = [S.cur]; dl = [delays[S.cur]]; }
  const comps = idxs.map(finalRGBA);
  const box = trim ? contentBox(comps) : [0, 0, W, H];
  if (!box) throw new SaveError('Nothing to save: every pixel is erased.');
  let bw = box[2] - box[0], bh = box[3] - box[1];
  let out = comps.map(c => cropRGBA(c, box));""", """  const f = $('#fmt').value, trim = $('#trim').checked, n = docFrames();
  const anim = f === 'gif' && n > 1 && $('#gifAll').checked;
  let idxs = [], dl = [];
  if (anim){
    const step = +$('#gskip').value, speed = +$('#gspeed').value;
    for (let i = 0; i < n; i += step){ idxs.push(i); let sum = 0; for (let k = i; k < Math.min(n, i + step); k++){ const dk = docDelay(k); sum += dk >= 2 ? dk : 10; } dl.push(Math.max(2, Math.round(sum / speed))); }
  } else { idxs = [S.dcur]; dl = [docDelay(S.dcur)]; }
  const comps = idxs.map(i => composeDoc(i, true));
  const box = trim ? contentBoxDoc(comps) : [0, 0, DocW, DocH];
  if (!box) throw new SaveError('Nothing to save: every pixel is erased.');
  let bw = box[2] - box[0], bh = box[3] - box[1];
  let out = comps.map(c => cropDoc(c, box));""")
# save flow: options window first
rep("$('#saveBtn').addEventListener('click', doSave);", "$('#saveBtn').addEventListener('click', () => { closeModal('saveOpts'); doSave(); });")
rep("$('#saveTop').addEventListener('click', doSave);", "$('#saveTop').addEventListener('click', openSaveOpts);")
# old backdrop swatch styling no longer applies
rep("$('#bgColorWrap').style.background = S.bgColor;\n", "")
rep("$('#bgColor').addEventListener('input', e => $('#bgColorWrap').style.background = e.target.value);\n", "")
# animation-only UI
rep("  $('#timeline').hidden = !multi; stage.classList.toggle('has-tl', multi); $('#motionSec').hidden = !multi;",
    "  $('#timeline').hidden = !multi; stage.classList.toggle('has-tl', multi); $('#motionSec').hidden = frames.length < 2;\n  $('#stabSec').hidden = frames.length < 2; $$('.anim-none, #animNone').forEach(el => el.hidden = frames.length > 1); $$('.anim-only').forEach(b => b.disabled = frames.length < 2);")
rep("  $('#fname').textContent = name;", "  $('#fname').textContent = name; document.title = name + ' - G-WIZ'; S.track = null; resetStabResult();")
rep("  resetEdges(); refCache = null; S.cur = Math.min(S.cur, frames.length - 1);", "  resetEdges(); refCache = null; S.cur = Math.min(S.cur, frames.length - 1); S.track = null; resetStabResult();")
rep("markThumb(); syncTl(); if (motionReady", "markThumb(); syncTl(); if (stab) drawStabGraph(); if (motionReady")

# small display fixes for layered pictures
rep("  vctx.strokeStyle = 'rgba(127,127,127,.5)'; vctx.lineWidth = 1; vctx.strokeRect(Math.round(x) - 0.5,", "  if (!S.rotA && !XF) vctx.strokeStyle = 'rgba(127,127,127,.5)', vctx.lineWidth = 1, vctx.strokeRect(Math.round(x) - 0.5,")
rep("""  const strip = $('#strip'); strip.textContent = ''; thumbs = [];
  if (frames.length < 2) return;
  const th = 52, tw = Math.max(16, Math.min(120, Math.round(W * th / H)));
  frames.forEach((_, i) => {""", """  const strip = $('#strip'); strip.textContent = ''; thumbs = [];
  const nTh = ANIM.on ? docFrames() : frames.length, tW = ANIM.on ? DocW : W, tH = ANIM.on ? DocH : H;
  strip.hidden = nTh < 2 && !ANIM.on;
  if (nTh < 2 && !ANIM.on) return;
  const th = 52, tw = Math.max(16, Math.min(120, Math.round(tW * th / tH)));
  for (let i0 = 0; i0 < nTh; i0++) (i => {""")
rep("""    strip.appendChild(b); thumbs.push({ b, c, dot });
  });
  thumbsDirty(frames.map((_, i) => i)); markThumb();""", """    strip.appendChild(b); thumbs.push({ b, c, dot });
  })(i0);
  thumbsDirty(thumbs.map((_, i) => i)); markThumb();""")

# touch screens and iPad
rep("    pan = null;\n    const [a, b] = [...pointers.values()];", "    pan = null; gestureStarted();\n    const [a, b] = [...pointers.values()];")
rep("  const MAX = 8192; let s = 1;\n  if (Math.max(w, h) > MAX){ s = MAX / Math.max(w, h); toast(",
    "  let s = Math.min(1, 8192 / Math.max(w, h), Math.sqrt(MAX_PIXELS / Math.max(1, w * h)));\n  if (s < 1){ toast(")
rep("  if (bytesNeeded > 1.6e9){", "  if (bytesNeeded > (IS_IOS ? 0.5e9 : 1.6e9) || (IS_IOS && res.w * res.h > MAX_PIXELS)){")
rep("(undoBytes > 300e6 && undoStack.length > 1)", "(undoBytes > (IS_IOS ? 120e6 : 300e6) && undoStack.length > 1)")
rep("async function saveBlob(blob, filename){\n  if (downloadsP){", "async function saveBlob(blob, filename){\n  if (!downloadsP && shareWanted()){ shareFile(blob, filename); return; }\n  if (downloadsP){")
rep("  $('#sdWhere').textContent = downloadsP\n", "  $('#sdWhere').textContent = shareWanted() ? 'Next, the iPad\\'s share sheet opens: choose Save to Files to pick a folder, or Save Image to put it in Photos.' : downloadsP\n")

# animation mode, onion skin, layout fixes, blank start
rep("function thumbsDirty(fs){ scheduleLayerThumb(); if (!thumbs.length) return; fs.forEach(f => thumbQ.add(f));",
    "function thumbsDirty(fs){ scheduleLayerThumb(); if (!thumbs.length) return; (ANIM.on && frames.length !== thumbs.length ? thumbs.map((_, i) => i) : fs).forEach(f => thumbQ.add(f));")
rep("function drawThumb(f){\n  const t = thumbs[f]; if (!t) return;", "function drawThumb(f){\n  if (ANIM.on) return drawDocThumb(f);\n  const t = thumbs[f]; if (!t) return;")
rep("  thumbs.forEach((t, i) => t.b.setAttribute('aria-current', String(i === S.cur)));\n  const t = thumbs[S.cur];",
    "  const cf = ANIM.on ? S.dcur : S.cur;\n  thumbs.forEach((t, i) => t.b.setAttribute('aria-current', String(i === cf)));\n  const t = thumbs[cf];")
rep("  const c = $('#tlMarks'); if (!c || frames.length < 2) return;", "  const c = $('#tlMarks'); if (c && ANIM.on){ c.getContext('2d').clearRect(0, 0, c.width, c.height); return; } if (!c || frames.length < 2) return;")
rep("function setupAnim(){\n  const multi = docFrames() > 1;", "function setupAnim(){\n  const multi = docFrames() > 1 || ANIM.on;")
rep("  $('#animSec').hidden = !multi;", "  $('#animSec').hidden = frames.length < 2;")
rep("function pushUndo(e){ if (e.lid === undefined)", "function pushUndo(e){ onionClear(); markDirty(); if (e.lid === undefined)")
rep("function swapEntry(e){ invalidateRefine();", "function swapEntry(e){ invalidateRefine(); onionClear();")
rep("if (motionReady && S.mMode === 'plate' && !S.playing) scheduleMotion(false); }", "if (motionReady && S.mMode === 'plate' && !S.playing) scheduleMotion(false); updateAnimPage(); }")
rep("function toast(msg, ms = 2600){ try { sbFlash(msg, Math.max(ms, 4000)); } catch (e) {} const t = $('#toast');",
    "function toast(msg, ms = 2600){ try { sbFlash(msg, Math.max(ms, 4000)); } catch (e) {} const t = $('#toast'); try { const pb = $('#palettebar'), st = $('#stage').getBoundingClientRect(); t.style.bottom = Math.max(8, innerHeight - st.bottom + 10) + 'px'; } catch (e) {}")
rep("setImage(makeSample(), 'sample-cactus');\nsetTimeout(fit, 0);", "if (/[?&]sample\\b/.test(location.search)) setImage(makeSample(), 'sample-cactus'); else startBlank();\nsetTimeout(fit, 0);")

# smart background removal, hints, perceptual matching, wide edges
rep("""  return (src, o) => {
    const dr = src[o] - sc[0], dg = src[o + 1] - sc[1], db = src[o + 2] - sc[2];
    const d = Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9);
    return d <= inner ? 1 : d >= tol ? 0 : 1 - (d - inner) / span;
  };""", """  if (S.labMatch){
    const lab = new Float32Array(3); rgb2lab(sc[0], sc[1], sc[2], lab, 0);
    return (src, o) => { const d = labDist(src, o, lab); return d <= inner ? 1 : d >= tol ? 0 : 1 - (d - inner) / span; };
  }
  return (src, o) => {
    const dr = src[o] - sc[0], dg = src[o + 1] - sc[1], db = src[o + 2] - sc[2];
    const d = Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9);
    return d <= inner ? 1 : d >= tol ? 0 : 1 - (d - inner) / span;
  };""")
rep("""      const xm = Math.max(0, x - 1), xp = Math.min(W - 1, x + 1);
      const A = (ym + xm) * 4,""", """      const xm = Math.max(0, x - 1), xp = Math.min(W - 1, x + 1);
      if (wide){ edge[yc + x] = wideEdge(src, x, y); continue; }
      const A = (ym + xm) * 4,""")
rep("function computeTile(src, edge, tx, ty){\n  const xs = tx * TILE,", "function computeTile(src, edge, tx, ty){\n  const wide = S.edgeWide;\n  const xs = tx * TILE,")
rep("const edgeThr = sens =>", """// a 5×5 gradient: fine grain and noise average out, real edges stay
function wideEdge(src, x, y){
  let best = 0;
  const x0 = Math.max(0, x - 2), x1 = Math.min(W - 1, x + 2), y0 = Math.max(0, y - 2), y1 = Math.min(H - 1, y + 2);
  for (let c = 0; c < 4; c++){
    let l = 0, r = 0, t = 0, b = 0, nl = 0, nt = 0;
    for (let yy = y0; yy <= y1; yy++){ l += src[(yy * W + x0) * 4 + c] + src[(yy * W + Math.max(0, x - 1)) * 4 + c]; r += src[(yy * W + x1) * 4 + c] + src[(yy * W + Math.min(W - 1, x + 1)) * 4 + c]; nl += 2; }
    for (let xx = x0; xx <= x1; xx++){ t += src[(y0 * W + xx) * 4 + c] + src[(Math.max(0, y - 1) * W + xx) * 4 + c]; b += src[(y1 * W + xx) * 4 + c] + src[(Math.min(H - 1, y + 1) * W + xx) * 4 + c]; nt += 2; }
    const mg = (Math.abs(r - l) / nl + Math.abs(b - t) / nt) * 4;
    if (mg > best) best = mg;
  }
  return best >= 1020 ? 255 : best >> 2;
}
const edgeThr = sens =>""")
rep("  const tol = 6 + S.atol * 1.6, inner = tol * 0.5, span = tol - inner, thr = edgeThr(S.wedge);\n  const src = frames[f], edge = ensureEdges(f, 0, 0, W, H);",
    "  if (CUT.method === 'smart') return smartAmt(f, out);\n  const tol = 6 + S.atol * 1.6, inner = tol * 0.5, span = tol - inner, thr = edgeThr(CUT.edge);\n  const src = frames[f], edge = ensureEdges(f, 0, 0, W, H);")
rep("  const sel = S.mShow && motionSel, heat = S.mHeat && motion, ap = S.autoPrev && autoPrevData;\n  if (!W || !(sel || heat || ap)){",
    "  const sel = S.mShow && motionSel, heat = S.mHeat && motion, ap = S.autoPrev && autoPrevData, hn = CUT.showHints && AL && AL.hints && AL.hints.length === W * H ? AL.hints : null;\n  if (!W || !(sel || heat || ap || hn)){")
rep("    if (ap && ap[i]){ const t = ap[i] / 255;", "    if (hn && hn[i]){ const t = 0.55; const hc = hn[i] === 1 ? [54, 213, 90] : [235, 40, 190]; r = r * (1 - t) + hc[0] * t; gg = gg * (1 - t) + hc[1] * t; b = b * (1 - t) + hc[2] * t; a = Math.max(a, 150); }\n    if (ap && ap[i]){ const t = ap[i] / 255;")
rep("    if (!W || !S.autoPrev || stroke || S.playing) return;\n    const N = W * H, d = new Uint8Array(N), m = masks[S.cur];\n    autoAmt(S.cur, d);",
    "    if (!W || !S.autoPrev || stroke || S.playing) return;\n    const N = W * H, d = new Uint8Array(N), m = masks[S.cur];\n    const st0 = $('#aPrevStat'); st0.hidden = false; st0.textContent = 'Working…';\n    autoAmt(S.cur, d);")
rep("  }, 140);\n}\nfunction requestOverlay(){", "  }, CUT.method === 'smart' ? 260 : 140);\n}\nfunction requestOverlay(){")

rep("function updateUndoUI(){ $('#undoBtn').disabled = !undoStack.length; $('#redoBtn').disabled = !redoStack.length;", "function updateUndoUI(){ $('#undoBtn').disabled = !undoStack.length; $('#redoBtn').disabled = !redoStack.length; if (typeof miniSync === 'function') miniSync();")

rep("  stopPlay();\n  W = res.w; H = res.h; frames = res.frames; delays = res.delays.slice();", "  stopPlay();\n  if (typeof autoBeforeSwitch === 'function' && W) autoBeforeSwitch();\n  W = res.w; H = res.h; frames = res.frames; delays = res.delays.slice();")

# pixel art mode
rep("  if (S.zoom >= 14){\n    vctx.strokeStyle = 'rgba(128,128,128,.28)';", "  if (S.zoom >= pixGridMin()){\n    vctx.strokeStyle = PIX.on ? 'rgba(128,128,128,.4)' : 'rgba(128,128,128,.28)';")
rep("  const z = Math.min((cw - 40) / DocW, (ch - 40) / DocH, 4);\n  S.zoom = z;", "  let z = Math.min((cw - 40) / DocW, (ch - 40) / DocH, PIX.on ? 64 : 4);\n  if (PIX.on && z >= 1) z = Math.floor(z);\n  S.zoom = z;")
rep("function stepZoom(dir, sx, sy){ setZoom(S.zoom * (dir > 0 ? 1.25 : 0.8), sx, sy); }", "function stepZoom(dir, sx, sy){ const pz = pixStepZoom(dir); setZoom(pz != null ? pz : S.zoom * (dir > 0 ? 1.25 : 0.8), sx, sy); }")
rep("  const base = baseName || (S.name + '-cutout');\n  let blob, filename;", "  if (PIX.on && PIX.exportScale > 1){ const k = PIX.exportScale; out = out.map(c => upscaleNearest(c, bw, bh, k)); bw *= k; bh *= k; }\n  const base = baseName || (S.name + '-cutout');\n  let blob, filename;")

# icons as JS
ic_js = 'const ICON_PAL = ' + json.dumps(icons.PAL) + ';\nconst ICONS = ' + json.dumps({k: v.strip('\n') for k, v in {**icons.I, **icons2.I2}.items()}) + ';\n'
extra = open('ui_layers.js', encoding='utf-8').read() + '\n' + open('ui_draw.js', encoding='utf-8').read() + '\n' + open('ui_extra.js', encoding='utf-8').read() + '\n' + open('ui_touch.js', encoding='utf-8').read() + '\n' + open('ui_anim.js', encoding='utf-8').read() + '\n' + open('ui_cutout.js', encoding='utf-8').read() + '\n' + open('ui_mini.js', encoding='utf-8').read() + '\n' + open('ui_session.js', encoding='utf-8').read() + '\n' + open('ui_pixel.js', encoding='utf-8').read()
boot = "// ---------- boot ----------"
assert app.count(boot) == 1
app = app.replace(boot, ic_js + extra + "\n" + boot)

def b64png(img):
    b = io.BytesIO(); img.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
ico = Image.open('icon32.png')
markup = open('ui_markup.html', encoding='utf-8').read()
markup = markup.replace('__FAVICON__', b64png(ico)).replace('__ICON64__', b64png(ico.resize((64, 64), Image.NEAREST))).replace('__VERSION__', VERSION)
html = markup + '\n<script>/*__GWIZ_BOOT__*/</script>\n<script>' + codecs + '</script>\n<script>' + app + '</script>\n'
open('../launcher/index.html', 'w', encoding='utf-8').write(html)
print('ok', len(html))

# ---------- installable offline web app (iPad, Android, desktop browsers) ----------
import os, hashlib
WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web')
os.makedirs(os.path.join(WEB, 'icons'), exist_ok=True)
pwa_head = ('<link rel="manifest" href="manifest.webmanifest">\n'
            '<meta name="theme-color" content="#000080">\n'
            '<meta name="apple-mobile-web-app-capable" content="yes">\n'
            '<meta name="mobile-web-app-capable" content="yes">\n'
            '<meta name="apple-mobile-web-app-status-bar-style" content="default">\n'
            '<meta name="apple-mobile-web-app-title" content="G-WIZ">\n'
            '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
            '<script>window.__GWIZ_PWA__ = 1;</script>')
web_html = html.replace('<!--__PWA_HEAD__-->', pwa_head, 1)
open(os.path.join(WEB, 'index.html'), 'w', encoding='utf-8').write(web_html)
small = Image.open('icon32.png').convert('RGBA')
def tile(size, scale, bg=(0, 128, 128, 255)):
    im = Image.new('RGBA', (size, size), bg)
    ic = small.resize((32 * scale, 32 * scale), Image.NEAREST)
    o = (size - 32 * scale) // 2
    im.alpha_composite(ic, (o, o + scale // 2))
    return im
tile(180, 4).convert('RGB').save(os.path.join(WEB, 'icons', 'apple-touch-icon.png'))
tile(192, 5).save(os.path.join(WEB, 'icons', 'icon-192.png'))
tile(512, 14).save(os.path.join(WEB, 'icons', 'icon-512.png'))
tile(512, 9).save(os.path.join(WEB, 'icons', 'maskable-512.png'))
manifest = {
  'name': 'G-WIZ Graphics Wizard', 'short_name': 'G-WIZ', 'id': './', 'start_url': './', 'scope': './',
  'display': 'standalone', 'orientation': 'any', 'background_color': '#c0c0c0', 'theme_color': '#000080',
  'description': 'Erase backgrounds, edit animated GIFs, draw and work with layers. Works offline.',
  'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
            {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
            {'src': 'icons/maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}]
}
open(os.path.join(WEB, 'manifest.webmanifest'), 'w', encoding='utf-8').write(json.dumps(manifest, indent=2))
sw = open('sw_template.js', encoding='utf-8').read().replace('__VERSION__', VERSION)
open(os.path.join(WEB, 'sw.js'), 'w', encoding='utf-8').write(sw)
open(os.path.join(WEB, '.nojekyll'), 'w').write('')
open(os.path.join(WEB, 'version.txt'), 'w').write(VERSION + '\n')
print('web ok', hashlib.sha1(web_html.encode()).hexdigest()[:10])
