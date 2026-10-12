import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
import asyncio, json
from playwright.async_api import async_playwright
# settings as saved by 1.3 (no style / angle on the pen, marker 55% multiply)
OLD={"pencil":{"size":1,"opacity":100,"tip":"round","blend":"source-over"},"pen":{"size":6,"opacity":100,"smooth":40,"pressSize":True,"pressOp":False,"blend":"source-over","style":"calligraphy"},"brush":{"size":24,"opacity":100,"flow":35,"hard":40,"spacing":12,"smooth":30,"pressSize":True,"pressOp":False,"blend":"source-over"},"marker":{"size":18,"opacity":55,"tip":"chisel","angle":45,"smooth":30,"blend":"multiply"},"air":{"size":40,"opacity":100,"flow":30,"density":40,"blend":"source-over"}}
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1366,'height':800})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(400)
    await pg.evaluate("o=>{localStorage.clear(); localStorage.setItem('gwiz.draw', JSON.stringify(o))}", OLD)
    await pg.reload(); await pg.wait_for_timeout(800)
    r=await pg.evaluate("()=>{const r=document.querySelector('#view').getBoundingClientRect();return [r.left,r.top,r.width,r.height]}")
    async def px(x,y): return await pg.evaluate(f"()=>Array.from(document.querySelector('#view').getContext('2d').getImageData(Math.round({x-r[0]}*devicePixelRatio),Math.round({y-r[1]}*devicePixelRatio),1,1).data)")
    print('pen settings', await pg.evaluate("JSON.parse(localStorage.getItem('gwiz.draw')).pen"))
    print('marker settings', await pg.evaluate("JSON.parse(localStorage.getItem('gwiz.draw')).marker"))
    # calligraphy with the mouse: horizontal and vertical strokes
    await pg.click('[data-tool="pen"]'); await pg.wait_for_timeout(100)
    print('style shown', await pg.input_value('#dStyle'), 'angle row visible', await pg.is_visible('#dAngleRow'))
    await pg.evaluate("()=>{const s=document.querySelector('#dSize');s.value=20;s.dispatchEvent(new Event('input'))}")
    y=r[1]+150
    await pg.mouse.move(r[0]+150,y); await pg.mouse.down(); await pg.mouse.move(r[0]+450,y,steps=15); await pg.mouse.up()
    await pg.mouse.move(r[0]+600,r[1]+100); await pg.mouse.down(); await pg.mouse.move(r[0]+600,r[1]+300,steps=15); await pg.mouse.up(); await pg.wait_for_timeout(100)
    print('calligraphy horizontal', await px(r[0]+300,y), 'vertical', await px(r[0]+600,r[1]+200))
    # marker opacity
    await pg.click('[data-tool="marker"]'); await pg.wait_for_timeout(100)
    print('marker opacity ui', await pg.input_value('#dOpacity'), 'blend', await pg.input_value('#dBlend'))
    for s in await pg.query_selector_all('#palGrid .sw'):
      if (await s.get_attribute('data-tip') or '').lower()=='#0000ff': await s.dispatch_event('mousedown',{'button':0}); break
    y2=r[1]+420; await pg.mouse.move(r[0]+150,y2); await pg.mouse.down(); await pg.mouse.move(r[0]+450,y2,steps=15); await pg.mouse.up(); await pg.wait_for_timeout(100)
    print('marker px (want 0,0,255)', await px(r[0]+300,y2))
    await pg.screenshot(path='c_pen.png')
    print('errors', errs); await b.close()
asyncio.run(main())
