// ===================== layers: document model, compositing, undo, transforms, panel, projects =====================
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

// ---------- canvas-wide operations ----------
// crop works on the canvas (all layers)
const ASPECTS2 = { '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '16:9': 16 / 9, '9:16': 9 / 16, '3:2': 1.5, '2:3': 2 / 3 };
function aspectRatio(){ const v = $('#caspect').value; return v === 'orig' ? DocW / DocH : (ASPECTS2[v] || 0); }
function curCrop(){ return S.crop || { x: 0, y: 0, w: DocW, h: DocH }; }
function cropIsFull(c){ return c.x === 0 && c.y === 0 && c.w === DocW && c.h === DocH; }
function syncCropUI(){
  const c = curCrop();
  const set = (id, max, v) => { const e = $('#' + id); e.max = Math.max(0, max); e.value = v; const o = $('#' + id + 'Out'); if (o) o.textContent = v + ' px'; };
  set('cropL', DocW - 1, c.x); set('cropR', DocW - 1, DocW - c.x - c.w); set('cropT', DocH - 1, c.y); set('cropB', DocH - 1, DocH - c.y - c.h);
  const num = (id, max, v) => { const e = $('#' + id); e.max = max; if (document.activeElement !== e) e.value = v; };
  num('cropX', DocW - 1, c.x); num('cropY', DocH - 1, c.y); num('cropW', DocW, c.w); num('cropH', DocH, c.h);
  $('#cApply').disabled = cropIsFull(c);
  requestDraw();
}
function cropInput(k, v){
  if (!W) return;
  v = Math.round(+v); if (!isFinite(v)) return;
  let { x, y, w, h } = curCrop();
  const right = x + w, bottom = y + h; let anchorR = false, anchorB = false;
  if (k === 'l'){ x = clamp(v, 0, right - 1); w = right - x; anchorR = true; }
  else if (k === 'r'){ w = clamp(DocW - v - x, 1, DocW - x); }
  else if (k === 't'){ y = clamp(v, 0, bottom - 1); h = bottom - y; anchorB = true; }
  else if (k === 'b'){ h = clamp(DocH - v - y, 1, DocH - y); }
  else if (k === 'x'){ x = clamp(v, 0, DocW - w); }
  else if (k === 'y'){ y = clamp(v, 0, DocH - h); }
  else if (k === 'w'){ w = clamp(v, 1, DocW - x); }
  else if (k === 'h'){ h = clamp(v, 1, DocH - y); }
  const ar = aspectRatio();
  if (ar && 'lrw'.includes(k)){ h = Math.max(1, Math.round(w / ar)); if (h > DocH){ h = DocH; w = Math.max(1, Math.round(h * ar)); if (anchorR) x = right - w; } if (y + h > DocH) y = DocH - h; }
  else if (ar && 'tbh'.includes(k)){ w = Math.max(1, Math.round(h * ar)); if (w > DocW){ w = DocW; h = Math.max(1, Math.round(w / ar)); if (anchorB) y = bottom - h; } if (x + w > DocW) x = DocW - w; }
  S.crop = { x, y, w, h }; syncCropUI();
}
function setAspect(){
  const ar = aspectRatio(); if (!ar || !W){ syncCropUI(); return; }
  const c = curCrop(); let w = c.w, h = Math.round(w / ar);
  if (h > c.h){ h = c.h; w = Math.round(h * ar); }
  w = Math.max(1, w); h = Math.max(1, h);
  S.crop = { x: c.x + ((c.w - w) >> 1), y: c.y + ((c.h - h) >> 1), w, h }; syncCropUI();
}
function fitContent(){
  if (!W) return;
  const list = []; for (let i = 0; i < docFrames(); i++) list.push(composeDoc(i, false));
  const b = contentBoxDoc(list);
  if (!b){ toast('Nothing visible to fit to.'); return; }
  $('#caspect').value = 'free';
  S.crop = { x: b[0], y: b[1], w: b[2] - b[0], h: b[3] - b[1] }; syncCropUI();
}
// crop every layer to the box; layers keep their pixels inside it
function applyCrop(){
  const c = curCrop(); if (cropIsFull(c) || op) return;
  if (XF) xfCommit();
  const before = captureDoc();
  for (const L of layers){
    const ix0 = Math.max(c.x, L.x), iy0 = Math.max(c.y, L.y), ix1 = Math.min(c.x + c.w, L.x + L.W), iy1 = Math.min(c.y + c.h, L.y + L.H);
    if (ix1 <= ix0 || iy1 <= iy0){ L.frames = L.frames.map(() => new Uint8ClampedArray(4)); L.masks = L.frames.map(() => new Uint8Array(1).fill(255)); L.W = 1; L.H = 1; L.x = 0; L.y = 0; continue; }
    const lx0 = ix0 - L.x, ly0 = iy0 - L.y, lx1 = ix1 - L.x, ly1 = iy1 - L.y;
    if (lx0 !== 0 || ly0 !== 0 || lx1 !== L.W || ly1 !== L.H){
      L.frames = withLayer(L, () => L.frames.map(f => cropPx(f, lx0, ly0, lx1, ly1)));
      L.masks = withLayer(L, () => L.masks.map(m => cropM(m, lx0, ly0, lx1, ly1)));
      L.W = lx1 - lx0; L.H = ly1 - ly0;
    }
    L.x = ix0 - c.x; L.y = iy0 - c.y;
  }
  DocW = c.w; DocH = c.h;
  pushLayersUndo(before);
  refreshDoc(true);
  toast('Cropped to ' + c.w + ' × ' + c.h + ' px.');
}
function canvasResize(nw, nh, ax, ay){
  if (!W) return; if (XF) xfCommit();
  const before = captureDoc(), dx = Math.round((nw - DocW) * ax), dy = Math.round((nh - DocH) * ay);
  for (const L of layers){ L.x += dx; L.y += dy; }
  DocW = nw; DocH = nh; pushLayersUndo(before); refreshDoc(true); toast('Canvas is now ' + nw + ' × ' + nh + ' px.');
}
function imageResize(nw, nh, smooth){
  if (!W) return; if (XF) xfCommit();
  const before = captureDoc(), sx = nw / DocW, sy = nh / DocH;
  for (const L of layers){
    const w = Math.max(1, Math.round(L.W * sx)), h = Math.max(1, Math.round(L.H * sy));
    L.frames = L.frames.map(f => scaleRGBA(f, L.W, L.H, w, h, smooth)); L.masks = L.masks.map(m => scaleMask(m, L.W, L.H, w, h, smooth));
    L.x = Math.round(L.x * sx); L.y = Math.round(L.y * sy); L.W = w; L.H = h;
  }
  DocW = nw; DocH = nh; pushLayersUndo(before); refreshDoc(true); toast('Resized the picture to ' + nw + ' × ' + nh + ' px.');
}
// rotate / flip the whole picture: every layer turns and moves with the canvas
function canvasTurn(deg, flip){
  if (!W || op) return; if (XF) xfCommit(); stopPlay();
  const before = captureDoc(), quarter = ((Math.round(deg / 90) % 4) + 4) % 4;
  for (const L of layers){
    let nw = L.W, nh = L.H; if (!flip && quarter % 2) { nw = L.H; nh = L.W; }
    const res = withLayer(L, () => L.frames.map((f, i) => resampleFrame(f, L.masks[i], nw, nh, flip ? 0 : deg, flip)));
    L.frames = res.map(r => r[0]); L.masks = res.map(r => r[1]);
    let nx = L.x, ny = L.y;
    if (flip === 'h') nx = DocW - L.x - L.W; else if (flip === 'v') ny = DocH - L.y - L.H;
    else if (quarter === 1){ nx = DocH - (L.y + L.H); ny = L.x; }
    else if (quarter === 3){ nx = L.y; ny = DocW - (L.x + L.W); }
    else if (quarter === 2){ nx = DocW - L.x - L.W; ny = DocH - L.y - L.H; }
    L.x = nx; L.y = ny; L.W = nw; L.H = nh;
  }
  if (!flip && quarter % 2){ const t = DocW; DocW = DocH; DocH = t; }
  pushLayersUndo(before); refreshDoc(true);
  toast(flip ? (flip === 'h' ? 'Flipped the picture horizontally.' : 'Flipped the picture vertically.') : 'Rotated the picture ' + (deg > 0 ? 'clockwise.' : 'counter-clockwise.'));
}

// rotate the whole picture by any angle: each layer turns about its own center, which swings around the canvas center
function canvasRotate(deg){
  if (!W || op) return; if (XF) xfCommit(); stopPlay();
  if (Math.abs(Math.round(deg / 90) * 90 - deg) < 1e-9){ canvasTurn(deg); return; }
  const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), ac = Math.abs(c), as = Math.abs(s), exp = $('#rexp').checked;
  const nDW = exp ? Math.max(1, Math.round(DocW * ac + DocH * as)) : DocW, nDH = exp ? Math.max(1, Math.round(DocW * as + DocH * ac)) : DocH;
  if (nDW * nDH > 400e6){ toast('The rotated picture would be too large.'); return; }
  busy(true);
  try {
    const before = captureDoc();
    for (const L of layers){
      const nw = Math.max(1, Math.round(L.W * ac + L.H * as)), nh = Math.max(1, Math.round(L.W * as + L.H * ac));
      const res = withLayer(L, () => L.frames.map((f, i) => resampleFrame(f, L.masks[i], nw, nh, deg, null)));
      const lcx = L.x + L.W / 2 - DocW / 2, lcy = L.y + L.H / 2 - DocH / 2;
      const ncx = c * lcx - s * lcy + nDW / 2, ncy = s * lcx + c * lcy + nDH / 2;
      L.frames = res.map(q => q[0]); L.masks = res.map(q => q[1]); L.W = nw; L.H = nh; L.x = Math.round(ncx - nw / 2); L.y = Math.round(ncy - nh / 2);
    }
    DocW = nDW; DocH = nDH; pushLayersUndo(before); setAngle(0); refreshDoc(true);
    toast('Rotated the picture ' + Math.abs(+deg.toFixed(1)) + '° ' + (deg > 0 ? 'clockwise.' : 'counter-clockwise.'));
  } finally { busy(false); }
}
// the Rotate page and its quick-turn buttons: the picture (all layers) or just the selected layer
function rotRun(deg, flip){
  if (!W) return;
  if (S.rotTarget === 'layer' || docFollows()){ transformFrames(deg, flip); return; }
  if (flip || Math.abs(Math.round(deg / 90) * 90 - deg) < 1e-9) canvasTurn(deg, flip); else canvasRotate(deg);
  setAngle(0);
}

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

