// ===================== touch screens, iPad and Apple Pencil =====================
// Touch mode enlarges every control, adds an on-screen bar for the keys a tablet lacks (Shift, Alt, Ctrl,
// secondary color, undo/redo), lets the Pencil draw while fingers pan and zoom, recognizes two- and
// three-finger taps as undo and redo, shows button names on a long press and saves through the share sheet.
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_STANDALONE = (() => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e){ return false; } })();
const TOUCH = { on: false, shift: false, alt: false, ctrl: false, sec: false, pencilOnly: false, lastTouch: 0 };
{
  const saved = store.get('touch', null);
  let coarse = false; try { coarse = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches; } catch (e){}
  TOUCH.on = saved === null ? (IS_IOS || coarse) : !!saved;
  TOUCH.pencilOnly = !!store.get('pencilOnly', false);
}
const touchRecent = () => Date.now() - TOUCH.lastTouch < 1200;
document.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') TOUCH.lastTouch = Date.now(); }, true);

// the bar of on-screen keys, floating over the top-right of the canvas
const touchBar = document.createElement('div');
touchBar.id = 'touchBar'; touchBar.className = 'touchbar raised';
touchBar.innerHTML = [
  ['undo', 'Undo (or tap with two fingers)', '<i class="ic" data-ic="undo"></i>'],
  ['redo', 'Redo (or tap with three fingers)', '<i class="ic" data-ic="redo"></i>'],
  ['|'],
  ['shift', 'Shift: straight and 45° lines, squares and circles, keep proportions; with the Eraser it ignores edges', 'Shift'],
  ['alt', 'Alt: the Eraser restores; drawing tools pick a color', 'Alt'],
  ['ctrl', 'Ctrl: with the Move tool, corners distort and edges skew', 'Ctrl'],
  ['sec', 'Paint and pick with the secondary color', '<span class="tk-sec"></span>2nd'],
  ['|'],
  ['fit', 'Fit the picture to the window', '<i class="ic" data-ic="fit"></i>'],
  ['dock', 'Show or hide the side panels for a bigger canvas', '<i class="ic" data-ic="options"></i>'],
  ['canvas', 'Canvas view: hide everything but the picture (also a Pencil double tap or a four-finger tap)', '<i class="ic" data-ic="canvasview"></i>']
].map(([k, tip, html]) => k === '|' ? '<span class="tk-sep"></span>' : '<button type="button" class="tk" data-tk="' + k + '" data-tip="' + tip.split(':')[0] + '" data-help="' + tip + '"' + (['shift', 'alt', 'ctrl', 'sec'].includes(k) ? ' aria-pressed="false"' : '') + '>' + html + '</button>').join('');
$('#stage').appendChild(touchBar);
touchBar.addEventListener('pointerdown', e => e.stopPropagation());
touchBar.querySelectorAll('.tk').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.tk;
  if (k === 'undo') undo(); else if (k === 'redo') redo(); else if (k === 'fit') fit();
  else if (k === 'dock') toggleDock();
  else if (k === 'canvas') setCanvasOnly(true);
  else { TOUCH[k] = !TOUCH[k]; b.setAttribute('aria-pressed', String(TOUCH[k])); if (S.hover){ S.hover.shift = TOUCH.shift; S.hover.alt = TOUCH.alt; } updateHud(); requestDraw(); }
}));
function syncTouchBar(){ touchBar.querySelectorAll('[aria-pressed]').forEach(b => b.setAttribute('aria-pressed', String(!!TOUCH[b.dataset.tk]))); }
function toggleDock(){ document.documentElement.classList.toggle('nodock'); setTimeout(() => { resize(); fit(); }, 30); }
function applyTouchMode(){
  document.documentElement.classList.toggle('touch', TOUCH.on);
  touchBar.hidden = !TOUCH.on;
  if (!TOUCH.on){ TOUCH.shift = TOUCH.alt = TOUCH.ctrl = TOUCH.sec = false; syncTouchBar(); document.documentElement.classList.remove('nodock'); }
  setTimeout(() => { resize(); if (W) fit(); }, 30);
}
function setTouchMode(on){ TOUCH.on = on; store.set('touch', on); applyTouchMode(); sbFlash(on ? 'Touch mode on: bigger controls and an on-screen key bar.' : 'Touch mode off.'); }
function setPencilOnly(on, auto){
  TOUCH.pencilOnly = on; store.set('pencilOnly', on);
  sbFlash(on ? (auto ? 'Apple Pencil found: the Pencil draws, fingers pan and zoom. Change this in the View menu.' : 'The Pencil draws; fingers pan and zoom.') : 'Fingers draw too.', 6000);
}
{
  const vm = MENUS.viewm, at = vm.findIndex(it => it && it.c === 'ghost');
  vm.splice(at, 0,
    { l: 'Touch mode (big controls)', c: 'touchMode', ck: () => TOUCH.on },
    { l: 'Pencil draws, fingers pan', c: 'pencilOnly', ck: () => TOUCH.pencilOnly },
    { l: 'Side panels', c: 'toggleDock', ck: () => !document.documentElement.classList.contains('nodock') },
    '-');
}

