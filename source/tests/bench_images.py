import numpy as np, random
from PIL import Image, ImageDraw, ImageFilter
random.seed(3); np.random.seed(3)
W,H=800,600
def save(name, bg, fg_rgba):
    # composite fg over bg, save image + truth alpha
    fg=np.array(fg_rgba).astype(np.float32); a=fg[...,3:4]/255
    out=(np.array(bg).astype(np.float32)*(1-a)+fg[...,:3]*a).clip(0,255).astype(np.uint8)
    Image.fromarray(out).save(name+'.png'); Image.fromarray(fg[...,3].astype(np.uint8)).save(name+'_truth.png')
def subject(color=(200,60,40), hair=True, hole=True):
    im=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.ellipse((250,120,550,420),fill=color+(255,))           # head
    d.rectangle((300,400,500,600),fill=(60,90,170,255))      # body (different color)
    if hole: d.ellipse((330,440,400,520),fill=(0,0,0,0))     # enclosed gap (background shows through)
    d.polygon([(120,600),(300,420),(330,600)],fill=(60,90,170,255)) # arm leaving gap at (200,520)
    if hair:
        for i in range(140):
            a=random.uniform(-2.4,-0.7); L=random.uniform(30,120); x0=400+math.cos(a)*150; y0=270+math.sin(a)*150
            d.line((x0,y0,x0+math.cos(a)*L,y0+math.sin(a)*L),fill=(90,40,20,random.randint(120,255)),width=random.choice([1,1,2]))
    return im
import math
# 1 plain gradient bg
bg=np.zeros((H,W,3),np.float32); yy,xx=np.mgrid[0:H,0:W]
bg[...,0]=170+40*xx/W; bg[...,1]=190+30*yy/H; bg[...,2]=215+20*xx/W
bg+=np.random.normal(0,4,bg.shape)
save('t1_gradient', bg.clip(0,255).astype(np.uint8), subject())
# 2 subject color close to background (red subject on pink bg) 
bg2=np.zeros((H,W,3),np.float32); bg2[...,0]=225; bg2[...,1]=130+30*yy/H; bg2[...,2]=130
bg2+=np.random.normal(0,6,bg2.shape)
save('t2_similar', bg2.clip(0,255).astype(np.uint8), subject(color=(205,70,60)))
# 3 busy textured background: wood-grain stripes + noise + a vignette
bg3=np.zeros((H,W,3),np.float32)
bg3[...,0]=150+35*np.sin(yy/9.0+np.sin(xx/40.0)*3); bg3[...,1]=110+30*np.sin(yy/9.0+np.sin(xx/40.0)*3); bg3[...,2]=70+20*np.sin(yy/9.0)
bg3*= (1-0.35*(((xx-W/2)/W)**2+((yy-H/2)/H)**2)*2)[...,None]
bg3+=np.random.normal(0,10,bg3.shape)
save('t3_texture', bg3.clip(0,255).astype(np.uint8), subject(color=(40,160,200)))
# 4 two-tone background (floor + wall) with shadow under the subject
bg4=np.zeros((H,W,3),np.float32); bg4[:380]=np.array([235,235,230]); bg4[380:]=np.array([120,125,135])
sh=np.exp(-(((xx-400)/220)**2+((yy-470)/60)**2))*0.5; bg4*= (1-sh)[...,None]; bg4+=np.random.normal(0,3,bg4.shape)
save('t4_twotone', bg4.clip(0,255).astype(np.uint8), subject(color=(230,200,60), hair=False))
print('ok')