// ---------- layers panel ----------
function renderLayersPanel(){
  const list = $('#layerList'); if (!list) return;
  list.innerHTML = '';
  for (let k = layers.length - 1; k >= 0; k--){
    const L = layers[k], row = document.createElement('div');
    row.className = 'lyr' + (L === AL ? ' sel' : ''); row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(L === AL)); row.draggable = true; row.dataset.id = L.id;
    const eye = document.createElement('button'); eye.className = 'lbtn' + (L.visible ? '' : ' off'); eye.innerHTML = '<i class="ic" data-ic="eye"></i>'; eye.dataset.tip = L.visible ? 'Hide layer' : 'Show layer';
    eye.addEventListener('click', ev => { ev.stopPropagation(); L.visible = !L.visible; renderLayersPanel(); syncLayerProps(); requestDraw(); });
    const th = document.createElement('div'); th.className = 'lthumb'; const tc = document.createElement('canvas'); th.appendChild(tc);
    const nm = document.createElement('div'); nm.className = 'lname';
    const t1 = document.createElement('div'); t1.textContent = L.name; const t2 = document.createElement('div'); t2.className = 'lsub';
    const fr = lfr(L), lw = L === AL ? W : L.W, lh = L === AL ? H : L.H;
    t2.textContent = lw + '×' + lh + (fr.length > 1 ? ' · ' + fr.length + ' fr' : '') + (L.blend !== 'source-over' ? ' · ' + $('#lBlend option[value="' + L.blend + '"]').textContent : '') + (L.opacity < 1 ? ' · ' + Math.round(L.opacity * 100) + '%' : '');
    nm.append(t1, t2);
    const lk = document.createElement('button'); lk.className = 'lbtn' + (L.locked ? '' : ' off'); lk.innerHTML = '<i class="ic" data-ic="lock"></i>'; lk.dataset.tip = L.locked ? 'Unlock layer' : 'Lock layer';
    lk.addEventListener('click', ev => { ev.stopPropagation(); L.locked = !L.locked; renderLayersPanel(); syncLayerProps(); });
    row.append(eye, th, nm, lk);
    row.addEventListener('mousedown', () => { if (L !== AL) activateLayer(L); });
    t1.addEventListener('dblclick', () => {
      const inp = document.createElement('input'); inp.type = 'text'; inp.value = L.name; t1.replaceWith(inp); inp.focus(); inp.select();
      const done = ok => { if (ok && inp.value.trim()) L.name = inp.value.trim(); renderLayersPanel(); syncLayerProps(); };
      inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); });
      inp.addEventListener('blur', () => done(true));
    });
    row.addEventListener('dragstart', ev => { ev.dataTransfer.setData('text/gwiz-layer', String(L.id)); ev.dataTransfer.effectAllowed = 'move'; });
    row.addEventListener('dragover', ev => { if ([...ev.dataTransfer.types].includes('text/gwiz-layer')){ ev.preventDefault(); row.classList.add('dragover'); } });
    row.addEventListener('dragleave', () => row.classList.remove('dragover'));
    row.addEventListener('drop', ev => {
      const id = +ev.dataTransfer.getData('text/gwiz-layer'); if (!id) return;
      ev.preventDefault(); ev.stopPropagation(); row.classList.remove('dragover');
      const src = layerById(id); if (!src || src === L) return;
      let idx = layers.indexOf(L); if (layers.indexOf(src) > idx) idx += 1;
      layerMoveTo(src, layers.indexOf(src) < idx ? idx - 1 + 1 : idx);
    });
    list.appendChild(row);
    drawLayerThumb(L, tc);
  }
  const ms = $$('[data-cmd="layerDel"],[data-cmd="layerMerge"]'); ms.forEach(b => b.disabled = layers.length < 2);
  updateLayerHead();
}
function drawLayerThumb(L, tc){
  const lw = L === AL ? W : L.W, lh = L === AL ? H : L.H; if (!lw) return;
  const s = Math.min(30 / lw, 26 / lh); tc.width = Math.max(1, Math.round(lw * s)); tc.height = Math.max(1, Math.round(lh * s));
  const g = tc.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(L === AL ? imgCanvas : L.canvas, 0, 0, tc.width, tc.height);
}
let lthT = 0;
function scheduleLayerThumb(){ clearTimeout(lthT); lthT = setTimeout(() => { const row = $('#layerList .lyr.sel canvas'); if (row && AL) drawLayerThumb(AL, row); }, 250); }
function syncLayerProps(){
  if (!AL) return;
  $('#lBlend').value = AL.blend; $('#lOpac').value = Math.round(AL.opacity * 100); $('#lOpacOut').textContent = Math.round(AL.opacity * 100) + '%';
  $('#lName').value = AL.name; $('#lVis').checked = AL.visible; $('#lLock').checked = AL.locked;
  $('#lInfo').textContent = 'Layer ' + (layers.indexOf(AL) + 1) + ' of ' + layers.length + ' · ' + W + ' × ' + H + ' px at ' + AL.x + ', ' + AL.y + (frames.length > 1 ? ' · ' + frames.length + ' frames' : '');
  const set = (id, v) => { const e = $('#' + id); if (document.activeElement !== e) e.value = v; };
  set('xX', AL.x); set('xY', AL.y); set('xW', W); set('xH', H);
  $('#cvW').value = DocW; $('#cvH').value = DocH; $('#rsW').value = DocW; $('#rsH').value = DocH;
}
$('#lBlend').addEventListener('change', e => { if (!AL) return; AL.blend = e.target.value; renderLayersPanel(); requestDraw(); });
$('#lOpac').addEventListener('input', e => { if (!AL) return; AL.opacity = +e.target.value / 100; $('#lOpacOut').textContent = e.target.value + '%'; requestDraw(); });
$('#lOpac').addEventListener('change', () => renderLayersPanel());
$('#lName').addEventListener('change', e => { if (AL && e.target.value.trim()){ AL.name = e.target.value.trim(); renderLayersPanel(); } });
$('#lVis').addEventListener('change', e => { if (AL){ AL.visible = e.target.checked; renderLayersPanel(); requestDraw(); } });
$('#lLock').addEventListener('change', e => { if (AL){ AL.locked = e.target.checked; renderLayersPanel(); } });
$('#xApply').addEventListener('click', xfFromNumbers);
$('#xReset').addEventListener('click', () => { if (XF) xfCancel(); $('#xRot').value = 0; $('#xSkX').value = 0; $('#xSkY').value = 0; syncLayerProps(); });
$('#xW').addEventListener('input', () => { if ($('#xKeep').checked && W) $('#xH').value = Math.max(1, Math.round(+$('#xW').value * H / W)); });
$('#xH').addEventListener('input', () => { if ($('#xKeep').checked && H) $('#xW').value = Math.max(1, Math.round(+$('#xH').value * W / H)); });
$('#xCenter').addEventListener('click', layerCenter);
$('#xFit').addEventListener('click', () => xfScaleTo('fit'));
$('#xFill').addEventListener('click', () => xfScaleTo('fill'));
$('#xTrim').addEventListener('click', layerTrim);
$('#xExpand').addEventListener('click', () => { if (!layerExpand()) toast('The layer already covers the canvas.'); });
rangeBind('kFeather', 'kFeather', v => v + ' px');
$('#kApply').addEventListener('click', shapeLayer);
$('#layerIn').addEventListener('change', async e => { const fl = [...e.target.files]; e.target.value = ''; FIT.batch = fl.length; FIT.choice = null; try { for (const f of fl) await loadFile(f, true); } finally { FIT.batch = 0; FIT.choice = null; } });
function importLayer(){ if (!W){ openFile(); return; } $('#layerIn').click(); }
// canvas page
let cvAnchor = [0.5, 0.5];
(function buildAnchor(){
  const box = $('#cvAnchor');
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++){
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', String(r === 1 && c === 1)); b.setAttribute('aria-label', 'Anchor ' + ['top', 'middle', 'bottom'][r] + ' ' + ['left', 'center', 'right'][c]);
    b.addEventListener('click', () => { cvAnchor = [c / 2, r / 2]; box.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
    box.appendChild(b);
  }
})();
$('#cvApply').addEventListener('click', () => { const w = Math.round(+$('#cvW').value), h = Math.round(+$('#cvH').value); if (w > 0 && h > 0 && (w !== DocW || h !== DocH)) canvasResize(w, h, cvAnchor[0], cvAnchor[1]); });
$('#rsPct').addEventListener('input', e => { const p = +e.target.value / 100; $('#rsPctOut').textContent = e.target.value + '%'; $('#rsW').value = Math.max(1, Math.round(DocW * p)); $('#rsH').value = Math.max(1, Math.round(DocH * p)); });
$('#rsW').addEventListener('input', () => { if ($('#rsKeep').checked && DocW) $('#rsH').value = Math.max(1, Math.round(+$('#rsW').value * DocH / DocW)); });
$('#rsH').addEventListener('input', () => { if ($('#rsKeep').checked && DocH) $('#rsW').value = Math.max(1, Math.round(+$('#rsH').value * DocW / DocH)); });
$('#rsApply').addEventListener('click', () => { const w = Math.round(+$('#rsW').value), h = Math.round(+$('#rsH').value); if (w > 0 && h > 0 && (w !== DocW || h !== DocH)) imageResize(w, h, $('#rsSmooth').checked); });

// ---------- new image ----------
let newBg = 'white';
segBind('#nBg', 'v', v => newBg = v);
$('#nPreset').addEventListener('change', e => { const v = e.target.value; if (!v) return; const [w, h] = v.split('x').map(Number); $('#nW').value = w; $('#nH').value = h; });
function newImage(){
  const w = Math.max(1, Math.min(IS_IOS ? 4000 : 20000, Math.round(+$('#nW').value))), h = Math.max(1, Math.min(IS_IOS ? 4000 : 20000, Math.round(+$('#nH').value)));
  const f = new Uint8ClampedArray(w * h * 4);
  if (newBg !== 'clear'){ const c = newBg === 'white' ? { r: 255, g: 255, b: 255, a: 255 } : S.c2; for (let p = 0; p < f.length; p += 4){ f[p] = c.r; f[p + 1] = c.g; f[p + 2] = c.b; f[p + 3] = c.a; } }
  closeModal('newDlg');
  setImage({ w, h, frames: [f], delays: [0] }, 'untitled');
  if (layers[0]) layers[0].name = 'Background';
  renderLayersPanel(); setTool('brush');
}
$('#nOk').addEventListener('click', newImage);

// ---------- project files (.gwiz) ----------
async function gzip(bytes){ const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')); return new Uint8Array(await new Response(s).arrayBuffer()); }
async function gunzip(bytes){ const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')); return new Uint8Array(await new Response(s).arrayBuffer()); }
async function projectBytes(){
  saveActive();
  const meta = { app: 'G-WIZ', version: 1, name: S.name, w: DocW, h: DocH, active: layers.indexOf(AL), layers: layers.map(L => ({ name: L.name, x: L.x, y: L.y, w: L.W, h: L.H, n: L.frames.length, delays: L.delays, opacity: L.opacity, blend: L.blend, visible: L.visible, locked: L.locked })) };
  const json = new TextEncoder().encode(JSON.stringify(meta)), parts = [new TextEncoder().encode('GWIZPRJ1'), new Uint8Array(new Uint32Array([json.length]).buffer), json];
  for (const L of layers) for (let f = 0; f < L.frames.length; f++){ parts.push(new Uint8Array(L.frames[f].buffer, L.frames[f].byteOffset, L.frames[f].byteLength)); parts.push(L.masks[f]); }
  return gzip(new Uint8Array(await new Blob(parts).arrayBuffer()));
}
function isProjectBytes(b){ return (b[0] === 0x1f && b[1] === 0x8b) || (b[0] === 0x50 && b[1] === 0x4b && b.length > 34 && new TextDecoder().decode(b.subarray(30, 30 + (b[26] | b[27] << 8))).endsWith('.gwiz')); }
async function openProject(bytes, fname){
  if (bytes[0] === 0x50){ const nl = bytes[26] | bytes[27] << 8, sz = bytes[18] | bytes[19] << 8 | bytes[20] << 16 | bytes[21] << 24; bytes = bytes.subarray(30 + nl, 30 + nl + (sz >>> 0)); }
  const raw = await gunzip(bytes), dec = new TextDecoder();
  if (dec.decode(raw.subarray(0, 8)) !== 'GWIZPRJ1') throw new Error('This is not a G-WIZ project file.');
  const jl = new DataView(raw.buffer, raw.byteOffset + 8, 4).getUint32(0, true), meta = JSON.parse(dec.decode(raw.subarray(12, 12 + jl)));
  let p = 12 + jl; const built = [];
  for (const m of meta.layers){
    const fr = [], ms = [];
    for (let f = 0; f < m.n; f++){ const a = m.w * m.h * 4; fr.push(new Uint8ClampedArray(raw.slice(p, p + a))); p += a; ms.push(new Uint8Array(raw.slice(p, p + m.w * m.h))); p += m.w * m.h; }
    const L = newLayerObj(m.w, m.h, fr, m.delays, m.name); L.masks = ms; Object.assign(L, { x: m.x, y: m.y, opacity: m.opacity, blend: m.blend, visible: m.visible, locked: m.locked });
    built.push(L);
  }
  const first = built[0];
  setImage({ w: first.W, h: first.H, frames: first.frames, delays: first.delays }, meta.name || fname);
  // replace the one-layer document setImage made with the project's layers
  masks = first.masks; AL.masks = first.masks; Object.assign(AL, { name: first.name, x: first.x, y: first.y, opacity: first.opacity, blend: first.blend, visible: first.visible, locked: first.locked });
  layers = [AL, ...built.slice(1)]; DocW = meta.w; DocH = meta.h; S.name = meta.name || fname;
  const act = layers[Math.max(0, Math.min(layers.length - 1, meta.active))];
  AL = null; loadActive(act); renderAllLayers(); setupAnim(); fit(); renderLayersPanel(); syncLayerProps(); undoStack.length = 0; redoStack.length = 0; updateUndoUI(); requestDraw();
  toast('Opened project "' + S.name + '" · ' + layers.length + ' layers.');
}
async function saveProject(){
  if (!W) return;
  const name = S.name + '.gwiz';
  let handle = null;
  if (canPick){
    try { handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'G-WIZ project', accept: { 'application/octet-stream': ['.gwiz'] } }] }); }
    catch (err){ if (err && err.name === 'AbortError'){ sbFlash('Save cancelled.'); return; } handle = null; }
  }
  busy(true); await new Promise(r => setTimeout(r, 16));
  try {
    const bytes = await projectBytes();
    if (handle){ const w = await handle.createWritable(); await w.write(bytes); await w.close(); toast('Saved project ' + handle.name + ' · ' + fmtBytes(bytes.length)); }
    else if (downloadsP) await saveBlob(new Blob([zipStore(name, bytes)]), S.name + '-project.zip');
    else await saveBlob(new Blob([bytes]), name);
    AUTO.savedProject = true; AUTO.dirty = true; AUTO.everEdited = true; autoSave(true).then(() => { AUTO.savedProject = true; });
  } catch (err){ toast('Could not save the project: ' + (err && err.message || err), 5000); }
  finally { busy(false); }
}
// copy the selected layer (or the whole picture) to the clipboard as a PNG
async function copyToClipboard(merged){
  if (!W) return;
  try {
    const rgba = merged ? composeDoc(S.dcur, false) : layerVisible(AL, S.cur), w = merged ? DocW : W, h = merged ? DocH : H;
    const blob = await new Promise(r => toCanvas(rgba, w, h).toBlob(r, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    sbFlash(merged ? 'Copied the whole picture.' : 'Copied the layer. Ctrl+V pastes it as a new layer.');
  } catch (err){ toast('Copying images is not allowed here.'); }
}
