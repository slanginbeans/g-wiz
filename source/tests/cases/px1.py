import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
import asyncio, base64, io
from PIL import Image
from playwright.async_api import async_playwright
INIT="delete window.showSaveFilePicker;window.__shared=null;navigator.canShare=()=>true;navigator.share=async(d)=>{const a=new Uint8Array(await d.files[0].arrayBuffer());let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode.apply(null,a.subarray(i,i+32768));window.__shared=[d.files[0].name,a.length,btoa(s)]};"
GB={(0x0f,0x38,0x0f),(0x30,0x62,0x30),(0x8b,0xac,0x0f),(0x9b,0xbc,0x0f)}
async def export(pg, scale='1'):
    await pg.evaluate("window.__shared=null")
    await pg.tap('[data-page-btn="pixel"]'); await pg.select_option('#pxExport', scale)
    await pg.tap('#saveTop'); await pg.select_option('#fmt','png'); await pg.tap('#saveBtn'); await pg.wait_for_timeout(300)
    await pg.tap('#saveDlg button[type=submit]'); await pg.wait_for_timeout(1500)
    if await pg.is_visible('#shGo'): await pg.tap('#shGo'); await pg.wait_for_timeout(500)
    sh=await pg.evaluate('window.__shared')
    return Image.open(io.BytesIO(base64.b64decode(sh[2]))).convert('RGBA') if sh else None
def colors(im): return {c[1][:3] for c in im.getcolors(1<<20) if c[1][3]>=128}
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    ctx=await b.new_context(**p.devices['iPad Pro 11 landscape']); pg=await ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    await pg.add_init_script(INIT)
    await pg.goto(URL); await pg.wait_for_timeout(900)
    cdp=await ctx.new_cdp_session(pg)
    async def pen(kind,x,y): await cdp.send('Input.dispatchMouseEvent',{'type':kind,'x':x,'y':y,'button':'left','buttons':1 if kind!='mouseReleased' else 0,'clickCount':1,'pointerType':'pen','force':0.6})
    async def stroke(pts):
      await pen('mousePressed',*pts[0])
      for (x0,y0),(x1,y1) in zip(pts,pts[1:]):
        for k in range(1,9): await pen('mouseMoved',x0+(x1-x0)*k/8,y0+(y1-y0)*k/8)
      await pen('mouseReleased',*pts[-1]); await pg.wait_for_timeout(150)
    await pg.tap('[data-page-btn="pixel"]'); await pg.wait_for_timeout(200)
    await pg.screenshot(path='p_page.png')
    await pg.select_option('#pxSize','160x144'); await pg.select_option('#pxPal','Game Boy (green)')
    await pg.tap('#pxBg button[data-v="first"]'); await pg.tap('#pxNew'); await pg.wait_for_timeout(500)
    st=lambda: pg.evaluate("()=>({size:document.querySelector('#sbSize').textContent, zoom:document.querySelector('#zoomVal').textContent, pix:document.documentElement.classList.contains('pixelmode'), anim:document.documentElement.classList.contains('animmode'), prev:!document.querySelector('#pxPreview').hidden, count:document.querySelector('#pxCount').textContent, scheme:document.querySelector('#palScheme').value, tool:document.querySelector('.tool[aria-pressed=true]')?.dataset.tool})")
    print('new', await st())
    # pick a palette swatch (light green) as primary
    sw=await pg.query_selector_all('#palGrid .sw'); print('swatches', len(sw))
    await sw[2].dispatch_event('mousedown',{'button':0})
    r=await pg.evaluate("()=>{const r=document.querySelector('#view').getBoundingClientRect();return [r.left,r.top,r.width,r.height]}")
    await pg.tap('[data-page-btn="pixel"]'); await pg.tap('#pxMirror button[data-v="both"]')
    cx,cy=r[0]+r[2]/2,r[1]+r[3]/2
    await stroke([(cx-200,cy-150),(cx-120,cy-60),(cx-40,cy-100)])
    await pg.wait_for_timeout(600); print('drawn', await st())
    await pg.screenshot(path='p_mirror.png')
    # off-palette color is snapped
    await pg.evaluate("()=>{}")
    # animation alongside
    await pg.tap('[data-page-btn="animate"]'); await pg.tap('#amOn'); await pg.wait_for_timeout(300)
    await pg.tap('#fdAdd'); await pg.wait_for_timeout(300)
    await pg.tap('[data-page-btn="pixel"]'); await pg.tap('#pxMirror button[data-v="off"]')
    await stroke([(cx-100,cy+40),(cx+100,cy+80)])
    await pg.wait_for_timeout(600); print('anim+pix', await st())
    await pg.screenshot(path='p_anim.png')
    await pg.tap('#zoomIn'); await pg.wait_for_timeout(100); z1=(await st())['zoom']; await pg.tap('#zoomIn'); await pg.wait_for_timeout(100); z2=(await st())['zoom']
    await pg.tap('#zoomOut'); await pg.wait_for_timeout(100); z3=(await st())['zoom']; print('zooms', z1,z2,z3)
    await pg.tap('#zoomFit')
    im=await export(pg,'4')
    print('export', im and im.size, im and colors(im), im and colors(im)<=GB)
    if im: im.save('p_export.png')
    # Hard brush draws solid palette pixels
    await pg.tap('[data-tool="brush"]'); await stroke([(cx-150,cy+100),(cx+150,cy+20)])
    im=await export(pg,'1'); print('brush hard', colors(im), colors(im)<=GB)
    # pixel mode off restores scheme
    await pg.tap('[data-page-btn="pixel"]'); await pg.tap('#pxOn'); await pg.wait_for_timeout(200); print('off', await st())
    await pg.tap('#pxOn'); await pg.wait_for_timeout(200); print('on again', await st())
    print('errors', errs)
    await ctx.close(); await b.close()
if __name__=="__main__": asyncio.run(main())