// ---------- pointer events on the canvas: add the latched keys, route fingers to panning ----------
const SEC_TOOLS = () => DRAW_TOOLS.includes(S.tool) || SHAPE_TOOLS.includes(S.tool) || S.tool === 'fill' || S.tool === 'picker';
const fingerPans = e => TOUCH.pencilOnly && e.pointerType === 'touch';
['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach(type => view.addEventListener(type, e => {
  if (e.__gw) return;
  if (type === 'pointerdown' && e.pointerType === 'pen' && !TOUCH.pencilOnly && store.get('pencilOnly', null) === null) setPencilOnly(true, true);
  const latched = TOUCH.on && (TOUCH.shift || TOUCH.alt || TOUCH.ctrl || TOUCH.sec);
  if (!latched && !fingerPans(e)) return;
  e.stopImmediatePropagation(); e.preventDefault();
  let button = e.button;
  if (type === 'pointerdown'){ if (fingerPans(e)) button = 1; else if (TOUCH.on && TOUCH.sec && e.button === 0 && SEC_TOOLS()) button = 2; }
  const ne = new PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary,
    width: e.width, height: e.height, pressure: e.pressure, tangentialPressure: e.tangentialPressure, tiltX: e.tiltX, tiltY: e.tiltY, twist: e.twist,
    clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY, button, buttons: e.buttons,
    shiftKey: e.shiftKey || (TOUCH.on && TOUCH.shift), altKey: e.altKey || (TOUCH.on && TOUCH.alt), ctrlKey: e.ctrlKey || (TOUCH.on && TOUCH.ctrl), metaKey: e.metaKey
  });
  ne.__gw = true;
  view.dispatchEvent(ne);
}, true));

// ---------- finger taps: two fingers = undo, three = redo, four = canvas view ----------
// Watched at the window, before anything else sees the touches, so it works in every tool and mode.
const tapT = { ids: new Map(), max: 0, t0: 0, moved: false, view: null };
const onView = e => e.target === view;
window.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch' || !onView(e) || e.__held || e.__gw) return;
  if (!tapT.ids.size){ tapT.max = 0; tapT.t0 = performance.now(); tapT.moved = false; tapT.view = [S.zoom, S.panX, S.panY]; }
  tapT.ids.set(e.pointerId, [e.clientX, e.clientY]); tapT.max = Math.max(tapT.max, tapT.ids.size);
}, true);
window.addEventListener('pointermove', e => {
  const p = tapT.ids.get(e.pointerId); if (!p || e.__held || e.__gw) return;
  if (Math.hypot(e.clientX - p[0], e.clientY - p[1]) > 20) tapT.moved = true;
}, true);
const tapEnd = e => {
  if (!tapT.ids.has(e.pointerId) || e.__held || e.__gw) return;
  tapT.ids.delete(e.pointerId);
  if (tapT.ids.size) return;
  const n = tapT.max;
  if (n >= 2 && !tapT.moved && performance.now() - tapT.t0 < 500){
    const [z, px, py] = tapT.view;   // a quick tap is not a pinch: put the view back
    setTimeout(() => {
      setZoom(z, cw / 2, ch / 2); S.panX = px; S.panY = py; requestDraw();
      if (n === 2){ undo(); sbFlash('Undo', 1200); }
      else if (n === 3){ redo(); sbFlash('Redo', 1200); }
      else toggleCanvasOnly();
    }, 0);
  }
};
window.addEventListener('pointerup', tapEnd, true);
window.addEventListener('pointercancel', tapEnd, true);

