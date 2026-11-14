// 签名图片的处理：手写的笔画 → PNG，上传的图片 → 去白底的 PNG。都会裁掉四周的空白。
import type { Point } from './coords';

export type Stroke = Point[];
export type SignatureImageData = { image: string; width: number; height: number };

/** 在 canvas 上画笔画（用二次曲线连接中点，线条比直接连线平滑） */
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], color: string, lineWidth: number) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (s.length === 1) {
      // 只点了一下：画一个圆点
      ctx.beginPath();
      ctx.arc(s[0].x, s[0].y, lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(s[0].x, s[0].y);
    for (let i = 1; i < s.length - 1; i++) {
      const mid = { x: (s[i].x + s[i + 1].x) / 2, y: (s[i].y + s[i + 1].y) / 2 };
      ctx.quadraticCurveTo(s[i].x, s[i].y, mid.x, mid.y);
    }
    const last = s[s.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
}

/** 所有点的范围，四周留出 pad */
export function strokesBounds(strokes: Stroke[], pad: number) {
  const pts = strokes.flat();
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, width: Math.max(...xs) + pad - x, height: Math.max(...ys) + pad - y };
}

/** 手写笔画 → 裁好边的透明 PNG。scale 倍放大，放大页面时签名也清楚 */
export function strokesToPng(strokes: Stroke[], color: string, lineWidth: number, scale = 3): SignatureImageData {
  const b = strokesBounds(strokes, lineWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(b.width * scale);
  canvas.height = Math.ceil(b.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.translate(-b.x, -b.y);
  drawStrokes(ctx, strokes, color, lineWidth);
  return { image: canvas.toDataURL('image/png'), width: b.width, height: b.height };
}

/**
 * 去白底：越接近白色越透明。
 * 亮度 ≥ 240 完全透明，≤ 160 完全不透明，中间渐变，这样笔画边缘不会有锯齿。
 */
export function whiteToAlpha(r: number, g: number, b: number, a: number): number {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const keep = Math.min(1, Math.max(0, (240 - lum) / (240 - 160)));
  return Math.round(a * keep);
}

/** 不透明内容的范围（用于裁掉四周空白），全透明时返回 null */
export function alphaBounds(data: Uint8ClampedArray, width: number, height: number) {
  let x1 = width, y1 = height, x2 = -1, y2 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x1) x1 = x;
        if (x > x2) x2 = x;
        if (y < y1) y1 = y;
        if (y > y2) y2 = y;
      }
    }
  }
  return x2 < 0 ? null : { x: x1, y: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 };
}

/** 上传的图片（PNG/JPG…）→ PNG。太大的会缩小；可以去掉白色背景 */
export async function imageFileToPng(file: File, removeWhite: boolean, maxSide = 1200): Promise<SignatureImageData> {
  const bitmap = await createImageBitmap(file);
  const s = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * s));
  const h = Math.max(1, Math.round(bitmap.height * s));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const img = ctx.getImageData(0, 0, w, h);
  if (removeWhite) {
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) d[i + 3] = whiteToAlpha(d[i], d[i + 1], d[i + 2], d[i + 3]);
    ctx.putImageData(img, 0, 0);
  }

  // 裁掉四周的透明部分
  const b = alphaBounds(img.data, w, h);
  if (!b) throw new Error('图片里没有找到签名（可能整张都是白色）');
  const out = document.createElement('canvas');
  out.width = b.width;
  out.height = b.height;
  out.getContext('2d')!.drawImage(canvas, b.x, b.y, b.width, b.height, 0, 0, b.width, b.height);
  return { image: out.toDataURL('image/png'), width: b.width, height: b.height };
}
