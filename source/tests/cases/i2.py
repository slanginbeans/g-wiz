import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    ctx=await b.new_context(**p.devices['iPad Pro 11 landscape']); pg=await ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    await pg.goto(URL+'?sample'); await pg.wait_for_timeout(900)
    cdp=await ctx.new_cdp_session(pg)
    r=await pg.evaluate("()=>{const r=document.querySelector('#view').getBoundingClientRect();return [r.left,r.top,r.width,r.height]}")
    async def px(x,y): return await pg.evaluate(f"()=>Array.from(document.querySelector('#view').getContext('2d').getImageData(Math.round({x-r[0]}*devicePixelRatio),Math.round({y-r[1]}*devicePixelRatio),1,1).data)")
    async def touch(kind, pts): await cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'x':x,'y':y,'id':i} for i,(x,y) in enumerate(pts)]})
    async def drag(x0,y0,x1,y1,n=10):
      await touch('touchStart',[(x0,y0)]); await pg.wait_for_timeout(130)
      for k in range(1,n+1): await touch('touchMove',[(x0+(x1-x0)*k/n,y0+(y1-y0)*k/n)])
      await touch('touchEnd',[])
    async def ntap(n, gap=35):
      pts=[(r[0]+300+i*90,r[1]+350) for i in range(n)]
      for i in range(1,n+1): await touch('touchStart',pts[:i]); await pg.wait_for_timeout(gap)
      await pg.wait_for_timeout(60); await touch('touchEnd',[]); await pg.wait_for_timeout(250)
    undoN=lambda: pg.evaluate("document.querySelector('#undoBtn').disabled")
    # paint bucket: a 2-finger tap must not fill
    await pg.tap('[data-tool="brush"]'); y=r[1]+150
    await drag(r[0]+100,y,r[0]+400,y); await pg.wait_for_timeout(200); print('stroke', await px(r[0]+250,y))
    await pg.tap('[data-tool="fill"]')
    for s in await pg.query_selector_all('#palGrid .sw'):
      if (await s.get_attribute('data-tip') or '').lower()=='#ff0000': await s.dispatch_event('mousedown',{'button':0}); break
    bg=await px(r[0]+600,r[1]+500)
    await ntap(2); print('2-finger tap with bucket: bg', bg, '->', await px(r[0]+600,r[1]+500), '| stroke now', await px(r[0]+250,y), await pg.inner_text('#sbHelp'))
    await ntap(3); print('3-finger redo: stroke', await px(r[0]+250,y))
    # single finger tap still fills
    await touch('touchStart',[(r[0]+600,r[1]+500)]); await pg.wait_for_timeout(50); await touch('touchEnd',[]); await pg.wait_for_timeout(500)
    print('single tap fill', await px(r[0]+600,r[1]+500))
    await ntap(2); print('undo fill', await px(r[0]+600,r[1]+500))
    # pencil -> pencilOnly, then 2-finger tap still undoes
    await pg.tap('[data-tool="pen"]')
    async def pen(kind,x,y): await cdp.send('Input.dispatchMouseEvent',{'type':kind,'x':x,'y':y,'button':'left','buttons':1 if kind!='mouseReleased' else 0,'clickCount':1,'pointerType':'pen','force':0.5})
    await pen('mousePressed',r[0]+100,r[1]+250)
    for k in range(1,11): await pen('mouseMoved',r[0]+100+k*30,r[1]+250)
    await pen('mouseReleased',r[0]+400,r[1]+250); await pg.wait_for_timeout(200)
    print('pen line', await px(r[0]+250,r[1]+250))
    await ntap(2); print('2-finger undo with pencil mode', await px(r[0]+250,r[1]+250))
    # pencil tip double tap -> canvas view, dot undone
    lenB=await pg.evaluate("document.querySelector('#undoBtn').disabled")
    for i in range(2):
      await pen('mousePressed',r[0]+700,r[1]+400); await pg.wait_for_timeout(40); await pen('mouseReleased',r[0]+700,r[1]+400); await pg.wait_for_timeout(120)
    await pg.wait_for_timeout(200)
    print('canvas view', await pg.evaluate("document.documentElement.classList.contains('canvasonly')"), 'menubar visible', await pg.is_visible('#menubar'), 'dot undone', await px(r[0]+700,r[1]+400))
    await pg.screenshot(path='c_canvasview.png')
    for i in range(2):
      await pen('mousePressed',r[0]+700,r[1]+400); await pg.wait_for_timeout(40); await pen('mouseReleased',r[0]+700,r[1]+400); await pg.wait_for_timeout(120)
    await pg.wait_for_timeout(200); print('back', await pg.is_visible('#menubar'))
    # four-finger tap
    await ntap(4); print('4-finger canvas', await pg.evaluate("document.documentElement.classList.contains('canvasonly')"))
    await pg.tap('#coExit'); print('exit button', await pg.is_visible('#menubar'))
    await pg.keyboard.press('Tab'); print('tab', await pg.evaluate("document.documentElement.classList.contains('canvasonly')")); await pg.keyboard.press('Tab')
    # crop: set pencil-only off, draw box with finger, then pinch -> box unchanged
    await pg.evaluate("localStorage.setItem('gwiz.pencilOnly','false')")
    await pg.tap('.mtop[data-menu="viewm"]'); await pg.tap('#menus >> text=Pencil draws, fingers pan'); await pg.wait_for_timeout(100)
    await pg.tap('[data-tool="crop"]')
    await drag(r[0]+200,r[1]+150,r[0]+500,r[1]+400); await pg.wait_for_timeout(150)
    box=[await pg.input_value(i) for i in ['#cropX','#cropY','#cropW','#cropH']]; print('box', box)
    cx,cy=r[0]+700,r[1]+450
    await touch('touchStart',[(cx-40,cy)]); await pg.wait_for_timeout(150)
    await touch('touchMove',[(cx-20,cy+30)]); await touch('touchStart',[(cx-20,cy+30),(cx+40,cy)])
    for k in range(1,6): await touch('touchMove',[(cx-20-k*10,cy+30),(cx+40+k*10,cy)])
    await touch('touchEnd',[]); await pg.wait_for_timeout(150)
    box2=[await pg.input_value(i) for i in ['#cropX','#cropY','#cropW','#cropH']]; print('box after pinch', box2, 'same', box==box2)
    await pg.tap('#cApply'); await pg.wait_for_timeout(500); print('canvas after crop', await pg.inner_text('#sbSize'))
    # layers minimize
    await pg.screenshot(path='c_aftercrop.png'); await pg.tap('#layersMin'); await pg.wait_for_timeout(200); print('layer list hidden', not await pg.is_visible('#layerList'))
    await pg.screenshot(path='c_layersmin.png')
    print('errors',errs); await b.close()
asyncio.run(main())