// A finger that lands on the canvas waits a moment before it acts, so the first finger of a two- or
// three-finger tap (or of a pinch) never drops paint, fills, picks or starts a crop box.
const HOLD_MS = 110;
let held = null;   // { down, moves: [], timer }
const redispatch = (src, type, button) => {
  const ne = new PointerEvent(type || src.type, {
    bubbles: true, cancelable: true, composed: true, pointerId: src.pointerId, pointerType: src.pointerType, isPrimary: src.isPrimary,
    width: src.width, height: src.height, pressure: src.pressure, tiltX: src.tiltX, tiltY: src.tiltY,
    clientX: src.clientX, clientY: src.clientY, screenX: src.screenX, screenY: src.screenY,
    button: button == null ? src.button : button, buttons: src.buttons, shiftKey: src.shiftKey, altKey: src.altKey, ctrlKey: src.ctrlKey, metaKey: src.metaKey
  });
  ne.__held = true; view.dispatchEvent(ne);
};
function releaseHeld(asPan){
  if (!held) return; const h = held; held = null; clearTimeout(h.timer);
  redispatch(h.down, 'pointerdown', asPan ? 1 : null);
}
const holdWanted = e => e.pointerType === 'touch' && onView(e) && !e.__held && !e.__gw && W && !S.space && S.tool !== 'hand' && !fingerPans(e);
window.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch' || !onView(e) || e.__held || e.__gw) return;
  if (held){ releaseHeld(true); return; }            // second finger: the first one becomes part of a pinch
  if (!holdWanted(e) || tapT.ids.size > 1) return;
  e.stopImmediatePropagation(); e.preventDefault();
  held = { down: e, timer: setTimeout(() => releaseHeld(false), HOLD_MS) };
}, true);
window.addEventListener('pointermove', e => {
  if (!held || e.pointerId !== held.down.pointerId || e.__held || e.__gw) return;
  if (Math.hypot(e.clientX - held.down.clientX, e.clientY - held.down.clientY) > 10){ releaseHeld(false); return; }
  e.stopImmediatePropagation();
}, true);
['pointerup', 'pointercancel'].forEach(t => window.addEventListener(t, e => {
  if (!held || e.pointerId !== held.down.pointerId || e.__held || e.__gw) return;
  releaseHeld(false);   // a quick single tap still counts as a tap with the tool
}, true));

// a second finger turns whatever the first one started into a pinch: undo it instead of keeping it
function drawCancel(){ clearInterval(DS.airT); DS.active = false; DS.bbox = null; requestDraw(); }
function gestureStarted(){
  if (DS.active){ if (performance.now() - (DS.t0 || 0) < 350) drawCancel(); else endDraw(); }
  if (XF && XF.drag){ XF.quad = XF.drag.start.map(c => c.slice()); XF.drag = null; requestDraw(); }
  if (boxDrag){
    const d = boxDrag; boxDrag = null;   // put the crop or track box back the way it was
    if (d.kind === 'crop'){ S.crop = d.start ? { ...d.start } : null; syncCropUI(); } else S.track = d.start ? { ...d.start } : null;
    requestDraw();
  }
}
const HIT_TOL = () => TOUCH.on ? 16 : 6;

// ---------- Apple Pencil: double-tap the screen with the tip to hide or show the interface ----------
// (The tap on the side of the Pencil is only available to App Store apps, not to web apps.)
TOUCH.penDbl = store.get('penDbl', true);
const PT = { downT: 0, downXY: null, moved: false, top: null, lastShort: false, lastUpT: 0, lastUpXY: null, swallow: null };
window.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'pen' || !onView(e) || e.__gw || e.__held) return;
  const now = performance.now();
  if (TOUCH.penDbl && PT.lastShort && now - PT.lastUpT < 350 && Math.hypot(e.clientX - PT.lastUpXY[0], e.clientY - PT.lastUpXY[1]) < 28){
    e.stopImmediatePropagation(); e.preventDefault(); PT.swallow = e.pointerId; PT.lastShort = false;
    if (undoStack.length && undoStack[undoStack.length - 1] !== PT.top){ undo(); redoStack.length = 0; updateUndoUI(); }   // take back the first tap's dot
    toggleCanvasOnly(); return;
  }
  PT.downT = now; PT.downXY = [e.clientX, e.clientY]; PT.moved = false; PT.top = undoStack[undoStack.length - 1] || null;
}, true);
window.addEventListener('pointermove', e => {
  if (e.pointerType !== 'pen' || e.__gw || e.__held) return;
  if (PT.swallow === e.pointerId){ e.stopImmediatePropagation(); return; }
  if (PT.downXY && Math.hypot(e.clientX - PT.downXY[0], e.clientY - PT.downXY[1]) > 8) PT.moved = true;
}, true);
['pointerup', 'pointercancel'].forEach(t => window.addEventListener(t, e => {
  if (e.pointerType !== 'pen' || e.__gw || e.__held) return;
  if (PT.swallow === e.pointerId){ PT.swallow = null; e.stopImmediatePropagation(); return; }
  if (!PT.downXY) return;
  const now = performance.now();
  PT.lastShort = !PT.moved && now - PT.downT < 250 && t === 'pointerup'; PT.lastUpT = now; PT.lastUpXY = [e.clientX, e.clientY]; PT.downXY = null;
}, true));

