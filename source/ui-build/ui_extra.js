// ===================== G-WIZ shell: icons, menus, tooltips, pages, tools, stabilize, desktop bridge =====================

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

// ---------- menus ----------
const isAnim = () => frames.length > 1;
const hasDoc = () => !!W;
const MENUS = {
  file: [
    { l: 'New…', k: 'Ctrl+N', c: 'new' },
    { l: 'Open…', k: 'Ctrl+O', c: 'open' },
    { l: 'Import as layer…', k: 'Ctrl+Shift+O', c: 'importLayer', en: hasDoc },
    '-',
    { l: 'Save As…', k: 'Ctrl+S', c: 'save', en: hasDoc },
    { l: 'Save project (.gwiz)…', k: 'Ctrl+Shift+S', c: 'saveProject', en: hasDoc },
    { l: 'Estimate file size', c: 'estimate', en: hasDoc },
    '-',
    { l: 'Exit', k: 'Alt+F4', c: 'exit' }
  ],
  edit: [
    { l: 'Undo', k: 'Ctrl+Z', c: 'undo', en: () => undoStack.length > 0 },
    { l: 'Redo', k: 'Ctrl+Y', c: 'redo', en: () => redoStack.length > 0 },
    '-',
    { l: 'Copy layer', k: 'Ctrl+C', c: 'copy', en: hasDoc },
    { l: 'Copy whole picture', k: 'Ctrl+Shift+C', c: 'copyMerged', en: hasDoc },
    { l: 'Paste as new layer', k: 'Ctrl+V', c: 'paste', en: hasDoc },
    '-',
    { l: 'Reset all erasing on this layer', c: 'reset', en: hasDoc },
    '-',
    { l: 'Copy mask to next frame', c: 'copyNext', en: isAnim },
    { l: 'Copy mask to all frames', c: 'copyAll', en: isAnim }
  ],
  viewm: [
    { l: 'Result', k: 'V', c: 'view:result', r: () => S.viewMode === 'result' },
    { l: 'Mask overlay', k: 'V', c: 'view:overlay', r: () => S.viewMode === 'overlay' },
    { l: 'Original', k: 'V', c: 'view:original', r: () => S.viewMode === 'original' },
    '-',
    { l: 'Zoom in', k: '+', c: 'zoomIn' }, { l: 'Zoom out', k: '−', c: 'zoomOut' },
    { l: 'Fit to window', k: '0', c: 'fit' }, { l: 'Actual pixels', k: '1', c: 'actual' },
    '-',
    { l: 'Checkerboard backdrop', c: 'bg:checker', r: () => S.bg === 'checker' },
    { l: 'White backdrop', c: 'bg:white', r: () => S.bg === 'white' },
    { l: 'Black backdrop', c: 'bg:black', r: () => S.bg === 'black' },
    { l: 'Custom backdrop color…', c: 'bg:color', r: () => S.bg === 'color' },
    '-',
    { l: 'Show erased areas faintly', c: 'ghost', ck: () => S.ghost },
    { l: 'Color palette', c: 'palette', ck: () => !$('#palettebar').hidden },
    { l: 'Status bar', c: 'statusbar', ck: () => !$('#statusbar').hidden },
    { l: 'Frame strip', c: 'framestrip', ck: () => !$('#strip').hidden, en: isAnim }
  ],
  image: [
    { l: 'Canvas size…', c: 'page:canvas', en: hasDoc },
    { l: 'Resize image…', c: 'page:canvas', en: hasDoc },
    { l: 'Crop…', k: 'C', c: 'tool:crop', en: hasDoc },
    { l: 'Crop to content', c: 'cropContent', en: hasDoc },
    '-',
    { l: 'Rotate picture left 90°', c: 'turnL', en: hasDoc }, { l: 'Rotate picture right 90°', c: 'turnR', en: hasDoc },
    { l: 'Flip picture horizontal', c: 'turnH', en: hasDoc }, { l: 'Flip picture vertical', c: 'turnV', en: hasDoc },
    { l: 'Rotate by angle…', c: 'page:rotate', en: hasDoc },
    '-',
    { l: 'Adjust colors…', c: 'page:adjust', en: hasDoc },
    { l: 'Effects…', c: 'page:effects', en: hasDoc },
    '-',
    { l: 'Remove background…', c: 'page:auto', en: hasDoc },
    { l: 'Mark subject (hint)', c: 'tool:hintKeep', r: () => S.tool === 'hintKeep', en: hasDoc }, { l: 'Mark background (hint)', c: 'tool:hintDrop', r: () => S.tool === 'hintDrop', en: hasDoc }, { l: 'Clear hints', c: 'clearHints', en: hasDoc },
    { l: 'Remove stray specks…', c: 'page:specks', en: hasDoc },
    { l: 'Edge finishing…', c: 'page:finish', en: hasDoc },
    { l: 'Picture opacity…', c: 'page:opacity', en: hasDoc },
    '-',
    { l: 'Attributes…', c: 'page:view', en: hasDoc }
  ],
  layerm: [
    { l: 'New layer', c: 'layerNew', en: hasDoc },
    { l: 'Import image as layer…', c: 'importLayer', en: hasDoc },
    { l: 'Duplicate layer', c: 'layerDup', en: hasDoc },
    { l: 'Delete layer', c: 'layerDel', en: () => layers.length > 1 },
    '-',
    { l: 'Move layer up', c: 'layerUp', en: () => !!AL && layers.indexOf(AL) < layers.length - 1 },
    { l: 'Move layer down', c: 'layerDown', en: () => !!AL && layers.indexOf(AL) > 0 },
    { l: 'Merge down', c: 'layerMerge', en: () => !!AL && layers.indexOf(AL) > 0 },
    { l: 'Flatten picture', c: 'layerFlatten', en: () => layers.length > 1 },
    '-',
    { l: 'Move and transform', k: 'M', c: 'tool:move', en: hasDoc },
    { l: 'Layer size and shape…', c: 'page:xform', en: hasDoc },
    { l: 'Center on canvas', c: 'layerCenter', en: hasDoc },
    { l: 'Fit to canvas', c: 'layerFit', en: hasDoc },
    { l: 'Trim to visible pixels', c: 'layerTrim', en: hasDoc },
    { l: 'Rotate layer left 90°', c: 'lrotL', en: hasDoc }, { l: 'Rotate layer right 90°', c: 'lrotR', en: hasDoc },
    { l: 'Flip layer horizontal', c: 'lflipH', en: hasDoc }, { l: 'Flip layer vertical', c: 'lflipV', en: hasDoc },
    '-',
    { l: 'Visible', c: 'layerVis', ck: () => !!AL && AL.visible, en: hasDoc },
    { l: 'Locked', c: 'layerLock', ck: () => !!AL && AL.locked, en: hasDoc }
  ],
  animm: [
    { l: 'Play / Pause', c: 'play', en: () => docFrames() > 1 },
    { l: 'Previous frame', k: ',', c: 'prev', en: () => docFrames() > 1 }, { l: 'Next frame', k: '.', c: 'next', en: () => docFrames() > 1 },
    '-',
    { l: 'Edits apply to this frame', c: 'scope:one', r: () => !S.scopeAll, en: isAnim },
    { l: 'Edits apply to all frames', c: 'scope:all', r: () => S.scopeAll, en: isAnim },
    '-',
    { l: 'Frames…', c: 'page:anim', en: isAnim },
    { l: 'Motion finder…', c: 'page:motion', en: isAnim },
    { l: 'Stabilize…', c: 'page:stab', en: isAnim }
  ],
  tools: [
    { l: 'Move and transform', k: 'M', c: 'tool:move', r: () => S.tool === 'move' },
    { l: 'Crop', k: 'C', c: 'tool:crop', r: () => S.tool === 'crop' },
    '-',
    { l: 'Eraser', k: 'B', c: 'tool:erase', r: () => S.tool === 'erase' },
    { l: 'Restore brush', k: 'R', c: 'tool:restore', r: () => S.tool === 'restore' },
    { l: 'Magic wand', k: 'W', c: 'tool:wand', r: () => S.tool === 'wand' },
    '-',
    { l: 'Pencil', k: 'P', c: 'tool:pencil', r: () => S.tool === 'pencil' },
    { l: 'Pen', k: 'N', c: 'tool:pen', r: () => S.tool === 'pen' },
    { l: 'Brush', k: 'Y', c: 'tool:brush', r: () => S.tool === 'brush' },
    { l: 'Marker', k: 'K', c: 'tool:marker', r: () => S.tool === 'marker' },
    { l: 'Airbrush', k: 'J', c: 'tool:air', r: () => S.tool === 'air' },
    { l: 'Fill with color', k: 'G', c: 'tool:fill', r: () => S.tool === 'fill' },
    { l: 'Pick color', k: 'I', c: 'tool:picker', r: () => S.tool === 'picker' },
    { l: 'Text', k: 'A', c: 'tool:text', r: () => S.tool === 'text' },
    '-',
    { l: 'Line', k: 'L', c: 'tool:line', r: () => S.tool === 'line' },
    { l: 'Rectangle', k: 'U', c: 'tool:rect', r: () => S.tool === 'rect' },
    { l: 'Ellipse', k: 'O', c: 'tool:ellipse', r: () => S.tool === 'ellipse' },
    { l: 'Rounded rectangle', c: 'tool:rrect', r: () => S.tool === 'rrect' },
    '-',
    { l: 'Track box', k: 'T', c: 'tool:track', r: () => S.tool === 'track' },
    { l: 'Pan', k: 'H', c: 'tool:hand', r: () => S.tool === 'hand' },
    { l: 'Magnifier', k: 'Z', c: 'tool:zoom', r: () => S.tool === 'zoom' }
  ],
  colorsm: [
    { l: 'Edit colors…', c: 'editColors' },
    { l: 'Swap primary and secondary', k: 'X', c: 'swapColors' },
    { l: 'Black and white', k: 'D', c: 'defaultColors' },
    '-',
    ...Object.keys(PALETTES).map(k => ({ l: k, c: 'scheme:' + k, r: () => S.scheme === k }))
  ],
  helpm: [
    { l: 'Keyboard shortcuts', k: 'F1', c: 'help' },
    '-',
    { l: 'Open the sample picture', c: 'sample' },
    { l: 'About G-WIZ', c: 'about' }
  ]
};
let openMenu = null;
function closeMenus(){ $('#menus').innerHTML = ''; $$('.mtop').forEach(b => b.classList.remove('open')); openMenu = null; }
function showMenu(name){
  closeMenus(); openMenu = name;
  const top = $('.mtop[data-menu="' + name + '"]'); top.classList.add('open');
  const m = document.createElement('div'); m.className = 'menu raised'; m.setAttribute('role', 'menu');
  const r = top.getBoundingClientRect(), bar = $('#menubar').getBoundingClientRect();
  m.style.left = (r.left) + 'px'; m.style.top = (r.bottom) + 'px'; m.style.position = 'fixed';
  for (const it of MENUS[name]){
    if (it === '-'){ const s = document.createElement('div'); s.className = 'msep'; m.appendChild(s); continue; }
    const b = document.createElement('button'); b.className = 'mi'; b.type = 'button'; b.setAttribute('role', 'menuitem');
    const mark = it.ck ? (it.ck() ? '✓' : '') : it.r ? (it.r() ? '●' : '') : '';
    b.innerHTML = '<span class="mk"></span><span class="lb"></span><span class="sc"></span><span></span>';
    b.querySelector('.mk').textContent = mark; b.querySelector('.lb').textContent = it.l; b.querySelector('.sc').textContent = it.k || '';
    if (it.en && !it.en()) b.disabled = true;
    b.addEventListener('click', () => { closeMenus(); runCmd(it.c); });
    b.addEventListener('mouseenter', () => { m.querySelectorAll('.mi.hot').forEach(x => x.classList.remove('hot')); b.classList.add('hot'); b.focus({ preventScroll: true }); });
    m.appendChild(b);
  }
  $('#menus').appendChild(m);
  fitMenu(m, r);
}
// keep a menu on screen: as wide as its longest item, two columns when it is too tall, scrolling as a last resort
function fitMenu(m, r){
  const room = () => innerHeight - m.getBoundingClientRect().top - 4;
  const place = () => { const mr = m.getBoundingClientRect(); m.style.left = Math.max(2, Math.min(r.left, innerWidth - mr.width - 2)) + 'px'; };
  m.classList.remove('cols2'); m.style.maxHeight = ''; place();
  if (m.getBoundingClientRect().height > room()){
    m.classList.add('cols2'); place();
    const mr = m.getBoundingClientRect();
    if (mr.height > room() || mr.width > innerWidth - 4){ m.classList.remove('cols2'); place(); }
  }
  if (m.getBoundingClientRect().height > room()){ m.style.maxHeight = room() + 'px'; m.classList.add('scroll'); }
}
window.addEventListener('resize', () => { const m = $('#menus .menu'), top = openMenu && $('.mtop[data-menu="' + openMenu + '"]'); if (m && top) fitMenu(m, top.getBoundingClientRect()); });
$$('.mtop').forEach(b => {
  b.addEventListener('mousedown', e => { e.preventDefault(); openMenu === b.dataset.menu ? closeMenus() : showMenu(b.dataset.menu); });
  b.addEventListener('mouseenter', () => { if (openMenu && openMenu !== b.dataset.menu) showMenu(b.dataset.menu); });
});
document.addEventListener('mousedown', e => { if (openMenu && !e.target.closest('.menu') && !e.target.closest('.mtop')) closeMenus(); });
function menuKey(e){
  if (!openMenu) return false;
  const items = [...$$('#menus .mi')].filter(b => !b.disabled), names = Object.keys(MENUS);
  const hot = $('#menus .mi.hot'); let i = items.indexOf(hot);
  if (e.key === 'Escape'){ closeMenus(); return true; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
    i = e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
    items.forEach(b => b.classList.remove('hot')); if (items[i]){ items[i].classList.add('hot'); items[i].focus({ preventScroll: true }); } return true;
  }
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft'){ const n = names.indexOf(openMenu); showMenu(names[(n + (e.key === 'ArrowRight' ? 1 : names.length - 1)) % names.length]); return true; }
  if (e.key === 'Enter' && hot){ hot.click(); return true; }
  return true;
}
const MENU_KEYS = { f: 'file', e: 'edit', v: 'viewm', i: 'image', l: 'layerm', a: 'animm', t: 'tools', c: 'colorsm', h: 'helpm' };

