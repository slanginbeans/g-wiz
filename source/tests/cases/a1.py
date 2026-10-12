import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
import asyncio, base64
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    ctx=await b.new_context(**p.devices['iPad Pro 11 landscape']); pg=await ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    await pg.add_init_script("delete window.showSaveFilePicker;window.__shared=null;navigator.canShare=()=>true;navigator.share=async(d)=>{const a=new Uint8Array(await d.files[0].arrayBuffer());let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode.apply(null,a.subarray(i,i+32768));window.__shared=[d.files[0].name,a.length,btoa(s)]};")
    await pg.goto(URL); await pg.wait_for_timeout(900)
    I=lambda: pg.evaluate("()=>({size:document.querySelector('#sbSize').textContent, frame:document.querySelector('#tlNum').textContent, info:document.querySelector('#amInfo').textContent, tool:document.querySelector('.tool[aria-pressed=true]')?.dataset.tool, layers:document.querySelectorAll('#layerList .lyr').length})")
    print('start', await I())
    await pg.screenshot(path='a_start.png')
    cdp=await ctx.new_cdp_session(pg)
    r=await pg.evaluate("()=>{const r=document.querySelector('#view').getBoundingClientRect();return [r.left,r.top,r.width,r.height]}")
    async def pen(kind,x,y): await cdp.send('Input.dispatchMouseEvent',{'type':kind,'x':x,'y':y,'button':'left','buttons':1 if kind!='mouseReleased' else 0,'clickCount':1,'pointerType':'pen','force':0.6})
    async def stroke(x0,y0,x1,y1):
      await pen('mousePressed',x0,y0)
      for k in range(1,13): await pen('mouseMoved',x0+(x1-x0)*k/12,y0+(y1-y0)*k/12)
      await pen('mouseReleased',x1,y1); await pg.wait_for_timeout(120)
    # animation mode on via toolbar page
    await pg.tap('[data-page-btn="animate"]'); await pg.tap('#amOn'); await pg.wait_for_timeout(300)
    # new layer for drawing
    await pg.tap('[data-cmd="layerNew"]'); await pg.wait_for_timeout(200)
    await pg.tap('[data-tool="brush"]')
    cx,cy=r[0]+r[2]/2,r[1]+r[3]/2
    for i in range(4):
      if i: await pg.tap('#fdAdd'); await pg.wait_for_timeout(250)
      await stroke(cx-150+i*60,cy-40,cx-150+i*60,cy+60)
    print('after 4 frames', await I())
    await pg.screenshot(path='a_onion.png')
    # onion settings
    await pg.tap('[data-page-btn="animate"]')
    await pg.evaluate("()=>{const s=document.querySelector('#onBefore');s.value=3;s.dispatchEvent(new Event('input'))}")
    await pg.wait_for_timeout(150); await pg.screenshot(path='a_onion3.png')
    # duplicate, move, delete + undo
    await pg.tap('#amDup'); await pg.wait_for_timeout(200); print('dup', (await I())['frame'])
    await pg.tap('#amLeft'); await pg.wait_for_timeout(200); print('moved', (await I())['frame'])
    await pg.tap('#amDel'); await pg.wait_for_timeout(200); print('del', (await I())['frame'])
    await pg.tap('#undoBtn'); await pg.wait_for_timeout(200); print('undo del', (await I())['frame'])
    # tween: new layer with a red square, then tween across 12 frames
    await pg.tap('[data-cmd="layerNew"]'); await pg.wait_for_timeout(200)
    await pg.tap('[data-tool="rect"]')
    await pg.evaluate("()=>{const b=[...document.querySelectorAll('#shStyle button')].find(x=>x.dataset.v==='fill'); b&&b.click()}")
    for s in await pg.query_selector_all('#palGrid .sw'):
      if (await s.get_attribute('data-tip') or '').lower()=='#ff0000': await s.dispatch_event('mousedown',{'button':0}); break
    await stroke(r[0]+60,r[1]+60,r[0]+120,r[1]+120)
    await pg.tap('[data-tool="move"]'); await pg.tap('[data-page-btn="xform"]'); await pg.tap('#xTrim'); await pg.wait_for_timeout(300)
    await pg.tap('[data-page-btn="animate"]'); await pg.wait_for_timeout(200)
    await pg.tap('#twSet0')
    x0=await pg.input_value('#twX0'); 
    await pg.fill('#twX1', str(int(x0)+900)); await pg.fill('#twY1','500'); await pg.fill('#twR1','180'); await pg.fill('#twS1','200')
    await pg.fill('#twFrom','1'); await pg.fill('#twTo','12')
    await pg.wait_for_timeout(100); await pg.screenshot(path='a_path.png')
    await pg.tap('#twApply'); await pg.wait_for_timeout(1500)
    print('tween', await I(), await pg.inner_text('#sbHelp'))
    await pg.screenshot(path='a_tween.png')
    # export animated GIF via share sheet
    await pg.tap('#saveTop'); await pg.select_option('#fmt','gif'); await pg.tap('#saveBtn'); await pg.wait_for_timeout(300)
    await pg.tap('#saveDlg button[type=submit]'); await pg.wait_for_timeout(4000); await pg.tap('#shGo'); await pg.wait_for_timeout(500)
    sh=await pg.evaluate('window.__shared && [window.__shared[0], window.__shared[1]]'); print('gif', sh)
    if sh: open('a_out.gif','wb').write(base64.b64decode(await pg.evaluate('window.__shared[2]')))
    # portrait / landscape option scrolling check
    await pg.tap('[data-tool="brush"]'); await pg.wait_for_timeout(200)
    print('pages scrollable', await pg.evaluate("()=>{const p=document.querySelector('#pages');return [p.clientHeight,p.scrollHeight, p.classList.contains('more')]}"))
    await pg.screenshot(path='a_land_brush.png')
    print('errors',errs); await b.close()
asyncio.run(main())
