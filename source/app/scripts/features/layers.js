// ===================== layers: document model, drawing the document, undo, adding and ordering layers =====================
// The original editing code works on one image held in the globals W, H, frames, masks, delays and imgCanvas.
// Each layer owns its own copy of those; the selected ("active") layer's data is bound to the globals,
// so every existing tool edits the active layer in its own pixel coordinates. Layers sit at (x, y) on the canvas.
var DocW = 0, DocH = 0, layers = [], AL = null, layerSeq = 1;
S.xAuto = true;
S.dcur = 0;
function LX(){ return AL ? AL.x : 0; }
function LY(){ return AL ? AL.y : 0; }
const lfr = L => (L === AL ? frames : L.frames);
function docFrames(){ let n = 1; for (const L of layers) n = Math.max(n, lfr(L).length); return n; }
function longestLayer(){ let best = AL, n = 0; for (const L of layers){ const k = lfr(L).length; if (k > n){ n = k; best = L; } } return best; }
function docDelay(i){ const L = longestLayer(); if (!L) return 10; const fr = lfr(L), d = L === AL ? delays : L.delays; return d[i % fr.length]; }
function saveActive(){ if (!AL) return; AL.W = W; AL.H = H; AL.frames = frames; AL.masks = masks; AL.delays = delays; AL.canvas = imgCanvas; AL.ctx = imgCtx; AL.disp = disp; }
function newLayerObj(w, h, fr, dl, name){
  const L = { id: layerSeq++, name: name || 'Layer', x: 0, y: 0, W: w, H: h, frames: fr, masks: fr.map(() => new Uint8Array(w * h).fill(255)),
    delays: (dl && dl.length ? dl : fr.map(() => 10)).slice(), opacity: 1, blend: 'source-over', visible: true, locked: false };
  L.canvas = document.createElement('canvas'); L.canvas.width = w; L.canvas.height = h; L.ctx = L.canvas.getContext('2d'); L.disp = L.ctx.createImageData(w, h);
  return L;
}
function ensureCanvas(L){ if (L.canvas.width !== L.W || L.canvas.height !== L.H || !L.disp || L.disp.width !== L.W || L.disp.height !== L.H){ L.canvas.width = L.W; L.canvas.height = L.H; L.ctx = L.canvas.getContext('2d'); L.disp = L.ctx.createImageData(L.W, L.H); } }
// called by setImage(): the freshly opened image becomes a one-layer document
function initDocFromGlobals(name){
  if (typeof autoNewDoc === 'function') autoNewDoc();
  if (typeof xfCancel === 'function') xfCancel(true);
  const L = { id: layerSeq++, name: name || 'Background', x: 0, y: 0, W, H, frames, masks, delays, canvas: imgCanvas, ctx: imgCtx, disp, opacity: 1, blend: 'source-over', visible: true, locked: false };
  layers = [L]; AL = L; DocW = W; DocH = H; S.dcur = 0; S.crop = null;
  setTimeout(() => { renderLayersPanel(); syncLayerProps(); }, 0);
}
function loadActive(L){
  ensureCanvas(L);
  if (L.hints && L.hints.length !== L.W * L.H) L.hints = null;
  if (typeof cutModels !== 'undefined') cutModels = null;   // the layer may have changed size (crop, resize, rotate) since its canvas was made
  AL = L; W = L.W; H = L.H; frames = L.frames; masks = L.masks; delays = L.delays; imgCanvas = L.canvas; imgCtx = L.ctx; disp = L.disp;
  S.cur = S.dcur % frames.length;
  resetEdges(); refCache = null; resetMotion(); resetStabResult(); S.track = null;
  renderRect(0, 0, W, H);
}
function activateLayer(L){
  if (!L || L === AL || !layers.includes(L)) return false;
  if (stroke) endStroke();
  if (op) return false;
  if (typeof xfCommit === 'function' && XF) xfCommit();
  if (typeof textCommit === 'function' && TE) textCommit();
  saveActive(); const prev = AL;
  loadActive(L);
  if (prev && layers.includes(prev)) renderLayerPlain(prev);
  setupAnim(); updateHud(); renderLayersPanel(); syncLayerProps(); scheduleAutoPreview(); requestDraw();
  return true;
}
function layerById(id){ return layers.find(L => L.id === id); }
function ensureActive(lid){ if (lid == null || !AL || lid === AL.id) return true; const L = layerById(lid); return L ? activateLayer(L) : false; }
// plain rendering of a non-active layer (current frame, mask applied)
function renderLayerPlain(L){
  if (L === AL){ renderRect(0, 0, W, H); return; }
  ensureCanvas(L);
  const fi = S.dcur % L.frames.length, src = L.frames[fi], m = L.masks[fi], d = L.disp.data, N = L.W * L.H;
  for (let i = 0, p = 0; i < N; i++, p += 4){ d[p] = src[p]; d[p + 1] = src[p + 1]; d[p + 2] = src[p + 2]; d[p + 3] = (src[p + 3] * m[i] + 127) / 255; }
  L.ctx.putImageData(L.disp, 0, 0); L._fi = fi;
}
function refreshOtherAnimated(){ for (const L of layers) if (L !== AL && L.frames.length > 1 && L._fi !== S.dcur % L.frames.length) renderLayerPlain(L); }
function renderAllLayers(){ for (const L of layers) renderLayerPlain(L); }