// ---------- commands ----------
function openModal(id){ $('#' + id).hidden = false; const d = $('#' + id).querySelector('.btn.default,button'); if (d) setTimeout(() => d.focus(), 0); }
function closeModal(id){ $('#' + id).hidden = true; }
$$('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));
function openSaveOpts(){ if (!W) return; stopPlay(); updateFmtUI(); $('#soTitle').textContent = 'Save As — ' + S.name; openModal('saveOpts'); }
function anyModal(){ return $$('.modal').some(m => !m.hidden); }
function runCmd(c){ if (touchCmd(c) || animCmd(c) || miniCmd(c) || sessionCmd(c) || pixelCmd(c)) return;
  if (c === 'clearHints'){ clearHints(); return; }
  const ci = c.indexOf(':'), k = ci < 0 ? c : c.slice(0, ci), v = ci < 0 ? undefined : c.slice(ci + 1);
  switch (k){
    case 'open': openFile(); break;
    case 'new': $('#nW').value = W ? DocW : 800; $('#nH').value = W ? DocH : 600; openModal('newDlg'); break;
    case 'importLayer': importLayer(); break;
    case 'saveProject': saveProject(); break;
    case 'copy': copyToClipboard(false); break;
    case 'copyMerged': copyToClipboard(true); break;
    case 'paste': navigator.clipboard && navigator.clipboard.read ? navigator.clipboard.read().then(async items => { for (const it of items){ const t = it.types.find(x => x.startsWith('image/')); if (t){ const b = await it.getType(t); await loadFile(new File([b], 'pasted.' + t.split('/')[1], { type: t }), !!W); return; } } toast('The clipboard has no image.'); }).catch(() => toast('Press Ctrl+V to paste an image.')) : toast('Press Ctrl+V to paste an image.'); break;
    case 'layerNew': layerNew(); break;
    case 'layerDup': layerDup(); break;
    case 'layerDel': layerDel(); break;
    case 'layerUp': layerMove(1); break;
    case 'layerDown': layerMove(-1); break;
    case 'layerMerge': layerMerge(); break;
    case 'layerFlatten': layerFlatten(); break;
    case 'layerCenter': layerCenter(); break;
    case 'layerFit': xfScaleTo('fit'); break;
    case 'layerTrim': layerTrim(); break;
    case 'layerVis': if (AL){ AL.visible = !AL.visible; renderLayersPanel(); syncLayerProps(); requestDraw(); } break;
    case 'layerLock': if (AL){ AL.locked = !AL.locked; renderLayersPanel(); syncLayerProps(); } break;
    case 'lrotL': transformFrames(-90); break;
    case 'lrotR': transformFrames(90); break;
    case 'lflipH': transformFrames(0, 'h'); break;
    case 'lflipV': transformFrames(0, 'v'); break;
    case 'turnL': canvasTurn(-90); break;
    case 'turnR': canvasTurn(90); break;
    case 'turnH': canvasTurn(0, 'h'); break;
    case 'turnV': canvasTurn(0, 'v'); break;
    case 'editColors': openColorDlg(1); break;
    case 'swapColors': swapColors(); break;
    case 'defaultColors': setColor(1, { r: 0, g: 0, b: 0, a: 255 }, true); setColor(2, { r: 255, g: 255, b: 255, a: 255 }, true); break;
    case 'scheme': S.scheme = v; $('#palScheme').value = v; store.set('scheme', v); renderPalette(); break;
    case 'palette': $('#palettebar').hidden = !$('#palettebar').hidden; break;
    case 'save': openSaveOpts(); break;
    case 'estimate': openSaveOpts(); estimate(); break;
    case 'exit': exitApp(); break;
    case 'undo': undo(); break;
    case 'redo': redo(); break;
    case 'reset': $('#resetBtn').click(); break;
    case 'copyNext': $('#copyNext').click(); break;
    case 'copyAll': $('#copyAll').click(); break;
    case 'view': setViewMode(v); break;
    case 'zoomIn': stepZoom(1); break;
    case 'zoomOut': stepZoom(-1); break;
    case 'fit': fit(); break;
    case 'actual': setZoom(1); break;
    case 'bg': if (v === 'color'){ $('#bgColor').click(); } $('#bgSeg [data-bg="' + v + '"]').click(); break;
    case 'ghost': $('#ghost').click(); break;
    case 'statusbar': $('#statusbar').hidden = !$('#statusbar').hidden; break;
    case 'framestrip': $('#strip').hidden = !$('#strip').hidden; break;
    case 'tool': setTool(v); break;
    case 'page': showPage(v); break;
    case 'cropContent': setTool('crop'); fitContent(); break;
    case 'rotL': $('#rotL').click(); break;
    case 'rotR': $('#rotR').click(); break;
    case 'flipH': $('#flipH').click(); break;
    case 'flipV': $('#flipV').click(); break;
    case 'play': S.playing ? stopPlay() : play(); break;
    case 'prev': stopPlay(); setFrame((S.cur + frames.length - 1) % frames.length); break;
    case 'next': stopPlay(); setFrame((S.cur + 1) % frames.length); break;
    case 'scope': $('#scopeSeg [data-a="' + v + '"]').click(); break;
    case 'help': openModal('helpDlg'); break;
    case 'about': openModal('aboutDlg'); break;
  }
}
$$('[data-cmd]').forEach(b => b.addEventListener('click', () => runCmd(b.dataset.cmd)));
$('#zoomFit').addEventListener('click', fit);
$('#tbRotL').addEventListener('click', () => $('#rotL').click());
$('#tbRotR').addEventListener('click', () => $('#rotR').click());
$('#tbFlipH').addEventListener('click', () => $('#flipH').click());
$('#tbFlipV').addEventListener('click', () => $('#flipV').click());

// keyboard: menus (Alt+letter, F10), dialogs, extra tools
window.addEventListener('keydown', e => {
  if (menuKey(e)){ e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (anyModal()){
    if (e.key === 'Escape'){ $$('.modal').forEach(m => { if (!m.hidden) m.hidden = true; }); e.preventDefault(); e.stopImmediatePropagation(); }
    else if (e.key === 'Enter' && !$('#saveOpts').hidden && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON'){ e.preventDefault(); $('#saveBtn').click(); }
    if (!$('#saveOpts').hidden || !$('#helpDlg').hidden || !$('#aboutDlg').hidden) e.stopImmediatePropagation();
    return;
  }
  if (e.altKey && !e.ctrlKey && MENU_KEYS[e.key.toLowerCase()]){ e.preventDefault(); e.stopImmediatePropagation(); showMenu(MENU_KEYS[e.key.toLowerCase()]); const f = $('#menus .mi:not(:disabled)'); if (f) f.classList.add('hot'); return; }
  if (e.key === 'F10'){ e.preventDefault(); showMenu('file'); return; }
  if (e.key === 'F1'){ e.preventDefault(); openModal('helpDlg'); return; }
  const t = e.target; if (t && (t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox'))) return;
  if (e.ctrlKey || e.metaKey){
    const kk = e.key.toLowerCase(), stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (kk === 's'){ stop(); e.shiftKey ? saveProject() : openSaveOpts(); }
    else if (kk === 'o'){ stop(); e.shiftKey ? importLayer() : openFile(); }
    else if (kk === 'n'){ stop(); runCmd('new'); }
    else if (kk === 'c'){ stop(); copyToClipboard(e.shiftKey); }
    return;
  }
  const k = e.key.toLowerCase();
  const KEYTOOL = { c: 'crop', t: 'track', z: 'zoom', m: 'move', p: 'pencil', n: 'pen', y: 'brush', k: 'marker', j: 'air', g: 'fill', i: 'picker', a: 'text', l: 'line', u: 'rect', o: 'ellipse' };
  if (S.tool === 'move' && e.key.startsWith('Arrow')){ e.preventDefault(); e.stopImmediatePropagation(); const st = e.shiftKey ? 10 : 1; xfNudge(e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0); return; }
  if (e.key === 'Enter' && XF){ e.preventDefault(); e.stopImmediatePropagation(); xfCommit(); return; }
  if (e.key === 'Escape' && XF){ e.preventDefault(); e.stopImmediatePropagation(); xfCancel(); return; }
  if ((e.key === '[' || e.key === ']') && (DRAW_TOOLS.includes(S.tool) || SHAPE_TOOLS.includes(S.tool))){ e.stopImmediatePropagation(); const cur = DRAW_TOOLS.includes(S.tool) ? S.draw[S.tool].size : S.shape.width; setDrawSize(e.key === ']' ? Math.max(cur + 1, cur * 1.2) : Math.min(cur - 1, cur / 1.2)); return; }
  if (k === 'x' && !e.altKey){ e.stopImmediatePropagation(); swapColors(); return; }
  if (k === 'd' && !e.altKey){ e.stopImmediatePropagation(); runCmd('defaultColors'); return; }
  if (KEYTOOL[k] && !e.altKey){ setTool(KEYTOOL[k]); e.stopImmediatePropagation(); }
  else if (e.key === 'Enter' && S.tool === 'crop' && S.crop && !cropIsFull(S.crop)){ e.preventDefault(); applyCrop(); }
  else if (e.key === 'Escape' && S.tool === 'crop' && S.crop){ S.crop = null; syncCropUI(); }
}, true);

// ---------- crop, track and magnifier tools on the canvas ----------
S.track = null;
let boxDrag = null;
// crop boxes live in canvas coordinates; the stabilizer's track box lives in the active layer's coordinates
function screenRect(r, local){ const ox = local ? LX() : 0, oy = local ? LY() : 0; return { x0: S.panX + (r.x + ox) * S.zoom, y0: S.panY + (r.y + oy) * S.zoom, x1: S.panX + (r.x + ox + r.w) * S.zoom, y1: S.panY + (r.y + oy + r.h) * S.zoom }; }
function boxHit(r, p, local){
  if (!r) return 'new';
  const s = screenRect(r, local), mx = (s.x0 + s.x1) / 2, my = (s.y0 + s.y1) / 2, tol = HIT_TOL(), near = (a, b) => Math.abs(a - b) <= tol;
  const pts = { nw: [s.x0, s.y0], n: [mx, s.y0], ne: [s.x1, s.y0], e: [s.x1, my], se: [s.x1, s.y1], s: [mx, s.y1], sw: [s.x0, s.y1], w: [s.x0, my] };
  for (const [k, [hx, hy]] of Object.entries(pts)) if (near(p.x, hx) && near(p.y, hy)) return k;
  if (p.x > s.x0 && p.x < s.x1 && p.y > s.y0 && p.y < s.y1) return 'move';
  return 'new';
}
const HIT_CURSOR = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', move: 'move', new: 'crosshair' };
function boxStart(kind, p){
  const r = kind === 'crop' ? (S.crop && !cropIsFull(S.crop) ? S.crop : null) : S.track;
  const [ix, iy] = kind === 'crop' ? toDoc(p) : toImg(p);
  boxDrag = { kind, mode: boxHit(r, p, kind !== 'crop'), ix, iy, start: r ? { ...r } : null };
}
function boxMove(p){
  const d = boxDrag, BW = d.kind === 'crop' ? DocW : W, BH = d.kind === 'crop' ? DocH : H;
  let [ix, iy] = d.kind === 'crop' ? toDoc(p) : toImg(p); ix = clamp(ix, 0, BW); iy = clamp(iy, 0, BH);
  const ar = d.kind === 'crop' ? aspectRatio() : 0;
  let r;
  if (d.mode === 'new' || !d.start){
    let x0 = Math.min(d.ix, ix), y0 = Math.min(d.iy, iy), w = Math.abs(ix - d.ix), h = Math.abs(iy - d.iy);
    if (ar){ if (w / Math.max(h, 1e-6) > ar) w = h * ar; else h = w / ar; x0 = ix < d.ix ? d.ix - w : d.ix; y0 = iy < d.iy ? d.iy - h : d.iy; }
    r = { x: x0, y: y0, w, h };
  } else if (d.mode === 'move'){
    const s = d.start; r = { x: clamp(s.x + ix - d.ix, 0, BW - s.w), y: clamp(s.y + iy - d.iy, 0, BH - s.h), w: s.w, h: s.h };
  } else {
    const s = d.start; let x0 = s.x, y0 = s.y, x1 = s.x + s.w, y1 = s.y + s.h;
    if (d.mode.includes('w')) x0 = Math.min(ix, x1 - 1); if (d.mode.includes('e')) x1 = Math.max(ix, x0 + 1);
    if (d.mode.includes('n')) y0 = Math.min(iy, y1 - 1); if (d.mode.includes('s')) y1 = Math.max(iy, y0 + 1);
    if (ar){ const w = x1 - x0; if (d.mode === 'n' || d.mode === 's'){ const nw = (y1 - y0) * ar; x1 = x0 + nw; } else { const nh = w / ar; if (d.mode.includes('n')) y0 = y1 - nh; else y1 = y0 + nh; } }
    r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  r.x = clamp(Math.round(r.x), 0, BW - 1); r.y = clamp(Math.round(r.y), 0, BH - 1);
  r.w = clamp(Math.round(r.w), 1, BW - r.x); r.h = clamp(Math.round(r.h), 1, BH - r.y);
  if (d.kind === 'crop'){ S.crop = r; syncCropUI(); } else { S.track = r; requestDraw(); }
}
function boxEnd(){
  const d = boxDrag; boxDrag = null; if (!d) return;
  const r = d.kind === 'crop' ? S.crop : S.track;
  if (r && (r.w < 3 || r.h < 3) && d.mode === 'new'){ if (d.kind === 'crop'){ S.crop = null; syncCropUI(); } else S.track = null; }
  if (d.kind === 'track'){ if (S.track){ segSet('#sArea', 'a', 'box'); S.stabArea = 'box'; } updateTrackHint(); resetStabResult(); }
  requestDraw();
}
// draw the track box and crop handles (called from draw)
function drawToolBoxes(){
  drawXfHandles(); drawDrawCursor(); positionTextEdit(); drawAnimOverlay(); drawPixelOverlay();
  if (S.track && (S.tool === 'track' || curPage === 'stab')){
    const s = screenRect(S.track, true);
    vctx.save(); vctx.lineWidth = 1; vctx.setLineDash([4, 3]);
    vctx.strokeStyle = '#000'; vctx.strokeRect(s.x0 + 0.5, s.y0 + 0.5, s.x1 - s.x0, s.y1 - s.y0);
    vctx.lineDashOffset = 4; vctx.strokeStyle = '#ffff00'; vctx.strokeRect(s.x0 + 0.5, s.y0 + 0.5, s.x1 - s.x0, s.y1 - s.y0);
    vctx.restore();
    vctx.fillStyle = '#ffff00'; vctx.font = '11px Tahoma, sans-serif'; vctx.fillText('Track', s.x0 + 3, s.y0 - 4 > 10 ? s.y0 - 4 : s.y0 + 12);
  }
  if (S.tool === 'crop' && S.crop && !cropIsFull(S.crop)){
    const s = screenRect(S.crop), mx = (s.x0 + s.x1) / 2, my = (s.y0 + s.y1) / 2;
    for (const [hx, hy] of [[s.x0, s.y0], [mx, s.y0], [s.x1, s.y0], [s.x1, my], [s.x1, s.y1], [mx, s.y1], [s.x0, s.y1], [s.x0, my]]){
      vctx.fillStyle = '#000080'; vctx.fillRect(Math.round(hx) - 3, Math.round(hy) - 3, 7, 7);
      vctx.strokeStyle = '#fff'; vctx.lineWidth = 1; vctx.strokeRect(Math.round(hx) - 2.5, Math.round(hy) - 2.5, 6, 6);
    }
  }
}

// ---------- stabilize ----------
S.stabRef = 'chain'; S.stabArea = 'all'; S.stabRad = 16; S.stabSmooth = 0; S.stabVis = false; S.stabPrev = true;
let stab = null;   // { T: [[x,y]...] measured content position per frame, C: [[x,y]...] correction }
function resetStabResult(){ stab = null; $('#sOpts').hidden = true; $('#sStat').textContent = ''; requestDraw(); }
function updateTrackHint(){
  $('#sAreaHint').textContent = S.stabArea === 'box'
    ? (S.track ? 'Tracking the yellow box (' + S.track.w + ' × ' + S.track.h + ' px). Pick something that should stay still.' : 'Choose the Track box tool (T) and drag a box around something that should stay still.')
    : 'Measures the shift of the whole picture.';
}
// grayscale + weight pyramid level for frame f at scale sc
function stabLevel(f, sc){
  const sw = Math.max(8, Math.round(W * sc)), sh = Math.max(8, Math.round(H * sc));
  const g = new Float32Array(sw * sh), w = new Float32Array(sw * sh), src = frames[f], m = masks[f];
  const fx = W / sw, fy = H / sh;
  for (let y = 0; y < sh; y++){
    const y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
    for (let x = 0; x < sw; x++){
      const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx));
      let sg = 0, sa = 0, n = 0;
      for (let yy = y0; yy < y1; yy += Math.max(1, (y1 - y0) >> 1)) for (let xx = x0; xx < x1; xx += Math.max(1, (x1 - x0) >> 1)){
        const i = yy * W + xx, p = i * 4;
        let a = src[p + 3] / 255; if (S.stabVis) a *= m[i] / 255;
        sg += (src[p] * 0.299 + src[p + 1] * 0.587 + src[p + 2] * 0.114) * a; sa += a; n++;
      }
      const j = y * sw + x; w[j] = sa / n; g[j] = sa > 0 ? sg / sa : 0;
    }
  }
  return { g, w, sw, sh, sc: sw / W };
}
// best shift of `cur` against `ref` inside box (in level pixels), searching dx,dy in [cx-r, cx+r]
function stabSearch(ref, cur, box, cx, cy, r){
  let best = Infinity, bx = cx, by = cy; const costs = new Map();
  const { sw, sh } = ref;
  let refW = 0; for (let y = box.y0; y < box.y1; y++) for (let x = box.x0; x < box.x1; x++) refW += ref.w[y * sw + x];
  for (let dy = cy - r; dy <= cy + r; dy++) for (let dx = cx - r; dx <= cx + r; dx++){
    let sum = 0, ws = 0;
    const xa = Math.max(box.x0, -dx), xb = Math.min(box.x1, sw - dx), ya = Math.max(box.y0, -dy), yb = Math.min(box.y1, sh - dy);
    for (let y = ya; y < yb; y++){
      const ro = y * sw, co = (y + dy) * sw + dx;
      for (let x = xa; x < xb; x++){ const wv = ref.w[ro + x] * cur.w[co + x]; if (wv <= 0) continue; sum += wv * Math.abs(ref.g[ro + x] - cur.g[co + x]); ws += wv; }
    }
    const c = ws > refW * 0.3 && ws > 0 ? sum / ws : Infinity;
    costs.set(dx + ',' + dy, c);
    if (c < best){ best = c; bx = dx; by = dy; }
  }
  // sub-pixel refinement with a parabola through the neighbours
  const sub = (a, b, c) => { const d = a - 2 * b + c; return (isFinite(a) && isFinite(c) && d > 0) ? Math.max(-0.5, Math.min(0.5, (a - c) / (2 * d))) : 0; };
  const C = (x, y) => costs.has(x + ',' + y) ? costs.get(x + ',' + y) : Infinity;
  return [bx + sub(C(bx - 1, by), best, C(bx + 1, by)), by + sub(C(bx, by - 1), best, C(bx, by + 1))];
}
function stabEstimate(a, b){
  // a, b: pyramids {lo, hi} for reference and current frame
  const boxFor = (L) => {
    const rad = Math.ceil(S.stabRad * L.sc) + 1;
    if (S.stabArea === 'box' && S.track){
      const t = S.track;
      return { x0: clamp(Math.floor(t.x * L.sc), 0, L.sw - 1), y0: clamp(Math.floor(t.y * L.sc), 0, L.sh - 1), x1: clamp(Math.ceil((t.x + t.w) * L.sc), 1, L.sw), y1: clamp(Math.ceil((t.y + t.h) * L.sc), 1, L.sh) };
    }
    return { x0: Math.min(rad, L.sw >> 2), y0: Math.min(rad, L.sh >> 2), x1: L.sw - Math.min(rad, L.sw >> 2), y1: L.sh - Math.min(rad, L.sh >> 2) };
  };
  const rLo = Math.max(1, Math.ceil(S.stabRad * a.lo.sc));
  const [lx, ly] = stabSearch(a.lo, b.lo, boxFor(a.lo), 0, 0, rLo);
  const k = a.hi.sc / a.lo.sc;
  const [hx, hy] = stabSearch(a.hi, b.hi, boxFor(a.hi), Math.round(lx * k), Math.round(ly * k), 2);
  return [hx / a.hi.sc, hy / a.hi.sc];
}
async function analyzeStab(){
  if (!W || frames.length < 2) return;
  stopPlay(); busy(true); await new Promise(r => setTimeout(r, 16));
  try {
    const n = frames.length, hiSc = Math.min(1, 480 / Math.max(W, H)), loSc = hiSc / 4;
    const pyr = f => ({ hi: stabLevel(f, hiSc), lo: stabLevel(f, loSc) });
    const T = [[0, 0]]; let prev = pyr(0); const first = prev;
    for (let f = 1; f < n; f++){
      const cur = pyr(f);
      if (S.stabRef === 'first'){ T.push(stabEstimate(first, cur)); }
      else { const [dx, dy] = stabEstimate(prev, cur); T.push([T[f - 1][0] + dx, T[f - 1][1] + dy]); }
      prev = cur;
      if (f % 8 === 0){ sbSet('Measuring shake… frame ' + (f + 1) + ' of ' + n); await new Promise(r => setTimeout(r, 0)); }
    }
    stab = { T, C: null };
    updateStabCorrection();
    $('#sOpts').hidden = false;
    sbFlash('Shake measured on ' + n + ' frames.');
  } finally { busy(false); }
}
function updateStabCorrection(){
  if (!stab) return;
  const T = stab.T, n = T.length, k = S.stabSmooth;
  const target = [];
  if (k === 0){ let mx = 0, my = 0; T.forEach(([x, y]) => { mx += x; my += y; }); for (let f = 0; f < n; f++) target.push([mx / n, my / n]); }
  else for (let f = 0; f < n; f++){ let sx = 0, sy = 0, c = 0; for (let j = Math.max(0, f - k); j <= Math.min(n - 1, f + k); j++){ sx += T[j][0]; sy += T[j][1]; c++; } target.push([sx / c, sy / c]); }
  stab.S = target;
  stab.C = T.map((t, f) => {
    let cx = target[f][0] - t[0], cy = target[f][1] - t[1];
    // whole pixels: round the target and the measured position separately so every frame lands on the same grid
    if ($('#sWhole').checked){ cx = Math.round(target[f][0]) - Math.round(t[0]); cy = Math.round(target[f][1]) - Math.round(t[1]); }
    return [cx, cy];
  });
  let mx = 0; stab.C.forEach(([x, y]) => { mx = Math.max(mx, Math.hypot(x, y)); });
  let jitter = 0; T.forEach((t, f) => { if (f) jitter = Math.max(jitter, Math.hypot(t[0] - T[f - 1][0], t[1] - T[f - 1][1])); });
  $('#sStat').textContent = 'Largest correction ' + mx.toFixed(1) + ' px · biggest frame-to-frame jump ' + jitter.toFixed(1) + ' px';
  drawStabGraph(); requestDraw();
}
function drawStabGraph(){
  const c = $('#sGraph'); if (!c || !stab) return;
  const g = c.getContext('2d'), w = c.width, h = c.height, T = stab.T, Sm = stab.S, n = T.length;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  let lim = 1; T.forEach(([x, y]) => { lim = Math.max(lim, Math.abs(x), Math.abs(y)); }); Sm.forEach(([x, y]) => { lim = Math.max(lim, Math.abs(x), Math.abs(y)); });
  const X = f => 6 + (w - 12) * (n === 1 ? 0 : f / (n - 1)), Y = v => h / 2 - v / lim * (h / 2 - 8);
  g.strokeStyle = '#c0c0c0'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, h / 2 + 0.5); g.lineTo(w, h / 2 + 0.5); g.stroke();
  g.strokeStyle = '#808080'; g.setLineDash([3, 3]); g.beginPath(); const cx = Math.round(X(S.cur)) + 0.5; g.moveTo(cx, 0); g.lineTo(cx, h); g.stroke(); g.setLineDash([]);
  const line = (arr, i, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); arr.forEach((p, f) => { const xx = X(f), yy = Y(p[i]); f ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }); g.stroke(); };
  line(T, 0, '#0000ff', 1.5); line(T, 1, '#ff0000', 1.5); line(Sm, 0, '#000080', 4); line(Sm, 1, '#800000', 4);
  g.fillStyle = '#000'; g.font = '18px Tahoma, sans-serif'; g.fillText('±' + lim.toFixed(1) + ' px', 8, 20);
}
function stabOffset(){ return (stab && stab.C && S.stabPrev && curPage === 'stab' && stab.C.length === frames.length) ? stab.C[S.cur] : null; }
function applyStab(){
  if (!stab || !stab.C || op) return;
  stopPlay();
  const C = stab.C, mode = $('#sEdge').value, n = frames.length;
  const nf = [], nm = [];
  for (let f = 0; f < n; f++){
    const [cx, cy] = C[f], src = frames[f], m = masks[f], out = new Uint8ClampedArray(W * H * 4), om = new Uint8Array(W * H).fill(255);
    const whole = Number.isInteger(cx) && Number.isInteger(cy);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
      let sx = x - cx, sy = y - cy; const di = y * W + x, o = di * 4;
      if (mode === 'extend'){ sx = clamp(sx, 0, W - 1); sy = clamp(sy, 0, H - 1); }
      if (whole){
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        const si = sy * W + sx; out[o] = src[si * 4]; out[o + 1] = src[si * 4 + 1]; out[o + 2] = src[si * 4 + 2]; out[o + 3] = src[si * 4 + 3]; om[di] = m[si];
        continue;
      }
      const x0 = Math.floor(sx), y0 = Math.floor(sy), tx = sx - x0, ty = sy - y0;
      let pa = 0, pr = 0, pg = 0, pb = 0, pm = 0, win = 0;
      for (let k = 0; k < 4; k++){
        const xx = x0 + (k & 1), yy = y0 + (k >> 1); if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const wgt = ((k & 1) ? tx : 1 - tx) * ((k >> 1) ? ty : 1 - ty), si = yy * W + xx, a = src[si * 4 + 3] * wgt;
        pa += a; pr += src[si * 4] * a; pg += src[si * 4 + 1] * a; pb += src[si * 4 + 2] * a; pm += m[si] * wgt; win += wgt;
      }
      if (pa > 0){ out[o] = pr / pa; out[o + 1] = pg / pa; out[o + 2] = pb / pa; out[o + 3] = pa; }
      if (win > 0) om[di] = pm / win;
    }
    nf.push(out); nm.push(om);
  }
  let nw = W, nh = H, rx = 0, ry = 0;
  if (mode === 'crop'){
    let x0 = 0, y0 = 0, x1 = W, y1 = H;
    C.forEach(([cx, cy]) => { x0 = Math.max(x0, Math.ceil(cx)); y0 = Math.max(y0, Math.ceil(cy)); x1 = Math.min(x1, Math.floor(W + cx)); y1 = Math.min(y1, Math.floor(H + cy)); });
    if (x1 - x0 < 4 || y1 - y0 < 4){ toast('The shake is too large to crop to a shared area. Choose another edge option.', 5000); return; }
    rx = x0; ry = y0; nw = x1 - x0; nh = y1 - y0;
    for (let f = 0; f < n; f++){ nf[f] = cropRGBA(nf[f], [x0, y0, x1, y1]).slice(); nm[f] = cropM(nm[f], x0, y0, x1, y1); }
  }
  geomCommit(nf, nm, nw, nh, 'Stabilized ' + n + ' frames' + (mode === 'crop' ? ', cropped to ' + nw + ' × ' + nh + ' px.' : '.'));
}
segBind('#sRef', 's', v => { S.stabRef = v; resetStabResult(); });
segBind('#sArea', 'a', v => { S.stabArea = v; updateTrackHint(); resetStabResult(); if (v === 'box' && !S.track) setTool('track'); });
rangeBind('sRad', 'stabRad', v => v + ' px', () => resetStabResult());
rangeBind('sSmooth', 'stabSmooth', v => v === 0 ? 'Lock' : v + ' frames', () => updateStabCorrection());
$('#sVis').addEventListener('change', e => { S.stabVis = e.target.checked; resetStabResult(); });
$('#sWhole').addEventListener('change', updateStabCorrection);
$('#sPrev').addEventListener('change', e => { S.stabPrev = e.target.checked; requestDraw(); });
$('#sAnalyze').addEventListener('click', analyzeStab);
$('#sApply').addEventListener('click', applyStab);
updateTrackHint();

// ---------- opening and exiting (browser or desktop) ----------
const GW = window.__GWIZ__ || null;
function openFile(){ $('#fileIn').click(); }
function exitApp(){
  if (GW){ fetch('/api/quit?t=' + GW.token, { method: 'POST' }).catch(() => {}); setTimeout(() => window.close(), 60); }
  else sbFlash('Close the browser tab to exit G-WIZ.');
}
if (GW){
  // keep the launcher alive while this window is open; it shuts down shortly after the window closes
  const ping = () => fetch('/api/ping?t=' + GW.token, { method: 'POST' }).catch(() => {});
  ping(); setInterval(ping, 3000);
  addEventListener('pagehide', () => navigator.sendBeacon('/api/bye?t=' + GW.token));
  $('#aboutMode').textContent = 'Desktop edition. Running in its own window.';
  if (GW.initial){
    fetch('/api/initial?t=' + GW.token).then(async r => {
      if (!r.ok) return;
      const name = decodeURIComponent(r.headers.get('X-File-Name') || 'image');
      const blob = await r.blob(); const ext = (name.split('.').pop() || '').toLowerCase();
      const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml', ico: 'image/x-icon', tif: 'image/tiff', tiff: 'image/tiff' };
      loadFile(new File([blob], name, { type: types[ext] || '' }));
    }).catch(() => {});
  }
} else {
  $('#aboutMode').textContent = 'Browser edition.';
}
