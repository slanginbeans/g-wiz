// ===================== animation mode: frames, onion skin, motion tween =====================
// Frames belong to layers. A layer with as many frames as the picture is "animated"; a one-frame layer is
// shown on every frame. Frame commands work on the animated layers together so they stay in step.
const ANIM = { on: !!store.get('animOn', false), onion: store.get('onion', true), before: store.get('onBefore', 2), after: store.get('onAfter', 1),
  op: store.get('onOp', 35), tint: store.get('onTint', true), src: store.get('onSrc', 'layer'), copy: !!store.get('amCopy', false) };
PAGE_INFO.animate = ['Animation', 'animate'];

// ---------- frame commands ----------
const isAnimated = (L, N) => lfr(L).length === N && N > 1;
function cloneFrameOf(L, fi, blank){
  const w = L.W, h = L.H;
  return blank ? [new Uint8ClampedArray(w * h * 4), new Uint8Array(w * h).fill(255)] : [L.frames[fi].slice(), L.masks[fi].slice()];
}
// give a layer exactly n frames by repeating what it has (a still layer becomes n copies of itself)
function unrollLayer(L, n){
  const k = L.frames.length; if (k === n) return;
  const fr = [], ms = [], dl = [];
  for (let i = 0; i < n; i++){ const s = i % k; fr.push(i < k ? L.frames[s] : L.frames[s].slice()); ms.push(i < k ? L.masks[s] : L.masks[s].slice()); dl.push(L.delays[s] || 10); }
  L.frames = fr; L.masks = ms; L.delays = dl;
}
function frameMemOk(extraFrames){
  let px = 0; for (const L of layers) if (isAnimated(L, docFrames()) || L === AL) px += L.W * L.H;
  const need = px * 5 * extraFrames, limit = IS_IOS ? 350e6 : 1.2e9;
  let total = 0; for (const L of layers) total += L.frames.length * L.W * L.H * 5;
  if (total + need > limit){ toast('There is not enough memory for more frames. Make the picture smaller or delete some frames.', 5000); return false; }
  return true;
}
function frameOp(fn, msg){
  if (!W || op) return; if (XF) xfCommit(); if (TE) textCommit(); stopPlay();
  saveActive(); const before = captureDoc();
  const go = fn(); if (go === false) return;
  pushLayersUndo(before); refreshDoc(false); onionClear();
  if (typeof go === 'number') setFrame(Math.max(0, Math.min(docFrames() - 1, go)));
  else setFrame(Math.min(S.dcur, docFrames() - 1));
  if (msg) sbFlash(typeof msg === 'function' ? msg() : msg);
}
function addFrame(dup){
  frameOp(() => {
    const N = docFrames(), at = S.dcur + 1;
    if (!frameMemOk(1)) return false;
    if (AL.frames.length !== N) unrollLayer(AL, N);   // the selected layer joins the animation
    for (const L of layers){
      if (!(L === AL || isAnimated(L, N))) continue;
      const fi = S.dcur % L.frames.length, blank = L === AL && !dup && !ANIM.copy;
      const [f, m] = cloneFrameOf(L, fi, blank);
      L.frames = [...L.frames.slice(0, at), f, ...L.frames.slice(at)];
      L.masks = [...L.masks.slice(0, at), m, ...L.masks.slice(at)];
      L.delays = [...L.delays.slice(0, at), L.delays[fi] || 10, ...L.delays.slice(at)];
    }
    return at;
  }, () => (dup ? 'Duplicated the frame' : 'Added a new frame') + ' · frame ' + (S.dcur + 1) + ' of ' + docFrames());
}
function deleteFrame(){
  const N = docFrames(); if (N < 2){ toast('The picture has only one frame.'); return; }
  frameOp(() => {
    const at = S.dcur;
    for (const L of layers){
      if (!isAnimated(L, N)) continue;
      L.frames = L.frames.filter((_, i) => i !== at); L.masks = L.masks.filter((_, i) => i !== at); L.delays = L.delays.filter((_, i) => i !== at);
    }
    return Math.min(at, N - 2);
  }, () => 'Deleted the frame · ' + docFrames() + (docFrames() === 1 ? ' frame left' : ' frames left'));
}
function moveFrame(dir){
  const N = docFrames(), j = S.dcur + dir; if (N < 2 || j < 0 || j >= N) return;
  frameOp(() => {
    const i = S.dcur, sw = a => { const b = a.slice(); [b[i], b[j]] = [b[j], b[i]]; return b; };
    for (const L of layers){ if (!isAnimated(L, N)) continue; L.frames = sw(L.frames); L.masks = sw(L.masks); L.delays = sw(L.delays); }
    return j;
  }, 'Moved the frame to position ' + (j + 1) + '.');
}
function setDelays(cs, all){
  const N = docFrames(); if (!W) return;
  saveActive(); const before = captureDoc();
  for (const L of layers){
    const k = lfr(L).length; if (!(k === N || L === longestLayer())) continue;
    L.delays = L.delays.map((d, i) => (all || i === S.dcur % k) ? cs : d);
  }
  pushLayersUndo(before); refreshDoc(false); updateAnimPage();
}