// ---------- drawing the document ----------
let compCanvas = document.createElement('canvas'), compCtx = compCanvas.getContext('2d');
function drawDocument(bgFill, x, y, w, h){
  const z = S.zoom, dx = S.panX, dy = S.panY, dw = DocW * z, dh = DocH * z;
  const vx0 = Math.max(0, dx), vy0 = Math.max(0, dy), vx1 = Math.min(cw, dx + dw), vy1 = Math.min(ch, dy + dh);
  if (vx1 > vx0 && vy1 > vy0){ vctx.fillStyle = bgFill; vctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0); }
  // layers are combined off-screen so blend modes mix with the layers below, not with the checkerboard
  if (compCanvas.width !== view.width || compCanvas.height !== view.height){ compCanvas.width = view.width; compCanvas.height = view.height; compCtx = compCanvas.getContext('2d'); }
  const g = compCtx;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, compCanvas.width, compCanvas.height);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const docRot = docRotMode();
  g.save();
  if (!(S.rotA && $('#rexp').checked)){ g.beginPath(); g.rect(dx, dy, dw, dh); g.clip(); }
  if (docRot){ const cx = dx + dw / 2, cy = dy + dh / 2; g.translate(cx, cy); g.rotate(S.rotA * Math.PI / 180); g.translate(-cx, -cy); }
  drawOnionDoc(g, dx, dy, dw, dh);
  for (const L of layers){
    if (!L.visible) continue;
    g.globalAlpha = L.opacity; g.globalCompositeOperation = L.blend;
    g.imageSmoothingEnabled = z < 1 || docRot; g.imageSmoothingQuality = 'high';
    if (L === AL) drawActiveLayer(g, x, y, w, h);
    else g.drawImage(L.canvas, dx + L.x * z, dy + L.y * z, L.W * z, L.H * z);
  }
  g.restore();
  vctx.save(); vctx.setTransform(1, 0, 0, 1, 0, 0); vctx.globalAlpha = S.opacity / 100; vctx.drawImage(compCanvas, 0, 0); vctx.restore();
  vctx.strokeStyle = 'rgba(0,0,0,.6)'; vctx.lineWidth = 1; vctx.strokeRect(Math.round(dx) - 0.5, Math.round(dy) - 0.5, Math.round(dw) + 1, Math.round(dh) + 1);
  if (S.rotA){
    vctx.strokeStyle = 'rgba(255,255,255,.35)'; vctx.lineWidth = 1; vctx.beginPath();
    for (let gx = 0.5; gx < cw; gx += 48){ vctx.moveTo(gx, 0); vctx.lineTo(gx, ch); }
    for (let gy = 0.5; gy < ch; gy += 48){ vctx.moveTo(0, gy); vctx.lineTo(cw, gy); }
    vctx.stroke();
  }
}
function drawActiveLayer(g, x, y, w, h){
  if (XF){ xfDrawPreview(g); return; }
  const so = stabOffset();
  g.save();
  if (S.rotA && !docRotMode()){
    if (!rotExpands()){ g.beginPath(); g.rect(x, y, w, h); g.clip(); }
    g.translate(x + w / 2, y + h / 2); g.rotate(S.rotA * Math.PI / 180); g.translate(-(x + w / 2), -(y + h / 2));
    g.imageSmoothingEnabled = true;
  }
  drawOnionLayer(g, x, y, w, h);
  if (so){ g.beginPath(); g.rect(x, y, w, h); g.clip(); g.drawImage(imgCanvas, x + so[0] * S.zoom, y + so[1] * S.zoom, w, h); }
  else g.drawImage(imgCanvas, x, y, w, h);
  if (DS.active && DS.canvas){
    const a = g.globalAlpha;
    g.globalAlpha = a * DS.opacity; g.globalCompositeOperation = DS.lock ? 'source-atop' : DS.blend;
    drawStrokeCanvas(g, x, y, w, h); g.globalAlpha = a;
  }
  if (ovOn){ g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.drawImage(ovCanvas, x, y, w, h); }
  g.restore();
}

