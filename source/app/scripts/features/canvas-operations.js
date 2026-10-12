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
