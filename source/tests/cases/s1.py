import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
import asyncio
from playwright.async_api import async_playwright
INFO="()=>({size:document.querySelector('#sbSize').textContent, n:document.querySelectorAll('#layerList .lyr').length, info:document.querySelector('#lInfo').textContent})"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    ctx=await b.new_context(viewport={'width':1366,'height':800}); pg=await ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    await pg.goto(URL); await pg.wait_for_timeout(900)
    print('recover dialog at first start', await pg.is_visible('#recDlg'))
    # 1) import a big picture into the blank canvas -> dialog
    await pg.set_input_files('#layerIn','big.png'); await pg.wait_for_timeout(800)
    print('fit dialog', await pg.is_visible('#fitDlg'), '|', await pg.inner_text('#fitInfo'))
    print('  canvas text:', await pg.inner_text('#fitCanvasTxt'))
    await pg.screenshot(path='s_fit.png')
    await pg.check('#fitDlg input[value=canvas]'); await pg.click('#fitOk'); await pg.wait_for_timeout(800)
    print('canvas choice', await pg.evaluate(INFO))
    # 2) another, choose scale
    await pg.set_input_files('#layerIn','wide.png'); await pg.wait_for_timeout(700)
    print('fit dialog again', await pg.is_visible('#fitDlg'))
    await pg.check('#fitDlg input[value=keep]'); await pg.click('#fitOk'); await pg.wait_for_timeout(600)
    print('keep choice', await pg.evaluate(INFO))
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(300)
    # 3) batch of two with "same for others", scale
    await pg.click('[data-cmd="new"]'); await pg.wait_for_timeout(200); await pg.fill('#nW','800'); await pg.fill('#nH','600'); await pg.click('#nOk'); await pg.wait_for_timeout(300)
    await pg.set_input_files('#layerIn',['big.png','wide.png']); await pg.wait_for_timeout(800)
    print('batch: same-for-others row', await pg.is_visible('#fitAllRow'))
    await pg.check('#fitDlg input[value=scale]'); await pg.check('#fitAll'); await pg.click('#fitOk'); await pg.wait_for_timeout(1500)
    print('batch scale', await pg.evaluate(INFO), 'dialog hidden', await pg.is_hidden('#fitDlg'))
    # 4) cancel
    await pg.set_input_files('#layerIn','big.png'); await pg.wait_for_timeout(700); await pg.click('#fitCancel'); await pg.wait_for_timeout(200)
    print('cancel', await pg.evaluate(INFO))
    # draw something, wait for autosave
    await pg.click('[data-tool="brush"]')
    r=await pg.evaluate("()=>{const r=document.querySelector('#view').getBoundingClientRect();return [r.left,r.top,r.width,r.height]}")
    await pg.mouse.move(r[0]+200,r[1]+200); await pg.mouse.down(); await pg.mouse.move(r[0]+600,r[1]+300,steps=10); await pg.mouse.up()
    await pg.wait_for_timeout(5000)
    recs=await pg.evaluate("new Promise(res=>{const q=indexedDB.open('gwiz');q.onsuccess=()=>{const t=q.result.transaction('autosave').objectStore('autosave').getAll();t.onsuccess=()=>res(t.result.map(r=>[r.name,r.w,r.h,r.layers,r.bytes.length,r.saved]))}})")
    print('autosaved records', recs)
    # close and reopen (same profile) -> recovery
    await pg.close(); pg=await ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(1200)
    print('recover on restart', await pg.is_visible('#recDlg'), await pg.evaluate("document.querySelectorAll('#recList .recrow').length"))
    await pg.screenshot(path='s_recover.png')
    await pg.click('#recOpen'); await pg.wait_for_timeout(1500)
    print('restored', await pg.evaluate(INFO))
    # reload again: already seen -> no prompt; File > Recover lists it
    await pg.reload(); await pg.wait_for_timeout(1200)
    print('prompt after seen', await pg.is_visible('#recDlg'))
    await pg.click('.mtop[data-menu="file"]'); await pg.click('#menus >> text=Recover autosaved work'); await pg.wait_for_timeout(500)
    print('menu recover list', await pg.evaluate("document.querySelectorAll('#recList .recrow').length"))
    await pg.click('#recSkip')
    print('errors', errs); await b.close()
asyncio.run(main())
