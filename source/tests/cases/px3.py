import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get('GWIZ_URL') or 'file://' + os.path.abspath(os.path.join(HERE, '..', '..', 'launcher', 'index.html'))
import asyncio
from playwright.async_api import async_playwright
from px1 import INIT
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    ctx=await b.new_context(**p.devices['iPad Pro 11'],); pg=await ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto(URL+'?sample'); await pg.wait_for_timeout(1200)
    await pg.tap('[data-page-btn="pixel"]'); await pg.select_option('#pxSize','128x128'); await pg.select_option('#pxPal','PICO-8')
    await pg.tap('#pxResize'); await pg.wait_for_timeout(500); await pg.tap('#pxOn'); await pg.wait_for_timeout(300)
    await pg.select_option('#pxDither','o4'); await pg.tap('#pxReduce'); await pg.wait_for_timeout(1200)
    await pg.select_option('#pxTile','16'); await pg.tap('#pxCrt'); await pg.tap('#pxTv'); await pg.wait_for_timeout(500)
    print(await pg.inner_text('#sbSize'), await pg.inner_text('#zoomVal'), await pg.inner_text('#pxCount'))
    await pg.screenshot(path='p_portrait.png')
    # image menu / view menu entries
    await pg.tap('.mtop[data-menu="image"]'); await pg.wait_for_timeout(200); await pg.screenshot(path='p_menu.png'); await pg.keyboard.press('Escape')
    print('errors',errs); await b.close()
asyncio.run(main())