// whole-picture rotation preview applies when the Rotate page targets the picture and it has more than a single plain layer
S.rotTarget = 'doc';
function docRotMode(){ return !!S.rotA && S.rotTarget === 'doc' && !docFollows(); }

// ---------- undo for layer structure ----------
function captureDoc(){
  saveActive();
  return { dw: DocW, dh: DocH, active: AL ? AL.id : null, list: layers.map(L => ({ L, p: { name: L.name, x: L.x, y: L.y, W: L.W, H: L.H, frames: L.frames, masks: L.masks, delays: L.delays, opacity: L.opacity, blend: L.blend, visible: L.visible, locked: L.locked } })) };
}
function restoreDoc(st){
  const dimsChanged = st.dw !== DocW || st.dh !== DocH;
  layers = st.list.map(o => { Object.assign(o.L, o.p); ensureCanvas(o.L); return o.L; });
  DocW = st.dw; DocH = st.dh;
  const A = layerById(st.active) || layers[layers.length - 1];
  loadActive(A);
  S.dcur = Math.min(S.dcur, docFrames() - 1); S.cur = S.dcur % frames.length;
  renderAllLayers(); setupAnim(); renderLayersPanel(); syncLayerProps(); S.crop = null; syncCropUI();
  if (dimsChanged) fit();
  updateHud(); requestDraw();
}
// reload the globals from the active layer after layer objects were changed directly
function refreshDoc(refit){
  loadActive(AL);
  S.dcur = Math.min(S.dcur, docFrames() - 1); S.cur = S.dcur % frames.length;
  renderAllLayers(); setupAnim(); renderLayersPanel(); syncLayerProps(); S.crop = null; syncCropUI();
  if (refit) fit();
  updateHud(); requestDraw();
}
function swapLayersEntry(e){ const cur = captureDoc(); restoreDoc(e.state); return { kind: 'layers', state: cur, lid: null }; }
function pushLayersUndo(before){ pushUndo({ kind: 'layers', state: before, lid: null }); redoStack.length = 0; updateUndoUI(); }
// pixel (paint) edits: RGBA and mask crops of the touched rectangle
function cropPx(arr, x0, y0, x1, y1){ const bw = x1 - x0, out = new Uint8ClampedArray(bw * (y1 - y0) * 4); for (let y = y0; y < y1; y++) out.set(arr.subarray((y * W + x0) * 4, (y * W + x1) * 4), (y - y0) * bw * 4); return out; }
function pastePx(arr, data, x0, y0, x1, y1){ const bw = x1 - x0; for (let y = y0; y < y1; y++) arr.set(data.subarray((y - y0) * bw * 4, (y - y0 + 1) * bw * 4), (y * W + x0) * 4); }
function paintSnapshot(fs, x0, y0, x1, y1){ return { paint: true, fs, x0, y0, x1, y1, data: fs.map(f => cropPx(frames[f], x0, y0, x1, y1)), mdata: fs.map(f => cropM(masks[f], x0, y0, x1, y1)) }; }
function pushPaint(entry){ pushUndo(entry); redoStack.length = 0; updateUndoUI(); thumbsDirty(entry.fs); if (frames.length > 1) drawTlMarks(); }
function swapPaintEntry(e){
  const cur = paintSnapshot(e.fs, e.x0, e.y0, e.x1, e.y1);
  e.fs.forEach((f, i) => { pastePx(frames[f], e.data[i], e.x0, e.y0, e.x1, e.y1); pasteM(masks[f], e.mdata[i], e.x0, e.y0, e.x1, e.y1); });
  resetEdges(); renderRect(e.x0, e.y0, e.x1, e.y1); thumbsDirty(e.fs);
  cur.lid = e.lid; return cur;
}
function docFollows(){ return layers.length === 1 && AL && AL.x === 0 && AL.y === 0 && W === DocW && H === DocH; }
// replace the active layer's pixels (new size/position) with one undo step
function replaceActive(nf, nm, nw, nh, nx, ny, msg){
  const before = captureDoc();
  AL.frames = nf; AL.masks = nm; AL.W = nw; AL.H = nh; AL.x = nx; AL.y = ny;
  ensureCanvas(AL); loadActive(AL); setupAnim(); renderLayersPanel(); syncLayerProps();
  pushLayersUndo(before); requestDraw(); if (msg) toast(msg);
}

