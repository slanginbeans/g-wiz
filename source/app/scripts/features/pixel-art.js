// ===================== pixel art mode =====================
// Retro screen sizes, retro machine palettes, color-depth limits, color reduction with dithering, a pixel and
// tile grid, symmetry drawing, a pixel-perfect pencil, hard edges for every tool, integer zoom, a live
// preview window with a CRT look, and upscaled export. Works together with animation mode.
const RETRO_PALETTES = {
  'PICO-8': '000000 1d2b53 7e2553 008751 ab5236 5f574f c2c3c7 fff1e8 ff004d ffa300 ffec27 00e436 29adff 83769c ff77a8 ffccaa',
  'Game Boy (green)': '0f380f 306230 8bac0f 9bbc0f',
  'Game Boy Pocket (gray)': '000000 555555 aaaaaa ffffff',
  'Virtual Boy': '000000 550000 aa0000 ff0000',
  'NES': '7c7c7c 0000fc 0000bc 4428bc 940084 a80020 a81000 881400 503000 007800 006800 005800 004058 000000 bcbcbc 0078f8 0058f8 6844fc d800cc e40058 f83800 e45c10 ac7c00 00b800 00a800 00a844 008888 f8f8f8 3cbcfc 6888fc 9878f8 f878f8 f85898 f87858 fca044 f8b800 b8f818 58d854 58f898 00e8d8 787878 fcfcfc a4e4fc b8b8f8 d8b8f8 f8b8f8 f8a4c0 f0d0b0 fce0a8 f8d878 d8f878 b8f8b8 b8f8d8 00fcfc f8d8f8',
  'Commodore 64': '000000 ffffff 880000 aaffee cc44cc 00cc55 0000aa eeee77 dd8855 664400 ff7777 333333 777777 aaff66 0088ff bbbbbb',
  'ZX Spectrum': '000000 0000d7 d70000 d700d7 00d700 00d7d7 d7d700 d7d7d7 0000ff ff0000 ff00ff 00ff00 00ffff ffff00 ffffff',
  'CGA / EGA (16 colors)': '000000 0000aa 00aa00 00aaaa aa0000 aa00aa aa5500 aaaaaa 555555 5555ff 55ff55 55ffff ff5555 ff55ff ffff55 ffffff',
  'CGA mode 4, palette 1': '000000 55ffff ff55ff ffffff',
  'CGA mode 4, palette 0': '000000 55ff55 ff5555 ffff55',
  'Apple II': '000000 722640 40337f e434fe 0e5940 808080 1b9afe bfb3ff 404c00 e46501 f1a6bf 1bcb01 bfcc80 8dd9bf ffffff',
  'MSX': '000000 21c842 5edc78 5455ed 7d76fc d4524d 42ebf5 fc5554 ff7978 d4c154 e6ce80 21b03b c95bba cccccc ffffff',
  'Amstrad CPC': (() => { const v = ['00', '80', 'ff'], o = []; for (const g of v) for (const r of v) for (const b of v) o.push(r + g + b); return o.join(' '); })(),
  'Sega Master System': (() => { const v = ['00', '55', 'aa', 'ff'], o = []; for (const r of v) for (const g of v) for (const b of v) o.push(r + g + b); return o.join(' '); })(),
  'Teletext / BBC Micro': '000000 ff0000 00ff00 ffff00 0000ff ff00ff 00ffff ffffff',
  'Macintosh (1-bit)': '000000 ffffff',
  'DawnBringer 16': '140c1c 442434 30346d 4e4a4e 854c30 346524 d04648 757161 597dce d27d2c 8595a1 6daa2c d2aa99 6dc2ca dad45e deeed6',
  'DawnBringer 32': '000000 222034 45283c 663931 8f563b df7126 d9a066 eec39a fbf236 99e550 6abe30 37946e 4b692f 524b24 323c39 3f3f74 306082 5b6ee1 639bff 5fcde4 cbdbfc ffffff 9badb7 847e87 696a6a 595652 76428a ac3232 d95763 d77bba 8f974a 8a6f30',
  'Sweetie 16': '1a1c2c 5d275d b13e53 ef7d57 ffcd75 a7f070 38b764 257179 29366f 3b5dc9 41a6f6 73eff7 f4f4f4 94b0c2 566c86 333c57'
};
Object.assign(PALETTES, RETRO_PALETTES);
{
  const sel = $('#palScheme'), grp = document.createElement('optgroup'); grp.label = 'Retro machines';
  for (const k of Object.keys(RETRO_PALETTES)){ const o = document.createElement('option'); o.value = k; o.textContent = k; grp.appendChild(o); }
  sel.appendChild(grp);
  if (S.scheme && !sel.querySelector('option[value="' + CSS.escape(S.scheme) + '"]')) S.scheme = 'Classic Paint';
  MENUS.colorsm.push('-', ...Object.keys(RETRO_PALETTES).map(k => ({ l: k, c: 'scheme:' + k, r: () => S.scheme === k })));
}
const RETRO_SIZES = [
  ['Handhelds', [['Game Boy / Game Boy Color', 160, 144], ['Game Gear', 160, 144], ['Game Boy Advance', 240, 160], ['Nintendo DS (one screen)', 256, 192], ['Atari Lynx', 160, 102], ['Neo Geo Pocket', 160, 152], ['WonderSwan', 224, 144], ['Virtual Boy', 384, 224], ['PSP', 480, 272]]],
  ['Consoles', [['Atari 2600', 160, 192], ['NES / Famicom', 256, 240], ['SNES', 256, 224], ['Sega Master System', 256, 192], ['Sega Genesis / Mega Drive', 320, 224], ['PC Engine / TurboGrafx-16', 256, 224], ['Neo Geo', 320, 224], ['PlayStation / Nintendo 64', 320, 240]]],
  ['Home computers', [['ZX Spectrum', 256, 192], ['Commodore 64', 320, 200], ['Commodore 64 multicolor', 160, 200], ['Amstrad CPC mode 0', 160, 200], ['Amstrad CPC mode 1', 320, 200], ['MSX', 256, 192], ['Apple II hi-res', 280, 192], ['BBC Micro mode 2', 160, 256], ['Amiga low-res (PAL)', 320, 256], ['Atari ST low-res', 320, 200], ['Macintosh 128K', 512, 342], ['NEC PC-98', 640, 400]]],
  ['PC graphics modes', [['CGA / VGA mode 13h', 320, 200], ['EGA high-res', 640, 350], ['VGA', 640, 480], ['CRT TV 240p', 320, 240]]],
  ['Fantasy consoles', [['PICO-8', 128, 128], ['TIC-80', 240, 136]]],
  ['Sprites and tiles', [['Tile 8 × 8', 8, 8], ['Sprite 16 × 16', 16, 16], ['Sprite 24 × 24', 24, 24], ['Sprite 32 × 32', 32, 32], ['Sprite 48 × 48', 48, 48], ['Icon 64 × 64', 64, 64], ['128 × 128', 128, 128], ['256 × 256', 256, 256]]]
];
// color depths: indexed ones limit how many colors a picture may use, RGB ones limit each channel's precision
const DEPTHS = {
  full: { name: 'Full color (24-bit)' },
  d1: { name: '1-bit · 2 colors', count: 2, auto: '000000 ffffff' },
  d2: { name: '2-bit · 4 colors', count: 4, auto: '000000 555555 aaaaaa ffffff' },
  d3: { name: '3-bit · 8 colors', count: 8, auto: '000000 ff0000 00ff00 ffff00 0000ff ff00ff 00ffff ffffff' },
  d4: { name: '4-bit · 16 colors', count: 16, auto: RETRO_PALETTES['CGA / EGA (16 colors)'] },
  d6: { name: '6-bit · 64 colors (RGB 2-2-2)', count: 64, bits: [2, 2, 2] },
  d8: { name: '8-bit · 256 colors (RGB 3-3-2)', count: 256, bits: [3, 3, 2] },
  d9: { name: '9-bit RGB · 512 colors (Mega Drive)', bits: [3, 3, 3] },
  d12: { name: '12-bit RGB · 4,096 colors (Amiga)', bits: [4, 4, 4] },
  d15: { name: '15-bit RGB · 32,768 colors (SNES, GBA)', bits: [5, 5, 5] },
  d16: { name: '16-bit RGB · 65,536 colors', bits: [5, 6, 5] }
};
var PIX = Object.assign({ on: false, palette: 'PICO-8', depth: 'full', snap: true, dither: 'none', hardAlpha: true, allFrames: true, hard: true, perfect: true, mirror: 'off',
  grid: true, tile: 0, preview: true, prevScale: 2, crt: false, tv: false, exportScale: 1, w: 160, h: 144, bg: 'clear' }, store.get('pixel', {}));
