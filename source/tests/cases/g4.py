import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
import asyncio, base64
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1366,'height':800})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.add_init_script("window.__saved=0;window.showSaveFilePicker=async(o)=>({name:o.suggestedName,createWritable:async()=>({write:async b=>{window.__saved=b.size},close:async()=>{}})});")
    await pg.goto(URL+'?sample'); await pg.wait_for_timeout(600)
    r=await pg.evaluate("()=>{const r=document.querySelector('#stage').getBoundingClientRect();return [r.left,r.top,r.width,r.height]}")
    # eraser stroke + undo
    await pg.mouse.move(r[0]+r[2]*0.25,r[1]+r[3]*0.2); await pg.mouse.down(); await pg.mouse.move(r[0]+r[2]*0.5,r[1]+r[3]*0.25,steps=12); await pg.mouse.up()
    print('undo enabled after stroke:', not await pg.is_disabled('#undoBtn'))
    # auto remove with preview
    await pg.click('[data-page-btn="auto"]'); await pg.click('#aMethod [data-v="smart"]'); await pg.check('#aPrev'); await pg.wait_for_timeout(600); print('auto preview:',await pg.inner_text('#aPrevStat'))
    await pg.click('#autoBtn'); await pg.wait_for_timeout(900); print('sb:',await pg.inner_text('#sbHelp'))
    await pg.uncheck('#aPrev')
    await pg.click('[data-page-btn="specks"]'); await pg.click('#speckBtn'); await pg.wait_for_timeout(500); print('sb:',await pg.inner_text('#sbHelp'))
    await pg.click('[data-page-btn="finish"]'); await pg.evaluate("()=>{const s=document.querySelector('#shrink');s.value=1;s.dispatchEvent(new Event('input'))}"); await pg.check('#defringe'); await pg.wait_for_timeout(400)
    await pg.click('[data-page-btn="opacity"]'); await pg.evaluate("()=>{const s=document.querySelector('#opac');s.value=80;s.dispatchEvent(new Event('input'))}")
    # wand
    await pg.click('[data-tool="wand"]'); await pg.mouse.click(r[0]+20,r[1]+20); await pg.wait_for_timeout(400)
    # rotate via toolbar, view menu
    await pg.click('#tbRotR'); await pg.wait_for_timeout(300); print('after rotate:',await pg.inner_text('#sbSize'))
    await pg.click('.mtop[data-menu="viewm"]'); await pg.click('#menus >> text=Mask overlay'); await pg.wait_for_timeout(200)
    await pg.screenshot(path='g_mask.png')
    await pg.click('.mtop[data-menu="viewm"]'); await pg.click('#menus >> text=Result')
    # save png + estimate gif
    await pg.click('#saveTop'); await pg.click('#estBtn'); await pg.wait_for_timeout(800); print('estimate:',await pg.inner_text('#estOut'))
    await pg.click('#saveBtn'); await pg.wait_for_timeout(1200); print('saved bytes:',await pg.evaluate('window.__saved'),'|',await pg.inner_text('#sbHelp'))
    # motion on anim
    await pg.set_input_files('#fileIn','anim2.gif'); await pg.wait_for_timeout(800)
    await pg.click('[data-page-btn="motion"]'); await pg.click('#mAnalyze'); await pg.wait_for_timeout(700); print('motion:',await pg.inner_text('#mStat'))
    await pg.click('#mErase'); await pg.wait_for_timeout(500)
    await pg.keyboard.press('Alt+h'); await pg.wait_for_timeout(100); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
    print('about open:', await pg.is_visible('#aboutDlg')); await pg.screenshot(path='g_about.png'); await pg.keyboard.press('Escape')
    await pg.hover('[data-page-btn="stab"]'); await pg.wait_for_timeout(700); await pg.screenshot(path='g_tip2.png',clip={'x':560,'y':20,'width':420,'height':90})
    print('errors',errs); await b.close()
asyncio.run(main())
