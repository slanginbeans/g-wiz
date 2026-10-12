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
