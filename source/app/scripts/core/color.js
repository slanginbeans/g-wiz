// ---------- color helpers ----------
function sampleAt(ix, iy, f = S.cur){
  const src = frames[f]; let r = 0, g = 0, b = 0, n = 0;
  const cx = Math.floor(ix), cy = Math.floor(iy);
  for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++){
    if (x < 0 || y < 0 || x >= W || y >= H) continue; const o = (y * W + x) * 4; r += src[o]; g += src[o + 1]; b += src[o + 2]; n++;
  }
  return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : null;
}
function colorAmtFn(sc, tolPct){
  const tol = 6 + tolPct * 1.6, inner = tol * 0.5, span = tol - inner;
  if (S.labMatch){
    const lab = new Float32Array(3); rgb2lab(sc[0], sc[1], sc[2], lab, 0);
    return (src, o) => { const d = labDist(src, o, lab); return d <= inner ? 1 : d >= tol ? 0 : 1 - (d - inner) / span; };
  }
  return (src, o) => {
    const dr = src[o] - sc[0], dg = src[o + 1] - sc[1], db = src[o + 2] - sc[2];
    const d = Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9);
    return d <= inner ? 1 : d >= tol ? 0 : 1 - (d - inner) / span;
  };
}
