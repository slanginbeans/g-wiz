# Makes the pictures the tests open. Run in the folder the tests run in.
import os, random, runpy
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))


def make_all():
    # 4-frame GIF: a red ball moving across blue
    fr = []
    for i in range(4):
        im = Image.new('RGB', (200, 100), (40, 90, 200))
        d = ImageDraw.Draw(im); cx = 40 + i * 40
        d.ellipse([cx - 22, 28, cx + 22, 72], fill=(220, 40, 40))
        fr.append(im)
    fr[0].save('anim.gif', save_all=True, append_images=fr[1:], duration=100, loop=0)

    # 8-frame GIF on a noisy checkered background
    random.seed(3)
    bg = Image.new('RGB', (240, 140)); px = bg.load()
    for y in range(140):
        for x in range(240):
            v = 120 + ((x // 12 + y // 12) % 2) * 40 + random.randint(-6, 6)
            px[x, y] = (v, v + 20, v - 10)
    fr = []
    for i in range(8):
        im = bg.copy(); d = ImageDraw.Draw(im); cx = 40 + i * 22
        d.ellipse([cx - 20, 50, cx + 20, 90], fill=(230, 50, 60))
        fr.append(im.convert('P', palette=Image.ADAPTIVE, colors=255))
    fr[0].save('anim2.gif', save_all=True, append_images=fr[1:], duration=80, loop=0)

    # pictures bigger than the default canvas, for the "picture does not fit" dialog
    for name, (w, h) in (('big.png', (2400, 1800)), ('wide.png', (3000, 500))):
        im = Image.new('RGB', (w, h))
        d = ImageDraw.Draw(im)
        for y in range(0, h, 20): d.rectangle([0, y, w, y + 19], fill=(y * 255 // h, 120, 255 - y * 255 // h))
        d.ellipse([w // 4, h // 4, w * 3 // 4, h * 3 // 4], fill=(240, 200, 40))
        im.save(name)

    # background-removal benchmark pictures with their true masks (t1..t4)
    runpy.run_path(os.path.join(HERE, 'bench_images.py'))


if __name__ == '__main__':
    make_all()
