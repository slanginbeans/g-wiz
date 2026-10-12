// ===================== colors, drawing tools, text, adjustments, effects =====================

// ---------- colors ----------
S.c1 = { r: 0, g: 0, b: 0, a: 255 }; S.c2 = { r: 255, g: 255, b: 255, a: 255 };
const cssc = c => 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (c.a / 255).toFixed(3) + ')';
const csso = c => 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
const hex6 = c => '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('');
const hexA = c => hex6(c) + (c.a < 255 ? c.a.toString(16).padStart(2, '0') : '');
function parseHex(h){
  h = String(h).trim().replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join('');
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255 };
}
const store = { get(k, d){ try { const v = localStorage.getItem('gwiz.' + k); return v ? JSON.parse(v) : d; } catch (e){ return d; } }, set(k, v){ try { localStorage.setItem('gwiz.' + k, JSON.stringify(v)); } catch (e){} } };
S.recent = store.get('recent', []);
function setColor(which, c, keepRecent){
  c = pixSnapColor({ r: c.r | 0, g: c.g | 0, b: c.b | 0, a: c.a == null ? 255 : c.a | 0 });
  if (which === 2) S.c2 = c; else S.c1 = c;
  if (!keepRecent){ const h = hexA(c); S.recent = [h, ...S.recent.filter(x => x !== h)].slice(0, 16); store.set('recent', S.recent); renderRecent(); }
  updateWells(); if (TE) styleTextEdit();
}
function updateWells(){ $('#cw1').style.setProperty('--c', cssc(S.c1)); $('#cw2').style.setProperty('--c', cssc(S.c2)); document.documentElement.style.setProperty('--c2', cssc(S.c2)); $('#cw1').dataset.tip = 'Primary color ' + hexA(S.c1); $('#cw2').dataset.tip = 'Secondary color ' + hexA(S.c2); }
function swapColors(){ const t = S.c1; S.c1 = S.c2; S.c2 = t; updateWells(); if (TE) styleTextEdit(); }
const PALETTES = {
  'Classic Paint': '000000 808080 800000 808000 008000 008080 000080 800080 808040 004040 0080ff 004080 8000ff 804000 ffffff c0c0c0 ff0000 ffff00 00ff00 00ffff 0000ff ff00ff ffff80 00ff80 80ffff 8080ff ff0080 ff8040',
  'Pastel': 'ffd1dc ffb3c6 ffc8a2 ffe5b4 fff5ba e2f0cb c1e1c1 b5ead7 a0e7e5 b4d8f6 c7ceea d5c6e0 e0bbe4 f7d6e0 ffffff fdfd96 ffdac1 d8f2c9 b5ead7 c7ceea ffb7b2 ff9aa2 cdb4db bde0fe a2d2ff caffbf fdffb6 ffd6a5',
  'Earth tones': '3b2f2f 5c4033 7b5b3a 8b6b4a a0785a b5835a c19a6b d2b48c e3c9a8 f0e1c8 6b4423 8a5a44 a0522d cd853f 556b2f 6b8e23 808000 9a9a5a b8b86b 2f4f4f 4a5d23 6e7f3a 8f9779 a3a380 c2b280 e6d3a3 704214 4b3621',
  'Neon': 'ff073a ff2a6d ff6ec7 ff00ff bc13fe 8a2be2 4d4dff 1f51ff 00ffff 0ff0fc 39ff14 7fff00 ccff00 ffff33 fff01f ffaa00 ff5f1f ff3131 fe019a 08f7fe 09fbd3 f5d300 ff8b00 00ff9f 00b8ff 001eff bd00ff 000000',
  'Grayscale': Array.from({ length: 28 }, (_, i) => { const v = Math.round(i * 255 / 27).toString(16).padStart(2, '0'); return v + v + v; }).join(' '),
  'Skin tones': '8d5524 c68642 e0ac69 f1c27d ffdbac 3d2210 5c3a21 7d4f2e a0663d c58c5c ffe0bd ffcd94 eac086 ffad60 4a312c 6b4226 8e5b3a b07850 d4a373 f2d0a9 fae3cd fde7d6 a46a4c 7a4a35 cc9a77 e5b897 f5d1b5 ffefe2',
  'Retro 8-bit': '7c7c7c 0000fc 0000bc 4428bc 940084 a80020 a81000 881400 503000 007800 006800 005800 004058 000000 bcbcbc 0078f8 0058f8 6844fc d800cc e40058 f83800 e45c10 ac7c00 00b800 00a800 00a844 008888 f8f8f8',
  'Game Boy': '0f380f 306230 8bac0f 9bbc0f',
  'Material': 'f44336 e91e63 9c27b0 673ab7 3f51b5 2196f3 03a9f4 00bcd4 009688 4caf50 8bc34a cddc39 ffeb3b ffc107 ff9800 ff5722 795548 9e9e9e 607d8b 000000 ffffff b71c1c 880e4f 4a148c 1a237e 0d47a1 1b5e20 e65100',
  'Ocean': '03045e 023e8a 0077b6 0096c7 00b4d8 48cae4 90e0ef ade8f4 caf0f8 e0fbfc 05668d 028090 00a896 02c39a f0f3bd 1a759f 1e96fc a2d6f9 fcf300 ffc600 012a4a 013a63 01497c 014f86 2a6f97 2c7da0 468faf 61a5c2',
  'Sunset': '0b0033 370031 832232 ce8964 eaf27c ff595e ffca3a 8ac926 1982c4 6a4c93 f72585 b5179e 7209b7 560bad 480ca8 3a0ca3 3f37c9 4361ee 4895ef 4cc9f0 ff9e00 ff8500 ff6d00 ff5400 ff4800 ff0054 9e0059 390099',
  'Forest': '081c15 1b4332 2d6a4f 40916c 52b788 74c69d 95d5b2 b7e4c7 d8f3dc 344e41 3a5a40 588157 a3b18a dad7cd 283618 606c38 dda15e bc6c25 fefae0 132a13 31572c 4f772d 90a955 ecf39e 3d405b 6b705c a5a58d b7b7a4',
  'Candy': 'ff99c8 fcf6bd d0f4de a9def9 e4c1f9 ff70a6 ff9770 ffd670 e9ff70 70d6ff f15bb5 fee440 00bbf9 00f5d4 9b5de5 ff006e fb5607 ffbe0b 8338ec 3a86ff ef476f ffd166 06d6a0 118ab2 073b4c f72585 b5179e 4cc9f0',
  'Vintage': '264653 2a9d8f e9c46a f4a261 e76f51 6d597a b56576 e56b6f eaac8b 355070 3d405b 81b29a f2cc8f e07a5f f4f1de 8e9aaf cbc0d3 efd3d7 feeafa dee2ff 5f0f40 9a031e fb8b24 e36414 0f4c5c 3c1518 69140e a44200',
  'Custom colors': ''
};
S.custom = store.get('custom', []);
S.scheme = store.get('scheme', 'Classic Paint');
if (!(S.scheme in PALETTES)) S.scheme = 'Classic Paint';
function paletteColors(){ return S.scheme === 'Custom colors' ? S.custom.slice() : PALETTES[S.scheme].split(' ').filter(Boolean); }
function renderPalette(){
  const grid = $('#palGrid'); grid.innerHTML = '';
  let list = paletteColors(); if (!list.length) list = ['ffffff'];
  const half = Math.ceil(list.length / 2), top = list.slice(0, half), bot = list.slice(half), order = [];
  for (let i = 0; i < half; i++){ order.push(top[i]); if (bot[i]) order.push(bot[i]); else order.push(null); }
  for (const h of order){
    const b = document.createElement('button'); b.className = 'sw';
    if (!h){ b.disabled = true; b.style.visibility = 'hidden'; grid.appendChild(b); continue; }
    const c = parseHex(h); b.style.setProperty('--c', cssc(c)); b.dataset.tip = '#' + h.replace('#', '');
    b.addEventListener('mousedown', e => { e.preventDefault(); setColor((e.button === 2 || (TOUCH.on && TOUCH.sec)) ? 2 : 1, c); });
    b.addEventListener('contextmenu', e => e.preventDefault());
    b.addEventListener('dblclick', () => openColorDlg(1));
    grid.appendChild(b);
  }
}
function renderRecent(){
  const box = $('#palRecent'); box.innerHTML = '';
  for (const h of S.recent.slice(0, 16)){
    const c = parseHex(h); if (!c) continue;
    const b = document.createElement('button'); b.className = 'sw'; b.style.setProperty('--c', cssc(c)); b.dataset.tip = 'Recent ' + h;
    b.addEventListener('mousedown', e => { e.preventDefault(); setColor((e.button === 2 || (TOUCH.on && TOUCH.sec)) ? 2 : 1, c, true); });
    b.addEventListener('contextmenu', e => e.preventDefault());
    box.appendChild(b);
  }
}
(function initPalette(){
  const sel = $('#palScheme');
  for (const k of Object.keys(PALETTES)){ const o = document.createElement('option'); o.value = k; o.textContent = k; sel.appendChild(o); }
  sel.value = S.scheme;
  sel.addEventListener('change', e => { S.scheme = e.target.value; store.set('scheme', S.scheme); renderPalette(); });
  $('#cwSwap').addEventListener('click', swapColors);
  $('#cw1').addEventListener('dblclick', () => openColorDlg(1)); $('#cw2').addEventListener('dblclick', () => openColorDlg(2));
  $('#cw1').addEventListener('click', e => { if (e.detail === 1) setTimeout(() => {}, 0); });
  $('#palEdit').addEventListener('click', () => openColorDlg(1));
  renderPalette(); renderRecent(); updateWells();
})();

