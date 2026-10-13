// ===================== pixel art tools: palette recolor, outline, shading, tiles, sprite sheets =====================
PIX.tilePrev = !!PIX.tilePrev; PIX.shade = PIX.shade || 'off'; PIX.outMode = PIX.outMode || 'outside'; PIX.outCorners = !!PIX.outCorners;
PIX.rampN = PIX.rampN || 5; PIX.rampHue = PIX.rampHue == null ? 25 : PIX.rampHue; PIX.sheetCols = PIX.sheetCols || 'auto'; PIX.sheetPad = PIX.sheetPad || 0;
PIX.recolorAll = PIX.recolorAll !== false;
const PXT = { sel: null };
const pxHex = c => '#' + c.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('');

// ---------- colors in the picture, and recoloring one of them everywhere ----------
// Every color the current frame uses is listed (most used first). Pick one, choose the new color as the primary
// color, and Recolor changes every pixel of exactly that color, on all layers and frames: like changing a color
// in an indexed palette.
let pxUsedT = 0;
function pxUsedSchedule(){ clearTimeout(pxUsedT); pxUsedT = setTimeout(pxUsedRender, 250); }
function pxUsedRender(){
  const box = $('#pxUsed'); if (!box || !W || DocW * DocH > 4e6){ if (box) box.textContent = ''; return; }
  const d = composeDoc(S.dcur, false), cnt = new Map();
  for (let p = 0; p < d.length; p += 4) if (d[p + 3] >= 128){ const k = (d[p] << 16) | (d[p + 1] << 8) | d[p + 2]; cnt.set(k, (cnt.get(k) || 0) + 1); if (cnt.size > 4096) break; }
  const list = [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 96);
  box.innerHTML = '';
  for (const [k, n] of list){
    const rgb = [(k >> 16) & 255, (k >> 8) & 255, k & 255], hx = pxHex(rgb), b = document.createElement('button');
    b.type = 'button'; b.className = 'pxsw' + (PXT.sel && pxHex(PXT.sel) === hx ? ' sel' : ''); b.style.background = hx;
    b.dataset.tip = hx + ' · ' + n.toLocaleString() + ' px'; b.setAttribute('aria-label', hx);
    b.addEventListener('click', () => { PXT.sel = rgb; setColor(1, { r: rgb[0], g: rgb[1], b: rgb[2], a: 255 }); pxUsedRender(); pxRecolorUI(); });
    box.appendChild(b);
  }
  if (cnt.size > 96) { const s = document.createElement('span'); s.className = 'hint dim'; s.textContent = '… ' + (cnt.size - 96) + ' more'; box.appendChild(s); }
  pxRecolorUI();
}
function pxRecolorUI(){
  const btn = $('#pxRecolor'); if (!btn) return;
  btn.disabled = !PXT.sel;
  $('#pxRecolorInfo').textContent = PXT.sel ? 'Selected ' + pxHex(PXT.sel) + '. Now choose the new color (it becomes the primary color), then Recolor.' : 'Click a color above to select it.';
}
function pxRecolor(){
  if (!PXT.sel || !W) return;
  const [r, g, b] = PXT.sel, to = S.c1;
  if (to.r === r && to.g === g && to.b === b){ toast('The primary color is the selected color. Choose the new color first.'); return; }
  const hit = (fr, o) => fr[o] === r && fr[o + 1] === g && fr[o + 2] === b && fr[o + 3] > 0;
  let n = 0;
  if (!PIX.recolorAll){
    applyPixels(fr => { for (let o = 0; o < fr.length; o += 4) if (hit(fr, o)){ fr[o] = to.r; fr[o + 1] = to.g; fr[o + 2] = to.b; n++; } }, null);
  } else {
    // every layer and frame; changed frames are copied, so one Undo puts all of them back
    const before = captureDoc();
    for (const L of layers){
      if (L.locked) continue;
      L.frames = L.frames.map(fr => { let c = null; for (let o = 0; o < fr.length; o += 4) if (hit(fr, o)){ if (!c) c = fr.slice(); c[o] = to.r; c[o + 1] = to.g; c[o + 2] = to.b; n++; } return c || fr; });
    }
    if (n){ pushLayersUndo(before); refreshDoc(false); markDirty(); }
  }
  toast(n ? 'Recolored ' + n.toLocaleString() + ' pixels from ' + pxHex(PXT.sel) + ' to ' + hexA(to) + '.' : 'No pixels of ' + pxHex(PXT.sel) + ' were found.');
  if (n){ PXT.sel = [to.r, to.g, to.b]; pixDirty(); pxUsedSchedule(); }
}