// ---------- onion skin ----------
const onionCache = new Map();
function onionClear(){ onionCache.clear(); }
const onionOn = () => ANIM.on && ANIM.onion && !S.playing && !XF && docFrames() > 1 && (ANIM.before > 0 || ANIM.after > 0);
function onionCanvas(key, make, w, h, tint){
  let c = onionCache.get(key); if (c) return c;
  c = toCanvas(make(), w, h);
  if (tint){ const g = c.getContext('2d'); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.8; g.fillStyle = tint; g.fillRect(0, 0, w, h); }
  if (onionCache.size > 48) onionCache.clear();
  onionCache.set(key, c); return c;
}
function onionList(){
  const N = docFrames(), out = [], far = Math.max(ANIM.before, ANIM.after, 1);
  for (let k = ANIM.before; k >= 1; k--){ const f = S.dcur - k; if (f >= 0) out.push([f, k, ANIM.tint ? '#ff2a2a' : null]); }
  for (let k = ANIM.after; k >= 1; k--){ const f = S.dcur + k; if (f < N) out.push([f, k, ANIM.tint ? '#14b83c' : null]); }
  return out.map(([f, k, t]) => [f, t, (ANIM.op / 100) * (1 - 0.75 * (k - 1) / far)]);
}
// selected layer only: drawn under the layer's current frame, in the layer's own place
function drawOnionLayer(g, x, y, w, h){
  if (ANIM.src !== 'layer' || !onionOn() || frames.length < 2) return;
  const a0 = g.globalAlpha; g.save(); g.globalCompositeOperation = 'source-over';
  for (const [f, tint, a] of onionList()){
    const fi = f % frames.length; if (fi === S.cur) continue;
    const c = onionCanvas('L' + AL.id + ':' + fi + ':' + tint, () => layerVisible(AL, fi), W, H, tint);
    g.globalAlpha = a0 * a; g.drawImage(c, x, y, w, h);
  }
  g.restore();
}
// whole picture: drawn under all layers
function drawOnionDoc(g, dx, dy, dw, dh){
  if (ANIM.src !== 'doc' || !onionOn()) return;
  g.save(); g.globalCompositeOperation = 'source-over';
  for (const [f, tint, a] of onionList()){
    if (f === S.dcur) continue;
    const c = onionCanvas('D:' + f + ':' + tint, () => composeDoc(f, false), DocW, DocH, tint);
    g.globalAlpha = a; g.drawImage(c, dx, dy, dw, dh);
  }
  g.restore();
}