// ---------- layer pixels helpers ----------
function layerVisible(L, fi){
  const fr = lfr(L), ms = L === AL ? masks : L.masks, w = L === AL ? W : L.W, h = L === AL ? H : L.H;
  const src = fr[fi % fr.length], m = ms[fi % fr.length], out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, p = 0; i < w * h; i++, p += 4){ out[p] = src[p]; out[p + 1] = src[p + 1]; out[p + 2] = src[p + 2]; out[p + 3] = (src[p + 3] * m[i] + 127) / 255; }
  return out;
}
function toCanvas(rgba, w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0); return c; }
// temporarily point the globals at another layer (callers keep the active layer saved)
function withLayer(L, fn){
  const sv = [W, H, frames, masks]; W = L.W; H = L.H; frames = L.frames; masks = L.masks;
  try { return fn(); } finally { [W, H, frames, masks] = sv; }
}
// the whole picture for one animation frame; export=true applies edge finishing and the picture opacity
function composeDoc(i, exp){
  saveActive();
  const c = document.createElement('canvas'); c.width = DocW; c.height = DocH;
  const g = c.getContext('2d', { willReadFrequently: true });
  for (const L of layers){
    if (!L.visible) continue;
    const fi = i % L.frames.length;
    let rgba;
    if (exp){ const so = S.opacity; S.opacity = 100; try { rgba = withLayer(L, () => finalRGBA(fi)); } finally { S.opacity = so; } }
    else rgba = layerVisible(L, fi);
    g.globalAlpha = L.opacity; g.globalCompositeOperation = L.blend;
    g.drawImage(toCanvas(rgba, L.W, L.H), L.x, L.y);
  }
  const d = g.getImageData(0, 0, DocW, DocH).data;
  if (exp && S.opacity < 100){ const o = S.opacity / 100; for (let p = 3; p < d.length; p += 4) d[p] = d[p] * o; }
  return d;
}
function contentBoxDoc(list){
  let x0 = DocW, y0 = DocH, x1 = -1, y1 = -1;
  for (const c of list) for (let y = 0; y < DocH; y++){ const row = y * DocW; for (let x = 0; x < DocW; x++) if (c[(row + x) * 4 + 3]){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
}
function cropDoc(c, [x0, y0, x1, y1]){
  if (x0 === 0 && y0 === 0 && x1 === DocW && y1 === DocH) return c;
  const bw = x1 - x0, out = new Uint8ClampedArray(bw * (y1 - y0) * 4);
  for (let y = y0; y < y1; y++) out.set(c.subarray((y * DocW + x0) * 4, (y * DocW + x1) * 4), (y - y0) * bw * 4);
  return out;
}
// resample RGBA (and a mask) to a new size with the browser's scaler
function scaleRGBA(src, w, h, nw, nh, smooth){
  const a = toCanvas(src, w, h), b = document.createElement('canvas'); b.width = nw; b.height = nh;
  const g = b.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = smooth; g.imageSmoothingQuality = 'high';
  if (smooth && (nw < w / 2 || nh < h / 2)) return resizeRGBA(src, w, h, nw, nh);
  g.drawImage(a, 0, 0, nw, nh); return g.getImageData(0, 0, nw, nh).data;
}
function scaleMask(m, w, h, nw, nh, smooth){
  const t = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++){ t[i * 4] = t[i * 4 + 1] = t[i * 4 + 2] = 255; t[i * 4 + 3] = m[i]; }
  const r = scaleRGBA(t, w, h, nw, nh, smooth), o = new Uint8Array(nw * nh); for (let i = 0; i < nw * nh; i++) o[i] = r[i * 4 + 3]; return o;
}

// ---------- adding, removing and ordering layers ----------
function addLayer(L, below){
  const before = captureDoc();
  const i = AL ? layers.indexOf(AL) : layers.length - 1;
  layers.splice(below ? Math.max(0, i) : i + 1, 0, L);
  renderLayerPlain(L);
  pushLayersUndo(before);
  if (!below) activateLayer(L); else { renderLayersPanel(); requestDraw(); }
}
// a picture that is bigger than the canvas: ask whether to scale it down, enlarge the canvas, or keep it as is
async function addLayerFromRes(res, name){
  if (!W){ return setImage(res, name); }
  if (res.frames.length * res.w * res.h * 5 > (IS_IOS ? 0.4e9 : 1.2e9) || (IS_IOS && res.w * res.h > MAX_PIXELS)){ toast('That image is too large to add as a layer.', 4000); return false; }
  let L = newLayerObj(res.w, res.h, res.frames, res.delays, name);
  let how = 'fits';
  if (L.W > DocW || L.H > DocH){ how = await askFit(name, L.W, L.H); if (!how){ sbFlash('Import cancelled.'); return false; } }
  if (how === 'scale'){
    const s = Math.min(DocW / L.W, DocH / L.H), nw = Math.max(1, Math.round(L.W * s)), nh = Math.max(1, Math.round(L.H * s));
    L.frames = L.frames.map(f => scaleRGBA(f, L.W, L.H, nw, nh, true)); L.masks = L.frames.map(() => new Uint8Array(nw * nh).fill(255)); L.W = nw; L.H = nh; ensureCanvas(L);
    toast('Added "' + name + '" as a layer, scaled to ' + nw + ' × ' + nh + ' px to fit the canvas.');
  } else if (how === 'canvas'){
    growCanvasFor(L.W, L.H);
    toast('Added "' + name + '" as a layer; the canvas is now ' + DocW + ' × ' + DocH + ' px.');
  } else if (how === 'keep') toast('Added "' + name + '" at full size; parts outside the canvas are kept and can be moved into view.');
  else toast('Added "' + name + '" as a layer.');
  L.x = Math.round((DocW - L.W) / 2); L.y = Math.round((DocH - L.H) / 2);
  addLayer(L);
  return true;
}
// enlarge the canvas around the current picture; a blank start canvas simply takes the new size
function growCanvasFor(w, h){
  const nw = Math.max(DocW, w), nh = Math.max(DocH, h);
  if (nw === DocW && nh === DocH) return;
  saveActive();
  const blank = isBlankDoc();
  canvasResize(nw, nh, 0.5, 0.5);
  if (blank){
    const L = layers[0], c = blank, f = new Uint8ClampedArray(nw * nh * 4);
    for (let p = 0; p < f.length; p += 4){ f[p] = c[0]; f[p + 1] = c[1]; f[p + 2] = c[2]; f[p + 3] = c[3]; }
    L.frames = [f]; L.masks = [new Uint8Array(nw * nh).fill(255)]; L.W = nw; L.H = nh; L.x = 0; L.y = 0; ensureCanvas(L); refreshDoc(true);
  }
}
// a one-layer picture of a single flat color (the blank start canvas): returns that color
function isBlankDoc(){
  if (layers.length !== 1) return null;
  const L = layers[0], fr = lfr(L); if (fr.length !== 1) return null;
  const f = fr[0], m = L === AL ? masks[0] : L.masks[0], n = f.length;
  for (let p = 4; p < n; p += 4) if (f[p] !== f[0] || f[p + 1] !== f[1] || f[p + 2] !== f[2] || f[p + 3] !== f[3]) return null;
  for (let i = 0; i < m.length; i++) if (m[i] !== 255) return null;
  return [f[0], f[1], f[2], f[3]];
}
function blankLayer(name){ const fr = [new Uint8ClampedArray(DocW * DocH * 4)]; return newLayerObj(DocW, DocH, fr, [docDelay(0) || 10], name); }
function layerNew(){ if (!W) return; addLayer(blankLayer('Layer ' + layerSeq)); sbFlash('Added an empty layer.'); }
function layerDup(){
  if (!W) return; saveActive();
  const L = newLayerObj(W, H, frames.map(f => f.slice()), delays, AL.name + ' copy');
  L.masks = masks.map(m => m.slice()); L.x = AL.x; L.y = AL.y; L.opacity = AL.opacity; L.blend = AL.blend;
  addLayer(L); sbFlash('Duplicated the layer.');
}
function layerDel(){
  if (!W) return;
  if (layers.length < 2){ toast('A picture needs at least one layer.'); return; }
  const before = captureDoc(), i = layers.indexOf(AL);
  layers.splice(i, 1); const next = layers[Math.max(0, i - 1)];
  AL = null; loadActive(next); setupAnim(); renderLayersPanel(); syncLayerProps(); pushLayersUndo(before); requestDraw();
  sbFlash('Deleted the layer.');
}
function layerMove(dir){
  if (!W) return; const i = layers.indexOf(AL), j = i + dir;
  if (j < 0 || j >= layers.length) return;
  const before = captureDoc(); layers.splice(i, 1); layers.splice(j, 0, AL);
  pushLayersUndo(before); renderLayersPanel(); requestDraw();
}
function layerMoveTo(L, idx){
  const before = captureDoc(), i = layers.indexOf(L); if (i < 0) return;
  layers.splice(i, 1); layers.splice(Math.max(0, Math.min(layers.length, idx)), 0, L);
  pushLayersUndo(before); renderLayersPanel(); requestDraw();
}
// merge a list of layers (bottom to top) into one new pixel set covering their union (or the canvas)
function mergeData(list, rect){
  saveActive();
  const n = Math.max(...list.map(L => L.frames.length));
  const { x, y, w, h } = rect, nf = [];
  for (let f = 0; f < n; f++){
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true });
    for (const L of list){ g.globalAlpha = L.opacity; g.globalCompositeOperation = L.blend; g.drawImage(toCanvas(layerVisible(L, f), L.W, L.H), L.x - x, L.y - y); }
    nf.push(g.getImageData(0, 0, w, h).data);
  }
  const src = list.reduce((a, L) => L.frames.length > a.frames.length ? L : a, list[0]);
  return { nf, nm: nf.map(() => new Uint8Array(w * h).fill(255)), dl: (src === AL ? delays : src.delays).slice() };
}
function layerMerge(){
  if (!W) return; const i = layers.indexOf(AL);
  if (i < 1){ toast('There is no layer below to merge into.'); return; }
  const B = layers[i - 1], A = AL;
  const x0 = Math.min(A.x, B.x), y0 = Math.min(A.y, B.y), x1 = Math.max(A.x + A.W, B.x + B.W), y1 = Math.max(A.y + A.H, B.y + B.H);
  const before = captureDoc();
  const { nf, nm, dl } = mergeData([B, A], { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  Object.assign(B, { frames: nf, masks: nm, delays: dl, W: x1 - x0, H: y1 - y0, x: x0, y: y0, opacity: 1, blend: 'source-over' });
  ensureCanvas(B); layers.splice(i, 1); AL = null; loadActive(B);
  renderAllLayers(); setupAnim(); renderLayersPanel(); syncLayerProps(); pushLayersUndo(before); requestDraw();
  sbFlash('Merged the layer into "' + B.name + '".');
}
function layerFlatten(){
  if (!W || layers.length < 2){ toast('There is only one layer.'); return; }
  const before = captureDoc(), vis = layers.filter(L => L.visible);
  if (!vis.length){ toast('Every layer is hidden.'); return; }
  const { nf, nm, dl } = mergeData(vis, { x: 0, y: 0, w: DocW, h: DocH });
  const L = layers[0]; Object.assign(L, { frames: nf, masks: nm, delays: dl, W: DocW, H: DocH, x: 0, y: 0, opacity: 1, blend: 'source-over', visible: true, name: S.name || 'Background' });
  ensureCanvas(L); layers = [L]; AL = null; loadActive(L);
  renderAllLayers(); setupAnim(); renderLayersPanel(); syncLayerProps(); pushLayersUndo(before); requestDraw();
  sbFlash('Flattened the picture into one layer.');
}
