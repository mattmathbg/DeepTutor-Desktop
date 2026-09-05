const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Génère un PNG RGBA 256x256
function createPngBuffer(width = 256, height = 256) {
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  const cx = width / 2;
  const cy = height / 2;
  const maxR = width * 0.45;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter byte: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < maxR - 4) {
        // Dégradé Cyan (#38bdf8) -> Indigo (#6366f1) -> Violet (#a855f7)
        const t = (x + y) / (width + height);
        rawData[pxOffset] = Math.round(56 * (1 - t) + 168 * t);     // R
        rawData[pxOffset + 1] = Math.round(189 * (1 - t) + 85 * t); // G
        rawData[pxOffset + 2] = Math.round(248 * (1 - t) + 247 * t);// B
        rawData[pxOffset + 3] = 255;                                // Alpha
      } else if (dist < maxR) {
        // Bordure douce
        rawData[pxOffset] = 255;
        rawData[pxOffset + 1] = 255;
        rawData[pxOffset + 2] = 255;
        rawData[pxOffset + 3] = Math.round(255 * (maxR - dist) / 4);
      } else {
        // Transparent
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }

  function calcCrc(buf) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  function createChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crc = calcCrc(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdrChunk = createChunk('IHDR', ihdrData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Convertit le PNG 256x256 en fichier .ico compatible Windows
function createIcoFromPng(pngBuffer) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(1, 4); // 1 Image

  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0);  // 0 = 256 width
  entry.writeUInt8(0, 1);  // 0 = 256 height
  entry.writeUInt8(0, 2);  // Palette count = 0
  entry.writeUInt8(0, 3);  // Reserved
  entry.writeUInt16LE(1, 4);  // Color planes
  entry.writeUInt16LE(32, 6); // Bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8); // Size of image data
  entry.writeUInt32LE(22, 12); // Offset (6 header + 16 entry = 22)

  return Buffer.concat([header, entry, pngBuffer]);
}

const targetDir = path.resolve(__dirname, '../src/renderer/assets');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const pngBuf = createPngBuffer(256, 256);
fs.writeFileSync(path.join(targetDir, 'icon.png'), pngBuf);
const icoBuf = createIcoFromPng(pngBuf);
fs.writeFileSync(path.join(targetDir, 'icon.ico'), icoBuf);

console.log('icon.png (256x256) et icon.ico generes avec succes.');
