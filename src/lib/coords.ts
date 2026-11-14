/**
 * 坐标换算。编辑器里有三套坐标：
 *
 * 1. 页面坐标（保存用）：未旋转的页面，单位 pt，原点在左上角，y 向下。
 *    所有标注都用这套坐标保存，所以缩放、旋转页面都不会影响已保存的标注。
 * 2. 屏幕坐标：页面旋转、缩放后在屏幕上的位置，单位 CSS 像素，原点在左上角。
 * 3. PDF 坐标（导出用）：单位 pt，原点在左下角，y 向上。
 *
 * 旋转角度一律是顺时针（和 PDF 的 /Rotate、CSS 的 rotate() 一致）。
 */

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
/** PDF 页面的裁剪框（pdf-lib 的 getCropBox() 返回值） */
export type Box = { x: number; y: number; width: number; height: number };

/** 文字的行高（字号的倍数），显示和导出必须一致 */
export const LINE_HEIGHT = 1.2;
/**
 * 英文（Helvetica/Arial）第一行文字的基线距离文字框顶部有多远（字号的倍数）。
 * 中文字体的值不一样，见 lib/fonts.ts。
 */
export const BASELINE = 0.9465;

/**
 * 屏幕上的点（相对于页面左上角，CSS 像素）→ 页面坐标（pt）
 * @param rotation 页面显示的旋转角度
 * @param page 未旋转的页面尺寸（pt）
 */
export function screenToPage(sx: number, sy: number, rotation: number, page: Size, zoom: number): Point {
  const x = sx / zoom;
  const y = sy / zoom;
  const { width: W, height: H } = page;
  switch (rotation) {
    case 90:
      return { x: y, y: H - x };
    case 180:
      return { x: W - x, y: H - y };
    case 270:
      return { x: W - y, y: x };
    default:
      return { x, y };
  }
}

/** 屏幕上的位移（拖动距离）→ 页面坐标里的位移 */
export function screenDeltaToPage(dx: number, dy: number, rotation: number, zoom: number): Point {
  const x = dx / zoom;
  const y = dy / zoom;
  switch (rotation) {
    case 90:
      return { x: y, y: -x };
    case 180:
      return { x: -x, y: -y };
    case 270:
      return { x: -y, y: x };
    default:
      return { x, y };
  }
}

/** 把向量顺时针旋转 deg 度（y 向下的坐标系），只处理 90 的倍数，避免浮点误差 */
export function rotateVector(v: Point, deg: number): Point {
  switch (((deg % 360) + 360) % 360) {
    case 90:
      return { x: -v.y, y: v.x };
    case 180:
      return { x: -v.x, y: -v.y };
    case 270:
      return { x: v.y, y: -v.x };
    default:
      return v;
  }
}

export type TextLineOp = {
  text: string;
  /** 基线起点，PDF 坐标 */
  x: number;
  y: number;
  /** pdf-lib drawText 的 rotate 参数（逆时针，度） */
  rotate: number;
};

/**
 * 算出导出时每一行文字要画在 PDF 的哪里。
 * @param anchor 文字框左上角（页面坐标）
 * @param rotation 文字框自身的旋转（顺时针，绕左上角）
 * @param box 页面的裁剪框
 * @param baseline 所用字体的基线位置（字号的倍数）
 */
export function textLineOps(
  text: string,
  anchor: Point,
  fontSize: number,
  rotation: number,
  box: Box,
  baseline = BASELINE,
): TextLineOp[] {
  return text.split('\n').map((line, i) => {
    // 这一行的基线起点相对于文字框左上角的偏移（未旋转时只有向下的偏移）
    const offset = rotateVector({ x: 0, y: (baseline + i * LINE_HEIGHT) * fontSize }, rotation);
    const px = anchor.x + offset.x;
    const py = anchor.y + offset.y;
    return {
      text: line,
      x: box.x + px,
      y: box.y + box.height - py, // 页面坐标 y 向下，PDF 坐标 y 向上
      rotate: (360 - rotation) % 360, // CSS 顺时针 → PDF 逆时针
    };
  });
}

