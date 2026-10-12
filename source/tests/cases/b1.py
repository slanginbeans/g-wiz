import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
import asyncio
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(**p.devices['iPad Pro 11 landscape']); pg=await ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    await pg.goto(URL); await pg.wait_for_timeout(800); await pg.evaluate("localStorage.clear()")
    cdp=await ctx.new_cdp_session(pg)
    r=await pg.evaluate("()=>{const r=document.querySelector('#view').getBoundingClientRect();return [r.left,r.top,r.width,r.height]}")
    async def pen(kind,x,y,force=0.6): await cdp.send('Input.dispatchMouseEvent',{'type':kind,'x':x,'y':y,'button':'left','buttons':1 if kind!='mouseReleased' else 0,'clickCount':1,'pointerType':'pen','force':force})
    async def stroke(x0,y0,x1,y1,n=14,fmin=0.2,fmax=0.9):
      await pen('mousePressed',x0,y0,fmin)
      for k in range(1,n+1): await pen('mouseMoved',x0+(x1-x0)*k/n,y0+(y1-y0)*k/n, fmin+(fmax-fmin)*k/n)
      await pen('mouseReleased',x1,y1,fmax); await pg.wait_for_timeout(120)
    # draw every style of every tool, one row per tool
    tools={'pencil':['round','square','grainy','sketch'],'pen':['ink','ballpoint','calligraphy','felt','brushpen'],'brush':['soft','hard','bristle','chalk','splatter','watercolor'],'marker':['chisel','round','highlighter','dry'],'air':['fine','coarse','soft','spatter','stipple']}
    y=r[1]+60
    for t,styles in tools.items():
      await pg.tap(f'[data-tool="{t}"]'); await pg.wait_for_timeout(100)
      await pg.evaluate("()=>{const s=document.querySelector('#dSize');s.value=18;s.dispatchEvent(new Event('input'))}")
      x=r[0]+80
      for st in styles:
        await pg.select_option('#dStyle', st); await pg.wait_for_timeout(60)
        await stroke(x,y+40,x+150,y, n=18)
        if t=='air': await pg.wait_for_timeout(100)
        x+=190
      y+=120
    await pg.screenshot(path='b_styles.png')
    print('pressure read', await pg.inner_text('#pressRead'))
    # pressure curve preset + custom drag
    await pg.tap('[data-tool="brush"]'); await pg.select_option('#pressPreset','firm'); await pg.wait_for_timeout(100)
    print('press', await pg.evaluate("JSON.parse(localStorage.getItem('gwiz.press'))"))
    bb=await (await pg.query_selector('#pressCurve')).bounding_box()
    await pg.mouse.move(bb['x']+bb['width']*0.3,bb['y']+bb['height']*0.2); await pg.mouse.down(); await pg.mouse.move(bb['x']+bb['width']*0.3,bb['y']+bb['height']*0.15,steps=3); await pg.mouse.up()
    print('custom', await pg.evaluate("JSON.parse(localStorage.getItem('gwiz.press'))"))
    await pg.screenshot(path='b_curve.png', clip={'x':1100,'y':320,'width':266,'height':500})
    # canvas view mini bar
    await pg.keyboard.press('Tab'); await pg.wait_for_timeout(300)
    print('mini visible', await pg.is_visible('#miniBar'))
    await pg.tap('#miniBar [data-mtool="pen"]'); print('tool', await pg.evaluate("document.querySelector('.tool[aria-pressed=true]').dataset.tool"))
    tb=await (await pg.query_selector('#mnSize .mn-track')).bounding_box()
    await pg.mouse.move(tb['x']+6,tb['y']+tb['height']*0.2); await pg.mouse.down(); await pg.mouse.up(); await pg.wait_for_timeout(100)
    print('size after slider', await pg.inner_text('#mnSizeVal'), await pg.evaluate("JSON.parse(localStorage.getItem('gwiz.draw')).pen.size"))
    await stroke(r[0]+300,r[1]+500,r[0]+700,r[1]+520)
    await pg.screenshot(path='b_mini.png')
    await pg.keyboard.press('Tab'); await pg.wait_for_timeout(200); print('mini hidden after exit', await pg.is_hidden('#miniBar'))
    print('errors',errs); await b.close()
asyncio.run(main())
