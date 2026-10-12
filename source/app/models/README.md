# AI subject model

`u2netp.bin` is U²-Net-P, a small salient-object (subject) detection network:

- Xuebin Qin, Zichen Zhang, Chenyang Huang, Masood Dehghan, Osmar R. Zaiane and Martin Jagersand,
  "U²-Net: Going Deeper with Nested U-Structure for Salient Object Detection", Pattern Recognition 106, 2020.
- Code and weights: https://github.com/xuebinqin/U-2-Net, Apache License 2.0 (`U2NET-LICENSE.txt`).
- Converted from the ONNX file `u2netp.onnx` published with rembg
  (https://github.com/danielgatis/rembg/releases/tag/v0.0.0) by `tools/convert_model.py`, which changes the
  storage format (16-bit weights with a scale per output channel) but not the network.

G-WIZ runs it on the device, offline: `app/scripts/features/ai-model.js`.