// ---------- outline ----------
// Outside: every clear pixel next to the shape gets the primary color. Inside: the shape's own rim is recolored.
function pxOutline(){
  const c = S.c1, diag = PIX.outCorners, inside = PIX.outMode === 'inside';
  let n = 0;
  applyPixels((fr, m) => {
    const N = W * H, solid = new Uint8Array(N);
    for (let i = 0; i < N; i++) solid[i] = fr[i * 4 + 3] * m[i] >= 128 * 255 ? 1 : 0;
    const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && solid[y * W + x];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
      const i = y * W + x, s = solid[i];
      if (inside ? !s : s) continue;
      let edge = inside ? !(at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1)) || (x === 0 || y === 0 || x === W - 1 || y === H - 1)
                        : at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1);
      if (!edge && diag) edge = inside ? !(at(x - 1, y - 1) && at(x + 1, y - 1) && at(x - 1, y + 1) && at(x + 1, y + 1)) : at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1);
      if (!edge) continue;
      const o = i * 4; fr[o] = c.r; fr[o + 1] = c.g; fr[o + 2] = c.b; fr[o + 3] = 255; m[i] = 255; n++;
    }
  }, null);
  toast(n ? 'Outlined with ' + hexA(c) + ' (' + n.toLocaleString() + ' pixels).' : 'Nothing to outline on the selected layer.');
  if (n) pixDirty();
}

// ---------- color ramps and the shading pencil ----------
function pxRgb2hsl(r, g, b){
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn){ const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [h, s, l];
}
function pxHsl2rgb(h, s, l){
  h = ((h % 360) + 360) % 360; const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
// shades of the primary color: darker ones lean toward blue and gain saturation, lighter ones lean toward
// yellow and lose some, the way pixel artists shift hue instead of only adding black or white
function pxRamp(){
  const c = S.c1, [h, s, l] = pxRgb2hsl(c.r, c.g, c.b), N = PIX.rampN, mid = (N - 1) / 2, out = [];
  const toward = (h0, target, t) => { let d = ((target - h0 + 540) % 360) - 180; return h0 + d * t; };
  for (let i = 0; i < N; i++){
    const t = (i - mid) / Math.max(1, mid);   // -1 darkest … +1 lightest
    const L = t < 0 ? l * (1 + t * 0.75) : l + (1 - l) * t * 0.7;
    const S2 = Math.min(1, Math.max(0, t < 0 ? s + (1 - s) * -t * 0.25 : s * (1 - t * 0.35)));
    const H2 = t < 0 ? toward(h, 240, -t * PIX.rampHue / 60) : toward(h, 60, t * PIX.rampHue / 60);
    out.push(pixSnapRGBIf(pxHsl2rgb(H2, S2, Math.min(1, Math.max(0, L)))));
  }
  return out;
}
const pixSnapRGBIf = rgb => PIX.on && PIX.snap && (pixPalette() || pixBits()) ? pixSnapRGB(rgb[0], rgb[1], rgb[2]) : rgb;
function pxRampRender(){
  const box = $('#pxRamp'); if (!box) return; box.innerHTML = '';
  for (const rgb of pxRamp()){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pxsw'; b.style.background = pxHex(rgb); b.dataset.tip = pxHex(rgb);
    b.addEventListener('click', () => setColor(1, { r: rgb[0], g: rgb[1], b: rgb[2], a: 255 }));
    box.appendChild(b);
  }
}
function pxRampToCustom(){
  const hs = pxRamp().map(pxHex);
  S.custom = [...hs, ...S.custom.filter(x => !hs.includes(x))].slice(0, 28); store.set('custom', S.custom);
  if (typeof renderCustom === 'function') renderCustom(); if (S.scheme === 'Custom colors') renderPalette();
  sbFlash('Added ' + hs.length + ' shades to Custom colors (Colors > Custom colors).');
}
// the shading pencil: each pixel it touches moves one step darker or lighter along the palette (the pixel art
// palette, else the colors shown below the canvas), sorted from dark to light
function pxShadeActive(){ return PIX.on && PIX.shade !== 'off' && DS.tool === 'pencil'; }
function pxShadeList(){
  const pal = pixPalette() || paletteColors().map(h => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; });
  const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  return pal.slice().sort((a, b) => lum(a) - lum(b));
}
function pxShadeApply(fs, sa, x0, y0, bw, bh){
  const list = pxShadeList(), dir = PIX.shade === 'lighten' ? 1 : -1, memo = new Map();
  const step = (r, g, b) => {
    const k = (r << 16) | (g << 8) | b; if (memo.has(k)) return memo.get(k);
    let bi = 0, bd = Infinity; for (let i = 0; i < list.length; i++){ const d = cdist(r, g, b, list[i]); if (d < bd){ bd = d; bi = i; } }
    const res = list[Math.min(list.length - 1, Math.max(0, bi + dir))]; memo.set(k, res); return res;
  };
  for (const f of fs){
    const fr = frames[f], m = masks[f];
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++){
      if (sa[(y * bw + x) * 4 + 3] < 128) continue;
      const gi = (y0 + y) * W + x0 + x, o = gi * 4; if (fr[o + 3] * m[gi] < 128 * 255) continue;   // only painted pixels are shaded
      const c = step(fr[o], fr[o + 1], fr[o + 2]); fr[o] = c[0]; fr[o + 1] = c[1]; fr[o + 2] = c[2];
    }
  }
}

