// ---------- colors: primary/secondary color, palettes, recent colors, Edit Colors dialog ----------
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
