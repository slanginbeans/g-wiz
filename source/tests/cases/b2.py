import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1366,'height':900})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    await pg.goto(URL); await pg.wait_for_timeout(800); await pg.evaluate("localStorage.clear()")
    cdp=await pg.context.new_cdp_session(pg)
    r=await pg.evaluate("()=>{const r=document.querySelector('#view').getBoundingClientRect();return [r.left,r.top,r.width,r.height]}")
    await pg.evaluate("()=>{}")
    async def pen(kind,x,y,force=0.6): await cdp.send('Input.dispatchMouseEvent',{'type':kind,'x':x,'y':y,'button':'left','buttons':1 if kind!='mouseReleased' else 0,'clickCount':1,'pointerType':'pen','force':force})
    async def stroke(x0,y0,x1,y1,n=16,fmin=0.15,fmax=0.95):
      await pen('mousePressed',x0,y0,fmin)
      for k in range(1,n+1):
        t=k/n; await pen('mouseMoved',x0+(x1-x0)*t,y0+(y1-y0)*t+18*__import__('math').sin(t*6.28), fmin+(fmax-fmin)*t); await pg.wait_for_timeout(12)
      await pen('mouseReleased',x1,y1,fmax); await pg.wait_for_timeout(150)
    tools={'pencil':['round','square','grainy','sketch'],'pen':['ink','ballpoint','calligraphy','felt','brushpen'],'brush':['soft','hard','bristle','chalk','splatter','watercolor'],'marker':['chisel','round','highlighter','dry'],'air':['fine','coarse','soft','spatter','stipple']}
    # zoom 1:1 and pan top-left
    await pg.keyboard.press('1'); await pg.wait_for_timeout(100)
    await pg.evaluate("()=>{}")
    y=r[1]+40
    for t,styles in tools.items():
      await pg.click(f'[data-tool="{t}"]'); await pg.wait_for_timeout(50); await pg.evaluate("()=>{const s=document.querySelector('#dSize');s.value=16;s.dispatchEvent(new Event('input'))}")
      x=r[0]+20
      for st in styles:
        await pg.evaluate(f"()=>{{const s=document.querySelector('#dStyle'); s.value='{st}'; s.dispatchEvent(new Event('change'))}}"); await pg.wait_for_timeout(60)
        await stroke(x,y+30,x+170,y)
        x+=170
      y+=110
    await pg.screenshot(path='b_styles2.png', clip={'x':r[0],'y':r[1],'width':1100,'height':600})
    print('errors',errs); await b.close()
asyncio.run(main())
