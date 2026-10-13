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
function runCmd(c){ if (touchCmd(c) || animCmd(c) || miniCmd(c) || sessionCmd(c) || pixelCmd(c) || cutoutToolsCmd(c) || pixelToolsCmd(c)) return;
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