/** "#rrggbb" → 0~1 的 RGB */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export type Rect = { x: number; y: number; width: number; height: number };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** 两个点（页面坐标）围成的矩形，限制在页面内 */
export function rectFromPoints(a: Point, b: Point, page: Size): Rect {
  const x1 = clamp(Math.min(a.x, b.x), 0, page.width);
  const y1 = clamp(Math.min(a.y, b.y), 0, page.height);
  const x2 = clamp(Math.max(a.x, b.x), 0, page.width);
  const y2 = clamp(Math.max(a.y, b.y), 0, page.height);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/** 平移矩形，整个矩形保持在页面内 */
export function moveRect(rect: Rect, delta: Point, page: Size): Rect {
  return {
    ...rect,
    x: clamp(rect.x + delta.x, 0, page.width - rect.width),
    y: clamp(rect.y + delta.y, 0, page.height - rect.height),
  };
}

/** 调整大小的手柄，用页面坐标里的方向表示（n = 上边，e = 右边…） */
export type Handle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export const HANDLES: Handle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

/**
 * 拖动手柄调整矩形大小。拖过头（比如把右边拖到左边的左侧）时矩形会翻转，
 * 和大多数绘图软件一样。
 * @param delta 页面坐标里的拖动距离
 */
export function resizeRect(rect: Rect, handle: Handle, delta: Point, page: Size, minSize = 4): Rect {
  let x1 = rect.x;
  let y1 = rect.y;
  let x2 = rect.x + rect.width;
  let y2 = rect.y + rect.height;
  if (handle.includes('w')) x1 += delta.x;
  if (handle.includes('e')) x2 += delta.x;
  if (handle.includes('n')) y1 += delta.y;
  if (handle.includes('s')) y2 += delta.y;
  const r = rectFromPoints({ x: x1, y: y1 }, { x: x2, y: y2 }, page);
  // 不能小到看不见、点不到
  return {
    x: Math.min(r.x, page.width - minSize),
    y: Math.min(r.y, page.height - minSize),
    width: Math.max(r.width, minSize),
    height: Math.max(r.height, minSize),
  };
}

/** 页面旋转后，手柄在屏幕上对应的鼠标指针样式 */
export function handleCursor(handle: Handle, rotation: number): string {
  const i = HANDLES.indexOf(handle) + Math.round(rotation / 45);
  // CSS 只有 4 种双向箭头：n-s、e-w、ne-sw、nw-se
  const screen = HANDLES[((i % 8) + 8) % 8];
  return `${screen}-resize`;
}

/** 页面坐标的矩形 → PDF 坐标（左下角为原点）的矩形，用于 pdf-lib 的 drawRectangle */
export function rectToPdf(rect: Rect, box: Box): Rect {
  return {
    x: box.x + rect.x,
    y: box.y + box.height - rect.y - rect.height,
    width: rect.width,
    height: rect.height,
  };
}

export const CORNER_HANDLES: Handle[] = ['ne', 'se', 'sw', 'nw'];

/**
 * 拖动四个角之一，等比例缩放（签名不能被拉变形）。对角固定不动。
 * @param delta 页面坐标里的拖动距离
 */
export function resizeRectKeepAspect(rect: Rect, handle: Handle, delta: Point, page: Size, minSize = 12): Rect {
  const east = handle.includes('e');
  const south = handle.includes('s');
  // 固定不动的对角
  const ax = east ? rect.x : rect.x + rect.width;
  const ay = south ? rect.y : rect.y + rect.height;
  // 被拖动的角的新位置
  const cx = (east ? rect.x + rect.width : rect.x) + delta.x;
  const cy = (south ? rect.y + rect.height : rect.y) + delta.y;
  const w = east ? cx - ax : ax - cx;
  const h = south ? cy - ay : ay - cy;

  // 取变化更大的方向作为缩放比例，再限制在页面内、不小于最小尺寸
  let s = Math.max(w / rect.width, h / rect.height);
  const roomX = east ? page.width - ax : ax;
  const roomY = south ? page.height - ay : ay;
  s = Math.min(s, roomX / rect.width, roomY / rect.height);
  s = Math.max(s, minSize / Math.min(rect.width, rect.height));

  const width = rect.width * s;
  const height = rect.height * s;
  return { x: east ? ax : ax - width, y: south ? ay : ay - height, width, height };
}

/** 新放一个图片时的大小：宽度不超过 maxW、高度不超过 maxH，保持比例 */
export function fitSize(aspect: number, maxW: number, maxH: number): Size {
  let width = maxW;
  let height = width / aspect;
  if (height > maxH) {
    height = maxH;
    width = height * aspect;
  }
  return { width, height };
}

/**
 * 导出图片（签名）时 pdf-lib drawImage 的参数。
 * drawImage 的 rotate 是绕图片左下角逆时针转，这里算出转完之后正好铺满 rect 的位置。
 * @param rect 页面坐标里图片占的矩形（已经是旋转后的样子）
 * @param rotation 图片自身的旋转（顺时针）
 */
export function imagePlacement(rect: Rect, rotation: number, box: Box) {
  const r = rectToPdf(rect, box);
  const rotate = (360 - rotation) % 360; // 顺时针 → 逆时针
  const sideways = rotate === 90 || rotate === 270;
  // 图片自己（未旋转时）的宽高
  const w = sideways ? r.height : r.width;
  const h = sideways ? r.width : r.height;
  switch (rotate) {
    case 90:
      return { x: r.x + h, y: r.y, width: w, height: h, rotate };
    case 180:
      return { x: r.x + w, y: r.y + h, width: w, height: h, rotate };
    case 270:
      return { x: r.x, y: r.y + w, width: w, height: h, rotate };
    default:
      return { x: r.x, y: r.y, width: w, height: h, rotate: 0 };
  }
}
