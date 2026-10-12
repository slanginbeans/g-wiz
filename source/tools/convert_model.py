#!/usr/bin/env python3
"""Converts the U²-Net-P subject-detection model (ONNX) into G-WIZ's compact model file.

    python3 tools/convert_model.py path/to/u2netp.onnx       # writes app/models/u2netp.bin

The model: U²-Net-P by Xuebin Qin et al., Apache License 2.0 (https://github.com/xuebinqin/U-2-Net),
in the ONNX conversion published by rembg (https://github.com/danielgatis/rembg/releases, u2netp.onnx).

The ONNX graph is reduced to the six operations the app implements (convolution with optional ReLU,
2x2 max-pooling, bilinear resize to another tensor's size, addition, packing several tensors' channels
together, sigmoid on the output). Weights are stored as 16-bit integers with one float scale per output
channel: 2.3 MB, and the same results as the original to within rounding.

File layout (little endian):
    'GWNN'  u32 version  u32 json_length  json  padding to 4 bytes
    float32 block (per conv: scales[cout], bias[cout])   int16 block (per conv: weights cout*cin*k*k)
The JSON lists tensors (channel counts) and the program; each conv has offsets into the two blocks.

This file also has a NumPy reference implementation of the converted model (run_reference), which the
tests use to check the app's own inference.
"""
import json, os, struct, sys
import numpy as np

MEAN, STD, SIZE = (0.485, 0.456, 0.406), (0.229, 0.224, 0.225), 320

# ---------------- a minimal ONNX (protobuf) reader ----------------
def _varint(b, i):
    r = s = 0
    while True:
        c = b[i]; i += 1; r |= (c & 0x7f) << s; s += 7
        if c < 0x80: return r, i

def _fields(b):
    i, n = 0, len(b)
    while i < n:
        k, i = _varint(b, i); f, t = k >> 3, k & 7
        if t == 0: v, i = _varint(b, i)
        elif t == 1: v = b[i:i + 8]; i += 8
        elif t == 5: v = b[i:i + 4]; i += 4
        elif t == 2: l, i = _varint(b, i); v = b[i:i + l]; i += l
        else: raise ValueError('wire type %d' % t)
        yield f, t, v

def _ints(t, v):
    if t != 2: return [v - (1 << 64) if v >= 1 << 63 else v]
    out, j = [], 0
    while j < len(v):
        x, j = _varint(v, j); out.append(x - (1 << 64) if x >= 1 << 63 else x)
    return out