// ---------- motion tween (baked into frames) ----------
const EASE = { linear: t => t, in: t => t * t, out: t => 1 - (1 - t) * (1 - t), inout: t => t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t) };
const twVals = k => ({ x: +$('#twX' + k).value || 0, y: +$('#twY' + k).value || 0, s: Math.max(1, +$('#twS' + k).value || 100), r: +$('#twR' + k).value || 0, o: Math.max(0, Math.min(100, +$('#twO' + k).value)) });
function twFromLayer(k){ if (!AL) return; $('#twX' + k).value = AL.x; $('#twY' + k).value = AL.y; $('#twS' + k).value = 100; $('#twR' + k).value = 0; $('#twO' + k).value = 100; requestDraw(); sbFlash(k ? 'End set to the layer\'s current position.' : 'Start set to the layer\'s current position.'); }
function twAt(i, a, b, A, B){
  const t = EASE[$('#twEase').value]((Math.max(a, Math.min(b, i)) - a) / Math.max(1, b - a)), L = (p, q) => p + (q - p) * t;
  return { x: L(A.x, B.x), y: L(A.y, B.y), s: L(A.s, B.s), r: L(A.r, B.r), o: L(A.o, B.o) };
}
function createTween(){
  if (!AL) return; if (AL.locked){ toast('The selected layer is locked.'); return; }
  const a = Math.max(1, Math.round(+$('#twFrom').value)) - 1, b = Math.max(1, Math.round(+$('#twTo').value)) - 1;
  if (b <= a){ toast('"To frame" must come after "From frame".'); return; }
  const A = twVals(0), B = twVals(1);
  if (A.x === B.x && A.y === B.y && A.s === B.s && A.r === B.r && A.o === B.o){ toast('Start and end are the same. Move the layer and press "Use the layer\'s current position" for the end.', 5000); return; }
  const N0 = docFrames(), N = Math.max(N0, b + 1);
  let total = 0; for (const L of layers) total += lfr(L).length * (L === AL ? W * H : L.W * L.H) * 5;
  if (total + N * DocW * DocH * 5 > (IS_IOS ? 400e6 : 1.4e9)){ toast('That tween needs more memory than is available. Use fewer frames or a smaller picture.', 5000); return; }
  busy(true);
  setTimeout(() => {
    try {
      frameOp(() => {
        // other animated layers hold their last frame when the timeline grows
        if (N > N0) for (const L of layers){
          if (L === AL || !isAnimated(L, N0)) continue;
          const lastF = L.frames[N0 - 1], lastM = L.masks[N0 - 1], d = L.delays[N0 - 1] || 10;
          for (let i = N0; i < N; i++){ L.frames = [...L.frames, lastF.slice()]; L.masks = [...L.masks, lastM.slice()]; L.delays = [...L.delays, d]; }
        }
        const k = AL.frames.length, srcs = [];
        for (let f = 0; f < k; f++) srcs.push(toCanvas(layerVisible(AL, f), AL.W, AL.H));
        const dl0 = []; for (let i = 0; i < N; i++) dl0.push(i < N0 ? (docDelay(i) || 10) : (docDelay(N0 - 1) || 10));
        const cv = document.createElement('canvas'); cv.width = DocW; cv.height = DocH;
        const g = cv.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        const nf = [], nm = [];
        for (let i = 0; i < N; i++){
          const p = twAt(i, a, b, A, B);
          g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.clearRect(0, 0, DocW, DocH);
          g.globalAlpha = p.o / 100;
          g.translate(p.x + AL.W / 2, p.y + AL.H / 2); g.rotate(p.r * Math.PI / 180); g.scale(p.s / 100, p.s / 100);
          g.drawImage(srcs[i % k], -AL.W / 2, -AL.H / 2);
          nf.push(g.getImageData(0, 0, DocW, DocH).data); nm.push(new Uint8Array(DocW * DocH).fill(255));
        }
        AL.frames = nf; AL.masks = nm; AL.delays = dl0; AL.W = DocW; AL.H = DocH; AL.x = 0; AL.y = 0;
        ensureCanvas(AL);
        return a;
      }, () => 'Tweened "' + AL.name + '" over frames ' + (a + 1) + '–' + (b + 1) + '.');
      if (!ANIM.on) setAnimMode(true);
      $('#twPath').checked = false; requestDraw();
    } finally { busy(false); }
  }, 20);
}
// start and end boxes with the path between them, while the Animation page is open
function drawAnimOverlay(){
  if (curPage !== 'animate' || !AL || !$('#twPath').checked) return;
  const z = S.zoom, A = twVals(0), B = twVals(1), w = W, h = H;
  if (A.x === B.x && A.y === B.y && A.s === B.s && A.r === B.r && A.o === B.o) return;
  const corners = p => { const c = Math.cos(p.r * Math.PI / 180), s = Math.sin(p.r * Math.PI / 180), k = p.s / 100, cx = p.x + w / 2, cy = p.y + h / 2;
    return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([u, v]) => [S.panX + (cx + (u * c - v * s) * k) * z, S.panY + (cy + (u * s + v * c) * k) * z]); };
  vctx.save(); vctx.lineWidth = 1.5;
  [[A, '#ff4040'], [B, '#20c040']].forEach(([p, col]) => { const q = corners(p); vctx.beginPath(); q.forEach((pt, i) => i ? vctx.lineTo(pt[0], pt[1]) : vctx.moveTo(pt[0], pt[1])); vctx.closePath(); vctx.setLineDash([5, 4]); vctx.strokeStyle = col; vctx.stroke(); });
  const a = +$('#twFrom').value - 1, b = +$('#twTo').value - 1;
  vctx.setLineDash([]); vctx.beginPath();
  for (let i = 0; i <= 24; i++){ const p = twAt(a + (b - a) * i / 24, a, b, A, B), x = S.panX + (p.x + w / 2) * z, y = S.panY + (p.y + h / 2) * z; i ? vctx.lineTo(x, y) : vctx.moveTo(x, y); }
  vctx.lineWidth = 4; vctx.strokeStyle = 'rgba(0,0,0,.55)'; vctx.stroke(); vctx.lineWidth = 1.5; vctx.strokeStyle = '#ffffff'; vctx.stroke();
  vctx.fillStyle = '#ffff00'; vctx.strokeStyle = '#000'; vctx.lineWidth = 1;
  for (let i = 0; i <= Math.min(30, b - a); i++){ const p = twAt(a + i * (b - a) / Math.max(1, Math.min(30, b - a)), a, b, A, B); vctx.beginPath(); vctx.arc(S.panX + (p.x + w / 2) * z, S.panY + (p.y + h / 2) * z, 3, 0, Math.PI * 2); vctx.fill(); vctx.stroke(); }
  vctx.restore();
}

