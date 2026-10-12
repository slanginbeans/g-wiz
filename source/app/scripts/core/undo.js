// ---------- undo ----------
const undoStack = [], redoStack = []; let undoBytes = 0, op = null;
function targetFrames(){ return (S.scopeAll && frames.length > 1) ? frames.map((_, i) => i) : [S.cur]; }
function beginOp(fs){ fs = fs || targetFrames(); op = { fs, snap: fs.map(f => masks[f].slice()), x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }; }
function touchOp(x0, y0, x1, y1){ invalidateRefine(); if (!op) return; op.x0 = Math.min(op.x0, x0); op.y0 = Math.min(op.y0, y0); op.x1 = Math.max(op.x1, x1); op.y1 = Math.max(op.y1, y1); }
function cropM(arr, x0, y0, x1, y1){ const bw = x1 - x0, out = new Uint8Array(bw * (y1 - y0)); for (let y = y0; y < y1; y++) out.set(arr.subarray(y * W + x0, y * W + x1), (y - y0) * bw); return out; }
function pasteM(arr, data, x0, y0, x1, y1){ const bw = x1 - x0; for (let y = y0; y < y1; y++) arr.set(data.subarray((y - y0) * bw, (y - y0 + 1) * bw), y * W + x0); }
function endOp(){
  if (!op) return; const o = op; op = null;
  if (!(o.x1 > o.x0)) return;
  const e = { fs: o.fs, x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1, data: o.snap.map(s => cropM(s, o.x0, o.y0, o.x1, o.y1)) };
  pushUndo(e); redoStack.length = 0; updateUndoUI(); thumbsDirty(o.fs); if (frames.length > 1) drawTlMarks();
}
function cancelOp(){ if (!op) return; op.fs.forEach((f, i) => masks[f].set(op.snap[i])); const o = op; op = null; if (o.x1 > o.x0) renderRect(o.x0, o.y0, o.x1, o.y1); }
function entryBytes(e){ if (e.kind === 'layers') return 4096; if (e.paint) return e.data.reduce((s, d) => s + d.length, 0) + e.mdata.reduce((s, d) => s + d.length, 0); return e.geom ? e.frames.reduce((s, d) => s + d.length, 0) + e.masks.reduce((s, d) => s + d.length, 0) : e.data.reduce((s, d) => s + d.length, 0); }
function pushUndo(e){ onionClear(); markDirty(); if (e.lid === undefined) e.lid = AL ? AL.id : null; undoStack.push(e); undoBytes += entryBytes(e); while (undoStack.length > 80 || (undoBytes > (IS_IOS ? 120e6 : 300e6) && undoStack.length > 1)) undoBytes -= entryBytes(undoStack.shift()); }
function swapEntry(e){ invalidateRefine(); onionClear();
  if (e.kind === 'layers') return swapLayersEntry(e);
  ensureActive(e.lid);
  if (e.paint) return swapPaintEntry(e);
  if (e.geom){
    const cur = { geom: true, W, H, frames, masks, x: AL.x, y: AL.y, dw: DocW, dh: DocH, lid: AL.id };
    const refit = e.dw != null && (e.dw !== DocW || e.dh !== DocH);
    W = e.W; H = e.H; frames = e.frames; masks = e.masks;
    if (e.x != null){ AL.x = e.x; AL.y = e.y; DocW = e.dw; DocH = e.dh; }
    saveActive(); reinitDims(refit); renderLayersPanel(); syncLayerProps(); return cur;
  }
  const cur = e.fs.map(f => cropM(masks[f], e.x0, e.y0, e.x1, e.y1)); e.fs.forEach((f, i) => pasteM(masks[f], e.data[i], e.x0, e.y0, e.x1, e.y1)); renderRect(e.x0, e.y0, e.x1, e.y1); thumbsDirty(e.fs); return { ...e, data: cur }; }
function undo(){ if (XF) xfCancel(true); if (TE) textCancel(); if (op || DS.active || !undoStack.length) return; const e = undoStack.pop(); undoBytes -= entryBytes(e); redoStack.push(swapEntry(e)); updateUndoUI(); }
function redo(){ if (XF) xfCancel(true); if (TE) textCancel(); if (op || DS.active || !redoStack.length) return; const e = redoStack.pop(); pushUndo(swapEntry(e)); updateUndoUI(); }
function updateUndoUI(){ $('#undoBtn').disabled = !undoStack.length; $('#redoBtn').disabled = !redoStack.length; if (typeof miniSync === 'function') miniSync(); if (frames.length > 1) drawTlMarks(); }