// ---------- Edit Colors dialog ----------
const CD = { which: 1, h: 0, s: 0, v: 0, a: 255 };
function rgb2hsv({ r, g, b }){ r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d){ if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return { h, s: mx ? d / mx : 0, v: mx }; }
function hsv2rgb(h, s, v){ const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c; let r, g, b; [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }; }
function cdColor(){ const c = hsv2rgb(CD.h, CD.s, CD.v); c.a = CD.a; return c; }
function openColorDlg(which){
  CD.which = which; const c = which === 2 ? S.c2 : S.c1; Object.assign(CD, rgb2hsv(c)); CD.a = c.a;
  $('#cTitle').textContent = 'Edit Colors — ' + (which === 2 ? 'secondary' : 'primary') + ' color';
  $('#cOld').style.setProperty('--c', cssc(c)); renderCustom(); cdRefresh(); openModal('colorDlg');
}
function cdRefresh(skip){
  const sv = $('#cSV'), g = sv.getContext('2d'), w = sv.width, h = sv.height;
  g.fillStyle = csso(hsv2rgb(CD.h, 1, 1)); g.fillRect(0, 0, w, h);
  let gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const mx = CD.s * w, my = (1 - CD.v) * h; g.strokeStyle = CD.v > 0.5 ? '#000' : '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(mx, my, 5, 0, Math.PI * 2); g.stroke();
  const hu = $('#cHue'), hg = hu.getContext('2d'), hh = hu.height; gr = hg.createLinearGradient(0, 0, 0, hh);
  for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, csso(hsv2rgb(i * 60 % 360, 1, 1)));
  hg.fillStyle = gr; hg.fillRect(0, 0, hu.width, hh); const hy = CD.h / 360 * hh; hg.fillStyle = '#000'; hg.fillRect(0, hy - 1, hu.width, 3); hg.fillStyle = '#fff'; hg.fillRect(0, hy, hu.width, 1);
  const c = cdColor(); $('#cNew').style.setProperty('--c', cssc(c));
  const put = (id, v) => { if (skip !== id) $('#' + id).value = v; };
  put('cR', c.r); put('cG', c.g); put('cB', c.b); put('cHh', Math.round(CD.h)); put('cSs', Math.round(CD.s * 100)); put('cVv', Math.round(CD.v * 100)); put('cHex', hexA(c));
  $('#cA').value = Math.round(CD.a / 2.55); $('#cAOut').textContent = Math.round(CD.a / 2.55) + '%';
}
function dragOn(el, fn){ el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); fn(e); const mv = ev => fn(ev), up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); }; el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); }); }
dragOn($('#cSV'), e => { const r = e.currentTarget.getBoundingClientRect(); CD.s = clamp((e.clientX - r.left) / r.width, 0, 1); CD.v = clamp(1 - (e.clientY - r.top) / r.height, 0, 1); cdRefresh(); });
dragOn($('#cHue'), e => { const r = e.currentTarget.getBoundingClientRect(); CD.h = clamp((e.clientY - r.top) / r.height, 0, 0.9999) * 360; cdRefresh(); });
['cR', 'cG', 'cB'].forEach(id => $('#' + id).addEventListener('input', () => { const c = { r: clamp(+$('#cR').value | 0, 0, 255), g: clamp(+$('#cG').value | 0, 0, 255), b: clamp(+$('#cB').value | 0, 0, 255) }; Object.assign(CD, rgb2hsv(c)); cdRefresh(id); }));
['cHh', 'cSs', 'cVv'].forEach(id => $('#' + id).addEventListener('input', () => { CD.h = clamp(+$('#cHh').value, 0, 359.99); CD.s = clamp(+$('#cSs').value / 100, 0, 1); CD.v = clamp(+$('#cVv').value / 100, 0, 1); cdRefresh(id); }));
$('#cHex').addEventListener('input', e => { const c = parseHex(e.target.value); if (!c) return; Object.assign(CD, rgb2hsv(c)); CD.a = c.a; cdRefresh('cHex'); });
$('#cA').addEventListener('input', e => { CD.a = Math.round(+e.target.value * 2.55); cdRefresh(); });
$('#cOk').addEventListener('click', () => { setColor(CD.which, cdColor()); closeModal('colorDlg'); });
$('#cAddCustom').addEventListener('click', () => { const h = hexA(cdColor()); S.custom = [h, ...S.custom.filter(x => x !== h)].slice(0, 28); store.set('custom', S.custom); renderCustom(); if (S.scheme === 'Custom colors') renderPalette(); sbFlash('Added ' + h + ' to your custom colors. Choose "Custom colors" in the scheme list to use them in the palette.'); });
function renderCustom(){
  const box = $('#cCustom'); box.innerHTML = '';
  for (let i = 0; i < 16; i++){
    const h = S.custom[i], b = document.createElement('button'); b.className = 'sw'; b.type = 'button';
    if (h){ const c = parseHex(h); b.style.setProperty('--c', cssc(c)); b.dataset.tip = h; b.addEventListener('click', () => { Object.assign(CD, rgb2hsv(c)); CD.a = c.a; cdRefresh(); }); }
    else { b.style.setProperty('--c', '#fff'); b.disabled = true; }
    box.appendChild(b);
  }
}

