import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    dev=p.devices['iPad Pro 11 landscape'] if 'iPad Pro 11 landscape' in p.devices else p.devices['iPad (gen 7) landscape']
    ctx=await b.new_context(**dev); pg=await ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    await pg.add_init_script("window.__shared=null;navigator.canShare=()=>true;delete window.showSaveFilePicker;navigator.share=async(d)=>{window.__shared=[d.files[0].name,d.files[0].size,d.files[0].type]};")
    await pg.goto(URL+'?sample'); await pg.wait_for_timeout(900)
    print('viewport', dev['viewport'], 'touch class', await pg.evaluate("document.documentElement.classList.contains('touch')"), 'bar', await pg.is_visible('#touchBar'))
    await pg.screenshot(path='i_land.png')
    cdp=await ctx.new_cdp_session(pg)
    r=await pg.evaluate("()=>{const r=document.querySelector('#view').getBoundingClientRect();return [r.left,r.top,r.width,r.height]}")
    async def px(x,y): return await pg.evaluate(f"()=>Array.from(document.querySelector('#view').getContext('2d').getImageData(Math.round({x-r[0]}*devicePixelRatio),Math.round({y-r[1]}*devicePixelRatio),1,1).data)")
    async def touch(kind, pts):
      await cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'x':x,'y':y,'id':i} for i,(x,y) in enumerate(pts)]})
    async def drag(x0,y0,x1,y1,n=10):
      await touch('touchStart',[(x0,y0)])
      for k in range(1,n+1): await touch('touchMove',[(x0+(x1-x0)*k/n,y0+(y1-y0)*k/n)])
      await touch('touchEnd',[])
    # finger draws with brush (pencilOnly off initially)
    await pg.tap('[data-tool="brush"]'); await pg.wait_for_timeout(100)
    y=r[1]+150; await drag(r[0]+100,y,r[0]+400,y); await pg.wait_for_timeout(200)
    await pg.screenshot(path='i_brush.png')
    print('finger brush', await px(r[0]+250,y), 'undo enabled', not await pg.is_disabled('#undoBtn'))
    # two-finger tap -> undo
    await touch('touchStart',[(r[0]+300,r[1]+300),(r[0]+400,r[1]+300)]); await pg.wait_for_timeout(60); await touch('touchEnd',[]); await pg.wait_for_timeout(200)
    print('after 2-finger tap', await px(r[0]+250,y), await pg.inner_text('#sbHelp'))
    # three-finger tap -> redo
    await touch('touchStart',[(r[0]+300,r[1]+300),(r[0]+400,r[1]+300),(r[0]+500,r[1]+300)]); await pg.wait_for_timeout(60); await touch('touchEnd',[]); await pg.wait_for_timeout(200)
    print('after 3-finger tap', await px(r[0]+250,y))
    # latch Shift with line tool; latch 2nd color
    await pg.tap('[data-tool="line"]'); await pg.tap('#touchBar [data-tk="sec"]')
    await drag(r[0]+100,r[1]+120,r[0]+400,r[1]+130); await pg.wait_for_timeout(150)
    await pg.screenshot(path='i_line.png')
    print('2nd color line px', await px(r[0]+250,r[1]+125))
    await pg.tap('#touchBar [data-tk="sec"]')
    # pinch zoom
    z0=await pg.inner_text('#zoomVal')
    cx,cy=r[0]+r[2]/2,r[1]+r[3]/2
    await touch('touchStart',[(cx-50,cy),(cx+50,cy)])
    for k in range(1,8): await touch('touchMove',[(cx-50-k*15,cy),(cx+50+k*15,cy)])
    await touch('touchEnd',[]); await pg.wait_for_timeout(100)
    print('pinch zoom', z0,'->',await pg.inner_text('#zoomVal'))
    # Apple Pencil: pen events via mouse with pointerType pen
    await pg.tap('[data-tool="pen"]')
    await cdp.send('Input.dispatchMouseEvent',{'type':'mousePressed','x':r[0]+100,'y':r[1]+200,'button':'left','clickCount':1,'pointerType':'pen','force':0.6})
    for k in range(1,11): await cdp.send('Input.dispatchMouseEvent',{'type':'mouseMoved','x':r[0]+100+k*30,'y':r[1]+200,'button':'left','buttons':1,'pointerType':'pen','force':0.6})
    await cdp.send('Input.dispatchMouseEvent',{'type':'mouseReleased','x':r[0]+400,'y':r[1]+200,'button':'left','clickCount':1,'pointerType':'pen'})
    await pg.wait_for_timeout(150)
    await pg.screenshot(path='i_pen.png')
    print('pencil px', await px(r[0]+250,r[1]+200), '| status:', await pg.inner_text('#sbHelp'))
    # finger now pans instead of drawing
    p0=await pg.evaluate("()=>document.querySelector('#sbPos').textContent")
    before=await px(r[0]+250,r[1]+260)
    await drag(r[0]+250,r[1]+260,r[0]+350,r[1]+300); await pg.wait_for_timeout(150)
    after=await px(r[0]+350,r[1]+300)
    print('finger pan: pixel moved with drag', before, after)
    # long press tooltip
    bb=await pg.query_selector('[data-tool="marker"]'); bx=await bb.bounding_box()
    await touch('touchStart',[(bx['x']+10,bx['y']+10)]); await pg.wait_for_timeout(700); print('long-press tip', await pg.is_visible('#tip'), await pg.inner_text('#tip')); await touch('touchEnd',[])
    # save through share sheet
    await pg.tap('#saveTop'); await pg.wait_for_timeout(200); await pg.tap('#saveBtn'); await pg.wait_for_timeout(300)
    print('name dialog', await pg.is_visible('#saveDlg'), await pg.inner_text('#sdWhere'))
    await pg.tap('#saveDlg button[type=submit]')
    await pg.wait_for_timeout(1500); print('share dlg', await pg.is_visible('#shareDlg'), await pg.inner_text('#shInfo'))
    await pg.tap('#shGo'); await pg.wait_for_timeout(300); print('shared', await pg.evaluate('window.__shared'))
    await pg.set_viewport_size({'width':834,'height':1194}); await pg.wait_for_timeout(500); await pg.screenshot(path='i_port.png')
    await pg.tap('.mtop[data-menu="viewm"]'); await pg.wait_for_timeout(200); await pg.screenshot(path='i_menu.png')
    print('errors',errs); await b.close()
asyncio.run(main())