// ---------- the page, the timeline buttons and the mode switch ----------
function setAnimMode(on){
  ANIM.on = on; store.set('animOn', on); $('#amOn').checked = on;
  document.documentElement.classList.toggle('animmode', on);
  onionClear(); setupAnim(); updateAnimPage(); requestDraw();
  setTimeout(() => { resize(); requestDraw(); }, 30);
}
function updateAnimPage(){
  const N = docFrames();
  $('#amInfo').textContent = 'Frame ' + (S.dcur + 1) + ' of ' + N + (AL && lfr(AL).length === 1 && N > 1 ? ' · this layer is still (one frame)' : '');
  const d = docDelay(S.dcur) || 10, ms = (d >= 2 ? d : 10) * 10;
  const dur = $('#amDur'); if (document.activeElement !== dur){ dur.value = ms; $('#amDurOut').textContent = ms + ' ms'; }
  $('#amDel').disabled = N < 2; $('#amLeft').disabled = S.dcur < 1; $('#amRight').disabled = S.dcur >= N - 1;
  if (+$('#twTo').value < 2) $('#twTo').value = Math.max(2, N);
}
$('#amOn').checked = ANIM.on;
$('#amOn').addEventListener('change', e => setAnimMode(e.target.checked));
$('#amAdd').addEventListener('click', () => addFrame(false));
$('#amDup').addEventListener('click', () => addFrame(true));
$('#amDel').addEventListener('click', deleteFrame);
$('#amLeft').addEventListener('click', () => moveFrame(-1));
$('#amRight').addEventListener('click', () => moveFrame(1));
$('#amCopy').checked = ANIM.copy; $('#amCopy').addEventListener('change', e => { ANIM.copy = e.target.checked; store.set('amCopy', ANIM.copy); });
$('#amDur').addEventListener('input', e => $('#amDurOut').textContent = e.target.value + ' ms');
$('#amDur').addEventListener('change', e => setDelays(Math.max(2, Math.round(+e.target.value / 10)), false));
$('#amFps').addEventListener('input', e => $('#amFpsOut').textContent = e.target.value + ' fps');
$('#amFpsApply').addEventListener('click', () => { setDelays(Math.max(2, Math.round(100 / +$('#amFps').value)), true); sbFlash('Every frame now plays at about ' + $('#amFps').value + ' frames a second.'); });
[['onBefore', 'before', v => v], ['onAfter', 'after', v => v], ['onOp', 'op', v => v + '%']].forEach(([id, k, f]) => {
  const el = $('#' + id); el.value = ANIM[k]; $('#' + id + 'Out').textContent = f(ANIM[k]);
  el.addEventListener('input', () => { ANIM[k] = +el.value; store.set(id, ANIM[k]); $('#' + id + 'Out').textContent = f(ANIM[k]); requestDraw(); });
});
$('#onOn').checked = ANIM.onion; $('#onOn').addEventListener('change', e => { ANIM.onion = e.target.checked; store.set('onion', ANIM.onion); syncOnionBtn(); requestDraw(); });
$('#onTint').checked = ANIM.tint; $('#onTint').addEventListener('change', e => { ANIM.tint = e.target.checked; store.set('onTint', ANIM.tint); requestDraw(); });
segSet('#onSrc', 'v', ANIM.src); segBind('#onSrc', 'v', v => { ANIM.src = v; store.set('onSrc', v); requestDraw(); });
$('#twSet0').addEventListener('click', () => twFromLayer(0));
$('#twSet1').addEventListener('click', () => twFromLayer(1));
$('#twApply').addEventListener('click', createTween);
['twX0', 'twY0', 'twS0', 'twR0', 'twO0', 'twX1', 'twY1', 'twS1', 'twR1', 'twO1', 'twFrom', 'twTo', 'twEase', 'twPath'].forEach(id => $('#' + id).addEventListener('input', requestDraw));
// quick buttons on the frame strip
{
  const box = document.createElement('div'); box.className = 'fd-btns fd-anim'; box.id = 'fdAnim';
  box.innerHTML = '<span class="tsep"></span>' +
    '<button class="tb" type="button" id="fdAdd" data-tip="New frame" data-help="Adds an empty frame after this one."><i class="ic" data-ic="framenew"></i></button>' +
    '<button class="tb" type="button" id="fdDup" data-tip="Duplicate frame" data-help="Copies this frame."><i class="ic" data-ic="layerdup"></i></button>' +
    '<button class="tb" type="button" id="fdDel" data-tip="Delete frame" data-help="Removes this frame."><i class="ic" data-ic="layerdel"></i></button>' +
    '<button class="tb" type="button" id="fdOnion" data-tip="Onion skin" data-help="Shows faint copies of the neighboring frames." aria-pressed="false"><i class="ic" data-ic="onion"></i></button>';
  $('#timeline .fd-btns').after(box);
  $('#fdAdd').addEventListener('click', () => addFrame(false));
  $('#fdDup').addEventListener('click', () => addFrame(true));
  $('#fdDel').addEventListener('click', deleteFrame);
  $('#fdOnion').addEventListener('click', () => { ANIM.onion = !ANIM.onion; store.set('onion', ANIM.onion); $('#onOn').checked = ANIM.onion; syncOnionBtn(); requestDraw(); });
}
function syncOnionBtn(){ $('#fdOnion').setAttribute('aria-pressed', String(ANIM.onion)); }
syncOnionBtn();
// whole-picture thumbnails for the frame strip in animation mode
function drawDocThumb(f){
  const t = thumbs[f]; if (!t) return;
  const g = t.c.getContext('2d'), rgba = composeDoc(f, false);
  g.clearRect(0, 0, t.c.width, t.c.height); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(toCanvas(rgba, DocW, DocH), 0, 0, t.c.width, t.c.height);
  t.dot.hidden = true;
}
// menu entries
{
  const am = MENUS.animm;
  am.unshift(
    { l: 'Animation mode', c: 'animMode', ck: () => ANIM.on },
    { l: 'New frame', c: 'animAdd', en: () => !!W }, { l: 'Duplicate frame', c: 'animDup', en: () => !!W },
    { l: 'Delete frame', c: 'animDel', en: () => docFrames() > 1 },
    { l: 'Onion skin', c: 'animOnion', ck: () => ANIM.onion },
    { l: 'Motion tween…', c: 'page:animate' },
    '-');
}
function animCmd(c){
  if (c === 'animMode'){ setAnimMode(!ANIM.on); if (ANIM.on) showPage('animate'); return true; }
  if (c === 'animAdd'){ addFrame(false); return true; }
  if (c === 'animDup'){ addFrame(true); return true; }
  if (c === 'animDel'){ deleteFrame(); return true; }
  if (c === 'animOnion'){ $('#fdOnion').click(); return true; }
  if (c === 'sample'){ setImage(makeSample(), 'sample-cactus'); setTool('erase'); return true; }
  return false;
}
document.documentElement.classList.toggle('animmode', ANIM.on);

// a new session starts on a blank white picture
function startBlank(){
  const w = 1280, h = 720, f = new Uint8ClampedArray(w * h * 4).fill(255);
  setImage({ w, h, frames: [f], delays: [10] }, 'untitled');
  if (layers[0]){ layers[0].name = 'Background'; renderLayersPanel(); }
  setTool('brush');
}

// fade the bottom edge of the side panels when there is more to scroll to (iPad hides scroll bars)
function markScrollMore(el){ if (el) el.classList.toggle('more', el.scrollHeight - el.clientHeight - el.scrollTop > 6); }
['#pages', '.leftdock'].forEach(sel => { const el = $(sel); if (!el) return; el.addEventListener('scroll', () => markScrollMore(el), { passive: true }); new ResizeObserver(() => markScrollMore(el)).observe(el); new MutationObserver(() => markScrollMore(el)).observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] }); });
