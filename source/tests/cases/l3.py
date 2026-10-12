import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
import asyncio, base64
from playwright.async_api import async_playwright
INFO=open(os.path.join(HERE,'l1.py')).read().split('INFO="""')[1].split('"""')[0]
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1366,'height':800})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    await pg.goto(URL+'?sample'); await pg.wait_for_timeout(700)
    r=await pg.evaluate("()=>{const r=document.querySelector('#view').getBoundingClientRect();return [r.left,r.top,r.width,r.height]}")
    async def px(x,y): return await pg.evaluate(f"()=>Array.from(document.querySelector('#view').getContext('2d').getImageData({int(x-r[0])},{int(y-r[1])},1,1).data)")
    I=lambda: pg.evaluate(INFO)
    z=0.893; ox=(r[2]-960*z)/2; oy=(r[3]-720*z)/2
    D=lambda dx,dy:(r[0]+ox+dx*z, r[1]+oy+dy*z)
    # add an opaque layer: new layer + fill with bucket using green
    await pg.click('[data-cmd="layerNew"]'); await pg.keyboard.press('g')
    sw=await pg.query_selector_all('#palGrid .sw')
    for s in sw:
      if (await s.get_attribute('data-tip') or '').lower()=='#00ff00': await s.dispatch_event('mousedown',{'button':0}); break
    await pg.uncheck('#fAll') if await pg.is_visible('#fAll') else None
    x,y=D(30,30); await pg.mouse.click(x,y); await pg.wait_for_timeout(400)
    print('filled', await px(x,y))
    # shrink layer to 400x300 and move to 100,200 via numbers
    await pg.click('[data-page-btn="xform"]'); await pg.uncheck('#xKeep'); await pg.fill('#xW','400'); await pg.fill('#xH','300'); await pg.fill('#xX','100'); await pg.fill('#xY','200'); await pg.click('#xApply'); await pg.wait_for_timeout(600)
    print(await I())
    # erase with plain mode at doc (300,350): should reveal cactus bg beneath
    await pg.keyboard.press('e'); await pg.click('#modeSeg [data-m="plain"]')
    x,y=D(300,350); before=await px(x,y)
    await pg.mouse.move(x-5,y); await pg.mouse.down(); await pg.mouse.move(x+5,y,steps=3); await pg.mouse.up(); await pg.wait_for_timeout(200)
    print('erase', before,'->',await px(x,y), 'outside layer', await px(*D(600,350)))
    # switch to bottom layer, then undo: should switch back and restore green
    await pg.click('#layerList .lyr:last-child'); await pg.wait_for_timeout(200); print('sel', (await I())['sel'])
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(300); print('undo erase', await px(x,y), (await I())['sel'])
    # wand on offset layer (restore all is default?), erase entire green
    await pg.keyboard.press('w'); await pg.mouse.click(*D(150,250)); await pg.wait_for_timeout(500); print('wand', await px(*D(150,250)))
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(300)
    # visibility toggle, duplicate, delete, reorder
    await pg.click('#layerList .lyr.sel .lbtn'); await pg.wait_for_timeout(100); print('hidden', await px(*D(150,250)))
    await pg.click('#layerList .lyr.sel .lbtn'); await pg.wait_for_timeout(100)
    await pg.click('[data-cmd="layerDup"]'); print('dup', (await I())['n'])
    await pg.click('[data-cmd="layerDown"]'); await pg.click('[data-cmd="layerDel"]'); print('del', (await I())['n'])
    # blend mode multiply + opacity
    await pg.select_option('#lBlend','multiply'); await pg.evaluate("()=>{const s=document.querySelector('#lOpac');s.value=50;s.dispatchEvent(new Event('input'))}"); await pg.wait_for_timeout(100)
    print('multiply 50%', await px(*D(150,250)))
    # corner drag scale with move tool: drag bottom-right corner of layer (doc 500,500) to (700,600)
    await pg.keyboard.press('m'); await pg.mouse.click(*D(300,350)); await pg.wait_for_timeout(100)
    i0=await I()
    cx,cy=D(i0['x']+i0['w'],i0['y']+i0['h']); await pg.mouse.move(cx,cy); await pg.mouse.down(); await pg.mouse.move(cx+100,cy+50,steps=6); await pg.mouse.up()
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500); print('corner', i0['w'],i0['h'],'->',(await I())['w'],(await I())['h'])
    # ctrl-drag distort a corner
    i0=await I(); cx,cy=D(i0['x'],i0['y']); await pg.mouse.move(cx,cy); await pg.keyboard.down('Control'); await pg.mouse.down(); await pg.mouse.move(cx+60,cy+30,steps=6); await pg.mouse.up(); await pg.keyboard.up('Control')
    await pg.wait_for_timeout(100); await pg.screenshot(path='l_distort.png'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(800); print('distort', await I())
    # crop tool overlay drag on canvas
    await pg.keyboard.press('c'); a=D(100,100); bb=D(500,400); await pg.mouse.move(*a); await pg.mouse.down(); await pg.mouse.move(*bb,steps=5); await pg.mouse.up()
    print('crop box', [await pg.input_value(i) for i in ['#cropX','#cropY','#cropW','#cropH']])
    await pg.screenshot(path='l_crop.png')
    await pg.keyboard.press('Escape')
    # flatten
    await pg.click('.mtop[data-menu="layerm"]'); await pg.wait_for_timeout(100)
    await pg.click('#menus >> text=Flatten'); await pg.wait_for_timeout(500); print('flatten', (await I())['n'])
    # new image dialog
    await pg.keyboard.press('Control+n'); await pg.wait_for_timeout(100); print('newdlg', await pg.is_visible('#newDlg'))
    await pg.fill('#nW','320'); await pg.fill('#nH','200'); await pg.click('#nOk'); await pg.wait_for_timeout(300); print('new', await I())
    print('errors',errs); await b.close()
asyncio.run(main())