// ---------- canvas view: hide everything but the picture ----------
const coExit = document.createElement('button');
coExit.type = 'button'; coExit.id = 'coExit'; coExit.className = 'coexit'; coExit.hidden = true;
coExit.innerHTML = '<i class="ic" data-ic="canvasview"></i><span>Show interface</span>';
coExit.dataset.tip = 'Show the interface again'; coExit.dataset.help = 'Shows the menus, tools and panels again. Shortcut: Tab, a double tap with the Pencil tip, or a four-finger tap.';
$('#stage').appendChild(coExit);
coExit.addEventListener('pointerdown', e => e.stopPropagation());
coExit.addEventListener('click', () => setCanvasOnly(false));
function setCanvasOnly(on){
  document.documentElement.classList.toggle('canvasonly', on); coExit.hidden = !on;
  if (typeof miniSync === 'function') setTimeout(miniSync, 0);
  if (on) sbFlash('Canvas view');
  setTimeout(() => { resize(); requestDraw(); }, 30);
  if (on && !store.get('coHint', false)){ store.set('coHint', true); toast('Canvas view. To bring the interface back: double-tap with the Pencil tip, tap with four fingers, press Tab, or use the button in the corner.', 6000); }
}
const toggleCanvasOnly = () => setCanvasOnly(!document.documentElement.classList.contains('canvasonly'));
window.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') || anyModal() || openMenu) return;
  e.preventDefault(); toggleCanvasOnly();
}, true);
{
  const tb = $('.toolbar'), help = tb.querySelector('[data-cmd="help"]');
  const b = document.createElement('button'); b.type = 'button'; b.className = 'tb'; b.dataset.cmd = 'canvasView';
  b.dataset.tip = 'Canvas view'; b.dataset.key = 'Tab'; b.dataset.help = 'Hides everything but the picture. Tab, a double tap with the Pencil tip or a four-finger tap brings the interface back.';
  b.innerHTML = '<i class="ic" data-ic="canvasview"></i>'; b.addEventListener('click', () => setCanvasOnly(true));
  if (help) help.before(b); else tb.appendChild(b);
}

// ---------- minimize the Layers panel ----------
const lHead = $('.layerdock .panehead');
const lInfoHead = document.createElement('span'); lInfoHead.className = 'phinfo';
const lMin = document.createElement('button'); lMin.type = 'button'; lMin.className = 'phbtn'; lMin.id = 'layersMin';
lHead.append(lInfoHead, lMin);
lHead.addEventListener('click', e => { if (e.target.closest('.panehead')) setLayersMin(!document.documentElement.classList.contains('layersmin')); });
function setLayersMin(on){
  document.documentElement.classList.toggle('layersmin', on); store.set('layersMin', on);
  lMin.textContent = on ? '▸' : '▾';
  lMin.dataset.tip = on ? 'Show the Layers panel' : 'Minimize the Layers panel';
  lHead.dataset.help = on ? 'The Layers panel is minimized. Tap here to show it.' : 'Tap here to minimize the Layers panel and make room for the options below.';
  updateLayerHead();
}
function updateLayerHead(){
  if (!lInfoHead) return;
  lInfoHead.textContent = document.documentElement.classList.contains('layersmin') && AL ? layers.length + (layers.length === 1 ? ' layer · ' : ' layers · ') + AL.name : '';
}

