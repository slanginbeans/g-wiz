import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
import asyncio, base64
from playwright.async_api import async_playwright
INFO="""()=>({n:document.querySelectorAll('#layerList .lyr').length, sel:(document.querySelector('#layerList .lyr.sel .lname div')||{}).textContent, info:document.querySelector('#lInfo').textContent, size:document.querySelector('#sbSize').textContent, x:+document.querySelector('#xX').value,y:+document.querySelector('#xY').value,w:+document.querySelector('#xW').value,h:+document.querySelector('#xH').value, undo:!document.querySelector('#undoBtn').disabled})"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1366,'height':800})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    await pg.add_init_script("window.__saved=null;window.showSaveFilePicker=async(o)=>({name:o.suggestedName,createWritable:async()=>({write:async b=>{const a=b instanceof Blob?new Uint8Array(await b.arrayBuffer()):new Uint8Array(b.buffer?b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength):b);let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode.apply(null,a.subarray(i,i+32768));window.__saved={name:o.suggestedName,size:a.length,b64:btoa(s)}},close:async()=>{}})});")
    await pg.goto(URL+'?sample'); await pg.wait_for_timeout(700)
    r=await pg.evaluate("()=>{const r=document.querySelector('#view').getBoundingClientRect();return [r.left,r.top,r.width,r.height]}")
    async def px(x,y): return await pg.evaluate(f"()=>Array.from(document.querySelector('#view').getContext('2d').getImageData({int(x-r[0])},{int(y-r[1])},1,1).data)")
    I=lambda: pg.evaluate(INFO)
    cx,cy=r[0]+r[2]/2,r[1]+r[3]/2
    print('start',await I())
    # 1. import an animated GIF as a layer
    await pg.set_input_files('#layerIn','anim.gif'); await pg.wait_for_timeout(900)
    print('import',await I(), 'tl visible', await pg.is_visible('#timeline'))
    # 2. move tool: drag layer
    await pg.keyboard.press('m'); await pg.wait_for_timeout(100)
    i0=await I()
    await pg.mouse.move(cx,cy); await pg.mouse.down(); await pg.mouse.move(cx+120,cy+60,steps=8); await pg.mouse.up()
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
    i1=await I(); print('moved', i0['x'],i0['y'],'->',i1['x'],i1['y'])
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(200); print('undo move', (await I())['x'])
    await pg.keyboard.press('Control+y'); await pg.wait_for_timeout(200); print('redo move', (await I())['x'])
    # 3. scale via numeric transform + rotate
    await pg.click('[data-page-btn="xform"]')
    await pg.fill('#xW','300'); await pg.dispatch_event('#xW','input'); await pg.fill('#xRot','30'); await pg.click('#xApply'); await pg.wait_for_timeout(800)
    print('xform', await I())
    await pg.screenshot(path='l_xform.png')
    # corner drag scale
    await pg.keyboard.press('m')
    q=await pg.evaluate("()=>1")
    # 4. layer shape
    await pg.select_option('#kShape','ellipse'); await pg.click('#kApply'); await pg.wait_for_timeout(300)
    # 5. new layer + brush stroke in red
    await pg.click('[data-cmd="layerNew"]'); await pg.wait_for_timeout(200); print('new layer', await I())
    await pg.keyboard.press('y'); await pg.wait_for_timeout(100)
    sw=await pg.query_selector_all('#palGrid .sw')
    # find pure red swatch
    red=None
    for s in sw:
      t=await s.get_attribute('data-tip')
      if t and t.lower()=='#ff0000': red=s; break
    await red.dispatch_event('mousedown',{'button':0})
    y0=r[1]+80
    await pg.mouse.move(r[0]+150,y0); await pg.mouse.down(); await pg.mouse.move(r[0]+450,y0,steps=15); await pg.mouse.up(); await pg.wait_for_timeout(200)
    print('brush px', await px(r[0]+300,y0))
    # pencil, pen, marker, airbrush in other rows
    for k,tool,yy in [('p','pencil',110),('n','pen',140),('k','marker',170),('j','air',200)]:
      await pg.keyboard.press(k); await pg.mouse.move(r[0]+150,r[1]+yy); await pg.mouse.down(); await pg.mouse.move(r[0]+450,r[1]+yy+5,steps=12); await pg.wait_for_timeout(120 if tool=='air' else 10); await pg.mouse.up(); await pg.wait_for_timeout(100)
      print(tool, await px(r[0]+300,r[1]+yy+2))
    # shapes
    for k,tool in [('l','line'),('u','rect'),('o','ellipse')]:
      await pg.keyboard.press(k); await pg.mouse.move(r[0]+500,r[1]+250); await pg.mouse.down(); await pg.mouse.move(r[0]+650,r[1]+350,steps=6); await pg.mouse.up(); await pg.wait_for_timeout(80)
    await pg.click('[data-tool="rrect"]'); await pg.mouse.move(r[0]+520,r[1]+400); await pg.mouse.down(); await pg.mouse.move(r[0]+640,r[1]+460,steps=5); await pg.mouse.up()
    print('rect edge px', await px(r[0]+500,r[1]+300))
    # fill inside the rectangle (all layers sampling default?) 
    await pg.keyboard.press('g'); await pg.mouse.click(r[0]+520,r[1]+330); await pg.wait_for_timeout(300)
    print('fill px', await px(r[0]+520,r[1]+330))
    # picker
    await pg.keyboard.press('i'); await pg.mouse.click(cx-200,cy+250); await pg.wait_for_timeout(100)
    print('picked', await pg.evaluate("()=>getComputedStyle(document.querySelector('#cw1')).getPropertyValue('--c')"))
    # text
    await pg.keyboard.press('a'); await pg.mouse.click(r[0]+100,r[1]+500); await pg.wait_for_timeout(100)
    await pg.keyboard.type('Hello G-WIZ'); await pg.click('#tDone'); await pg.wait_for_timeout(300)
    print('after text', await I())
    # palettes + edit colors dialog
    await pg.select_option('#palScheme','Game Boy'); print('gameboy swatches', len(await pg.query_selector_all('#palGrid .sw:not([disabled])')))
    await pg.click('#palEdit'); await pg.wait_for_timeout(100); print('colordlg', await pg.is_visible('#colorDlg'))
    await pg.fill('#cHex','#3366cc'); await pg.press('#cHex','Enter'); await pg.click('#cOk'); await pg.wait_for_timeout(100)
    print('c1 after dlg', await pg.evaluate("()=>getComputedStyle(document.querySelector('#cw1')).getPropertyValue('--c')"))
    # adjustments on active layer
    await pg.click('[data-page-btn="adjust"]'); await pg.evaluate("()=>{const s=document.querySelector('#aBright');s.value=40;s.dispatchEvent(new Event('input'))}"); await pg.wait_for_timeout(200)
    await pg.click('#aApply'); await pg.wait_for_timeout(300)
    await pg.click('[data-page-btn="effects"]'); await pg.click('#eBlurBtn'); await pg.wait_for_timeout(500)
    await pg.screenshot(path='l_draw.png')
    print('sb', await pg.inner_text('#sbHelp'))
    # merge down & flatten & undo
    n0=(await I())['n']; await pg.click('[data-cmd="layerMerge"]'); await pg.wait_for_timeout(400); print('merge', n0,'->',(await I())['n'])
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(300); print('undo merge', (await I())['n'])
    # whole picture rotate 90 with layers
    await pg.click('[data-page-btn="rotate"]'); await pg.click('#rotR'); await pg.wait_for_timeout(600); print('rot90', await I())
    await pg.evaluate("()=>{const s=document.querySelector('#rang');s.value=20;s.dispatchEvent(new Event('input'))}"); await pg.wait_for_timeout(200); await pg.screenshot(path='l_rotprev.png')
    await pg.click('#rApply'); await pg.wait_for_timeout(1500); print('rot20', await I())
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(500); await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(500); print('undo rots', await I())
    # canvas size + resize
    await pg.click('[data-page-btn="canvas"]'); await pg.fill('#cvW','1100'); await pg.fill('#cvH','800'); await pg.click('#cvApply'); await pg.wait_for_timeout(500); print('canvas', await I())
    await pg.fill('#rsW','550'); await pg.dispatch_event('#rsW','input'); await pg.click('#rsApply'); await pg.wait_for_timeout(1500); print('resize', await I())
    # crop via tool numbers
    await pg.keyboard.press('c'); await pg.fill('#cropW','400'); await pg.press('#cropW','Enter'); await pg.click('#cApply'); await pg.wait_for_timeout(600); print('crop', await I())
    # export animated GIF
    await pg.click('#saveTop'); await pg.select_option('#fmt','gif'); await pg.wait_for_timeout(100)
    print('gifAnimRows visible', await pg.is_visible('#gifAnimRows'))
    await pg.click('#saveBtn'); await pg.wait_for_timeout(3000)
    sv=await pg.evaluate('window.__saved && [window.__saved.name, window.__saved.size]'); print('saved', sv)
    if sv:
      open('l_out.gif','wb').write(base64.b64decode(await pg.evaluate('window.__saved.b64')))
    # project save / reopen
    nlay=(await I())['n']
    await pg.keyboard.press('Control+Shift+s'); await pg.wait_for_timeout(2500)
    sv=await pg.evaluate('window.__saved && [window.__saved.name, window.__saved.size]'); print('project', sv)
    open('l_proj.gwiz','wb').write(base64.b64decode(await pg.evaluate('window.__saved.b64')))
    await pg.set_input_files('#fileIn','anim2.gif'); await pg.wait_for_timeout(800); print('opened other', (await I())['n'])
    await pg.set_input_files('#fileIn','l_proj.gwiz'); await pg.wait_for_timeout(1500); print('reopened', await I(), 'expected n', nlay)
    await pg.screenshot(path='l_reopen.png')
    print('errors',errs); await b.close()
asyncio.run(main())