// ---------- drawing tools ----------
var DRAW_TOOLS = ['pencil', 'pen', 'brush', 'marker', 'air'], SHAPE_TOOLS = ['line', 'rect', 'ellipse', 'rrect'];
S.draw = Object.assign({
  pencil: { size: 1, opacity: 100, tip: 'round', style: 'round', blend: 'source-over' },
  pen: { size: 4, opacity: 100, smooth: 40, style: 'ink', angle: 45, pressSize: true, pressOp: false, blend: 'source-over' },
  brush: { size: 24, opacity: 100, flow: 35, hard: 40, spacing: 12, smooth: 30, style: 'soft', pressSize: true, pressOp: false, blend: 'source-over' },
  marker: { size: 18, opacity: 100, tip: 'chisel', style: 'chisel', angle: 45, smooth: 30, pressSize: false, pressOp: false, blend: 'source-over' },
  air: { size: 40, opacity: 100, flow: 30, density: 40, style: 'fine', pressSize: false, pressOp: true, blend: 'source-over' }
}, {});
// saved settings are merged tool by tool, so settings added in later versions (the pen's nib angle, say) get their defaults
{
  const saved = store.get('draw', {}), ver = store.get('drawVer', 1);
  for (const t of Object.keys(S.draw)){
    const sv = saved[t] && typeof saved[t] === 'object' ? saved[t] : {};
    if (t === 'marker' && ver < 2){ delete sv.opacity; delete sv.blend; }   // markers used to default to 55% multiply
    if (t === 'marker' && !sv.style && sv.tip) sv.style = sv.tip;
    S.draw[t] = Object.assign({}, S.draw[t], sv);
    for (const k of ['size', 'opacity', 'angle', 'flow', 'hard', 'spacing', 'density', 'smooth']) if (k in S.draw[t] && !isFinite(S.draw[t][k])) delete S.draw[t][k];
  }
  store.set('drawVer', 2); store.set('draw', S.draw);
}
const STYLES = {
  pencil: [['round', 'Hard round', 'Solid pixels, round tip.'], ['square', 'Square', 'Solid pixels, square tip.'], ['grainy', 'Grainy', 'Graphite look: some pixels are skipped at random.'], ['sketch', 'Sketch', 'Several light, slightly offset lines, like quick sketching.']],
  pen: [['ink', 'Ink', 'Smooth solid line.'], ['ballpoint', 'Ballpoint', 'A thinner, even line.'], ['calligraphy', 'Calligraphy', 'A flat nib: thick and thin depending on the direction. Set the nib angle below.'], ['felt', 'Felt tip', 'Soft, slightly fuzzy edge.'], ['brushpen', 'Brush pen', 'Thin when you move fast, thick when you slow down.']],
  brush: [['soft', 'Soft round', 'Round dab with a soft edge; hardness sets how soft.'], ['hard', 'Hard round', 'Round dab with a crisp edge.'], ['bristle', 'Bristle', 'Several fine hairs that leave streaks.'], ['chalk', 'Chalk', 'Rough, textured dab.'], ['splatter', 'Splatter', 'Speckles sprayed around the dab.'], ['watercolor', 'Watercolor', 'Thin wash that darkens toward the rim.']],
  marker: [['chisel', 'Chisel tip', 'Flat tip at the angle below; thick and thin strokes.'], ['round', 'Round tip', 'Even width.'], ['highlighter', 'Highlighter', 'A wide flat tip held upright: broad sideways, thin up and down.'], ['dry', 'Dry marker', 'Chisel tip that is running out of ink.']],
  air: [['fine', 'Fine spray', 'Fine mist of dots.'], ['coarse', 'Coarse spray', 'Bigger, rougher dots.'], ['soft', 'Soft airbrush', 'Smooth cloud of color that builds up.'], ['spatter', 'Spatter', 'Random blobs of different sizes.'], ['stipple', 'Stipple', 'Round dots of one size.']]
};
// pen pressure: a curve from raw pressure to how much of the size / opacity is used
S.press = Object.assign({ preset: 'linear', cx: 0.5, cy: 0.5, minSize: 15, minOp: 10 }, store.get('press', {}));
const PRESS_PRESETS = { linear: [0.5, 0.5], light: [0.25, 0.75], vlight: [0.1, 0.9], firm: [0.75, 0.25], vfirm: [0.9, 0.1] };
let pressLUT = null;
function pressCurve(x){
  const cx = S.press.cx, cy = S.press.cy, A = 1 - 2 * cx;
  let t = Math.abs(A) < 1e-6 ? x / (2 * cx || 1) : (-2 * cx + Math.sqrt(Math.max(0, 4 * cx * cx + 4 * A * x))) / (2 * A);
  t = Math.min(1, Math.max(0, t));
  return Math.min(1, Math.max(0, 2 * (1 - t) * t * cy + t * t));
}
function pressRebuild(){ pressLUT = new Float32Array(65); for (let i = 0; i <= 64; i++) pressLUT[i] = pressCurve(i / 64); }
pressRebuild();
const pressMapped = p => { const x = Math.min(1, Math.max(0, p)) * 64, i = x | 0, f = x - i; return i >= 64 ? pressLUT[64] : pressLUT[i] + (pressLUT[i + 1] - pressLUT[i]) * f; };
const sizeScale = (st, p) => st.pressSize && DS.pen ? S.press.minSize / 100 + (1 - S.press.minSize / 100) * pressMapped(p) : 1;
const opScale = (st, p) => st.pressOp && DS.pen ? S.press.minOp / 100 + (1 - S.press.minOp / 100) * pressMapped(p) : 1;
let lastPressure = 0;
S.shape = Object.assign({ style: 'stroke', width: 3, opacity: 100, dash: 'solid', radius: 18, arrow: 'none', cap: 'round', aa: true }, store.get('shape', {}));
S.drawLock = false;
const DRAW_INFO = {
  pencil: ['Pencil', 'Hard, pixel-exact lines with no smoothing. Good for pixel art.'],
  pen: ['Pen', 'Smooth, solid ink lines. Pen pressure changes the width.'],
  brush: ['Brush', 'Soft strokes that build up. Lower the flow for gentle shading.'],
  marker: ['Marker', 'Bold ink with a chisel or round tip. Overlaps inside one stroke do not darken; lower the opacity or pick Multiply for see-through ink.'],
  air: ['Airbrush', 'Sprays paint while you hold the button down.']
};
function loadDrawUI(t){
  const st = S.draw[t]; if (!st) return;
  $('#drawTitle').textContent = DRAW_INFO[t][0]; $('#drawHint').textContent = DRAW_INFO[t][1];
  $$('[data-dt]').forEach(el => el.hidden = !el.dataset.dt.split(' ').includes(t));
  const sv = (id, v) => { const el = $('#' + id); if (el && v != null){ el.value = v; el.dispatchEvent(new Event('input')); } };
  sv('dSize', st.size); sv('dOpacity', st.opacity); sv('dFlow', st.flow); sv('dHard', st.hard); sv('dSpacing', st.spacing); sv('dDensity', st.density); sv('dAngle', st.angle); sv('dSmooth', st.smooth);
  const sel = $('#dStyle'); sel.innerHTML = '';
  for (const [v, name] of STYLES[t]){ const o = document.createElement('option'); o.value = v; o.textContent = name; sel.appendChild(o); }
  sel.value = st.style; styleHint(t);
  $('#dAngleLbl').textContent = t === 'pen' ? 'Nib angle' : 'Tip angle';
  $('#dAngleRow').hidden = !((t === 'marker' && (st.style === 'chisel' || st.style === 'dry')) || (t === 'pen' && st.style === 'calligraphy'));
  $('#dHardRow').hidden = !(t === 'brush' && (st.style === 'soft' || st.style === 'chalk' || st.style === 'watercolor'));
  $('#dPressSize').checked = !!st.pressSize; $('#dPressOp').checked = !!st.pressOp; $('#dBlend').value = st.blend || 'source-over'; $('#dLock').checked = S.drawLock;
  drawPressCurve();
}
function styleHint(t){ const st = S.draw[t], e = STYLES[t].find(x => x[0] === st.style); $('#dStyleHint').textContent = e ? e[2] : ''; }
$('#dStyle').addEventListener('change', e => { const t = DRAW_TOOL(); if (!t) return; S.draw[t].style = e.target.value; if (t === 'marker' && (e.target.value === 'chisel' || e.target.value === 'round')) S.draw.marker.tip = e.target.value; store.set('draw', S.draw); dabCache.key = ''; loadDrawUI(t); requestDraw(); });
// pressure curve editor
const pcv = $('#pressCurve');
function drawPressCurve(){
  if (!pcv) return; const g = pcv.getContext('2d'), w = pcv.width, h = pcv.height;
  g.clearRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c0c0c0'; g.lineWidth = 1; g.beginPath(); for (let i = 1; i < 4; i++){ g.moveTo(i * w / 4 + 0.5, 0); g.lineTo(i * w / 4 + 0.5, h); g.moveTo(0, i * h / 4 + 0.5); g.lineTo(w, i * h / 4 + 0.5); } g.stroke();
  const ms = S.press.minSize / 100;
  g.strokeStyle = '#000080'; g.lineWidth = 2; g.beginPath();
  for (let i = 0; i <= 64; i++){ const x = i / 64, y = ms + (1 - ms) * pressMapped(x); i ? g.lineTo(x * w, h - y * h) : g.moveTo(x * w, h - y * h); } g.stroke();
  g.fillStyle = '#ff0000'; g.beginPath(); g.arc(S.press.cx * w, h - S.press.cy * h, 4, 0, Math.PI * 2); g.fill();
  if (lastPressure > 0){ const y = ms + (1 - ms) * pressMapped(lastPressure); g.fillStyle = '#008000'; g.beginPath(); g.arc(lastPressure * w, h - y * h, 4, 0, Math.PI * 2); g.fill(); }
  $('#pressRead').textContent = lastPressure > 0 ? 'Last pen pressure ' + Math.round(lastPressure * 100) + '% → size ' + Math.round((ms + (1 - ms) * pressMapped(lastPressure)) * 100) + '%' : 'Draw with the pen to see its pressure here.';
}
if (pcv){
  dragOn(pcv, e => { const r = pcv.getBoundingClientRect(); S.press.cx = clamp((e.clientX - r.left) / r.width, 0.02, 0.98); S.press.cy = clamp(1 - (e.clientY - r.top) / r.height, 0, 1); S.press.preset = 'custom'; $('#pressPreset').value = 'custom'; pressRebuild(); store.set('press', S.press); drawPressCurve(); });
  $('#pressPreset').value = S.press.preset;
  $('#pressPreset').addEventListener('change', e => { const v = e.target.value; S.press.preset = v; if (PRESS_PRESETS[v]){ [S.press.cx, S.press.cy] = PRESS_PRESETS[v]; } pressRebuild(); store.set('press', S.press); drawPressCurve(); });
  [['pressMin', 'minSize'], ['pressMinOp', 'minOp']].forEach(([id, k]) => { const el = $('#' + id); el.value = S.press[k]; $('#' + id + 'Out').textContent = S.press[k] + '%'; el.addEventListener('input', () => { S.press[k] = +el.value; $('#' + id + 'Out').textContent = el.value + '%'; store.set('press', S.press); drawPressCurve(); }); });
}
const DRAW_TOOL = () => DRAW_TOOLS.includes(S.tool) ? S.tool : null;
function bindDraw(id, key, fmt){
  const el = $('#' + id), out = $('#' + id + 'Out');
  el.addEventListener('input', () => { const t = DRAW_TOOL(); const v = +el.value; if (out) out.textContent = fmt(v); if (t){ S.draw[t][key] = v; store.set('draw', S.draw); } if (key === 'size'){ renderToolOpts(); requestDraw(); } });
}
bindDraw('dSize', 'size', v => v + ' px'); bindDraw('dOpacity', 'opacity', v => v + '%'); bindDraw('dFlow', 'flow', v => v + '%'); bindDraw('dHard', 'hard', v => v + '%');
bindDraw('dSpacing', 'spacing', v => v + '%'); bindDraw('dDensity', 'density', v => v + '%'); bindDraw('dAngle', 'angle', v => v + '°'); bindDraw('dSmooth', 'smooth', v => v === 0 ? 'Off' : v + '%');

$('#dPressSize').addEventListener('change', e => { const t = DRAW_TOOL(); if (t){ S.draw[t].pressSize = e.target.checked; store.set('draw', S.draw); } });
$('#dPressOp').addEventListener('change', e => { const t = DRAW_TOOL(); if (t){ S.draw[t].pressOp = e.target.checked; store.set('draw', S.draw); } });
$('#dBlend').addEventListener('change', e => { const t = DRAW_TOOL(); if (t){ S.draw[t].blend = e.target.value; store.set('draw', S.draw); } });
$('#dLock').addEventListener('change', e => { S.drawLock = e.target.checked; });
function setDrawSize(v){ const t = DRAW_TOOL(); if (t){ S.draw[t].size = clamp(Math.round(v), 1, 200); loadDrawUI(t); store.set('draw', S.draw); } else if (SHAPE_TOOLS.includes(S.tool)){ S.shape.width = clamp(Math.round(v), 1, 60); loadShapeUI(S.tool); } renderToolOpts(); requestDraw(); }
// shape settings
const SHAPE_NAMES = { line: 'Line', rect: 'Rectangle', ellipse: 'Ellipse', rrect: 'Rounded rectangle' };
function loadShapeUI(t){
  $('#shapeTitle').textContent = SHAPE_NAMES[t] || 'Shape';
  $$('[data-st]').forEach(el => el.hidden = !el.dataset.st.split(' ').includes(t));
  segSet('#shStyle', 'v', S.shape.style);
  const sv = (id, v) => { const el = $('#' + id); el.value = v; el.dispatchEvent(new Event('input')); };
  sv('shWidth', S.shape.width); sv('shOpacity', S.shape.opacity); sv('shRadius', S.shape.radius);
  $('#shDash').value = S.shape.dash; $('#shArrow').value = S.shape.arrow; $('#shCap').value = S.shape.cap; $('#shAA').checked = S.shape.aa;
}
const saveShape = () => store.set('shape', S.shape);
segBind('#shStyle', 'v', v => { S.shape.style = v; saveShape(); });
[['shWidth', 'width', v => v + ' px'], ['shOpacity', 'opacity', v => v + '%'], ['shRadius', 'radius', v => v + ' px']].forEach(([id, k, f]) => $('#' + id).addEventListener('input', e => { S.shape[k] = +e.target.value; $('#' + id + 'Out').textContent = f(+e.target.value); saveShape(); }));
[['shDash', 'dash'], ['shArrow', 'arrow'], ['shCap', 'cap']].forEach(([id, k]) => $('#' + id).addEventListener('change', e => { S.shape[k] = e.target.value; saveShape(); }));
$('#shAA').addEventListener('change', e => { S.shape.aa = e.target.checked; saveShape(); });
rangeBind('fTol', 'fTol', v => v + '%'); rangeBind('fOpacity', 'fOpacity', v => v + '%');
rangeBind('tOutline', 'tOutline', v => v + ' px', () => { if (TE) styleTextEdit(); });
rangeBind('tShadow', 'tShadow', v => v + ' px');

