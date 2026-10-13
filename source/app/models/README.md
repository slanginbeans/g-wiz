# AI subject model

`u2netp.bin` is U²-Net-P, a small salient-object (subject) detection network:

- Xuebin Qin, Zichen Zhang, Chenyang Huang, Masood Dehghan, Osmar R. Zaiane and Martin Jagersand,
  "U²-Net: Going Deeper with Nested U-Structure for Salient Object Detection", Pattern Recognition 106, 2020.
- Code and weights: https://github.com/xuebinqin/U-2-Net, Apache License 2.0 (`U2NET-LICENSE.txt`).
- Converted from the ONNX file `u2netp.onnx` published with rembg
  (https://github.com/danielgatis/rembg/releases/tag/v0.0.0) by `tools/convert_model.py`, which changes the
  storage format (16-bit weights with a scale per output channel) but not the network.

The optional **high-quality model** is U²-Net (same authors and license), converted at 8 bits from rembg's
`u2net.onnx` with

    python3 tools/convert_model.py u2net.onnx --bits 8 --name "U2-Net" --out ../models/u2net.bin

It is 44 MB, too large to build into the page, so it lives in the repository root (`models/u2net.bin`), where
GitHub Pages serves it and the app downloads it when someone chooses High quality (then keeps it in the browser's
cache, `gwiz-models-v1`). Its results are within about 1% of the full-precision model.

G-WIZ runs both on the device, offline: `app/scripts/features/ai-model.js`.