const savePix = () => store.set('pixel', PIX);
PAGE_INFO.pixel = ['Pixel art', 'pixel'];

// ---------- the effective color limit ----------
const hexList = s => s.split(/\s+/).filter(Boolean).map(h => { const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; });
function pixPalette(){
  if (PIX.palette && RETRO_PALETTES[PIX.palette]) return hexList(RETRO_PALETTES[PIX.palette]);
  if (PIX.palette === '__scheme' && PALETTES[S.scheme]) return hexList(PALETTES[S.scheme]);
  const d = DEPTHS[PIX.depth]; return d && d.auto ? hexList(d.auto) : null;
}
const pixBits = () => { const d = DEPTHS[PIX.depth]; return d && d.bits ? d.bits : null; };
const pixCount = () => { const d = DEPTHS[PIX.depth]; return d && d.count ? d.count : 0; };
const qch = (v, b) => { const m = (1 << b) - 1; return Math.round(Math.round(v / 255 * m) * 255 / m); };
const cdist = (r, g, b, c) => { const dr = r - c[0], dg = g - c[1], db = b - c[2], rm = (r + c[0]) / 2; return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db; };
function nearestIn(pal, r, g, b){ let best = 0, bd = Infinity; for (let i = 0; i < pal.length; i++){ const d = cdist(r, g, b, pal[i]); if (d < bd){ bd = d; best = i; } } return pal[best]; }
function pixSnapRGB(r, g, b){
  const pal = pixPalette(), bits = pixBits();
  if (pal) [r, g, b] = nearestIn(pal, r, g, b);
  if (bits){ r = qch(r, bits[0]); g = qch(g, bits[1]); b = qch(b, bits[2]); }
  return [r, g, b];
}
function pixHard(){ return !!(PIX && PIX.on && PIX.hard); }
function pixHardenRGBA(d){
  const snap = PIX.snap && (pixPalette() || pixBits());
  for (let p = 0; p < d.length; p += 4){ if (d[p + 3] < 128){ d[p] = d[p + 1] = d[p + 2] = d[p + 3] = 0; continue; } d[p + 3] = 255; if (snap){ const c = pixSnapRGB(d[p], d[p + 1], d[p + 2]); d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; } }
}
// in pixel art mode with hard edges, everything a stroke leaves behind is snapped to the limits
function pixSnapper(){
  if (!pixHard() || !PIX.snap || (!pixPalette() && !pixBits())) return null;
  const cache = new Map();
  return (d, o) => { if (d[o + 3] < 128){ d[o + 3] = 0; return; } d[o + 3] = 255; const key = (d[o] << 16) | (d[o + 1] << 8) | d[o + 2]; let c = cache.get(key); if (!c){ c = pixSnapRGB(d[o], d[o + 1], d[o + 2]); cache.set(key, c); } d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; };
}
function pixSnapColor(c){
  if (!PIX || !PIX.on || !PIX.snap || (!pixPalette() && !pixBits())) return c;
  const [r, g, b] = pixSnapRGB(c.r, c.g, c.b);
  return { r, g, b, a: PIX.hardAlpha ? (c.a >= 128 ? 255 : 0) : c.a };
}