// stroke state
var DS = { active: false, canvas: null, ctx: null, opacity: 1, blend: 'source-over', lock: false, hard: false, bbox: null };
function strokeCanvasReady(){
  if (!DS.canvas || DS.canvas.width !== W || DS.canvas.height !== H){ DS.canvas = document.createElement('canvas'); DS.canvas.width = W; DS.canvas.height = H; DS.ctx = DS.canvas.getContext('2d', { willReadFrequently: true }); }
  else { DS.ctx.setTransform(1, 0, 0, 1, 0, 0); DS.ctx.globalAlpha = 1; DS.ctx.globalCompositeOperation = 'source-over'; DS.ctx.clearRect(0, 0, W, H); }
  DS.bbox = [Infinity, Infinity, -Infinity, -Infinity]; DS.mirror = false; DS.pp = null;
}
function grow(x, y, r){ const b = DS.bbox; b[0] = Math.min(b[0], x - r - 2); b[1] = Math.min(b[1], y - r - 2); b[2] = Math.max(b[2], x + r + 2); b[3] = Math.max(b[3], y + r + 2); }
const pressureOf = e => { if (e.pointerType === 'pen'){ lastPressure = e.pressure || 0; return e.pressure || 0.5; } return 1; };
// make sure the layer covers the point we start drawing at
function ensureDrawableAt(p){
  const [lx, ly] = toImg(p), [dx, dy] = toDoc(p);
  if (lx >= 0 && ly >= 0 && lx < W && ly < H) return true;
  if (dx < 0 || dy < 0 || dx >= DocW || dy >= DocH) return false;
  layerExpand(true); sbFlash('The layer was enlarged to the canvas so you can draw there.');
  return true;
}
function beginDraw(e, p){
  const t = S.tool, shape = SHAPE_TOOLS.includes(t);
  if (!ensureDrawableAt(p)) return;
  stopPlay();
  const [lx, ly] = toImg(p);
  strokeCanvasReady();
  DS.active = true; DS.t0 = performance.now(); DS.tool = t; DS.btn = e.button; DS.hard = false;
  const c = e.button === 2 ? S.c2 : S.c1; DS.color = c; DS.mirror = pixMirrorFor(t);
  if (shape){
    DS.opacity = S.shape.opacity / 100; DS.blend = 'source-over'; DS.lock = false; DS.hard = !S.shape.aa || pixHard();
    if (pixHard()) DS.opacity = 1;
    DS.start = [lx, ly]; DS.cur = [lx, ly]; DS.shift = e.shiftKey; drawShape(); requestDraw(); return;
  }
  const st = S.draw[t];
  DS.opacity = st.opacity / 100 * c.a / 255; DS.blend = st.blend || 'source-over'; DS.lock = S.drawLock; DS.hard = t === 'pencil' || pixHard();
  if (pixHard() && DS.blend === 'source-over') DS.opacity = c.a >= 128 ? 1 : 0;
  DS.pen = e.pointerType === 'pen'; DS.p = pressureOf(e); DS.last = [lx, ly]; DS.sm = [lx, ly]; DS.mid = [lx, ly]; DS.rem = 0; DS.speed = 0; DS.lastT = performance.now(); DS.dir = 0; DS.sk = null; DS.skN = 0;
  const g = DS.ctx; g.fillStyle = csso(c); g.strokeStyle = csso(c);
  if (t === 'pencil') pencilLine(lx, ly, lx, ly);
  else if (t === 'pen'){ const w = penWidth(); if (st.style !== 'calligraphy'){ g.globalAlpha = penAlpha(); g.beginPath(); g.arc(lx, ly, w / 2, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; } grow(lx, ly, w); }
  else if (t === 'brush') brushDab(lx, ly);
  else if (t === 'marker') markerDab(lx, ly);
  else if (t === 'air'){ spray(); DS.airT = setInterval(spray, 28); }
  requestDraw();
}
function moveDraw(e){
  if (!DS.active) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ce of (evs.length ? evs : [e])){
    const [lx, ly] = toImg(localPt(ce));
    if (SHAPE_TOOLS.includes(DS.tool)){ DS.cur = [lx, ly]; DS.shift = ce.shiftKey; continue; }
    DS.p = pressureOf(ce);
    { const now = performance.now(), dt = Math.max(1, now - DS.lastT), v = Math.hypot(lx - DS.raw0x, ly - DS.raw0y) / dt; DS.speed = DS.speed * 0.7 + (isFinite(v) ? v : 0) * 0.3; DS.lastT = now; DS.raw0x = lx; DS.raw0y = ly; }
    const st = S.draw[DS.tool], s = DS.tool === 'pencil' || DS.tool === 'air' ? 0 : (st.smooth || 0) / 100;
    DS.sm = [DS.sm[0] + (lx - DS.sm[0]) * (1 - s), DS.sm[1] + (ly - DS.sm[1]) * (1 - s)];
    if (DS.tool === 'air'){ DS.last = [lx, ly]; continue; }
    segment(DS.last, DS.sm); DS.last = DS.sm.slice(); DS.raw = [lx, ly];
  }
  if (SHAPE_TOOLS.includes(DS.tool)) drawShape();
  requestDraw();
}
function endDraw(){
  if (!DS.active) return;
  clearInterval(DS.airT);
  if (DS.raw && !SHAPE_TOOLS.includes(DS.tool) && DS.tool !== 'air'){ segment(DS.last, DS.raw); }
  if (DS.tool === 'pen' && S.draw.pen.style !== 'calligraphy'){ const g = DS.ctx; g.globalAlpha = penAlpha(); g.beginPath(); g.moveTo(DS.mid[0], DS.mid[1]); g.lineTo(DS.last[0], DS.last[1]); g.lineWidth = penWidth(); g.lineCap = 'round'; g.stroke(); g.globalAlpha = 1; }
  DS.raw = null;
  commitStroke();
}
const localPt = ev => { const r = view.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
const penWidth = () => {
  const st = S.draw.pen; let w = st.size * sizeScale(st, DS.p);
  if (st.style === 'ballpoint') w *= 0.7;
  else if (st.style === 'brushpen'){ const sp = Math.min(1, DS.speed / 1.6); w *= 1.25 - 1.05 * sp; }
  return Math.max(0.5, w);
};
const penAlpha = () => { const st = S.draw.pen; return opScale(st, DS.p); };
// a flat nib: the line's width depends on its direction
function nibSegment(a, b){
  const st = S.draw.pen, g = DS.ctx, nib = st.angle * Math.PI / 180, w = st.size * sizeScale(st, DS.p);
  const nx = Math.cos(nib) * w / 2, ny = -Math.sin(nib) * w / 2;
  g.globalAlpha = penAlpha(); g.beginPath(); g.moveTo(a[0] + nx, a[1] + ny); g.lineTo(b[0] + nx, b[1] + ny); g.lineTo(b[0] - nx, b[1] - ny); g.lineTo(a[0] - nx, a[1] - ny); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(a[0] + nx, a[1] + ny); g.lineTo(a[0] - nx, a[1] - ny); g.lineWidth = 1; g.stroke(); g.globalAlpha = 1;
  grow(a[0], a[1], w); grow(b[0], b[1], w);
}
function segment(a, b){
  const t = DS.tool, g = DS.ctx;
  if (t === 'pencil'){ pencilLine(a[0], a[1], b[0], b[1]); return; }
  if (t === 'pen'){
    const st = S.draw.pen;
    if (st.style === 'calligraphy'){ nibSegment(a, b); return; }
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], w = penWidth();
    g.globalAlpha = penAlpha();
    if (st.style === 'felt'){ g.beginPath(); g.moveTo(DS.mid[0], DS.mid[1]); g.quadraticCurveTo(a[0], a[1], mid[0], mid[1]); g.lineWidth = w * 1.25; g.lineCap = 'round'; g.lineJoin = 'round'; g.globalAlpha = penAlpha() * 0.45; g.stroke(); g.globalAlpha = penAlpha(); }
    g.beginPath(); g.moveTo(DS.mid[0], DS.mid[1]); g.quadraticCurveTo(a[0], a[1], mid[0], mid[1]);
    g.lineWidth = st.style === 'felt' ? w * 0.75 : w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); g.globalAlpha = 1; DS.mid = mid; grow(a[0], a[1], w * 1.3); grow(b[0], b[1], w * 1.3); return;
  }
  const st = S.draw[t], size = st.size * sizeScale(st, DS.p);
  DS.dir = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const step = t === 'marker' ? Math.max(0.6, size * 0.06) : Math.max(0.6, size * (st.style === 'bristle' ? Math.min(st.spacing, 8) : st.spacing) / 100);
  const dx = b[0] - a[0], dy = b[1] - a[1], dist = Math.hypot(dx, dy);
  let d = step - DS.rem;
  while (d <= dist){ const x = a[0] + dx * d / dist, y = a[1] + dy * d / dist; t === 'marker' ? markerDab(x, y) : brushDab(x, y); d += step; }
  DS.rem = dist - (d - step);
}
// pencil: aliased pixels, Bresenham between integer points
let discCache = {};
function pencilDot(x, y){
  const st = S.draw.pencil, n = Math.max(1, st.size | 0), g = DS.ctx, sty = st.style;
  if (sty === 'grainy'){ const h = Math.floor(n / 2); for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++){ const dx = xx + 0.5 - n / 2, dy = yy + 0.5 - n / 2; const px = x - h + xx, py = y - h + yy; let hsh = (px * 374761393 + py * 668265263) | 0; hsh = ((hsh ^ (hsh >> 13)) * 1274126177) | 0; if (dx * dx + dy * dy <= n * n / 4 && ((hsh >>> 8) & 255) < 110) g.fillRect(px, py, 1, 1); } grow(x, y, n); return; }
  if (sty === 'sketch'){ const sp = Math.max(1, Math.round(n * 0.7)), d = Math.max(1, Math.round(n / 4)); if (!DS.sk) DS.sk = [0, 1, 2].map(() => [Math.round((Math.random() - 0.5) * sp * 2), Math.round((Math.random() - 0.5) * sp * 2)]); g.globalAlpha = 0.45; for (const [ox, oy] of DS.sk) g.fillRect(x + ox - (d >> 1), y + oy - (d >> 1), d, d); g.globalAlpha = 1; grow(x, y, n + sp); return; }
  if (n === 1){ g.fillRect(x, y, 1, 1); grow(x, y, 1); if (sty === 'round' || sty === 'square' || !sty) pixelPerfect(x, y); return; }
  const h = Math.floor(n / 2);
  if (sty === 'square' || st.tip === 'square' && sty === 'round' && false){ g.fillRect(x - h, y - h, n, n); grow(x, y, n); return; }
  let rows = discCache[n];
  if (!rows){ rows = []; const r = n / 2; for (let yy = 0; yy < n; yy++){ const cy = yy + 0.5 - r, half = Math.sqrt(Math.max(0, r * r - cy * cy)); const x0 = Math.round(r - half), x1 = Math.round(r + half); if (x1 > x0) rows.push([yy, x0, x1 - x0]); } discCache[n] = rows; }
  for (const [yy, xx, ww] of rows) g.fillRect(x - h + xx, y - h + yy, ww, 1);
  grow(x, y, n);
}
function pencilLine(x0, y0, x1, y1){
  x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.floor(x1); y1 = Math.floor(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
  for (;;){ pencilDot(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy){ err += dy; x0 += sx; } if (e2 <= dx){ err += dx; y0 += sy; } }
}
// brush: soft round dab, cached per size/hardness/color
let dabCache = { key: '', c: null };
let noiseCv = null;
function noiseCanvas(){
  if (noiseCv) return noiseCv;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), id = g.createImageData(128, 128), d = id.data;
  let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 128 * 128; i++){ const v = rnd(); d[i * 4 + 3] = v < 0.35 ? 0 : v < 0.6 ? 110 : 255; }
  g.putImageData(id, 0, 0); return noiseCv = c;
}
let dryCv = { key: '', c: null };
function dryCanvas(col){
  const key = hex6(col); if (dryCv.key === key) return dryCv.c;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = csso(col); g.fillRect(0, 0, 128, 128); g.globalCompositeOperation = 'destination-in'; g.drawImage(noiseCanvas(), 0, 0);
  dryCv = { key, c }; return c;
}
function makeDab(style, hard, col){
  const c = document.createElement('canvas'); c.width = c.height = 128; const cg = c.getContext('2d'), rgb = col.r + ',' + col.g + ',' + col.b;
  const gr = cg.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (style === 'hard'){ cg.fillStyle = 'rgb(' + rgb + ')'; cg.beginPath(); cg.arc(64, 64, 63, 0, Math.PI * 2); cg.fill(); return c; }
  if (style === 'watercolor'){ gr.addColorStop(0, 'rgba(' + rgb + ',0.35)'); gr.addColorStop(0.75, 'rgba(' + rgb + ',0.45)'); gr.addColorStop(0.93, 'rgba(' + rgb + ',0.9)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)'); }
  else { gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(Math.min(0.99, hard / 100), 'rgba(' + rgb + ',1)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)'); }
  cg.fillStyle = gr; cg.fillRect(0, 0, 128, 128);
  if (style === 'chalk'){ cg.globalCompositeOperation = 'destination-in'; cg.drawImage(noiseCanvas(), 0, 0); }
  return c;
}
function brushDab(x, y){
  const st = S.draw.brush, size = Math.max(1, st.size * sizeScale(st, DS.p)), g = DS.ctx, sty = st.style;
  const key = sty + '|' + st.hard + '|' + hex6(DS.color);
  if (dabCache.key !== key) dabCache = { key, c: makeDab(sty, st.hard, DS.color) };
  const flow = st.flow / 100 * opScale(st, DS.p);
  if (sty === 'bristle'){
    const n = Math.max(4, Math.round(size / 3)), px = -Math.sin(DS.dir), py = Math.cos(DS.dir); let seed = ((x * 73 + y * 151) | 0) & 0xffff;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    g.globalAlpha = flow;
    for (let i = 0; i < n; i++){ const t = (i + 0.5) / n - 0.5, off = t * size * (0.9 + 0.2 * rnd()), hs = size * (0.08 + 0.12 * rnd()); g.beginPath(); g.arc(x + px * off, y + py * off, hs, 0, Math.PI * 2); g.fillStyle = csso(DS.color); g.fill(); }
    g.globalAlpha = 1; grow(x, y, size / 2); return;
  }
  if (sty === 'splatter'){
    g.globalAlpha = flow; g.fillStyle = csso(DS.color);
    const n = Math.max(3, Math.round(size / 4));
    for (let i = 0; i < n; i++){ const a = Math.random() * Math.PI * 2, d = size * 0.7 * Math.sqrt(Math.random()), r = size * (0.03 + 0.09 * Math.random() * Math.random()); g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(0.5, r), 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1; grow(x, y, size * 0.8); return;
  }
  g.globalAlpha = sty === 'watercolor' ? Math.min(1, flow * 0.8) : flow;
  if (sty === 'chalk'){ g.save(); g.translate(x, y); g.rotate(((x * 7 + y * 13) % 360) * Math.PI / 180); g.drawImage(dabCache.c, -size / 2, -size / 2, size, size); g.restore(); }
  else g.drawImage(dabCache.c, x - size / 2, y - size / 2, size, size);
  g.globalAlpha = 1; grow(x, y, size / 2);
}
function markerDab(x, y){
  const st = S.draw.marker, g = DS.ctx, s = st.size * sizeScale(st, DS.p), sty = st.style;
  g.globalAlpha = opScale(st, DS.p);
  if (sty === 'highlighter'){ g.fillRect(x - s * 0.14, y - s * 0.5, s * 0.28, s); g.globalAlpha = 1; grow(x, y, s / 2); return; }
  if (sty === 'dry'){
    g.save(); g.translate(x, y); g.rotate(-st.angle * Math.PI / 180); g.beginPath(); g.ellipse(0, 0, s / 2, Math.max(0.8, s * 0.16), 0, 0, Math.PI * 2); g.clip();
    g.drawImage(dryCanvas(DS.color), -s / 2, -s / 2, s, s); g.restore(); g.globalAlpha = 1; grow(x, y, s / 2); return;
  }
  g.beginPath();
  if (sty === 'chisel') g.ellipse(x, y, s / 2, Math.max(0.8, s * 0.16), st.angle * Math.PI / 180, 0, Math.PI * 2);
  else g.arc(x, y, s / 2, 0, Math.PI * 2);
  g.fill(); g.globalAlpha = 1; grow(x, y, s / 2);
}
function spray(){
  const st = S.draw.air, g = DS.ctx, [x, y] = DS.last, size = st.size * sizeScale(st, DS.p), r = size / 2, sty = st.style;
  const flow = st.flow / 100 * opScale(st, DS.p);
  if (sty === 'soft'){
    const key = 'air|' + hex6(DS.color); if (dabCache.key !== key) dabCache = { key, c: makeDab('soft', 0, DS.color) };
    g.globalAlpha = Math.min(1, flow * 0.4 * Math.max(0.2, st.density / 50)); g.drawImage(dabCache.c, x - r, y - r, size, size); g.globalAlpha = 1; grow(x, y, r); requestDraw(); return;
  }
  const n = Math.max(2, Math.round(st.density * size / (sty === 'spatter' ? 120 : sty === 'stipple' ? 60 : 25)));
  g.globalAlpha = flow; g.fillStyle = csso(DS.color);
  for (let i = 0; i < n; i++){
    const a = Math.random() * Math.PI * 2, d = r * Math.sqrt(Math.random()), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    if (sty === 'fine') g.fillRect(px, py, 1.2, 1.2);
    else if (sty === 'coarse'){ const k = 1.5 + Math.random() * 2.5; g.fillRect(px, py, k, k); }
    else if (sty === 'stipple'){ g.beginPath(); g.arc(px, py, Math.max(0.8, size / 14), 0, Math.PI * 2); g.fill(); }
    else { g.beginPath(); g.arc(px, py, Math.max(0.6, size * (0.02 + 0.1 * Math.random() * Math.random())), 0, Math.PI * 2); g.fill(); }
  }
  g.globalAlpha = 1; grow(x, y, r); requestDraw();
}
function dashFor(kind, w){ return kind === 'dash' ? [w * 3, w * 2] : kind === 'dot' ? [0.1, w * 2] : kind === 'dashdot' ? [w * 3, w * 1.5, 0.1, w * 1.5] : []; }
function drawShape(){
  const g = DS.ctx, sh = S.shape, t = DS.tool;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  let [x0, y0] = DS.start, [x1, y1] = DS.cur;
  if (DS.shift){
    if (t === 'line'){ const a = Math.round(Math.atan2(y1 - y0, x1 - x0) / (Math.PI / 4)) * (Math.PI / 4), l = Math.hypot(x1 - x0, y1 - y0); x1 = x0 + Math.cos(a) * l; y1 = y0 + Math.sin(a) * l; }
    else { const s = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); x1 = x0 + Math.sign(x1 - x0 || 1) * s; y1 = y0 + Math.sign(y1 - y0 || 1) * s; }
  }
  const strokeC = DS.btn === 2 ? S.c2 : S.c1, fillC = DS.btn === 2 ? S.c1 : S.c2, w = sh.width;
  g.lineWidth = w; g.lineCap = sh.cap; g.lineJoin = sh.cap === 'square' ? 'miter' : sh.cap === 'butt' ? 'bevel' : 'round'; g.setLineDash(dashFor(sh.dash, w));
  g.strokeStyle = cssc(strokeC); g.fillStyle = cssc(sh.style === 'fill' ? strokeC : fillC);
  const rx = Math.min(x0, x1), ry = Math.min(y0, y1), rw = Math.abs(x1 - x0), rh = Math.abs(y1 - y0);
  g.beginPath();
  if (t === 'line'){
    g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]);
    const head = (ax, ay, bx, by) => { const a = Math.atan2(by - ay, bx - ax), L = Math.max(8, w * 3.2), s = Math.PI / 7; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - L * Math.cos(a - s), by - L * Math.sin(a - s)); g.lineTo(bx - L * Math.cos(a + s), by - L * Math.sin(a + s)); g.closePath(); g.fillStyle = cssc(strokeC); g.fill(); };
    if (sh.arrow === 'end' || sh.arrow === 'both') head(x0, y0, x1, y1);
    if (sh.arrow === 'start' || sh.arrow === 'both') head(x1, y1, x0, y0);
  } else {
    if (t === 'rect') g.rect(rx, ry, rw, rh);
    else if (t === 'ellipse') g.ellipse(rx + rw / 2, ry + rh / 2, Math.max(0.5, rw / 2), Math.max(0.5, rh / 2), 0, 0, Math.PI * 2);
    else { const k = Math.min(sh.radius, rw / 2, rh / 2); g.moveTo(rx + k, ry); g.arcTo(rx + rw, ry, rx + rw, ry + rh, k); g.arcTo(rx + rw, ry + rh, rx, ry + rh, k); g.arcTo(rx, ry + rh, rx, ry, k); g.arcTo(rx, ry, rx + rw, ry, k); g.closePath(); }
    if (sh.style !== 'stroke') g.fill();
    if (sh.style !== 'fill') g.stroke();
  }
  g.setLineDash([]);
  const pad = w * 4 + 4;
  DS.bbox = [Math.min(x0, x1) - pad, Math.min(y0, y1) - pad, Math.max(x0, x1) + pad, Math.max(y0, y1) + pad];
}
// blend the stroke canvas into the layer's pixels (current frame, or every frame)
function commitStroke(){
  DS.active = false;
  if (DS.mirror){ mirrorBake(); DS.mirror = false; }
  const bb = DS.bbox; if (!bb){ requestDraw(); return; }
  const x0 = Math.max(0, Math.floor(bb[0])), y0 = Math.max(0, Math.floor(bb[1])), x1 = Math.min(W, Math.ceil(bb[2])), y1 = Math.min(H, Math.ceil(bb[3]));
  if (x1 <= x0 || y1 <= y0){ requestDraw(); return; }
  const bw = x1 - x0, bh = y1 - y0, sd = DS.ctx.getImageData(x0, y0, bw, bh);
  if (DS.hard){ const a = sd.data; for (let p = 3; p < a.length; p += 4) a[p] = a[p] >= 128 ? 255 : 0; }
  const src = DS.hard ? toCanvas(sd.data, bw, bh) : null;
  let any = false; for (let p = 3; p < sd.data.length; p += 4) if (sd.data[p]){ any = true; break; }
  if (!any){ requestDraw(); return; }
  const fs = (S.scopeAll && frames.length > 1) ? frames.map((_, i) => i) : [S.cur];
  const entry = paintSnapshot(fs, x0, y0, x1, y1);
  const tmp = document.createElement('canvas'); tmp.width = bw; tmp.height = bh; const tg = tmp.getContext('2d', { willReadFrequently: true });
  const pxs = pixSnapper();
  for (const f of fs){
    const fr = frames[f], m = masks[f], vis = new ImageData(bw, bh), vd = vis.data;
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++){ const gi = (y0 + y) * W + x0 + x, o = gi * 4, k = (y * bw + x) * 4; vd[k] = fr[o]; vd[k + 1] = fr[o + 1]; vd[k + 2] = fr[o + 2]; vd[k + 3] = (fr[o + 3] * m[gi] + 127) / 255; }
    tg.globalCompositeOperation = 'source-over'; tg.globalAlpha = 1; tg.putImageData(vis, 0, 0);
    tg.globalAlpha = DS.opacity; tg.globalCompositeOperation = DS.blend;
    if (src) tg.drawImage(src, 0, 0); else tg.drawImage(DS.canvas, x0, y0, bw, bh, 0, 0, bw, bh);
    const res = tg.getImageData(0, 0, bw, bh).data, sa = sd.data;
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++){
      const k = (y * bw + x) * 4; if (!sa[k + 3]) continue;
      const gi = (y0 + y) * W + x0 + x, o = gi * 4;
      fr[o] = res[k]; fr[o + 1] = res[k + 1]; fr[o + 2] = res[k + 2]; fr[o + 3] = DS.lock ? vd[k + 3] : res[k + 3]; m[gi] = 255;
      if (pxs) pxs(fr, o);
    }
  }
  pushPaint(entry); resetEdges(); renderRect(x0, y0, x1, y1);
  DS.ctx.clearRect(0, 0, W, H); requestDraw();
}

