# Builds launcher/rsrc_windows_amd64.syso: a COFF object with the app icon, a manifest and version info,
# which Go links into G-WIZ.exe. make_release.py runs it before building the exe.
import struct, io, os, re
from PIL import Image
os.chdir(os.path.dirname(os.path.abspath(__file__)))   # works from any folder; paths below are from tools/
# the version comes from build.py, so it is set in one place
VERSION = tuple(int(x) for x in re.search(r"^VERSION = '([\d.]+)'", open(os.path.join('..', 'build.py'), encoding='utf-8').read(), re.M).group(1).split('.')) + (0,)

def dib(img):
    img = img.convert('RGBA'); w, h = img.size; px = img.load()
    hdr = struct.pack('<IiiHHIIiiII', 40, w, h * 2, 1, 32, 0, 0, 0, 0, 0, 0)
    xor = bytearray()
    for y in range(h - 1, -1, -1):
        for x in range(w):
            r, g, b, a = px[x, y]; xor += bytes((b, g, r, a))
    stride = ((w + 31) // 32) * 4; andm = bytearray()
    for y in range(h - 1, -1, -1):
        row = bytearray(stride)
        for x in range(w):
            if px[x, y][3] == 0: row[x // 8] |= 0x80 >> (x % 8)
        andm += row
    return hdr + bytes(xor) + bytes(andm)

def png(img):
    b = io.BytesIO(); img.save(b, 'PNG'); return b.getvalue()

img = lambda n: Image.open(os.path.join('..', 'app', 'images', f'icon{n}.png'))
icons = [(16, dib(img(16))), (32, dib(img(32))), (48, dib(img(48))), (256, png(img(256)))]
grp = struct.pack('<HHH', 0, 1, len(icons))
for i, (s, data) in enumerate(icons):
    grp += struct.pack('<BBBBHHIH', 0 if s >= 256 else s, 0 if s >= 256 else s, 0, 0, 1, 32, len(data), i + 1)

manifest = b'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <assemblyIdentity type="win32" name="GWIZ.GraphicsWizard" version="__VER__" processorArchitecture="amd64"/>
  <description>G-WIZ Graphics Wizard</description>
  <dependency><dependentAssembly><assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*"/></dependentAssembly></dependency>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1"><application>
    <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
  </application></compatibility>
  <application xmlns="urn:schemas-microsoft-com:asm.v3"><windowsSettings>
    <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>
    <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness>
  </windowsSettings></application>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3"><security><requestedPrivileges>
    <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
  </requestedPrivileges></security></trustInfo>
</assembly>
'''
manifest = manifest.replace(b'__VER__', '.'.join(map(str, VERSION)).encode())

# ---- VS_VERSIONINFO ----
def pad4(b): return b + b'\0' * ((4 - len(b) % 4) % 4)
def wstr(s): return (s + '\0').encode('utf-16-le')
def node(key, value=b'', wtype=1, children=(), vlen=None):
    body = pad4(struct.pack('<HHH', 0, 0, wtype) + wstr(key))
    body += value
    if children:
        body = pad4(body)
        for i, c in enumerate(children):
            body += pad4(c) if i < len(children) - 1 else c
    if vlen is None: vlen = len(value) // 2 if wtype == 1 else len(value)
    return struct.pack('<HHH', len(body), vlen, wtype) + body[6:]
def sval(k, v): return node(k, wstr(v), 1, (), len(v) + 1)
ms = (VERSION[0] << 16) | VERSION[1]; ls = (VERSION[2] << 16) | VERSION[3]
fixed = struct.pack('<13I', 0xFEEF04BD, 0x00010000, ms, ls, ms, ls, 0x3F, 0, 0x40004, 1, 0, 0, 0)
vs = '.'.join(map(str, VERSION))
strings = [sval('CompanyName', 'G-WIZ'), sval('FileDescription', 'G-WIZ Graphics Wizard'), sval('FileVersion', vs),
           sval('InternalName', 'G-WIZ'), sval('LegalCopyright', 'G-WIZ'), sval('OriginalFilename', 'G-WIZ.exe'),
           sval('ProductName', 'G-WIZ'), sval('ProductVersion', vs)]
st = node('040904B0', b'', 1, strings, 0)
sfi = node('StringFileInfo', b'', 1, [st], 0)
var = node('Translation', struct.pack('<HH', 0x0409, 0x04B0), 0, (), 4)
vfi = node('VarFileInfo', b'', 1, [var], 0)
version = node('VS_VERSION_INFO', fixed, 0, [sfi, vfi], len(fixed))

# ---- resource tree: type -> id -> language ----
res = {3: {i + 1: d for i, (s, d) in enumerate(icons)}, 14: {1: grp}, 16: {1: version}, 24: {1: manifest}}
LANG = 0x0409
types = sorted(res)
# sizes
def dsize(n): return 16 + 8 * n
off = dsize(len(types))
type_off = {}
for t in types: type_off[t] = off; off += dsize(len(res[t]))
name_off = {}
for t in types:
    for n in sorted(res[t]): name_off[(t, n)] = off; off += dsize(1)
entry_off = {}
for t in types:
    for n in sorted(res[t]): entry_off[(t, n)] = off; off += 16
data_off = {}
for t in types:
    for n in sorted(res[t]):
        off = (off + 7) & ~7; data_off[(t, n)] = off; off += len(res[t][n])
sec = bytearray(off)
def put(o, b): sec[o:o + len(b)] = b
def dirhdr(o, nid): put(o, struct.pack('<IIHHHH', 0, 0, 0, 0, 0, nid))
dirhdr(0, len(types))
for i, t in enumerate(types): put(16 + 8 * i, struct.pack('<II', t, 0x80000000 | type_off[t]))
relocs = []
for t in types:
    names = sorted(res[t]); dirhdr(type_off[t], len(names))
    for i, n in enumerate(names):
        put(type_off[t] + 16 + 8 * i, struct.pack('<II', n, 0x80000000 | name_off[(t, n)]))
        dirhdr(name_off[(t, n)], 1)
        put(name_off[(t, n)] + 16, struct.pack('<II', LANG, entry_off[(t, n)]))
        put(entry_off[(t, n)], struct.pack('<IIII', data_off[(t, n)], len(res[t][n]), 0, 0))
        relocs.append(entry_off[(t, n)])
        put(data_off[(t, n)], res[t][n])
sec = bytes(sec)
# ---- COFF object ----
nrel = len(relocs)
p_raw = 20 + 40; p_rel = p_raw + len(sec); p_sym = p_rel + 10 * nrel
out = struct.pack('<HHIIIHH', 0x8664, 1, 0, p_sym, 1, 0, 0)
out += struct.pack('<8sIIIIIIHHI', b'.rsrc', 0, 0, len(sec), p_raw, p_rel, 0, nrel, 0, 0x40000040)
out += sec
for r in relocs: out += struct.pack('<IIH', r, 0, 3)   # IMAGE_REL_AMD64_ADDR32NB against symbol 0 (.rsrc)
out += struct.pack('<8sIhHBB', b'.rsrc', 0, 1, 0, 3, 0)
out += struct.pack('<I', 4)
open(os.path.join('..', 'launcher', 'rsrc_windows_amd64.syso'), 'wb').write(out)
print('syso', len(out), 'bytes,', nrel, 'resources')
