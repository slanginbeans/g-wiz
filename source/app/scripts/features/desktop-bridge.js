// ---------- opening and exiting (browser or desktop) ----------
const GW = window.__GWIZ__ || null;
function openFile(){ $('#fileIn').click(); }
function exitApp(){
  if (GW){ fetch('/api/quit?t=' + GW.token, { method: 'POST' }).catch(() => {}); setTimeout(() => window.close(), 60); }
  else sbFlash('Close the browser tab to exit G-WIZ.');
}
if (GW){
  // keep the launcher alive while this window is open; it shuts down shortly after the window closes
  const ping = () => fetch('/api/ping?t=' + GW.token, { method: 'POST' }).catch(() => {});
  ping(); setInterval(ping, 3000);
  addEventListener('pagehide', () => navigator.sendBeacon('/api/bye?t=' + GW.token));
  $('#aboutMode').textContent = 'Desktop edition. Running in its own window.';
  if (GW.initial){
    fetch('/api/initial?t=' + GW.token).then(async r => {
      if (!r.ok) return;
      const name = decodeURIComponent(r.headers.get('X-File-Name') || 'image');
      const blob = await r.blob(); const ext = (name.split('.').pop() || '').toLowerCase();
      const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml', ico: 'image/x-icon', tif: 'image/tiff', tiff: 'image/tiff' };
      loadFile(new File([blob], name, { type: types[ext] || '' }));
    }).catch(() => {});
  }
} else {
  $('#aboutMode').textContent = 'Browser edition.';
}