// ---------- reducing a layer's colors ----------
function medianCut(samples, k){
  // samples: Uint8Array of rgb triples
  let boxes = [{ idx: Array.from({ length: samples.length / 3 }, (_, i) => i) }];
  const range = bx => { let mn = [255, 255, 255], mx = [0, 0, 0]; for (const i of bx.idx) for (let c = 0; c < 3; c++){ const v = samples[i * 3 + c]; if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v; } const r = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]]; bx.ch = r.indexOf(Math.max(...r)); bx.span = r[bx.ch]; return bx; };
  boxes.forEach(range);
  while (boxes.length < k){
    let bi = -1, bs = 0; boxes.forEach((bx, i) => { const s = bx.span * Math.sqrt(bx.idx.length); if (bx.idx.length > 1 && s > bs){ bs = s; bi = i; } });
    if (bi < 0) break;
    const bx = boxes[bi], ch = bx.ch; bx.idx.sort((a, b) => samples[a * 3 + ch] - samples[b * 3 + ch]);
    const mid = bx.idx.length >> 1, A = range({ idx: bx.idx.slice(0, mid) }), B = range({ idx: bx.idx.slice(mid) });
    boxes.splice(bi, 1, A, B);
  }
  return boxes.map(bx => { let r = 0, g = 0, b = 0; for (const i of bx.idx){ r += samples[i * 3]; g += samples[i * 3 + 1]; b += samples[i * 3 + 2]; } const n = bx.idx.length || 1; return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]; });
}
// improve a choice of K palette colors: swap a chosen color for an unused one while that lowers the total error
function optimizePick(chosen, pal, samples, K){
  const n = samples.length / 3, step = Math.max(1, Math.floor(n / 3000)), sm = [];
  for (let i = 0; i < n; i += step) sm.push(samples[i * 3], samples[i * 3 + 1], samples[i * 3 + 2]);
  const m = sm.length / 3, bk = i => ((sm[i * 3] >> 4) << 8) | ((sm[i * 3 + 1] >> 4) << 4) | (sm[i * 3 + 2] >> 4), freq = new Map();
  for (let i = 0; i < m; i++){ const k = bk(i); freq.set(k, (freq.get(k) || 0) + 1); }
  // big flat areas would otherwise take every color, so rarer colors count for more
  const wt = new Float32Array(m); for (let i = 0; i < m; i++) wt[i] = 1 / Math.sqrt(freq.get(bk(i)));
  const D = pal.map(c => { const d = new Float32Array(m); for (let i = 0; i < m; i++) d[i] = cdist(sm[i * 3], sm[i * 3 + 1], sm[i * 3 + 2], c); return d; });
  const key = c => c.join(','), pIdx = new Map(pal.map((c, i) => [key(c), i]));
  let sel = [...new Set(chosen.map(c => pIdx.get(key(c))))].slice(0, K);
  for (let i = 0; sel.length < Math.min(K, pal.length) && i < pal.length; i++) if (!sel.includes(i)) sel.push(i);
  const cost = s => { let t = 0; for (let i = 0; i < m; i++){ let b = Infinity; for (const j of s){ const v = D[j][i]; if (v < b) b = v; } t += b * wt[i]; } return t; };
  let best = cost(sel);
  for (let pass = 0; pass < 3; pass++){
    let improved = false;
    for (let a = 0; a < sel.length; a++) for (let j = 0; j < pal.length; j++){
      if (sel.includes(j)) continue;
      const t = sel.slice(); t[a] = j; const c = cost(t);
      if (c < best - 1e-6){ best = c; sel = t; improved = true; }
    }
    if (!improved) break;
  }
  return sel.map(i => pal[i]);
}
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const BAYER2 = [0, 2, 3, 1];
// the set of colors a reduction maps to, chosen from what the picture actually uses
function reductionSet(frs){
  const pal = pixPalette(), bits = pixBits(), K = pixCount();
  if (!pal && (!K || pixBits())) return null;                   // a per-channel limit (RGB 3-3-2 is itself the 256 colors)
  // sample the visible colors
  const smp = []; let total = 0;
  for (const [fr, m] of frs){ for (let i = 0; i < m.length; i++) if (fr[i * 4 + 3] * m[i] >= 128 * 255) total++; }
  const step = Math.max(1, Math.floor(total / 120000));
  let k = 0;
  for (const [fr, m] of frs) for (let i = 0; i < m.length; i++){ if (fr[i * 4 + 3] * m[i] < 128 * 255) continue; if (k++ % step) continue; smp.push(fr[i * 4], fr[i * 4 + 1], fr[i * 4 + 2]); }
  if (!smp.length) return pal || [[0, 0, 0]];
  const samples = Uint8Array.from(smp);
  if (pal && (!K || pal.length <= K)) return pal;
  // pick K colors: median cut on the picture, each snapped to the palette when there is one
  let cen = medianCut(samples, K || 256);
  if (pal){
    const used = new Map();
    for (const c of cen){ const p = nearestIn(pal, c[0], c[1], c[2]); used.set(p.join(','), p); }
    // fill up with the palette colors the picture needs most, if snapping merged some
    if (used.size < K){
      const votes = new Map(); for (let i = 0; i < samples.length; i += 3 * 7){ const p = nearestIn(pal, samples[i], samples[i + 1], samples[i + 2]), key = p.join(','); votes.set(key, (votes.get(key) || 0) + 1); }
      for (const [key] of [...votes].sort((a, b) => b[1] - a[1])){ if (used.size >= K) break; if (!used.has(key)) used.set(key, key.split(',').map(Number)); }
    }
    cen = optimizePick([...used.values()], pal, samples, K);
  } else if (bits) cen = cen.map(c => [qch(c[0], bits[0]), qch(c[1], bits[1]), qch(c[2], bits[2])]);
  return cen;
}
function reduceFrame(fr, m, w, h, set){
  const bits = pixBits(), dither = PIX.dither, hard = PIX.hardAlpha;
  const cache = new Map();
  const map = (r, g, b) => {
    r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
    if (set){ const key = (r << 16) | (g << 8) | b; let c = cache.get(key); if (!c){ c = nearestIn(set, r, g, b); if (cache.size < 200000) cache.set(key, c); } return c; }
    return [qch(r, bits[0]), qch(g, bits[1]), qch(b, bits[2])];
  };
  const err = dither === 'fs' ? new Float32Array(w * h * 3) : null;
  // how strong ordered dithering is: about one step between neighboring colors
  const spread = set ? Math.max(16, 255 / Math.cbrt(Math.max(2, set.length)) * 0.9) : 255 / ((1 << Math.min(...bits)) - 1) * 0.9;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const i = y * w + x, o = i * 4;
    const a = (fr[o + 3] * m[i] + 127) / 255;
    if (hard && a < 128){ fr[o + 3] = 0; m[i] = 255; continue; }
    if (a === 0) continue;
    let r = fr[o], g = fr[o + 1], b = fr[o + 2];
    if (err){ r += err[i * 3]; g += err[i * 3 + 1]; b += err[i * 3 + 2]; }
    else if (dither === 'o2' || dither === 'o4'){ const t = dither === 'o2' ? (BAYER2[(y & 1) * 2 + (x & 1)] + 0.5) / 4 - 0.5 : (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5; r += t * spread; g += t * spread; b += t * spread; }
    const c = map(r, g, b);
    if (err){
      const er = r - c[0], eg = g - c[1], eb = b - c[2];
      const add = (xx, yy, f) => { if (xx < 0 || xx >= w || yy >= h) return; const j = (yy * w + xx) * 3; err[j] += er * f; err[j + 1] += eg * f; err[j + 2] += eb * f; };
      add(x + 1, y, 7 / 16); add(x - 1, y + 1, 3 / 16); add(x, y + 1, 5 / 16); add(x + 1, y + 1, 1 / 16);
    }
    fr[o] = c[0]; fr[o + 1] = c[1]; fr[o + 2] = c[2];
    if (hard){ fr[o + 3] = 255; m[i] = 255; }
  }
}
function reduceColors(){
  if (!AL) return; if (AL.locked){ toast('The selected layer is locked.'); return; }
  if (!pixPalette() && !pixBits() && !pixCount()){ toast('Choose a palette or a color depth first.'); return; }
  const was = S.scopeAll; S.scopeAll = PIX.allFrames;
  busy(true);
  setTimeout(() => {
    try {
      const fs = layerFrames(), set = reductionSet(fs.map(f => [frames[f], masks[f]]));
      applyPixels((fr, m) => reduceFrame(fr, m, W, H, set), 'Reduced "' + AL.name + '" to ' + (set ? set.length + ' colors' : DEPTHS[PIX.depth].name) + (fs.length > 1 ? ' on ' + fs.length + ' frames.' : '.'));
      pixDirty(); renderAllLayers(); requestDraw();
    } finally { S.scopeAll = was; busy(false); }
  }, 20);
}
function replaceColor(){
  if (!AL) return; if (AL.locked){ toast('The selected layer is locked.'); return; }
  const a = S.c1, b = S.c2, was = S.scopeAll; S.scopeAll = PIX.allFrames;
  let n = 0;
  try {
    applyPixels((fr, m) => { for (let i = 0, o = 0; i < m.length; i++, o += 4){ if (fr[o + 3] * m[i] >= 128 * 255 && fr[o] === a.r && fr[o + 1] === a.g && fr[o + 2] === a.b){ fr[o] = b.r; fr[o + 1] = b.g; fr[o + 2] = b.b; n++; } } }, null);
  } finally { S.scopeAll = was; }
  toast(n ? 'Replaced ' + n + ' pixels of ' + hexA(a) + ' with ' + hexA(b) + '.' : 'No pixels of exactly ' + hexA(a) + ' on this layer.');
  pixDirty();
}
// ---------- colors in use ----------
let pixCountT = 0;
function pixDirty(){ if (!PIX.on) return; clearTimeout(pixCountT); pixCountT = setTimeout(updateColorCount, 400); }
function updateColorCount(){
  if (!W || DocW * DocH > 4e6){ $('#pxCount').textContent = ''; return; }
  if (typeof pxUsedSchedule === 'function') pxUsedSchedule();
  const d = composeDoc(S.dcur, false), set = new Set();
  for (let p = 0; p < d.length && set.size < 4097; p += 4) if (d[p + 3] >= 128) set.add((d[p] << 16) | (d[p + 1] << 8) | d[p + 2]);
  const K = pixCount(), pal = pixPalette(), n = set.size;
  let off = 0; if (pal){ const ok = new Set(pal.map(c => (c[0] << 16) | (c[1] << 8) | c[2])); for (const v of set) if (!ok.has(v)) off++; }
  const over = (K && n > K) || off;
  const el = $('#pxCount');
  el.textContent = 'Colors on this frame: ' + (n > 4096 ? 'over 4,096' : n) + (K ? ' of ' + K + ' allowed' : '') + (off ? ' · ' + off + ' not in the palette' : '');
  el.classList.toggle('warn', !!over);
}