// ---------- fill ----------
function fillAt(p, secondary){
  if (!ensureDrawableAt(p)) return;
  const [fx, fy] = toImg(p), sx = Math.floor(fx), sy = Math.floor(fy);
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
  const c = secondary ? S.c2 : S.c1, N = W * H, all = $('#fAll').checked;
  let buf, get;
  if (all){ const comp = composeDoc(S.dcur, false), ox = AL.x, oy = AL.y;
    get = i => { const x = i % W + ox, y = ((i / W) | 0) + oy; if (x < 0 || y < 0 || x >= DocW || y >= DocH) return [0, 0, 0, 0]; const o = (y * DocW + x) * 4; return [comp[o], comp[o + 1], comp[o + 2], comp[o + 3]]; }; }
  else { buf = layerVisible(AL, S.cur); get = i => [buf[i * 4], buf[i * 4 + 1], buf[i * 4 + 2], buf[i * 4 + 3]]; }
  const seed = get(sy * W + sx), tol = S.fTol * 2.2, soft = $('#fAA').checked && !pixHard();
  const amt = i => {
    const q = get(i); let dr = q[0] - seed[0], dg = q[1] - seed[1], db = q[2] - seed[2], da = q[3] - seed[3];
    if (seed[3] < 8 && q[3] < 8) return 1;
    const d = Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9 + da * da);
    if (tol <= 0) return d < 1 ? 1 : 0;
    const inner = tol * (soft ? 0.7 : 1); return d <= inner ? 1 : d >= tol ? 0 : 1 - (d - inner) / (tol - inner);
  };
  const cov = new Float32Array(N);
  if (!$('#fContig').checked){ for (let i = 0; i < N; i++) cov[i] = amt(i); }
  else {
    const vis = new Uint8Array(N); let q = new Int32Array(1 << 16), qh = 0, qt = 0;
    const push = v => { if (qt >= q.length){ if (qh > q.length / 2){ q.copyWithin(0, qh, qt); qt -= qh; qh = 0; } else { const nq = new Int32Array(q.length * 2); nq.set(q); q = nq; } } q[qt++] = v; };
    const s0 = sy * W + sx; vis[s0] = 1; push(s0);
    while (qh < qt){
      const i = q[qh++], a = amt(i); cov[i] = a; if (a < 0.5) continue;
      const x = i % W;
      if (x > 0 && !vis[i - 1]){ vis[i - 1] = 1; push(i - 1); }
      if (x < W - 1 && !vis[i + 1]){ vis[i + 1] = 1; push(i + 1); }
      if (i >= W && !vis[i - W]){ vis[i - W] = 1; push(i - W); }
      if (i + W < N && !vis[i + W]){ vis[i + W] = 1; push(i + W); }
    }
  }
  strokeCanvasReady();
  const id = DS.ctx.createImageData(W, H), d = id.data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let i = 0; i < N; i++){ let a = cov[i]; if (!soft) a = a >= 0.5 ? 1 : 0; if (a <= 0) continue; const o = i * 4; d[o] = c.r; d[o + 1] = c.g; d[o + 2] = c.b; d[o + 3] = a * 255; const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return;
  DS.ctx.putImageData(id, 0, 0);
  DS.bbox = [x0, y0, x1 + 1, y1 + 1]; DS.opacity = S.fOpacity / 100 * c.a / 255; DS.blend = 'source-over'; DS.lock = false; DS.hard = pixHard(); if (pixHard()) DS.opacity = 1;
  commitStroke(); sbFlash('Filled with ' + hexA(c) + '.');
}

