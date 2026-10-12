// ---------- sample photo ----------
function makeSample(){
  const w = 960, h = 720, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let grd = g.createRadialGradient(w * 0.46, h * 0.36, 40, w * 0.5, h * 0.55, w * 0.78);
  grd.addColorStop(0, '#e6e9ec'); grd.addColorStop(0.6, '#c6cdd4'); grd.addColorStop(1, '#a2abb5');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  const cx = w / 2;
  g.save(); g.filter = 'blur(16px)'; g.fillStyle = 'rgba(38,44,54,.42)'; g.beginPath(); g.ellipse(cx + 26, 640, 175, 26, 0, 0, Math.PI * 2); g.fill(); g.restore();
  const rr = (x, y, ww, hh, r) => { const p = new Path2D(); p.moveTo(x + r, y); p.arcTo(x + ww, y, x + ww, y + hh, r); p.arcTo(x + ww, y + hh, x, y + hh, r); p.arcTo(x, y + hh, x, y, r); p.arcTo(x, y, x + ww, y, r); p.closePath(); return p; };
  // cactus
  const body = new Path2D();
  body.addPath(rr(cx - 80, 150, 160, 330, 80));
  body.addPath(rr(cx - 205, 200, 66, 175, 33));
  body.addPath(rr(cx - 185, 315, 130, 58, 29));
  body.addPath(rr(cx + 118, 168, 60, 150, 30));
  body.addPath(rr(cx + 60, 270, 110, 52, 26));
  grd = g.createLinearGradient(cx - 210, 0, cx + 180, 0);
  grd.addColorStop(0, '#21492a'); grd.addColorStop(0.3, '#4f9457'); grd.addColorStop(0.55, '#6db06b'); grd.addColorStop(0.8, '#3b7a44'); grd.addColorStop(1, '#1f4426');
  g.fillStyle = grd; g.fill(body);
  g.save(); g.clip(body);
  g.strokeStyle = 'rgba(18,52,26,.45)'; g.lineWidth = 3;
  for (const dx of [-52, -22, 8, 38, 62]){ g.beginPath(); g.moveTo(cx + dx * 0.7, 160); g.quadraticCurveTo(cx + dx * 1.1, 320, cx + dx * 0.8, 480); g.stroke(); }
  for (const [x0, y0, x1, y1] of [[-172, 210, -172, 370], [148, 175, 148, 315]]){ g.beginPath(); g.moveTo(cx + x0, y0); g.lineTo(cx + x1, y1); g.stroke(); }
  g.restore();
  g.strokeStyle = 'rgba(246,240,214,.95)'; g.lineWidth = 1.2; g.lineCap = 'round';
  for (let i = 0; i < 900; i++){
    const x = cx - 210 + rnd() * 390, y = 150 + rnd() * 330;
    if (!g.isPointInPath(body, x, y)) continue;
    for (let k = 0; k < 3; k++){ const a = rnd() * Math.PI * 2, L = 4 + rnd() * 7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
  }
  // flower
  g.save(); g.translate(cx + 6, 156);
  for (let i = 0; i < 9; i++){ g.rotate(Math.PI * 2 / 9); g.fillStyle = i % 2 ? '#ef6f9a' : '#f58db0'; g.beginPath(); g.ellipse(0, -17, 8, 18, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#f6d34b'; g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill(); g.restore();
  // pot
  grd = g.createLinearGradient(cx - 150, 0, cx + 150, 0);
  grd.addColorStop(0, '#7a3519'); grd.addColorStop(0.35, '#d07a4c'); grd.addColorStop(0.6, '#b85e35'); grd.addColorStop(1, '#6d2f16');
  g.fillStyle = grd; g.beginPath();
  g.moveTo(cx - 136, 486); g.lineTo(cx + 136, 486); g.lineTo(cx + 108, 628); g.quadraticCurveTo(cx + 104, 640, cx + 92, 640);
  g.lineTo(cx - 92, 640); g.quadraticCurveTo(cx - 104, 640, cx - 108, 628); g.closePath(); g.fill();
  g.fillStyle = grd; g.fill(rr(cx - 152, 446, 304, 52, 9));
  g.fillStyle = 'rgba(255,220,190,.18)'; g.fillRect(cx - 146, 452, 292, 6);
  g.fillStyle = 'rgba(60,24,10,.25)'; g.fillRect(cx - 140, 494, 280, 8);
  // sensor noise
  const id = g.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4){ const n = (rnd() - 0.5) * 12; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  return { w, h, frames: [d], delays: [0] };
}