// ---------- menu entries ----------
function touchCmd(c){
  if (c === 'touchMode'){ setTouchMode(!TOUCH.on); return true; }
  if (c === 'pencilOnly'){ setPencilOnly(!TOUCH.pencilOnly); return true; }
  if (c === 'toggleDock'){ toggleDock(); return true; }
  if (c === 'canvasView'){ toggleCanvasOnly(); return true; }
  if (c === 'layersMin'){ setLayersMin(!document.documentElement.classList.contains('layersmin')); return true; }
  if (c === 'penDbl'){ TOUCH.penDbl = !TOUCH.penDbl; store.set('penDbl', TOUCH.penDbl); sbFlash(TOUCH.penDbl ? 'A double tap with the Pencil tip hides or shows the interface.' : 'Pencil double tap turned off.'); return true; }
  return false;
}
{
  const vm = MENUS.viewm, at = vm.findIndex(it => it && it.c === 'touchMode');
  vm.splice(at, 0, { l: 'Canvas view (hide interface)', k: 'Tab', c: 'canvasView', ck: () => document.documentElement.classList.contains('canvasonly') }, '-');
  const at2 = vm.findIndex(it => it && it.c === 'pencilOnly');
  vm.splice(at2 + 1, 0, { l: 'Pencil double tap toggles canvas view', c: 'penDbl', ck: () => TOUCH.penDbl });
  const at3 = vm.findIndex(it => it && it.c === 'toggleDock');
  vm.splice(at3 + 1, 0, { l: 'Layers panel', c: 'layersMin', ck: () => !document.documentElement.classList.contains('layersmin') });
  const lm = MENUS.layerm; lm.push('-', { l: 'Minimize Layers panel', c: 'layersMin', ck: () => document.documentElement.classList.contains('layersmin') });
}
setLayersMin(!!store.get('layersMin', false));

// ---------- long press shows a button's name (there is no hover on a tablet) ----------
let lpT = 0, lpHide = 0, lpAt = null;
document.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') return;
  const el = e.target.closest && e.target.closest('[data-tip]'); clearTimeout(lpT); if (!el) return; lpAt = [e.clientX, e.clientY];
  lpT = setTimeout(() => {
    const t = $('#tip'); t.innerHTML = ''; t.append(el.dataset.tip); t.hidden = false;
    const r = el.getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight;
    let x = Math.min(innerWidth - tw - 4, Math.max(4, r.left)), y = r.bottom + 6; if (y + th > innerHeight - 4) y = r.top - th - 6;
    t.style.left = x + 'px'; t.style.top = y + 'px'; sbSet(el.dataset.help || el.dataset.tip);
    clearTimeout(lpHide); lpHide = setTimeout(() => t.hidden = true, 2200);
  }, 480);
}, true);
['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, () => clearTimeout(lpT), true));
document.addEventListener('pointermove', e => { if (lpAt && e.pointerType !== 'mouse' && Math.hypot(e.clientX - lpAt[0], e.clientY - lpAt[1]) > 10) clearTimeout(lpT); }, true);
document.addEventListener('contextmenu', e => { if (TOUCH.on && e.target.closest('[data-tip]')) e.preventDefault(); });
// stop Safari from zooming the whole page with pinches or double taps outside the canvas
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => { if (TOUCH.on && e.target.closest('button')) e.preventDefault(); });

// ---------- saving on iPad: hand the finished file to the share sheet ----------
const canShareFiles = () => { try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [new File([new Uint8Array(1)], 'x.png', { type: 'image/png' })] })); } catch (e){ return false; } };
const shareWanted = () => (IS_IOS || (TOUCH.on && !canPick)) && canShareFiles();
let pendingShare = null;
const shareDlg = document.createElement('div');
shareDlg.className = 'modal'; shareDlg.id = 'shareDlg'; shareDlg.hidden = true;
shareDlg.innerHTML = '<div class="win" role="dialog" aria-modal="true" aria-labelledby="shTitle" style="width:min(420px,94vw)">' +
  '<div class="titlebar"><span class="tt" id="shTitle">Save</span><button class="tbx" type="button" id="shX" aria-label="Close"><svg viewBox="0 0 8 7"><path d="M0 0h2v1h1v1h2V1h1V0h2v1H7v1H6v1H5v1h1v1h1v1h1v1H6V6H5V5H3v1H2v1H0V6h1V5h1V4h1V3H2V2H1V1H0z"/></svg></button></div>' +
  '<div class="winbody"><p class="hint" id="shInfo"></p><p class="hint dim">Tap Save, then choose <b>Save to Files</b> to pick a folder, <b>Save Image</b> for Photos, or another app.</p>' +
  '<div class="winbtns"><button class="btn" type="button" id="shCancel">Cancel</button><button class="btn default" type="button" id="shGo">Save…</button></div></div></div>';