// ---------- pick color ----------
function sampleDocAt(dx, dy, allLayers){
  const x = Math.floor(dx), y = Math.floor(dy);
  if (x < 0 || y < 0 || x >= DocW || y >= DocH) return null;
  saveActive();
  let R = 0, G = 0, B = 0, A = 0;
  for (const L of (allLayers ? layers : [AL])){
    if (allLayers && !L.visible) continue;
    const lx = x - L.x, ly = y - L.y; if (lx < 0 || ly < 0 || lx >= L.W || ly >= L.H) continue;
    const fi = S.dcur % L.frames.length, i = ly * L.W + lx, o = i * 4, f = L.frames[fi];
    const a = f[o + 3] / 255 * L.masks[fi][i] / 255 * (allLayers ? L.opacity : 1);
    R = f[o] * a + R * (1 - a); G = f[o + 1] * a + G * (1 - a); B = f[o + 2] * a + B * (1 - a); A = a + A * (1 - a);
  }
  if (A <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  return { r: Math.round(R / A), g: Math.round(G / A), b: Math.round(B / A), a: Math.round(A * 255) };
}
function pickColorAt(p, secondary){
  const [dx, dy] = toDoc(p), c = sampleDocAt(dx, dy, $('#pkAll').checked);
  if (!c) return;
  setColor(secondary ? 2 : 1, c);
  $('#pkLast').textContent = 'Picked ' + hexA(c) + ' as the ' + (secondary ? 'secondary' : 'primary') + ' color.';
  sbFlash($('#pkLast').textContent);
}

// ---------- text ----------
var TE = null;
const tEl = () => $('#textEdit');
function textFont(scale){ return ($('#tItalic').checked ? 'italic ' : '') + ($('#tBold').checked ? 'bold ' : '') + Math.max(1, +$('#tSize').value * scale) + 'px "' + $('#tFont').value + '", sans-serif'; }
function styleTextEdit(){
  const el = tEl(); if (!TE) return;
  el.style.font = textFont(S.zoom); el.style.color = cssc(S.c1); el.style.textAlign = $('#tAlign').value;
  el.style.textDecoration = $('#tUnder').checked ? 'underline' : 'none';
  const ol = +$('#tOutline').value; el.style.webkitTextStroke = ol ? (ol * S.zoom) + 'px ' + cssc(S.c2) : '0'; el.style.paintOrder = 'stroke fill';
  el.style.width = '10px'; el.style.height = '10px';
  el.style.width = Math.max(40, el.scrollWidth + 6) + 'px'; el.style.height = Math.max(+$('#tSize').value * S.zoom * 1.25, el.scrollHeight + 2) + 'px';
}
function positionTextEdit(){ if (!TE) return; const el = tEl(); el.style.left = (S.panX + TE.dx * S.zoom) + 'px'; el.style.top = (S.panY + TE.dy * S.zoom) + 'px'; }
function textClick(p){
  if (TE){ textCommit(); return; }
  if (!W) return;
  const [dx, dy] = toDoc(p); TE = { dx, dy, z: S.zoom };
  const el = tEl(); el.value = ''; el.hidden = false; styleTextEdit(); positionTextEdit(); setTimeout(() => el.focus(), 0);
  sbFlash('Type your text. Ctrl+Enter places it, Esc cancels.');
}
function textCancel(){ if (!TE) return; TE = null; tEl().hidden = true; }
function textCommit(){
  if (!TE) return; const t = TE, el = tEl(), txt = el.value; TE = null; el.hidden = true;
  if (!txt.trim()) return;
  const size = Math.max(1, +$('#tSize').value), ol = +$('#tOutline').value, shd = +$('#tShadow').value, lines = txt.split('\n'), lh = size * 1.2;
  const m = document.createElement('canvas').getContext('2d'); m.font = textFont(1);
  const widths = lines.map(l => m.measureText(l).width), maxW = Math.max(1, ...widths);
  const pad = Math.ceil(ol + shd * 2 + 4), w = Math.ceil(maxW + pad * 2), h = Math.ceil(lines.length * lh + pad * 2 + size * 0.15);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true });
  g.font = textFont(1); g.textBaseline = 'top'; const al = $('#tAlign').value; g.textAlign = al;
  const xAt = (i) => al === 'left' ? pad : al === 'center' ? w / 2 : w - pad;
  const pass = (fn) => lines.forEach((l, i) => fn(l, xAt(i), pad + i * lh, widths[i]));
  if (shd){ g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = shd; g.shadowOffsetX = shd / 2; g.shadowOffsetY = shd / 2; g.fillStyle = cssc(S.c1); pass((l, x, y) => g.fillText(l, x, y)); g.restore(); }
  if (ol){ g.lineWidth = ol * 2; g.lineJoin = 'round'; g.strokeStyle = cssc(S.c2); pass((l, x, y) => g.strokeText(l, x, y)); }
  g.fillStyle = cssc(S.c1); pass((l, x, y) => g.fillText(l, x, y));
  if ($('#tUnder').checked) pass((l, x, y, lw) => { const sx = al === 'left' ? x : al === 'center' ? x - lw / 2 : x - lw; g.fillRect(sx, y + size * 1.02, lw, Math.max(1, size / 14)); });
  const data = g.getImageData(0, 0, w, h).data;
  if (pixHard()) pixHardenRGBA(data);
  const L = newLayerObj(w, h, [data], [docDelay(0) || 10], 'Text: ' + txt.replace(/\s+/g, ' ').trim().slice(0, 24));
  L.x = Math.round(t.dx - pad); L.y = Math.round(t.dy - pad);
  addLayer(L); sbFlash('Placed the text as a new layer. Use the Move tool to move or resize it.');
}
tEl().addEventListener('input', styleTextEdit);
tEl().addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape'){ e.preventDefault(); textCancel(); } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); textCommit(); } });
['tFont', 'tSize', 'tAlign', 'tBold', 'tItalic', 'tUnder'].forEach(id => $('#' + id).addEventListener('input', () => { if (TE) styleTextEdit(); }));
['tFont', 'tAlign', 'tBold', 'tItalic', 'tUnder'].forEach(id => $('#' + id).addEventListener('change', () => { if (TE) styleTextEdit(); }));
$('#tDone').addEventListener('click', textCommit);
$('#tCancel').addEventListener('click', textCancel);