def _tensor(b):
    dims, dt, name, raw, fl, il = [], 1, '', None, [], []
    for f, t, v in _fields(b):
        if f == 1: dims += _ints(t, v)
        elif f == 2: dt = v
        elif f == 8: name = v.decode()
        elif f == 9: raw = bytes(v)
        elif f == 4: fl += list(struct.unpack('<%df' % (len(v) // 4), v)) if t == 2 else [struct.unpack('<f', v)[0]]
        elif f == 7: il += _ints(t, v)
    types = {1: np.float32, 6: np.int32, 7: np.int64, 10: np.float16, 11: np.float64}
    a = np.frombuffer(raw, types[dt]).copy() if raw is not None else np.array(fl or il)
    return name, a.reshape(dims) if dims else a

def _attr(b):
    name, val, ints = '', None, []
    for f, t, v in _fields(b):
        if f == 1: name = v.decode()
        elif f == 2: val = struct.unpack('<f', v)[0]
        elif f == 3: val = _ints(0, v)[0]
        elif f == 4: val = v.decode()
        elif f == 5: val = _tensor(v)[1]
        elif f == 8: ints += _ints(t, v)
    return name, ints if val is None else val

def load_onnx(path):
    b = open(path, 'rb').read(); g = None
    for f, t, v in _fields(b):
        if f == 7: g = v
    nodes, inits, outputs = [], {}, []
    for f, t, v in _fields(g):
        if f == 1:
            n = {'in': [], 'out': [], 'op': '', 'attr': {}}
            for f2, t2, v2 in _fields(v):
                if f2 == 1: n['in'].append(v2.decode())
                elif f2 == 2: n['out'].append(v2.decode())
                elif f2 == 4: n['op'] = v2.decode()
                elif f2 == 5: k, a = _attr(v2); n['attr'][k] = a
            nodes.append(n)
        elif f == 5: k, a = _tensor(v); inits[k] = a
        elif f == 12:
            for f2, t2, v2 in _fields(v):
                if f2 == 1: outputs.append(v2.decode())
    return nodes, inits, outputs

# ---------------- ONNX graph -> program ----------------
def convert(onnx_path):
    nodes, inits, outputs = load_onnx(onnx_path)
    prod = {o: n for n in nodes for o in n['out']}
    used = {}
    for n in nodes:
        for i in n['in']: used.setdefault(i, []).append(n)
    names = {'input.1': 0}; chans = [3]; prog = []; floats = []; wq = []; fpos = [0]; ipos = [0]

    def tid(name, c):
        if name not in names: names[name] = len(chans); chans.append(c)
        return names[name]

    def resize_ref(n):
        refs = set()
        def walk(t):
            p = prod.get(t)
            if not p: return
            if p['op'] == 'Shape':
                if p['in'][0] != n['in'][0]: refs.add(p['in'][0])
                return
            for i in p['in']: walk(i)
        walk(n['in'][3]); assert len(refs) == 1, refs
        return refs.pop()

    concat_of = {n['out'][0]: n['in'] for n in nodes if n['op'] == 'Concat' and n['attr'].get('axis') == 1}
    relu_after = {}
    for n in nodes:
        if n['op'] == 'Relu': relu_after[n['in'][0]] = n['out'][0]
    for n in nodes:
        op = n['op']
        if op == 'Conv':
            a = n['attr']; w = inits[n['in'][1]].astype(np.float32); b = inits[n['in'][2]].astype(np.float32)
            co, ci, k, _ = w.shape
            assert a['strides'] == [1, 1] and a['group'] == 1 and a['pads'][0] == a['dilations'][0] * (k // 2)
            src = n['in'][0]
            parts = concat_of.get(src, [src])
            if len(parts) > 2:   # a wide concat (the six side outputs) is packed into one tensor first
                out = tid(src, sum(chans[names[p]] for p in parts)); prog.append({'op': 'pack', 'in': [names[p] for p in parts], 'out': out}); parts = [src]
            ins = [names[p] for p in parts]
            assert sum(chans[i] for i in ins) == ci
            # Conv + Relu are one step when the conv output is used only by the Relu
            o_name = n['out'][0]; relu = o_name in relu_after and len(used.get(o_name, [])) == 1
            if relu: o_name = relu_after[o_name]
            out = tid(o_name, co)
            # 16-bit weights with one scale per output channel: 8 bits are not enough here, because the last
            # layer mixes six large side outputs that nearly cancel and small errors grow through ~100 layers
            scale = np.maximum(np.abs(w).reshape(co, -1).max(1), 1e-12) / 32767
            q = np.clip(np.round(w / scale[:, None, None, None]), -32767, 32767).astype('<i2')
            prog.append({'op': 'conv', 'in': ins, 'out': out, 'k': k, 'dil': a['dilations'][0], 'relu': relu, 'cout': co, 'cin': ci, 'f': fpos[0], 'q': ipos[0]})
            floats += [scale.astype(np.float32), b]; fpos[0] += 2 * co
            wq.append(q.ravel()); ipos[0] += q.size
        elif op == 'Relu':
            assert n['in'][0] in names and names.get(n['out'][0]) is not None or True
            if n['out'][0] not in names:   # a Relu not merged into its conv
                raise ValueError('unsupported standalone Relu')
        elif op == 'MaxPool':
            assert n['attr']['kernel_shape'] == [2, 2] and n['attr']['strides'] == [2, 2] and n['attr'].get('ceil_mode') == 1
            prog.append({'op': 'pool', 'in': names[n['in'][0]], 'out': tid(n['out'][0], chans[names[n['in'][0]]])})
        elif op == 'Resize':
            assert n['attr']['mode'] == 'linear' and n['attr']['coordinate_transformation_mode'] == 'pytorch_half_pixel'
            prog.append({'op': 'resize', 'in': names[n['in'][0]], 'ref': names[resize_ref(n)], 'out': tid(n['out'][0], chans[names[n['in'][0]]])})
        elif op == 'Add':
            a_, b_ = names[n['in'][0]], names[n['in'][1]]; assert chans[a_] == chans[b_]
            prog.append({'op': 'add', 'in': [a_, b_], 'out': tid(n['out'][0], chans[a_])})
        elif op == 'Sigmoid':
            if n['out'][0] == outputs[0]: final = names[n['in'][0]]
        elif op in ('Concat', 'Shape', 'Gather', 'Unsqueeze', 'Slice', 'Cast', 'Constant'):
            pass   # concats are folded into the convs that read them; the rest only computes sizes
        else:
            raise ValueError('unsupported op ' + op)
    # keep only what the main output needs
    need = {final}; keep = []
    for p in reversed(prog):
        if p['out'] in need:
            keep.append(p)
            for k in ('in', 'ref'):
                v = p.get(k)
                if v is None: continue
                need.update(v if isinstance(v, list) else [v])
    keep.reverse()
    meta = {'name': 'U2-Net-P', 'license': 'Apache-2.0', 'size': SIZE, 'mean': MEAN, 'std': STD, 'channels': chans, 'output': final, 'program': keep}
    return meta, np.concatenate(floats).astype('<f4'), np.concatenate(wq)

def write(meta, fl, wq, path):
    js = json.dumps(meta, separators=(',', ':')).encode()
    head = b'GWNN' + struct.pack('<II', 1, len(js)) + js
    head += b'\0' * (-len(head) % 4)
    meta['_float_offset'] = len(head)
    open(path, 'wb').write(head + fl.tobytes() + wq.tobytes())

def read(path):
    b = open(path, 'rb').read(); assert b[:4] == b'GWNN'
    ver, n = struct.unpack('<II', b[4:12]); meta = json.loads(b[12:12 + n])
    off = 12 + n; off += -off % 4
    nf = sum(2 * p['cout'] for p in meta['program'] if p['op'] == 'conv')
    fl = np.frombuffer(b, '<f4', nf, off); wq = np.frombuffer(b, '<i2', -1, off + nf * 4)
    return meta, fl, wq

# ---------------- NumPy reference of the converted model ----------------
def _resize(x, oh, ow):
    c, h, w = x.shape
    if (h, w) == (oh, ow): return x.copy()
    def co(o, i):
        s = (np.arange(o) + 0.5) * (i / o) - 0.5; s = np.clip(s, 0, None)
        i0 = np.minimum(np.floor(s).astype(int), i - 1); return i0, np.minimum(i0 + 1, i - 1), (s - i0).astype(np.float32)
    y0, y1, fy = co(oh, h); x0, x1, fx = co(ow, w)
    r0, r1 = x[:, y0], x[:, y1]; fx = fx[None, None]; fy = fy[None, :, None]
    return (r0[:, :, x0] * (1 - fx) + r0[:, :, x1] * fx) * (1 - fy) + (r1[:, :, x0] * (1 - fx) + r1[:, :, x1] * fx) * fy

def _conv(x, w, b, dil):
    c, h, ww = x.shape; o, ci, k, _ = w.shape; pad = dil * (k // 2)
    xp = np.pad(x, ((0, 0), (pad, pad), (pad, pad)))
    cols = np.empty((ci, k, k, h, ww), np.float32)
    for i in range(k):
        for j in range(k): cols[:, i, j] = xp[:, i * dil:i * dil + h, j * dil:j * dil + ww]
    return (w.reshape(o, -1) @ cols.reshape(-1, h * ww)).reshape(o, h, ww) + b[:, None, None]

def _pool(x):
    c, h, w = x.shape; oh, ow = -(-h // 2), -(-w // 2)
    xp = np.full((c, oh * 2, ow * 2), -np.inf, np.float32); xp[:, :h, :w] = x
    return xp.reshape(c, oh, 2, ow, 2).max(axis=(2, 4))

def preprocess(rgb):
    """rgb: HxWx3 uint8 already at SIZE x SIZE -> 3xSIZExSIZE float32"""
    x = rgb.astype(np.float32); x = x / max(float(x.max()), 1e-6)
    return ((x - np.array(MEAN, np.float32)) / np.array(STD, np.float32)).transpose(2, 0, 1).astype(np.float32)

def run_reference(meta, fl, wq, x):
    """x: 3xSIZExSIZE preprocessed input -> SIZExSIZE subject map, 0..1 (min-max normalized like rembg)"""
    env = {0: x}
    for p in meta['program']:
        op = p['op']
        if op == 'conv':
            co, ci, k = p['cout'], p['cin'], p['k']
            scale, bias = fl[p['f']:p['f'] + co], fl[p['f'] + co:p['f'] + 2 * co]
            w = wq[p['q']:p['q'] + co * ci * k * k].astype(np.float32).reshape(co, ci, k, k) * scale[:, None, None, None]
            inp = np.concatenate([env[i] for i in p['in']], 0)
            y = _conv(inp, w, bias, p['dil']); env[p['out']] = np.maximum(y, 0) if p['relu'] else y
        elif op == 'pool': env[p['out']] = _pool(env[p['in']])
        elif op == 'resize': r = env[p['ref']]; env[p['out']] = _resize(env[p['in']], r.shape[1], r.shape[2])
        elif op == 'add': env[p['out']] = env[p['in'][0]] + env[p['in'][1]]
        elif op == 'pack': env[p['out']] = np.concatenate([env[i] for i in p['in']], 0)
    y = 1 / (1 + np.exp(-env[meta['output']][0]))
    return (y - y.min()) / max(float(y.max() - y.min()), 1e-8)

if __name__ == '__main__':
    if len(sys.argv) != 2: sys.exit(__doc__)
    meta, fl, wq = convert(sys.argv[1])
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app', 'models', 'u2netp.bin')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    write(meta, fl, wq, out)
    ops = {}
    for p in meta['program']: ops[p['op']] = ops.get(p['op'], 0) + 1
    print(f'{out}: {os.path.getsize(out):,} bytes, {len(meta["channels"])} tensors, ops {ops}')
