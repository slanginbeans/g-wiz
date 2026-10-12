// ---------- layers panel ----------
function renderLayersPanel(){
  const list = $('#layerList'); if (!list) return;
  list.innerHTML = '';
  for (let k = layers.length - 1; k >= 0; k--){
    const L = layers[k], row = document.createElement('div');
    row.className = 'lyr' + (L === AL ? ' sel' : ''); row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(L === AL)); row.draggable = true; row.dataset.id = L.id;
    const eye = document.createElement('button'); eye.className = 'lbtn' + (L.visible ? '' : ' off'); eye.innerHTML = '<i class="ic" data-ic="eye"></i>'; eye.dataset.tip = L.visible ? 'Hide layer' : 'Show layer';
    eye.addEventListener('click', ev => { ev.stopPropagation(); L.visible = !L.visible; renderLayersPanel(); syncLayerProps(); requestDraw(); });
    const th = document.createElement('div'); th.className = 'lthumb'; const tc = document.createElement('canvas'); th.appendChild(tc);
    const nm = document.createElement('div'); nm.className = 'lname';
    const t1 = document.createElement('div'); t1.textContent = L.name; const t2 = document.createElement('div'); t2.className = 'lsub';
    const fr = lfr(L), lw = L === AL ? W : L.W, lh = L === AL ? H : L.H;
    t2.textContent = lw + '×' + lh + (fr.length > 1 ? ' · ' + fr.length + ' fr' : '') + (L.blend !== 'source-over' ? ' · ' + $('#lBlend option[value="' + L.blend + '"]').textContent : '') + (L.opacity < 1 ? ' · ' + Math.round(L.opacity * 100) + '%' : '');
    nm.append(t1, t2);
    const lk = document.createElement('button'); lk.className = 'lbtn' + (L.locked ? '' : ' off'); lk.innerHTML = '<i class="ic" data-ic="lock"></i>'; lk.dataset.tip = L.locked ? 'Unlock layer' : 'Lock layer';
    lk.addEventListener('click', ev => { ev.stopPropagation(); L.locked = !L.locked; renderLayersPanel(); syncLayerProps(); });
    row.append(eye, th, nm, lk);
    row.addEventListener('mousedown', () => { if (L !== AL) activateLayer(L); });
    t1.addEventListener('dblclick', () => {
      const inp = document.createElement('input'); inp.type = 'text'; inp.value = L.name; t1.replaceWith(inp); inp.focus(); inp.select();
      const done = ok => { if (ok && inp.value.trim()) L.name = inp.value.trim(); renderLayersPanel(); syncLayerProps(); };
      inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); });
      inp.addEventListener('blur', () => done(true));
    });
    row.addEventListener('dragstart', ev => { ev.dataTransfer.setData('text/gwiz-layer', String(L.id)); ev.dataTransfer.effectAllowed = 'move'; });
    row.addEventListener('dragover', ev => { if ([...ev.dataTransfer.types].includes('text/gwiz-layer')){ ev.preventDefault(); row.classList.add('dragover'); } });
    row.addEventListener('dragleave', () => row.classList.remove('dragover'));
    row.addEventListener('drop', ev => {
      const id = +ev.dataTransfer.getData('text/gwiz-layer'); if (!id) return;
      ev.preventDefault(); ev.stopPropagation(); row.classList.remove('dragover');
      const src = layerById(id); if (!src || src === L) return;
      let idx = layers.indexOf(L); if (layers.indexOf(src) > idx) idx += 1;
      layerMoveTo(src, layers.indexOf(src) < idx ? idx - 1 + 1 : idx);
    });
    list.appendChild(row);
    drawLayerThumb(L, tc);
  }
  const ms = $$('[data-cmd="layerDel"],[data-cmd="layerMerge"]'); ms.forEach(b => b.disabled = layers.length < 2);
  updateLayerHead();
}
function drawLayerThumb(L, tc){
  const lw = L === AL ? W : L.W, lh = L === AL ? H : L.H; if (!lw) return;
  const s = Math.min(30 / lw, 26 / lh); tc.width = Math.max(1, Math.round(lw * s)); tc.height = Math.max(1, Math.round(lh * s));
  const g = tc.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(L === AL ? imgCanvas : L.canvas, 0, 0, tc.width, tc.height);
}
let lthT = 0;
function scheduleLayerThumb(){ clearTimeout(lthT); lthT = setTimeout(() => { const row = $('#layerList .lyr.sel canvas'); if (row && AL) drawLayerThumb(AL, row); }, 250); }
function syncLayerProps(){
  if (!AL) return;
  $('#lBlend').value = AL.blend; $('#lOpac').value = Math.round(AL.opacity * 100); $('#lOpacOut').textContent = Math.round(AL.opacity * 100) + '%';
  $('#lName').value = AL.name; $('#lVis').checked = AL.visible; $('#lLock').checked = AL.locked;
  $('#lInfo').textContent = 'Layer ' + (layers.indexOf(AL) + 1) + ' of ' + layers.length + ' · ' + W + ' × ' + H + ' px at ' + AL.x + ', ' + AL.y + (frames.length > 1 ? ' · ' + frames.length + ' frames' : '');
  const set = (id, v) => { const e = $('#' + id); if (document.activeElement !== e) e.value = v; };
  set('xX', AL.x); set('xY', AL.y); set('xW', W); set('xH', H);
  $('#cvW').value = DocW; $('#cvH').value = DocH; $('#rsW').value = DocW; $('#rsH').value = DocH;
}
$('#lBlend').addEventListener('change', e => { if (!AL) return; AL.blend = e.target.value; renderLayersPanel(); requestDraw(); });
$('#lOpac').addEventListener('input', e => { if (!AL) return; AL.opacity = +e.target.value / 100; $('#lOpacOut').textContent = e.target.value + '%'; requestDraw(); });
$('#lOpac').addEventListener('change', () => renderLayersPanel());
$('#lName').addEventListener('change', e => { if (AL && e.target.value.trim()){ AL.name = e.target.value.trim(); renderLayersPanel(); } });
$('#lVis').addEventListener('change', e => { if (AL){ AL.visible = e.target.checked; renderLayersPanel(); requestDraw(); } });
$('#lLock').addEventListener('change', e => { if (AL){ AL.locked = e.target.checked; renderLayersPanel(); } });
$('#xApply').addEventListener('click', xfFromNumbers);
$('#xReset').addEventListener('click', () => { if (XF) xfCancel(); $('#xRot').value = 0; $('#xSkX').value = 0; $('#xSkY').value = 0; syncLayerProps(); });
$('#xW').addEventListener('input', () => { if ($('#xKeep').checked && W) $('#xH').value = Math.max(1, Math.round(+$('#xW').value * H / W)); });
$('#xH').addEventListener('input', () => { if ($('#xKeep').checked && H) $('#xW').value = Math.max(1, Math.round(+$('#xH').value * W / H)); });
$('#xCenter').addEventListener('click', layerCenter);
$('#xFit').addEventListener('click', () => xfScaleTo('fit'));
$('#xFill').addEventListener('click', () => xfScaleTo('fill'));
$('#xTrim').addEventListener('click', layerTrim);
$('#xExpand').addEventListener('click', () => { if (!layerExpand()) toast('The layer already covers the canvas.'); });
rangeBind('kFeather', 'kFeather', v => v + ' px');
$('#kApply').addEventListener('click', shapeLayer);
$('#layerIn').addEventListener('change', async e => { const fl = [...e.target.files]; e.target.value = ''; FIT.batch = fl.length; FIT.choice = null; try { for (const f of fl) await loadFile(f, true); } finally { FIT.batch = 0; FIT.choice = null; } });
function importLayer(){ if (!W){ openFile(); return; } $('#layerIn').click(); }
// canvas page
let cvAnchor = [0.5, 0.5];
(function buildAnchor(){
  const box = $('#cvAnchor');
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++){
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', String(r === 1 && c === 1)); b.setAttribute('aria-label', 'Anchor ' + ['top', 'middle', 'bottom'][r] + ' ' + ['left', 'center', 'right'][c]);
    b.addEventListener('click', () => { cvAnchor = [c / 2, r / 2]; box.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
    box.appendChild(b);
  }
})();
$('#cvApply').addEventListener('click', () => { const w = Math.round(+$('#cvW').value), h = Math.round(+$('#cvH').value); if (w > 0 && h > 0 && (w !== DocW || h !== DocH)) canvasResize(w, h, cvAnchor[0], cvAnchor[1]); });
$('#rsPct').addEventListener('input', e => { const p = +e.target.value / 100; $('#rsPctOut').textContent = e.target.value + '%'; $('#rsW').value = Math.max(1, Math.round(DocW * p)); $('#rsH').value = Math.max(1, Math.round(DocH * p)); });
$('#rsW').addEventListener('input', () => { if ($('#rsKeep').checked && DocW) $('#rsH').value = Math.max(1, Math.round(+$('#rsW').value * DocH / DocW)); });
$('#rsH').addEventListener('input', () => { if ($('#rsKeep').checked && DocH) $('#rsW').value = Math.max(1, Math.round(+$('#rsH').value * DocW / DocH)); });
$('#rsApply').addEventListener('click', () => { const w = Math.round(+$('#rsW').value), h = Math.round(+$('#rsH').value); if (w > 0 && h > 0 && (w !== DocW || h !== DocH)) imageResize(w, h, $('#rsSmooth').checked); });

// ---------- new image ----------
let newBg = 'white';
segBind('#nBg', 'v', v => newBg = v);
$('#nPreset').addEventListener('change', e => { const v = e.target.value; if (!v) return; const [w, h] = v.split('x').map(Number); $('#nW').value = w; $('#nH').value = h; });
function newImage(){
  const w = Math.max(1, Math.min(IS_IOS ? 4000 : 20000, Math.round(+$('#nW').value))), h = Math.max(1, Math.min(IS_IOS ? 4000 : 20000, Math.round(+$('#nH').value)));
  const f = new Uint8ClampedArray(w * h * 4);
  if (newBg !== 'clear'){ const c = newBg === 'white' ? { r: 255, g: 255, b: 255, a: 255 } : S.c2; for (let p = 0; p < f.length; p += 4){ f[p] = c.r; f[p + 1] = c.g; f[p + 2] = c.b; f[p + 3] = c.a; } }
  closeModal('newDlg');
  setImage({ w, h, frames: [f], delays: [0] }, 'untitled');
  if (layers[0]) layers[0].name = 'Background';
  renderLayersPanel(); setTool('brush');
}
$('#nOk').addEventListener('click', newImage);
