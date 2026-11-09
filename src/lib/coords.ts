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
 * 第一行文字的基线距离文字框顶部有多远（字号的倍数）。
 * Helvetica/Arial：ascent 0.905，descent 0.212，
 * 行高 1.2 时上下各留 (1.2 - 1.117) / 2，所以基线在 0.0415 + 0.905 ≈ 0.9465。
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
 */
export function textLineOps(
  text: string,
  anchor: Point,
  fontSize: number,
  rotation: number,
  box: Box,
): TextLineOp[] {
  return text.split('\n').map((line, i) => {
    // 这一行的基线起点相对于文字框左上角的偏移（未旋转时只有向下的偏移）
    const offset = rotateVector({ x: 0, y: (BASELINE + i * LINE_HEIGHT) * fontSize }, rotation);
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