document.body.appendChild(shareDlg);
function shareFile(blob, filename){
  const type = blob.type || (/\.png$/i.test(filename) ? 'image/png' : /\.gif$/i.test(filename) ? 'image/gif' : /\.webp$/i.test(filename) ? 'image/webp' : /\.tif$/i.test(filename) ? 'image/tiff' : 'application/octet-stream');
  pendingShare = new File([blob], filename, { type });
  $('#shTitle').textContent = 'Save ' + filename;
  $('#shInfo').textContent = filename + ' is ready (' + fmtBytes(blob.size) + ').';
  shareDlg.hidden = false;
}
const closeShare = () => { shareDlg.hidden = true; pendingShare = null; };
$('#shX').addEventListener('click', closeShare);
$('#shCancel').addEventListener('click', () => { closeShare(); sbFlash('Save cancelled.'); });
$('#shGo').addEventListener('click', () => {
  const f = pendingShare; if (!f) return;
  // share() must run straight from the tap, so the file was prepared before this dialog opened
  navigator.share({ files: [f], title: f.name }).then(() => { closeShare(); toast('Saved ' + f.name); })
    .catch(err => { if (err && err.name === 'AbortError'){ sbFlash('Save cancelled.'); } else { closeShare(); fallbackDownload(f, f.name); } });
});
function fallbackDownload(blob, filename){
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}

// ---------- iPad limits and file picking ----------
// Safari caps a single canvas at about 16.7 million pixels and gives pages less memory than a PC
const MAX_PIXELS = IS_IOS ? 16e6 : 64e6;
if (IS_IOS){ $('#fileIn').removeAttribute('accept'); $('#layerIn').setAttribute('accept', 'image/*'); }

// ---------- installed web app: offline copy and updates ----------
const APP_FILES = ['index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
function initPWA(){
  if (!window.__GWIZ_PWA__ || !('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    // the page itself compares the copy it runs from with the one online, so any edit to the site is noticed
    const check = () => { if (navigator.onLine && document.visibilityState === 'visible'){ reg.update().catch(() => {}); checkForUpdate(); } };
    setTimeout(check, 2500); setInterval(check, 30 * 60 * 1000);
    window.addEventListener('online', check);
  }).catch(() => {});
}
let updChecking = false, updFound = false;
async function checkForUpdate(){
  if (updChecking || updFound || !window.caches) return; updChecking = true;
  try {
    const url = new URL('index.html', location.href).href;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return;
    const fresh = new Uint8Array(await res.clone().arrayBuffer());
    const c = await caches.open('gwiz-app'), old = await c.match(url);
    if (old){
      const ob = new Uint8Array(await old.arrayBuffer());
      if (ob.length === fresh.length){ let same = true; for (let i = 0; i < ob.length; i++) if (ob[i] !== fresh[i]){ same = false; break; } if (same) return; }
    }
    await c.put(url, res);
    await Promise.all(APP_FILES.slice(1).map(async f => { try { const u = new URL(f, location.href).href, r = await fetch(u, { cache: 'no-store' }); if (r.ok) await c.put(u, r); } catch (e){} }));
    if (old){ updFound = true; showUpdateBar(); }
  } catch (e){ /* offline or the site is unreachable: keep using this copy */ }
  finally { updChecking = false; }
}
function showUpdateBar(ver){
  let bar = $('#updBar');
  if (!bar){
    bar = document.createElement('div'); bar.id = 'updBar'; bar.className = 'updbar raised';
    bar.innerHTML = '<span>A new version of G-WIZ has been downloaded.</span><button class="btn default" type="button" id="updGo">Restart now</button><button class="btn" type="button" id="updLater">Later</button>';
    document.body.appendChild(bar);
    $('#updGo').addEventListener('click', () => location.reload());
    $('#updLater').addEventListener('click', () => { bar.hidden = true; sbFlash('The update starts the next time G-WIZ opens.'); });
  }
  bar.hidden = false;
}
applyTouchMode();
initPWA();
