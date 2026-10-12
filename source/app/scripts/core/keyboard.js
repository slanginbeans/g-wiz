// ---------- keyboard ----------
const VIEWS = ['result', 'overlay', 'original'];
window.addEventListener('keydown', e => {
  if (!$('#saveDlg').hidden) return;
  const t = e.target, typing = t && (t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox'));
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z'){ e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y'){ e.preventDefault(); redo(); return; }
  if (mod && e.key.toLowerCase() === 's'){ e.preventDefault(); doSave(); return; }
  if (mod && e.key.toLowerCase() === 'o'){ e.preventDefault(); $('#fileIn').click(); return; }
  if (typing || mod) return;
  if (e.code === 'Space'){ if (t && t.tagName === 'BUTTON') return; e.preventDefault(); if (!S.space){ S.space = true; setCursor(); requestDraw(); } return; }
  const k = e.key;
  if (k === 'b' || k === 'B' || k === 'e' || k === 'E') setTool('erase');
  else if (k === 'r' || k === 'R') setTool('restore');
  else if (k === 'w' || k === 'W') setTool('wand');
  else if (k === 'h' || k === 'H') setTool('hand');
  else if (k === '[') setSize(Math.round(S.size / 1.15));
  else if (k === ']') setSize(Math.round(S.size * 1.15) + 1);
  else if (k === '+' || k === '=') stepZoom(1);
  else if (k === '-' || k === '_') stepZoom(-1);
  else if (k === '0') fit();
  else if (k === '1') setZoom(1);
  else if (k === 'v' || k === 'V') setViewMode(VIEWS[(VIEWS.indexOf(S.viewMode) + 1) % 3]);
  else if ((k === ',' || k === '.') && docFrames() > 1){ stopPlay(); setFrame((S.dcur + (k === '.' ? 1 : docFrames() - 1)) % docFrames()); }
  else return;
  requestDraw();
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space'){ S.space = false; setCursor(); requestDraw(); }
  if (e.key === 'Alt' && S.hover){ S.hover.alt = false; requestDraw(); }
  if (e.key === 'Shift'){ if (S.hover) S.hover.shift = false; if (stroke) stroke.force = S.force; requestDraw(); }
});
window.addEventListener('keydown', e => {
  if (e.key === 'Alt' && S.hover){ e.preventDefault(); S.hover.alt = true; requestDraw(); }
  if (e.key === 'Shift'){ if (S.hover) S.hover.shift = true; if (stroke) stroke.force = true; requestDraw(); }
});
window.addEventListener('blur', () => { S.space = false; setCursor(); });