// ---------- seamless tiles ----------
// Shift by half moves the picture by half its size, wrapping around, so the seams come to the middle where they
// can be drawn over; shift again to move them back. The preview can show the picture tiled 3 × 3.
function pxShiftHalf(){
  const dx = Math.floor(W / 2), dy = Math.floor(H / 2);
  applyPixels((fr, m) => {
    const f2 = fr.slice(), m2 = m.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
      const s = y * W + x, d = ((y + dy) % H) * W + (x + dx) % W;
      fr[d * 4] = f2[s * 4]; fr[d * 4 + 1] = f2[s * 4 + 1]; fr[d * 4 + 2] = f2[s * 4 + 2]; fr[d * 4 + 3] = f2[s * 4 + 3]; m[d] = m2[s];
    }
  }, 'Shifted by half: the edges now meet in the middle. Shift again to put them back.');
  pixDirty();
}

// ---------- sprite sheets ----------
// every frame of the animation side by side in one PNG (at the export scale), plus an optional frame list (JSON)
// with each frame's place and length, the way game engines read sprite sheets
async function pxSpriteSheet(){
  if (!W) return;
  const n = docFrames(), fw = DocW, fh = DocH, pad = PIX.sheetPad, k = Math.max(1, PIX.exportScale || 1);
  const cols = PIX.sheetCols === 'auto' ? Math.ceil(Math.sqrt(n)) : PIX.sheetCols === 'row' ? n : PIX.sheetCols === 'col' ? 1 : Math.min(n, +PIX.sheetCols);
  const rows = Math.ceil(n / cols), sw = cols * fw + (cols - 1) * pad, sh = rows * fh + (rows - 1) * pad;
  if (sw * k * sh * k > 64e6){ toast('That sprite sheet would be too large. Lower the export scale or use more rows.'); return; }
  busy(true); await new Promise(r => setTimeout(r, 16));
  try {
    const cv = document.createElement('canvas'); cv.width = sw * k; cv.height = sh * k; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const list = [];
    for (let i = 0; i < n; i++){
      const cx = (i % cols) * (fw + pad), cy = Math.floor(i / cols) * (fh + pad);
      g.drawImage(toCanvas(composeDoc(i, false), fw, fh), cx * k, cy * k, fw * k, fh * k);
      list.push({ frame: i, x: cx * k, y: cy * k, w: fw * k, h: fh * k, duration: (docDelay(i) >= 2 ? docDelay(i) : 10) * 10 });
    }
    const blob = await new Promise(r => cv.toBlob(r, 'image/png')), name = (S.name || 'sprite') + '-sheet';
    await saveBlob(blob, name + '.png');
    if ($('#pxSheetJson').checked){
      const meta = { image: name + '.png', size: { w: sw * k, h: sh * k }, frameSize: { w: fw * k, h: fh * k }, columns: cols, rows, padding: pad * k, frames: list };
      await new Promise(r => setTimeout(r, 400));
      await saveBlob(new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' }), name + '.json');
    }
    sbFlash('Sprite sheet: ' + n + ' frame' + (n === 1 ? '' : 's') + ', ' + cols + ' × ' + rows + ', ' + (sw * k) + ' × ' + (sh * k) + ' px.');
  } finally { busy(false); }
}

// ---------- page wiring ----------
{
  const chk = (id, k, after) => { const el = $('#' + id); el.checked = !!PIX[k]; el.addEventListener('change', () => { PIX[k] = el.checked; savePix(); if (after) after(); }); };
  const selb = (id, k, after) => { const el = $('#' + id); el.value = String(PIX[k]); el.addEventListener('change', () => { PIX[k] = isNaN(+el.value) ? el.value : +el.value; savePix(); if (after) after(); }); };
  chk('pxRecolorAll', 'recolorAll'); chk('pxOutCorners', 'outCorners'); chk('pxTilePrev', 'tilePrev', pixPreviewRender);
  segSet('#pxOutMode', 'v', PIX.outMode); segBind('#pxOutMode', 'v', v => { PIX.outMode = v; savePix(); });
  segSet('#pxShade', 'v', PIX.shade); segBind('#pxShade', 'v', v => { PIX.shade = v; savePix(); if (v !== 'off' && S.tool !== 'pencil'){ setTool('pencil'); showPage('pixel'); sbFlash('The pencil now shades: each pixel it touches gets one step ' + (v === 'darken' ? 'darker' : 'lighter') + '.'); } });
  const rng = (id, k, fmt) => { const el = $('#' + id), out = $('#' + id + 'Out'); el.value = PIX[k]; out.textContent = fmt(PIX[k]); el.addEventListener('input', () => { PIX[k] = +el.value; out.textContent = fmt(PIX[k]); savePix(); pxRampRender(); }); };
  rng('pxRampN', 'rampN', v => v + ' shades'); rng('pxRampHue', 'rampHue', v => v + '°');
  selb('pxSheetCols', 'sheetCols'); selb('pxSheetPad', 'sheetPad');
  $('#pxRecolor').addEventListener('click', pxRecolor);
  $('#pxOutline').addEventListener('click', pxOutline);
  $('#pxRampAdd').addEventListener('click', pxRampToCustom);
  $('#pxShift').addEventListener('click', pxShiftHalf);
  $('#pxSheet').addEventListener('click', pxSpriteSheet);
  // keep the lists current: the ramp follows the primary color, the color list follows the picture
  $('#cw1').addEventListener('click', () => setTimeout(pxRampRender, 0));
  new MutationObserver(() => pxRampRender()).observe($('#cw1'), { attributes: true, attributeFilter: ['style'] });
  pxRampRender(); pxRecolorUI();
}
MENUS.image.push({ l: 'Save sprite sheet…', c: 'pxSheet', en: () => !!W });
function pixelToolsCmd(c){ if (c === 'pxSheet'){ pxSpriteSheet(); return true; } return false; }
$$('[data-page-btn="pixel"]').forEach(b => b.addEventListener('click', () => pxUsedSchedule()));
