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
