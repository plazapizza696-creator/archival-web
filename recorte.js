// Recorte de fotos de producto en el navegador, sin 3D.
// Lo usan la vitrina 3D, la galería de la demo y el personalizador.
const MAX_SIDE = 1024; // px de trabajo para la foto

/* ---------- 1. Foto -> recorte ---------- */

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No pudimos leer esa imagen. Prueba con JPG o PNG."));
    img.src = src;
  });
}

export async function toDrawable(input) {
  if (input instanceof HTMLCanvasElement || input instanceof HTMLImageElement) return input;
  if (input instanceof Blob) {
    const url = URL.createObjectURL(input);
    try { return await loadImage(url); } finally { URL.revokeObjectURL(url); }
  }
  return loadImage(input);
}

const dist2 = (d, i, c) => (d[i] - c[0]) ** 2 + (d[i + 1] - c[1]) ** 2 + (d[i + 2] - c[2]) ** 2;

// Quita el fondo si el borde de la foto es de un color parejo (foto de estudio, pared, mesa lisa).
// Rellena desde las orillas hacia adentro, así no borra partes del producto del mismo color.
function removeFlatBackground(d, W, H) {
  const border = [];
  for (let x = 0; x < W; x += 2) border.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y += 2) border.push(y * W, y * W + W - 1);
  const mean = [0, 0, 0];
  for (const p of border) { mean[0] += d[p * 4]; mean[1] += d[p * 4 + 1]; mean[2] += d[p * 4 + 2]; }
  mean.forEach((v, k) => (mean[k] = v / border.length));
  let spread = 0;
  for (const p of border) spread += dist2(d, p * 4, mean);
  spread = Math.sqrt(spread / border.length);
  if (spread > 30) return false; // fondo con textura: mejor mostrarla como tarjeta

  const tol2 = (34 + spread * 1.4) ** 2;
  const seen = new Uint8Array(W * H);
  const queue = new Int32Array(W * H);
  let head = 0, tail = 0;
  for (const p of border) if (!seen[p] && dist2(d, p * 4, mean) < tol2) { seen[p] = 1; queue[tail++] = p; }
  while (head < tail) {
    const p = queue[head++];
    d[p * 4 + 3] = 0;
    const x = p % W, y = (p / W) | 0;
    const near = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
    for (const q of near) if (q >= 0 && !seen[q] && dist2(d, q * 4, mean) < tol2) { seen[q] = 1; queue[tail++] = q; }
  }
  return true;
}

export function prepare(source) {
  const iw = source.naturalWidth || source.width, ih = source.naturalHeight || source.height;
  const s = Math.min(1, MAX_SIDE / Math.max(iw, ih));
  const W = Math.max(8, Math.round(iw * s)), H = Math.max(8, Math.round(ih * s));
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, W, H);
  const im = ctx.getImageData(0, 0, W, H), d = im.data;

  let edgeAlpha = 0, edges = 0;
  for (let x = 0; x < W; x += 4) { edgeAlpha += d[x * 4 + 3] < 200; edgeAlpha += d[((H - 1) * W + x) * 4 + 3] < 200; edges += 2; }
  for (let y = 0; y < H; y += 4) { edgeAlpha += d[y * W * 4 + 3] < 200; edgeAlpha += d[(y * W + W - 1) * 4 + 3] < 200; edges += 2; }

  let cutout = edgeAlpha / edges > 0.5 || removeFlatBackground(d, W, H);

  // Color promedio del producto: da el canto de la pieza
  let r = 0, g = 0, b = 0, n = 0, solid = 0;
  for (let i = 0; i < d.length; i += 4 * 7) {
    if (d[i + 3] > 128) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  }
  for (let i = 3; i < d.length; i += 4) solid += d[i] > 128;
  const cover = solid / (W * H);
  if (cover < 0.03 || cover > 0.985) cutout = false; // recorte fallido: tarjeta
  const avg = n ? [r / n, g / n, b / n] : [128, 128, 128];

  if (cutout) ctx.putImageData(im, 0, 0);
  else ctx.drawImage(source, 0, 0, W, H);
  const mask = cutout ? ctx.getImageData(0, 0, W, H).data : null;
  return { canvas: cv, W, H, cutout, mask, avg };
}


// Foto -> versión sin fondo, recortada a lo que ocupa el producto, más la original reducida (1024 px).
// ok = false cuando el fondo tiene textura: ahí no se puede quitar en el navegador (en la página real lo recorta Archival).
// Devuelve blob: URLs (no data URLs) para no cargar megas de texto en memoria ni en el HTML.
const aURL = (cv, type, q) => new Promise((ok, bad) => cv.toBlob((b) => (b ? ok(URL.createObjectURL(b)) : bad(new Error("toBlob"))), type, q));
export async function quitarFondo(input) {
  const src = await toDrawable(input);
  const p = prepare(src);
  const orig = document.createElement("canvas");
  orig.width = p.W; orig.height = p.H;
  const go = orig.getContext("2d");
  go.fillStyle = "#FFFFFF"; go.fillRect(0, 0, p.W, p.H); // un PNG con transparencia no sale negro al guardarse como JPEG
  go.drawImage(src, 0, 0, p.W, p.H);
  const original = await aURL(orig, "image/jpeg", 0.88);
  if (!p.cutout) return { ok: false, url: null, original };
  const d = p.mask;
  let x0 = p.W, y0 = p.H, x1 = 0, y1 = 0;
  for (let y = 0; y < p.H; y++) for (let x = 0; x < p.W; x++) if (d[(y * p.W + x) * 4 + 3] > 24) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const pad = Math.round(Math.max(p.W, p.H) * 0.03);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(p.W - 1, x1 + pad); y1 = Math.min(p.H - 1, y1 + pad);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext("2d").drawImage(p.canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return { ok: true, url: await aURL(out, "image/png"), original };
}