// ---------- drawing aids ----------
function pixMirrorFor(t){ return !!PIX && PIX.on && PIX.mirror !== 'off' && (DRAW_TOOLS.includes(t) || SHAPE_TOOLS.includes(t)); }
function mirrorAxes(){ return [DocW / 2 - (AL ? AL.x : 0), DocH / 2 - (AL ? AL.y : 0)]; }
function mirrorXforms(){
  const [ax, ay] = mirrorAxes(), out = [];
  if (PIX.mirror === 'h' || PIX.mirror === 'both') out.push([-1, 0, 0, 1, 2 * ax, 0]);
  if (PIX.mirror === 'v' || PIX.mirror === 'both') out.push([1, 0, 0, -1, 0, 2 * ay]);
  if (PIX.mirror === 'both') out.push([-1, 0, 0, -1, 2 * ax, 2 * ay]);
  return out;
}
// live preview of the mirrored copies of the stroke being drawn
function drawStrokeCanvas(g, x, y, w, h){
  g.drawImage(DS.canvas, x, y, w, h);
  if (!DS.mirror) return;
  const sx = w / W, sy = h / H;
  for (const m of mirrorXforms()){ g.save(); g.translate(x, y); g.scale(sx, sy); g.transform(...m); g.drawImage(DS.canvas, 0, 0); g.restore(); }
}
// before the stroke is merged into the layer, its mirrored copies are painted onto it
function mirrorBake(){
  const xf = mirrorXforms(); if (!xf.length || !DS.bbox) return;
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; tmp.getContext('2d').drawImage(DS.canvas, 0, 0);
  const g = DS.ctx, b = DS.bbox.slice();
  g.save(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  for (const m of xf){
    g.setTransform(...m); g.drawImage(tmp, 0, 0);
    const xs = [b[0], b[2]].map(v => m[0] * v + m[4]), ys = [b[1], b[3]].map(v => m[3] * v + m[5]);
    DS.bbox[0] = Math.min(DS.bbox[0], ...xs); DS.bbox[2] = Math.max(DS.bbox[2], ...xs); DS.bbox[1] = Math.min(DS.bbox[1], ...ys); DS.bbox[3] = Math.max(DS.bbox[3], ...ys);
  }
  g.restore();
}
// pixel-perfect pencil: a corner pixel in an L-shaped step is taken back, so 1-pixel lines stay clean
function pixelPerfect(x, y){
  if (!(PIX.on && PIX.perfect)) return;
  const pp = DS.pp || (DS.pp = []), last = pp[pp.length - 1];
  if (last && last[0] === x && last[1] === y) return;
  pp.push([x, y]);
  if (pp.length >= 3){
    const [a, b, c] = pp.slice(-3);
    const adj = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) === 1;
    if (adj(a, b) && adj(b, c) && Math.abs(a[0] - c[0]) === 1 && Math.abs(a[1] - c[1]) === 1){ DS.ctx.clearRect(b[0], b[1], 1, 1); pp.splice(pp.length - 2, 1); }
  }
  if (pp.length > 8) pp.shift();
}
// grids and the symmetry axis
function drawPixelOverlay(){
  if (!PIX || !PIX.on || !W) return;
  const z = S.zoom, x0 = S.panX, y0 = S.panY, dw = DocW * z, dh = DocH * z;
  vctx.save();
  if (PIX.tile > 1 && PIX.tile * z >= 6){
    vctx.strokeStyle = 'rgba(0,120,255,.55)'; vctx.lineWidth = 1; vctx.beginPath();
    for (let gx = PIX.tile; gx < DocW; gx += PIX.tile){ const sx = Math.round(x0 + gx * z) + 0.5; vctx.moveTo(sx, Math.max(0, y0)); vctx.lineTo(sx, Math.min(ch, y0 + dh)); }
    for (let gy = PIX.tile; gy < DocH; gy += PIX.tile){ const sy = Math.round(y0 + gy * z) + 0.5; vctx.moveTo(Math.max(0, x0), sy); vctx.lineTo(Math.min(cw, x0 + dw), sy); }
    vctx.stroke();
  }
  if (PIX.mirror !== 'off'){
    vctx.setLineDash([6, 4]); vctx.strokeStyle = 'rgba(255,0,200,.85)'; vctx.lineWidth = 1.5; vctx.beginPath();
    if (PIX.mirror === 'h' || PIX.mirror === 'both'){ const sx = x0 + DocW / 2 * z; vctx.moveTo(sx, y0); vctx.lineTo(sx, y0 + dh); }
    if (PIX.mirror === 'v' || PIX.mirror === 'both'){ const sy = y0 + DocH / 2 * z; vctx.moveTo(x0, sy); vctx.lineTo(x0 + dw, sy); }
    vctx.stroke();
  }
  vctx.restore();
  pixPreviewSchedule();
}
function pixGridMin(){ return PIX && PIX.on ? (PIX.grid ? 3 : Infinity) : 14; }

