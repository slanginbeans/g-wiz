// ===================== mini bar: tools and sizes while the interface is hidden =====================
// A small floating strip on the left of the canvas in canvas view: the drawing tools, the eraser and
// restore brush, a size slider, an opacity slider for the drawing tools, and the primary color.
const MINI_TOOLS = [['erase', 'eraser', 'Eraser'], ['restore', 'restore', 'Restore brush'], ['pencil', 'pencil', 'Pencil'], ['pen', 'pen', 'Pen'], ['brush', 'brush', 'Brush'], ['marker', 'marker', 'Marker'], ['air', 'airbrush', 'Airbrush'], ['fill', 'fill', 'Paint bucket'], ['move', 'move', 'Move']];
var MINI = { on: store.get('miniOn', true), open: store.get('miniOpen', true), drag: null };
const mini = document.createElement('div'); mini.id = 'miniBar'; mini.className = 'minibar raised'; mini.hidden = true;
mini.innerHTML = '<button type="button" class="mn-toggle" id="mnToggle" data-tip="Collapse or expand">▾</button>' +
  '<div class="mn-body">' +
  '<div class="mn-tools">' + MINI_TOOLS.map(([t, ic, name]) => '<button type="button" class="mn-tool" data-mtool="' + t + '" data-tip="' + name + '" aria-pressed="false"><i class="ic" data-ic="' + ic + '"></i></button>').join('') + '</div>' +
  '<div class="mn-sliders">' +
  '<div class="mn-sl" id="mnSize" data-tip="Size"><div class="mn-track"><div class="mn-fill"></div><div class="mn-thumb"></div></div><div class="mn-val" id="mnSizeVal">24</div></div>' +
  '<div class="mn-sl" id="mnOp" data-tip="Opacity"><div class="mn-track"><div class="mn-fill"></div><div class="mn-thumb"></div></div><div class="mn-val" id="mnOpVal">100</div></div>' +
  '</div>' +
  '<button type="button" class="mn-color" id="mnColor" data-tip="Primary color (tap to change)"></button>' +
  '<div class="mn-undo"><button type="button" class="mn-tool" id="mnUndo" data-tip="Undo"><i class="ic" data-ic="undo"></i></button><button type="button" class="mn-tool" id="mnRedo" data-tip="Redo"><i class="ic" data-ic="redo"></i></button></div>' +
  '</div>';
$('#stage').appendChild(mini);
mini.addEventListener('pointerdown', e => e.stopPropagation());
mini.addEventListener('contextmenu', e => e.preventDefault());
$$('#miniBar .mn-tool[data-mtool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.mtool)));
$('#mnUndo').addEventListener('click', undo); $('#mnRedo').addEventListener('click', redo);
$('#mnColor').addEventListener('click', () => openColorDlg(1));
$('#mnToggle').addEventListener('click', () => { MINI.open = !MINI.open; store.set('miniOpen', MINI.open); miniSync(); });
// which number the size slider edits depends on the tool
function miniSizeInfo(){
  const t = S.tool;
  if (t === 'erase' || t === 'restore') return { min: 2, max: 500, get: () => S.size, set: v => setSize(v), op: null };
  if (DRAW_TOOLS.includes(t)) return { min: 1, max: 200, get: () => S.draw[t].size, set: v => setDrawSize(v), op: { get: () => S.draw[t].opacity, set: v => { S.draw[t].opacity = v; $('#dOpacity').value = v; $('#dOpacity').dispatchEvent(new Event('input')); } } };
  if (SHAPE_TOOLS.includes(t)) return { min: 1, max: 60, get: () => S.shape.width, set: v => setDrawSize(v), op: { get: () => S.shape.opacity, set: v => { S.shape.opacity = v; $('#shOpacity').value = v; $('#shOpacity').dispatchEvent(new Event('input')); } } };
  if (t === 'hintKeep' || t === 'hintDrop') return { min: 4, max: 200, get: () => CUT.hintSize, set: v => { CUT.hintSize = v; $('#aHintSize').value = v; $('#aHintSize').dispatchEvent(new Event('input')); }, op: null };
  if (t === 'fill') return { min: 0, max: 100, get: () => S.fTol, set: v => { $('#fTol').value = v; $('#fTol').dispatchEvent(new Event('input')); }, op: { get: () => S.fOpacity, set: v => { $('#fOpacity').value = v; $('#fOpacity').dispatchEvent(new Event('input')); } }, label: 'tol' };
  return null;
}
// sliders run on a log scale so small sizes are easy to hit
const toPos = (v, mn, mx) => mn <= 0 ? (v - mn) / (mx - mn) : Math.log(v / mn) / Math.log(mx / mn);
const fromPos = (p, mn, mx) => mn <= 0 ? mn + p * (mx - mn) : mn * Math.pow(mx / mn, p);
function miniSync(){
  if (!MINI || !DRAW_TOOLS) return;
  const show = MINI.on && document.documentElement.classList.contains('canvasonly') && W;
  mini.hidden = !show; if (!show) return;
  mini.classList.toggle('closed', !MINI.open); $('#mnToggle').textContent = MINI.open ? '▴' : '▾';
  $$('#miniBar .mn-tool[data-mtool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mtool === S.tool)));
  const info = miniSizeInfo();
  const sz = $('#mnSize'), op = $('#mnOp');
  sz.hidden = !info; op.hidden = !(info && info.op);
  if (info){
    const v = info.get(), p = Math.min(1, Math.max(0, toPos(v, info.min, info.max)));
    sz.querySelector('.mn-fill').style.height = (p * 100) + '%'; sz.querySelector('.mn-thumb').style.bottom = 'calc(' + (p * 100) + '% - 6px)';
    $('#mnSizeVal').textContent = info.label === 'tol' ? v + '%' : Math.round(v);
    sz.dataset.tip = info.label === 'tol' ? 'Tolerance' : 'Size';
    if (info.op){ const ov = info.op.get(), q = ov / 100; op.querySelector('.mn-fill').style.height = (q * 100) + '%'; op.querySelector('.mn-thumb').style.bottom = 'calc(' + (q * 100) + '% - 6px)'; $('#mnOpVal').textContent = Math.round(ov) + '%'; }
  }
  $('#mnColor').style.setProperty('--c', cssc(S.c1));
  $('#mnUndo').disabled = !undoStack.length; $('#mnRedo').disabled = !redoStack.length;
}
function miniDrag(el, apply){
  const track = el.querySelector('.mn-track');
  const at = e => { const r = track.getBoundingClientRect(); return Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)); };
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId); apply(at(e));
    const mv = ev => apply(at(ev)), up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
}
miniDrag($('#mnSize'), p => { const info = miniSizeInfo(); if (!info) return; info.set(Math.round(fromPos(p, info.min, info.max))); miniSync(); });
miniDrag($('#mnOp'), p => { const info = miniSizeInfo(); if (!info || !info.op) return; info.op.set(Math.round(p * 100)); miniSync(); });
// menu entry
{
  const vm = MENUS.viewm, at = vm.findIndex(it => it && it.c === 'canvasView');
  vm.splice(at + 1, 0, { l: 'Tool strip in canvas view', c: 'miniBar', ck: () => MINI.on });
}
function miniCmd(c){ if (c === 'miniBar'){ MINI.on = !MINI.on; store.set('miniOn', MINI.on); miniSync(); return true; } return false; }
