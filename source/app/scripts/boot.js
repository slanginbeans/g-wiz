// ---------- boot ----------
readTheme(); resize();
updateRelHint(); setTool('erase'); updateFmtUI();
if (/[?&]sample\b/.test(location.search)) setImage(makeSample(), 'sample-cactus'); else startBlank();
setTimeout(fit, 0);