// ---------- preview window ----------
const pv = document.createElement('div'); pv.id = 'pxPreview'; pv.className = 'pxpreview raised'; pv.hidden = true;
pv.innerHTML = '<div class="titlebar"><span class="tt">Preview</span><button class="tbx" type="button" id="pvX" aria-label="Close preview"><svg viewBox="0 0 8 7"><path d="M0 0h2v1h1v1h2V1h1V0h2v1H7v1H6v1H5v1h1v1h1v1h1v1H6V6H5V5H3v1H2v1H0V6h1V5h1V4h1V3H2V2H1V1H0z"/></svg></button></div><canvas id="pvCanvas"></canvas>';
$('#stage').appendChild(pv);
pv.addEventListener('pointerdown', e => e.stopPropagation());
$('#pvX').addEventListener('click', () => { PIX.preview = false; savePix(); $('#pxPrev').checked = false; pixPreviewSync(); });
let pvT = 0;
function pixPreviewSchedule(){ if (!PIX.on || !PIX.preview || pvT) return; pvT = setTimeout(() => { pvT = 0; pixPreviewRender(); }, 90); }
function pixPreviewSync(){ pv.hidden = !(PIX.on && PIX.preview && W && DocW * DocH <= 1e6); if (!pv.hidden) pixPreviewRender(); }
function pixPreviewRender(){
  if (pv.hidden || !W) return;
  const c = $('#pvCanvas'), k = PIX.prevScale, maxW = Math.min(cw * 0.32, 420), maxH = Math.min(ch * 0.36, 340);
  const tl = PIX.tilePrev ? 3 : 1;   // 3 × 3 copies show whether the picture tiles without seams
  let w = DocW * k * tl, h = DocH * k * tl;
  if (PIX.tv) w = Math.round(h * 4 / 3);
  const fitS = Math.min(1, maxW / w, maxH / h); w = Math.max(1, Math.round(w * fitS)); h = Math.max(1, Math.round(h * fitS));
  if (c.width !== w || c.height !== h){ c.width = w; c.height = h; }
  const g = c.getContext('2d'), rgba = composeDoc(S.dcur, false);
  g.imageSmoothingEnabled = false; g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  const pic = toCanvas(rgba, DocW, DocH);
  for (let ty = 0; ty < tl; ty++) for (let tx = 0; tx < tl; tx++) g.drawImage(pic, Math.round(tx * w / tl), Math.round(ty * h / tl), Math.round((tx + 1) * w / tl) - Math.round(tx * w / tl), Math.round((ty + 1) * h / tl) - Math.round(ty * h / tl));
  if (PIX.crt){
    const rows = Math.max(1, h / DocH);
    g.fillStyle = 'rgba(0,0,0,.28)';
    if (rows >= 2) for (let y = 0; y < DocH; y++) g.fillRect(0, Math.round((y + 1) * rows - Math.max(1, rows * 0.35)), w, Math.max(1, Math.round(rows * 0.35)));
    const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
}

// ---------- canvas sizes ----------
function pixNewCanvas(){
  const w = Math.max(1, Math.min(4096, Math.round(+$('#pxW').value))), h = Math.max(1, Math.min(4096, Math.round(+$('#pxH').value)));
  const f = new Uint8ClampedArray(w * h * 4);
  if (PIX.bg !== 'clear'){ const pal = pixPalette(), c = PIX.bg === 'first' && pal ? pal[0] : PIX.bg === 'last' && pal ? pal[pal.length - 1] : [255, 255, 255]; for (let p = 0; p < f.length; p += 4){ f[p] = c[0]; f[p + 1] = c[1]; f[p + 2] = c[2]; f[p + 3] = 255; } }
  const label = $('#pxSize').selectedOptions[0];
  setImage({ w, h, frames: [f], delays: [10] }, label && label.value ? label.textContent.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() : 'pixel-art');
  if (layers[0]){ layers[0].name = 'Background'; renderLayersPanel(); }
  if (!PIX.on) setPixelMode(true); else fit();
  setTool('pencil'); if (S.draw.pencil.size > 1) setDrawSize(1);
  toast('New ' + w + ' × ' + h + ' pixel canvas.');
}
function pixResizePicture(){ const w = Math.round(+$('#pxW').value), h = Math.round(+$('#pxH').value); if (w > 0 && h > 0 && (w !== DocW || h !== DocH)) imageResize(w, h, false); }
function pixCanvasSize(){ const w = Math.round(+$('#pxW').value), h = Math.round(+$('#pxH').value); if (w > 0 && h > 0 && (w !== DocW || h !== DocH)) canvasResize(w, h, 0.5, 0.5); }

// ---------- the mode ----------
function setScheme(name){ if (!PALETTES[name]) return; S.scheme = name; store.set('scheme', name); $('#palScheme').value = name; renderPalette(); }
function setPixelMode(on){
  if (on === PIX.on) return;
  PIX.on = on; savePix();
  document.documentElement.classList.toggle('pixelmode', on);
  if (on){ PIX.prevScheme = S.scheme; if (RETRO_PALETTES[PIX.palette]) setScheme(PIX.palette); $('#fAA').checked = false; }
  else if (PIX.prevScheme && PALETTES[PIX.prevScheme]) setScheme(PIX.prevScheme);
  $('#pxOn').checked = on;
  if (W) fit();
  pixPreviewSync(); pixDirty(); requestDraw();
  sbFlash(on ? 'Pixel art mode: integer zoom, pixel grid, hard edges, palette limits.' : 'Pixel art mode off.');
}

// ---------- page wiring ----------
{
  const sel = $('#pxSize');
  for (const [grp, list] of RETRO_SIZES){ const og = document.createElement('optgroup'); og.label = grp; for (const [n, w, h] of list){ const o = document.createElement('option'); o.value = w + 'x' + h; o.textContent = n + ' — ' + w + ' × ' + h; og.appendChild(o); } sel.appendChild(og); }
  sel.addEventListener('change', () => { const v = sel.value; if (!v) return; const [w, h] = v.split('x').map(Number); $('#pxW').value = w; $('#pxH').value = h; PIX.w = w; PIX.h = h; savePix(); });
  $('#pxW').value = PIX.w; $('#pxH').value = PIX.h;
  ['pxW', 'pxH'].forEach(id => $('#' + id).addEventListener('change', () => { PIX.w = +$('#pxW').value; PIX.h = +$('#pxH').value; sel.value = ''; savePix(); }));
  // the File > New dialog gets the same sizes
  const np = $('#nPreset');
  for (const [grp, list] of RETRO_SIZES){ const og = document.createElement('optgroup'); og.label = 'Retro: ' + grp; for (const [n, w, h] of list){ const o = document.createElement('option'); o.value = w + 'x' + h; o.textContent = n + ' (' + w + ' × ' + h + ')'; og.appendChild(o); } np.appendChild(og); }
  const ps = $('#pxPal');
  const o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'None (any color)'; ps.appendChild(o0);
  const o1 = document.createElement('option'); o1.value = '__scheme'; o1.textContent = 'The palette shown below the canvas'; ps.appendChild(o1);
  const og = document.createElement('optgroup'); og.label = 'Retro machines';
  for (const k of Object.keys(RETRO_PALETTES)){ const o = document.createElement('option'); o.value = k; o.textContent = k + ' (' + hexList(RETRO_PALETTES[k]).length + ')'; og.appendChild(o); }
  ps.appendChild(og); ps.value = PIX.palette;
  ps.addEventListener('change', () => { PIX.palette = ps.value; savePix(); if (PIX.on && RETRO_PALETTES[PIX.palette]) setScheme(PIX.palette); setColor(1, S.c1, true); setColor(2, S.c2, true); pixDirty(); });
  const ds = $('#pxDepth'); for (const [k, d] of Object.entries(DEPTHS)){ const o = document.createElement('option'); o.value = k; o.textContent = d.name; ds.appendChild(o); }
  ds.value = PIX.depth; ds.addEventListener('change', () => { PIX.depth = ds.value; savePix(); setColor(1, S.c1, true); setColor(2, S.c2, true); pixDirty(); });
  const chk = (id, k, after) => { const el = $('#' + id); el.checked = !!PIX[k]; el.addEventListener('change', () => { PIX[k] = el.checked; savePix(); if (after) after(); requestDraw(); }); };
  $('#pxOn').checked = PIX.on; $('#pxOn').addEventListener('change', e => setPixelMode(e.target.checked));
  chk('pxSnap', 'snap', () => { setColor(1, S.c1, true); setColor(2, S.c2, true); });
  chk('pxHardAlpha', 'hardAlpha'); chk('pxAllFrames', 'allFrames'); chk('pxHard', 'hard'); chk('pxPerfect', 'perfect'); chk('pxGrid', 'grid');
  chk('pxPrev', 'preview', pixPreviewSync); chk('pxCrt', 'crt', pixPreviewRender); chk('pxTv', 'tv', pixPreviewRender);
  const selb = (id, k, num, after) => { const el = $('#' + id); el.value = PIX[k]; el.addEventListener('change', () => { PIX[k] = num ? +el.value : el.value; savePix(); if (after) after(); requestDraw(); }); };
  selb('pxDither', 'dither'); selb('pxTile', 'tile', true); selb('pxPrevScale', 'prevScale', true, pixPreviewRender); selb('pxExport', 'exportScale', true);
  segSet('#pxMirror', 'v', PIX.mirror); segBind('#pxMirror', 'v', v => { PIX.mirror = v; savePix(); requestDraw(); });
  segSet('#pxBg', 'v', PIX.bg); segBind('#pxBg', 'v', v => { PIX.bg = v; savePix(); });
  $('#pxNew').addEventListener('click', pixNewCanvas);
  $('#pxResize').addEventListener('click', pixResizePicture);
  $('#pxCanvas').addEventListener('click', pixCanvasSize);
  $('#pxReduce').addEventListener('click', reduceColors);
  $('#pxReplace').addEventListener('click', replaceColor);
  $('#pxCountBtn').addEventListener('click', updateColorCount);
}
// menus
{
  const im = MENUS.image; im.push('-', { l: 'Pixel art mode', c: 'pixelMode', ck: () => PIX.on }, { l: 'Pixel art settings…', c: 'page:pixel' }, { l: 'Reduce colors…', c: 'pixReduce', en: () => !!W });
  const vm = MENUS.viewm, at = vm.findIndex(it => it && it.c === 'canvasView');
  vm.splice(at, 0, { l: 'Pixel grid', c: 'pixGrid', ck: () => PIX.grid, en: () => PIX.on }, { l: 'Pixel art preview', c: 'pixPrev', ck: () => PIX.preview, en: () => PIX.on }, '-');
}
function pixelCmd(c){
  if (c === 'pixelMode'){ setPixelMode(!PIX.on); if (PIX.on) showPage('pixel'); return true; }
  if (c === 'pixReduce'){ showPage('pixel'); setTimeout(() => { const el = $('#pxReduce'); if (el) el.scrollIntoView({ block: 'center' }); }, 30); return true; }
  if (c === 'pixGrid'){ PIX.grid = !PIX.grid; $('#pxGrid').checked = PIX.grid; savePix(); requestDraw(); return true; }
  if (c === 'pixPrev'){ PIX.preview = !PIX.preview; $('#pxPrev').checked = PIX.preview; savePix(); pixPreviewSync(); return true; }
  return false;
}
// stepping the zoom in pixel art mode stays on whole numbers
function pixStepZoom(dir){
  const z = S.zoom; if (!PIX || !PIX.on || z < 1) return null;
  return dir > 0 ? Math.max(Math.floor(z) + 1, Math.round(z * 1.25)) : Math.max(1, Math.min(Math.ceil(z) - 1, Math.round(z * 0.8)));
}
document.documentElement.classList.toggle('pixelmode', PIX.on);
setTimeout(() => { pixPreviewSync(); if (PIX.on) pixDirty(); }, 0);
function upscaleNearest(src, w, h, k){
  const W2 = w * k, out = new Uint8ClampedArray(W2 * h * k * 4), s32 = new Uint32Array(src.buffer, src.byteOffset, w * h), o32 = new Uint32Array(out.buffer);
  for (let y = 0; y < h; y++){ const row = new Uint32Array(W2); for (let x = 0; x < w; x++){ const v = s32[y * w + x]; for (let j = 0; j < k; j++) row[x * k + j] = v; } for (let j = 0; j < k; j++) o32.set(row, (y * k + j) * W2); }
  return out;
}
