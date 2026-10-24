/**
 * Script to generate generic PWA icons for the storefront.
 * Generates solid brand-colored icons (#C4622D) with a white shopping bag glyph.
 * Uses built-in Node.js modules (fs, path, zlib) without external dependencies.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function isInsideBag(x, y, s) {
  const cx = 256 * s;
  const cy = 256 * s;
  const px = x - cx;
  const py = y - cy;

  // Handle arch: cx = 0, cy = -50*s, R_out = 70*s, R_in = 48*s, y <= -50*s
  const handleCy = -50 * s;
  const distHandle = Math.hypot(px, py - handleCy);
  if (py <= handleCy && distHandle >= 48 * s && distHandle <= 70 * s) {
    return true;
  }

  // Bag body: top = -50*s, bottom = 115*s
  if (py >= handleCy && py <= 115 * s) {
    const t = (py - handleCy) / (165 * s);
    const halfW = (95 + 15 * t) * s;
    const botR = 24 * s;
    if (py > (115 * s - botR)) {
      const cornerY = 115 * s - botR;
      const cornerX = halfW - botR;
      if (Math.abs(px) > cornerX) {
        const d = Math.hypot(Math.abs(px) - cornerX, py - cornerY);
        return d <= botR;
      }
    }
    return Math.abs(px) <= halfW;
  }

  return false;
}

function generatePng(size) {
  const s = size / 512;
  const rowBytes = 1 + size * 4;
  const rawData = Buffer.alloc(rowBytes * size);
  const brandColor = [196, 98, 45]; // #C4622D (Primary brand color)
  const white = [255, 255, 255];

  const sub = 3; // 3x3 supersampling for anti-aliased edges
  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < sub; sy++) {
        for (let sx = 0; sx < sub; sx++) {
          const px = x + (sx + 0.5) / sub;
          const py = y + (sy + 0.5) / sub;
          if (isInsideBag(px, py, s)) hits++;
        }
      }
      const alpha = hits / (sub * sub);
      const r = Math.round(brandColor[0] * (1 - alpha) + white[0] * alpha);
      const g = Math.round(brandColor[1] * (1 - alpha) + white[1] * alpha);
      const b = Math.round(brandColor[2] * (1 - alpha) + white[2] * alpha);

      const offset = rowOffset + 1 + x * 4;
      rawData[offset] = r;
      rawData[offset + 1] = g;
      rawData[offset + 2] = b;
      rawData[offset + 3] = 255;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const buf = Buffer.alloc(12 + data.length);
    buf.writeUInt32BE(data.length, 0);
    buf.write(type, 4, 'ascii');
    data.copy(buf, 8);
    const crc = zlib.crc32(buf.subarray(4, 8 + data.length));
    buf.writeUInt32BE(crc, 8 + data.length);
    return buf;
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), generatePng(192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), generatePng(512));
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512.png'), generatePng(512));

console.log('✅ Generated PWA icons in public/icons/:');
console.log(' - icon-192.png (192x192)');
console.log(' - icon-512.png (512x512)');
console.log(' - icon-maskable-512.png (512x512 maskable)');
