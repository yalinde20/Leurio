import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/** Décodeur PNG minimal (8 bits, non entrelacé, RGB ou RGBA) : pas de dépendance, pas de navigateur. */
export function decodePng(file) {
  const buf = readFileSync(file);
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`${file} n'est pas un PNG`);
  let pos = 8, width = 0, height = 0, depth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`${file} : format PNG non géré (profondeur ${depth}, type ${colorType}, entrelacement ${interlace})`);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 255;
    }
  }
  const hasAlpha = colorType === 6;
  const pixel = (x, y) => {
    const i = y * stride + x * bpp;
    return { r: out[i], g: out[i + 1], b: out[i + 2], a: hasAlpha ? out[i + 3] : 255 };
  };
  return { width, height, hasAlpha, pixel };
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function distance(p, hex) {
  const q = hexToRgb(hex);
  return Math.hypot(p.r - q.r, p.g - q.g, p.b - q.b);
}

/** Vrai si au moins un pixel opaque de l'image est à moins de `tol` de la couleur. */
export function contientCouleur(img, hex, tol = 24) {
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const p = img.pixel(x, y);
    if (p.a > 200 && distance(p, hex) <= tol) return true;
  }
  return false;
}