// ---------- adjustments (preview on the canvas, apply to the layer) ----------
S.adj = { bright: 0, contrast: 0, sat: 0, hue: 0, temp: 0, gamma: 0, preset: 'none', levels: 4 };
const adjDefault = () => !S.adj.bright && !S.adj.contrast && !S.adj.sat && !S.adj.hue && !S.adj.temp && !S.adj.gamma && S.adj.preset === 'none';
function adjActive(){ return curPage === 'adjust' && !adjDefault(); }
function adjFn(){
  const A = S.adj, lut = new Uint8ClampedArray(256), cc = A.contrast * 2.55, cf = (259 * (cc + 255)) / (255 * (259 - cc)), ge = Math.pow(2, -A.gamma / 50);
  for (let v = 0; v < 256; v++){ let x = v + A.bright * 1.28; x = cf * (x - 128) + 128; x = 255 * Math.pow(Math.max(0, Math.min(255, x)) / 255, ge); lut[v] = x; }
  const s = 1 + A.sat / 100, t = A.temp * 0.6, ha = A.hue * Math.PI / 180, cs = Math.cos(ha), sn = Math.sin(ha);
  const M = [0.213 + cs * 0.787 - sn * 0.213, 0.715 - cs * 0.715 - sn * 0.715, 0.072 - cs * 0.072 + sn * 0.928,
             0.213 - cs * 0.213 + sn * 0.143, 0.715 + cs * 0.285 + sn * 0.140, 0.072 - cs * 0.072 - sn * 0.283,
             0.213 - cs * 0.213 - sn * 0.787, 0.715 - cs * 0.715 + sn * 0.715, 0.072 + cs * 0.928 + sn * 0.072];
  const lv = Math.max(2, A.levels | 0), step = 255 / (lv - 1), hue = A.hue !== 0, pre = A.preset;
  return (d, o) => {
    let r = lut[d[o]], g = lut[d[o + 1]], b = lut[d[o + 2]];
    if (t){ r += t; b -= t; }
    if (hue){ const R = r, G = g, B = b; r = M[0] * R + M[1] * G + M[2] * B; g = M[3] * R + M[4] * G + M[5] * B; b = M[6] * R + M[7] * G + M[8] * B; }
    if (s !== 1){ const l = 0.2126 * r + 0.7152 * g + 0.0722 * b; r = l + (r - l) * s; g = l + (g - l) * s; b = l + (b - l) * s; }
    if (pre !== 'none'){
      if (pre === 'gray'){ const l = 0.299 * r + 0.587 * g + 0.114 * b; r = g = b = l; }
      else if (pre === 'sepia'){ const R = r, G = g, B = b; r = 0.393 * R + 0.769 * G + 0.189 * B; g = 0.349 * R + 0.686 * G + 0.168 * B; b = 0.272 * R + 0.534 * G + 0.131 * B; }
      else if (pre === 'invert'){ r = 255 - r; g = 255 - g; b = 255 - b; }
      else if (pre === 'posterize'){ r = Math.round(r / step) * step; g = Math.round(g / step) * step; b = Math.round(b / step) * step; }
      else if (pre === 'threshold'){ const l = 0.299 * r + 0.587 * g + 0.114 * b; r = g = b = l >= 128 ? 255 : 0; }
    }
    d[o] = r; d[o + 1] = g; d[o + 2] = b;
  };
}
function adjustRect(d, x0, y0, x1, y1){ const fn = adjFn(); for (let y = y0; y < y1; y++) for (let x = x0, o = (y * W + x0) * 4; x < x1; x++, o += 4) fn(d, o); }
let adjRaf = 0;
function adjPreview(){ if (!adjRaf) adjRaf = requestAnimationFrame(() => { adjRaf = 0; if (W) renderRect(0, 0, W, H); }); }
[['aBright', 'bright', v => (v > 0 ? '+' : '') + v], ['aContrast', 'contrast', v => (v > 0 ? '+' : '') + v], ['aSat', 'sat', v => (v > 0 ? '+' : '') + v], ['aHue', 'hue', v => v + '°'], ['aTemp', 'temp', v => (v > 0 ? 'warmer ' : v < 0 ? 'cooler ' : '') + Math.abs(v)], ['aGamma', 'gamma', v => (v > 0 ? '+' : '') + v], ['aLevels', 'levels', v => v]]
  .forEach(([id, k, f]) => { const el = $('#' + id); const up = () => { S.adj[k] = +el.value; $('#' + id + 'Out').textContent = f(+el.value); adjPreview(); }; el.addEventListener('input', up); up(); });
$('#aPreset').addEventListener('change', e => { S.adj.preset = e.target.value; $('#aLevelsRow').hidden = e.target.value !== 'posterize'; adjPreview(); });
function adjReset(){ ['aBright', 'aContrast', 'aSat', 'aHue', 'aTemp', 'aGamma'].forEach(id => { $('#' + id).value = 0; $('#' + id).dispatchEvent(new Event('input')); }); $('#aPreset').value = 'none'; S.adj.preset = 'none'; $('#aLevelsRow').hidden = true; adjPreview(); }
function layerFrames(){ return (S.scopeAll && frames.length > 1) ? frames.map((_, i) => i) : [S.cur]; }
function applyPixels(fn, msg){
  if (!AL) return; if (AL.locked){ toast('The selected layer is locked.'); return; }
  const fs = layerFrames(), entry = paintSnapshot(fs, 0, 0, W, H);
  for (const f of fs) fn(frames[f], masks[f], f);
  pushPaint(entry); resetEdges(); invalidateRefine(); renderRect(0, 0, W, H); if (msg) toast(msg);
}
$('#aApply').addEventListener('click', () => { if (adjDefault()){ toast('Move a slider or choose a look first.'); return; } const fn = adjFn(); applyPixels(fr => { for (let o = 0; o < fr.length; o += 4) fn(fr, o); }, 'Adjusted the layer colors.'); adjReset(); });
$('#aReset').addEventListener('click', adjReset);
$('#aAuto').addEventListener('click', () => applyPixels((fr, m) => {
  const hist = new Uint32Array(256); let n = 0;
  for (let i = 0, o = 0; i < m.length; i++, o += 4){ if (fr[o + 3] * m[i] < 255 * 16) continue; hist[(0.299 * fr[o] + 0.587 * fr[o + 1] + 0.114 * fr[o + 2]) | 0]++; n++; }
  if (!n) return; let lo = 0, hi = 255, c = 0; while (lo < 255 && (c += hist[lo]) < n * 0.005) lo++; c = 0; while (hi > 0 && (c += hist[hi]) < n * 0.005) hi--;
  if (hi <= lo) return; const k = 255 / (hi - lo); for (let o = 0; o < fr.length; o += 4){ fr[o] = (fr[o] - lo) * k; fr[o + 1] = (fr[o + 1] - lo) * k; fr[o + 2] = (fr[o + 2] - lo) * k; }
}, 'Stretched the contrast.'));

