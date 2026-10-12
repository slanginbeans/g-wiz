// ---------- the window: pixel icons, status bar, tooltips, option pages, tool options box ----------

// ---------- pixel icons ----------
(function buildIcons(){
  const css = [];
  const toRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  for (const [name, art] of Object.entries(ICONS)){
    const rows = art.trim().split('\n');
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d'), id = g.createImageData(16, 16), dd = g.createImageData(16, 16);
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      const col = ICON_PAL[ch]; if (!col) return;
      const [R, G, B] = toRGB(col), o = (y * 16 + x) * 4;
      id.data[o] = R; id.data[o + 1] = G; id.data[o + 2] = B; id.data[o + 3] = 255;
    }));
    // classic disabled look: shape in gray with a white emboss one pixel down-right
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (!ICON_PAL[ch] || ch === 'w' || ch === 's') return;
      const put = (xx, yy, v) => { if (xx > 15 || yy > 15) return; const o = (yy * 16 + xx) * 4; if (dd.data[o + 3] && v === 255) return; dd.data[o] = dd.data[o + 1] = dd.data[o + 2] = v; dd.data[o + 3] = 255; };
      put(x + 1, y + 1, 255);
    }));
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (!ICON_PAL[ch] || ch === 'w' || ch === 's') return;
      const o = (y * 16 + x) * 4; dd.data[o] = dd.data[o + 1] = dd.data[o + 2] = 128; dd.data[o + 3] = 255;
    }));
    g.putImageData(id, 0, 0); const a = c.toDataURL();
    g.clearRect(0, 0, 16, 16); g.putImageData(dd, 0, 0); const b = c.toDataURL();
    css.push(`.ic[data-ic="${name}"]{--i:url(${a});--d:url(${b})}`);
  }
  const st = document.createElement('style'); st.textContent = css.join('\n'); document.head.appendChild(st);
})();
const setIcon = (el, name) => { if (el) el.querySelector('.ic') ? el.querySelector('.ic').dataset.ic = name : (el.dataset.ic = name); };

// ---------- status bar ----------
const DEFAULT_HELP = 'For Help, press F1.';
let sbMsgT = 0, sbHover = false;
function sbSet(text){ $('#sbHelp').textContent = text; }
function sbFlash(text, ms = 5000){ clearTimeout(sbMsgT); sbSet(text); sbMsgT = setTimeout(() => { if (!sbHover) sbSet(DEFAULT_HELP); }, ms); }
function updateStatus(){
  if (!W){ $('#sbSize').textContent = ''; return; }
  $('#sbSize').textContent = DocW + ' × ' + DocH + ' px' + (layers.length > 1 || W !== DocW || H !== DocH ? ' · layer ' + W + '×' + H : '');
  $('#sbZoom').textContent = $('#zoomVal').textContent;
  const nf = docFrames(); $('#sbFrame').textContent = nf > 1 ? 'Frame ' + (S.dcur + 1) + ' / ' + nf : (layers.length > 1 ? layers.length + ' layers' : '');
}
function updatePos(ix, iy){
  const dx = ix + LX(), dy = iy + LY();
  if (!W || dx < 0 || dy < 0 || dx >= DocW || dy >= DocH){ $('#sbPos').textContent = ''; return; }
  $('#sbPos').textContent = Math.floor(dx) + ', ' + Math.floor(dy) + ' px';
}

// ---------- tooltips (classic yellow) with help text in the status bar ----------
let tipT = 0, tipEl = null;
document.addEventListener('mouseover', e => {
  const el = e.target.closest('[data-tip],[data-help]'); if (el === tipEl) return;
  tipEl = el; clearTimeout(tipT); $('#tip').hidden = true;
  if (!el){ sbHover = false; sbSet(DEFAULT_HELP); return; }
  sbHover = true;
  sbSet(el.dataset.help || el.dataset.tip || DEFAULT_HELP);
  if (!el.dataset.tip || touchRecent()) return;
  tipT = setTimeout(() => {
    const t = $('#tip'); t.innerHTML = ''; t.append(el.dataset.tip);
    if (el.dataset.key){ const k = document.createElement('span'); k.className = 'k'; k.textContent = '(' + el.dataset.key + ')'; t.append(k); }
    t.hidden = false;
    const r = el.getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight;
    let x = r.left + 4, y = r.bottom + 4;
    if (x + tw > innerWidth - 4) x = innerWidth - tw - 4;
    if (y + th > innerHeight - 4) y = r.top - th - 4;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }, 480);
});
document.addEventListener('mousedown', () => { clearTimeout(tipT); $('#tip').hidden = true; }, true);

// ---------- option pages ----------
const PAGE_INFO = {
  brush: ['Eraser', 'eraser'], wand: ['Magic wand', 'wand'], crop: ['Crop', 'crop'], rotate: ['Flip and rotate', 'rotr'],
  view: ['View and image', 'hand'], auto: ['Remove background', 'auto'], specks: ['Remove specks', 'specks'],
  finish: ['Edge finishing', 'finish'], opacity: ['Opacity', 'opacity'], anim: ['Animation', 'anim'],
  motion: ['Motion finder', 'motion'], stab: ['Stabilize', 'stab'],
  draw: ['Drawing', 'brush'], shape: ['Shapes', 'rect'], fill: ['Fill with color', 'fill'], text: ['Text', 'text'], pick: ['Pick color', 'picker'],
  xform: ['Layer size and shape', 'shape'], adjust: ['Adjust colors', 'adjust'], effects: ['Effects', 'effects'], canvas: ['Canvas and image size', 'canvas']
};
const TOOL_PAGE = { erase: 'brush', restore: 'brush', wand: 'wand', crop: 'crop', track: 'stab', hand: 'view', zoom: 'view',
  move: 'xform', fill: 'fill', picker: 'pick', text: 'text', pencil: 'draw', pen: 'draw', brush: 'draw', marker: 'draw', air: 'draw',
  line: 'shape', rect: 'shape', ellipse: 'shape', rrect: 'shape' };