// ---------- effects ----------
function premul(fr, m){ const N = m.length, p = new Float32Array(N * 4); for (let i = 0, o = 0; i < N; i++, o += 4){ const a = fr[o + 3] * m[i] / 255 / 255; p[o] = fr[o] * a; p[o + 1] = fr[o + 1] * a; p[o + 2] = fr[o + 2] * a; p[o + 3] = a; } return p; }
function unpremul(p, fr, m){ for (let i = 0, o = 0; i < m.length; i++, o += 4){ const a = p[o + 3]; if (a > 1e-4){ fr[o] = p[o] / a; fr[o + 1] = p[o + 1] / a; fr[o + 2] = p[o + 2] / a; } fr[o + 3] = a * 255; m[i] = 255; } }
function boxPass(p, w, h, r){
  if (r < 1) return; const t = new Float32Array(p.length), d = 2 * r + 1;
  for (let y = 0; y < h; y++) for (let c = 0; c < 4; c++){
    let s = 0; for (let k = -r; k <= r; k++) s += p[(y * w + clamp(k, 0, w - 1)) * 4 + c];
    for (let x = 0; x < w; x++){ t[(y * w + x) * 4 + c] = s / d; s += p[(y * w + Math.min(w - 1, x + r + 1)) * 4 + c] - p[(y * w + Math.max(0, x - r)) * 4 + c]; }
  }
  for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++){
    let s = 0; for (let k = -r; k <= r; k++) s += t[(clamp(k, 0, h - 1) * w + x) * 4 + c];
    for (let y = 0; y < h; y++){ p[(y * w + x) * 4 + c] = s / d; s += t[(Math.min(h - 1, y + r + 1) * w + x) * 4 + c] - t[(Math.max(0, y - r) * w + x) * 4 + c]; }
  }
}
const gaussBlur = (p, w, h, r) => { const b = Math.max(1, Math.round(r / 1.7)); boxPass(p, w, h, b); boxPass(p, w, h, b); boxPass(p, w, h, b); };
rangeBind('eBlur', 'eBlur', v => v + ' px'); rangeBind('eSharp', 'eSharp', v => v + '%'); rangeBind('ePix', 'ePix', v => v + ' px');
rangeBind('eOut', 'eOut', v => v + ' px'); rangeBind('eShBlur', 'eShBlur', v => v + ' px'); rangeBind('eShOp', 'eShOp', v => v + '%');
$('#eBlurBtn').addEventListener('click', () => applyPixels((fr, m) => { const p = premul(fr, m); gaussBlur(p, W, H, S.eBlur); unpremul(p, fr, m); }, 'Blurred the layer.'));
$('#eSharpBtn').addEventListener('click', () => applyPixels((fr, m) => {
  const p = premul(fr, m), b = p.slice(); gaussBlur(b, W, H, 2); const k = S.eSharp / 100;
  for (let o = 0; o < p.length; o += 4){ const a = p[o + 3]; if (a <= 0) continue; for (let c = 0; c < 3; c++) p[o + c] = clamp(p[o + c] + k * (p[o + c] - b[o + c]), 0, 255 * a); }
  unpremul(p, fr, m);
}, 'Sharpened the layer.'));
$('#ePixBtn').addEventListener('click', () => applyPixels((fr, m) => {
  const n = S.ePix, p = premul(fr, m);
  for (let by = 0; by < H; by += n) for (let bx = 0; bx < W; bx += n){
    const s = [0, 0, 0, 0]; let c = 0;
    for (let y = by; y < Math.min(H, by + n); y++) for (let x = bx; x < Math.min(W, bx + n); x++){ const o = (y * W + x) * 4; s[0] += p[o]; s[1] += p[o + 1]; s[2] += p[o + 2]; s[3] += p[o + 3]; c++; }
    for (let y = by; y < Math.min(H, by + n); y++) for (let x = bx; x < Math.min(W, bx + n); x++){ const o = (y * W + x) * 4; p[o] = s[0] / c; p[o + 1] = s[1] / c; p[o + 2] = s[2] / c; p[o + 3] = s[3] / c; }
  }
  unpremul(p, fr, m);
}, 'Pixelated the layer.'));
// distance from every pixel to the nearest solid pixel (two-pass chamfer)
function distanceMap(alpha, w, h){
  const INF = 1e9, d = new Float32Array(w * h); for (let i = 0; i < w * h; i++) d[i] = alpha[i] >= 128 ? 0 : INF;
  const D = Math.SQRT2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ const i = y * w + x; let v = d[i]; if (x) v = Math.min(v, d[i - 1] + 1); if (y){ v = Math.min(v, d[i - w] + 1); if (x) v = Math.min(v, d[i - w - 1] + D); if (x < w - 1) v = Math.min(v, d[i - w + 1] + D); } d[i] = v; }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--){ const i = y * w + x; let v = d[i]; if (x < w - 1) v = Math.min(v, d[i + 1] + 1); if (y < h - 1){ v = Math.min(v, d[i + w] + 1); if (x < w - 1) v = Math.min(v, d[i + w + 1] + D); if (x) v = Math.min(v, d[i + w - 1] + D); } d[i] = v; }
  return d;
}
$('#eOutBtn').addEventListener('click', () => {
  if (!AL) return; if (AL.locked){ toast('The selected layer is locked.'); return; }
  const r = S.eOut, nw = W + 2 * r + 2, nh = H + 2 * r + 2, c = S.c1, ox = r + 1, nf = [], nm = [];
  busy(true);
  try {
    for (let f = 0; f < frames.length; f++){
      const vis = layerVisible(AL, f), a = new Uint8ClampedArray(nw * nh);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) a[(y + ox) * nw + x + ox] = vis[(y * W + x) * 4 + 3];
      const dm = distanceMap(a, nw, nh), out = new Uint8ClampedArray(nw * nh * 4);
      for (let i = 0; i < nw * nh; i++){ const cov = clamp(r + 0.5 - dm[i], 0, 1) * c.a; if (cov <= 0) continue; const o = i * 4; out[o] = c.r; out[o + 1] = c.g; out[o + 2] = c.b; out[o + 3] = cov; }
      const g = toCanvas(out, nw, nh).getContext('2d', { willReadFrequently: true }); g.drawImage(toCanvas(vis, W, H), ox, ox);
      nf.push(g.getImageData(0, 0, nw, nh).data); nm.push(new Uint8Array(nw * nh).fill(255));
    }
    replaceActive(nf, nm, nw, nh, AL.x - ox, AL.y - ox, 'Added a ' + r + ' px outline.');
  } finally { busy(false); }
});
$('#eShBtn').addEventListener('click', () => {
  if (!AL) return;
  const b = S.eShBlur, pad = b * 2 + 2, nw = W + 2 * pad, nh = H + 2 * pad, c = S.c2, k = S.eShOp / 100, fr = [];
  busy(true);
  try {
    for (let f = 0; f < frames.length; f++){
      const vis = layerVisible(AL, f), p = new Float32Array(nw * nh * 4);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){ p[((y + pad) * nw + x + pad) * 4 + 3] = vis[(y * W + x) * 4 + 3] / 255; }
      if (b) gaussBlur(p, nw, nh, b);
      const out = new Uint8ClampedArray(nw * nh * 4);
      for (let i = 0; i < nw * nh; i++){ const o = i * 4; out[o] = c.r; out[o + 1] = c.g; out[o + 2] = c.b; out[o + 3] = p[o + 3] * 255 * k * c.a / 255; }
      fr.push(out);
    }
    const L = newLayerObj(nw, nh, fr, delays, AL.name + ' shadow');
    L.x = AL.x - pad + (+$('#eShX').value || 0); L.y = AL.y - pad + (+$('#eShY').value || 0);
    addLayer(L, true); toast('Added a shadow layer below "' + AL.name + '".');
  } finally { busy(false); }
});

// ---------- pointer routing for the new tools ----------
const NEW_TOOLS = ['move', 'fill', 'picker', 'text', 'hintKeep', 'hintDrop', ...DRAW_TOOLS, ...SHAPE_TOOLS];
function handleToolDown(e, p){
  const t = S.tool; if (!NEW_TOOLS.includes(t)) return false;
  if (!W) return true;
  if (t === 'picker' || (e.altKey && (DRAW_TOOLS.includes(t) || SHAPE_TOOLS.includes(t) || t === 'fill'))){ pickColorAt(p, e.button === 2); return true; }
  if (t === 'move'){ if (e.button === 0) xfDown(e, p); return true; }
  if (t === 'hintKeep' || t === 'hintDrop') return hintDown(e, p);
  if (t === 'text'){ if (e.button === 0) textClick(p); return true; }
  if (AL.locked){ toast('The selected layer is locked. Unlock it in the Layers panel to draw on it.'); return true; }
  if (t === 'fill'){ fillAt(p, e.button === 2); return true; }
  if (e.button !== 0 && e.button !== 2) return false;
  beginDraw(e, p); return true;
}
function handleToolMove(e, p){
  if (XF && XF.drag){ xfMove(e, p); return true; }
  if (hintStroke){ hintMove(e, p); return true; }
  if (DS.active){ moveDraw(e); return true; }
  if (S.tool === 'move' && XF && !S.space){ const m = xfHit(p); view.style.cursor = XF_CURSOR[m] || 'default'; }
  return false;
}
function handleToolUp(e){ if (hintStroke){ hintUp(); return true; } if (XF && XF.drag){ xfUp(); return true; } if (DS.active){ endDraw(); return true; } return false; }
function beforeToolChange(t){
  if (XF && t !== 'move') xfCommit();
  if (TE && t !== 'text') textCommit();
  if (DRAW_TOOLS.includes(t)) setTimeout(() => loadDrawUI(t), 0);
  if (SHAPE_TOOLS.includes(t)) setTimeout(() => loadShapeUI(t), 0);
}
// brush outline for the drawing tools
function drawDrawCursor(){
  drawHintCursor();
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