let curPage = 'brush';
function showPage(name){
  if (!PAGE_INFO[name]) return;
  const wasAdjust = curPage === 'adjust';
  curPage = name;
  if ((wasAdjust || name === 'adjust') && W) renderRect(0, 0, W, H);
  if (name === 'xform' || name === 'canvas') syncLayerProps();
  if (name === 'animate') updateAnimPage();
  $$('#pages > .page').forEach(p => p.hidden = p.dataset.page !== name);
  let [title, icon] = PAGE_INFO[name];
  if (name === 'brush' && S.tool === 'restore'){ title = 'Restore brush'; icon = 'restore'; }
  if (name === 'draw' && DRAW_INFO[S.tool]){ title = DRAW_INFO[S.tool][0]; icon = { pencil: 'pencil', pen: 'pen', brush: 'brush', marker: 'marker', air: 'airbrush' }[S.tool]; }
  if (name === 'shape' && SHAPE_NAMES[S.tool]){ title = SHAPE_NAMES[S.tool]; icon = S.tool; }
  $('#paneTitle').textContent = title; $('#paneIcon').dataset.ic = icon;
  $$('[data-page-btn]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pageBtn === name)));
  $('#pages').scrollTop = 0;
  if (name === 'auto' && S.autoPrev) scheduleAutoPreview();
}
$$('[data-page-btn]').forEach(b => b.addEventListener('click', () => showPage(b.dataset.pageBtn)));

// ---------- Paint-style tool options box under the toolbox ----------
function renderToolOpts(){
  if (typeof miniSync === 'function') miniSync();
  const box = $('#toolOpts'); box.innerHTML = '';
  const add = (label, pressed, fn, help, inner) => {
    const b = document.createElement('button'); b.className = 'to-btn'; b.type = 'button';
    b.setAttribute('aria-pressed', String(!!pressed)); if (help) b.dataset.help = help;
    if (inner) b.appendChild(inner); else b.textContent = label;
    b.addEventListener('click', () => { fn(); renderToolOpts(); }); box.appendChild(b);
  };
  const t = S.tool;
  if (t === 'erase' || t === 'restore'){
    [[8, 3], [20, 5], [40, 8], [90, 12]].forEach(([sz, dot]) => {
      const d = document.createElement('span'); d.className = 'dot'; d.style.width = d.style.height = dot + 'px';
      add('', Math.abs(S.size - sz) < 1, () => setSize(sz), 'Brush size ' + sz + ' ' + (S.rel === 'screen' ? 'screen' : 'image') + ' px', d);
    });
  } else if (t === 'wand'){
    [10, 24, 40, 60].forEach(v => add(v + '%', S.wtol === v, () => { S.wtol = v; $('#wtol').value = v; $('#wtol').dispatchEvent(new Event('input')); }, 'Wand tolerance ' + v + '%'));
  } else if (t === 'zoom' || t === 'hand'){
    [1, 2, 4, 8].forEach(z => add(z * 100 + '%', Math.abs(S.zoom - z) < 0.01, () => setZoom(z), 'Zoom to ' + z * 100 + '%'));
  } else if (t === 'crop'){
    [['free', 'Free'], ['1:1', '1:1'], ['4:3', '4:3'], ['16:9', '16:9']].forEach(([v, l]) => add(l, $('#caspect').value === v, () => { $('#caspect').value = v; setAspect(); }, 'Crop aspect ratio ' + l));
  } else if (t === 'track'){
    add('Clear', false, () => { S.track = null; requestDraw(); updateTrackHint(); }, 'Removes the track box');
  } else if (DRAW_TOOLS.includes(t)){
    const sizes = { pencil: [1, 2, 4, 8], pen: [2, 4, 8, 16], brush: [8, 20, 40, 80], marker: [8, 16, 28, 48], air: [16, 32, 60, 100] }[t];
    sizes.forEach((sz, i) => { const d = document.createElement('span'); d.className = 'dot'; const px = [2, 4, 7, 11][i]; d.style.width = d.style.height = px + 'px'; if (t === 'pencil' || (t === 'marker' && S.draw.marker.tip === 'chisel')) d.style.borderRadius = '0'; add('', S.draw[t].size === sz, () => setDrawSize(sz), 'Size ' + sz + ' px', d); });
  } else if (SHAPE_TOOLS.includes(t)){
    [1, 3, 6, 12].forEach(wd => { const d = document.createElement('span'); d.style.cssText = 'display:block;width:34px;height:' + Math.min(8, Math.max(1, Math.round(wd / 1.5))) + 'px;background:currentColor'; add('', S.shape.width === wd, () => setDrawSize(wd), 'Line width ' + wd + ' px', d); });
  } else if (t === 'move'){
    add('Auto pick', S.xAuto, () => { S.xAuto = !S.xAuto; }, 'When on, clicking a different layer on the canvas selects it.');
  }
}
