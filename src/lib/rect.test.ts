import { describe, expect, it } from 'vitest';
import { handleCursor, moveRect, rectFromPoints, rectToPdf, resizeRect } from './coords';

const page = { width: 600, height: 800 };
const r = { x: 100, y: 100, width: 200, height: 50 };

describe('高亮矩形', () => {
  it('从任意方向拖出来都是正的矩形，并且限制在页面内', () => {
    expect(rectFromPoints({ x: 300, y: 150 }, { x: 100, y: 100 }, page)).toEqual(r);
    expect(rectFromPoints({ x: -20, y: 790 }, { x: 50, y: 900 }, page)).toEqual({ x: 0, y: 790, width: 50, height: 10 });
  });

  it('移动时不会移出页面', () => {
    expect(moveRect(r, { x: 10, y: -5 }, page)).toEqual({ ...r, x: 110, y: 95 });
    expect(moveRect(r, { x: 1000, y: -1000 }, page)).toEqual({ ...r, x: 400, y: 0 });
  });

  it('拖手柄调整大小', () => {
    expect(resizeRect(r, 'se', { x: 20, y: 10 }, page)).toEqual({ x: 100, y: 100, width: 220, height: 60 });
    expect(resizeRect(r, 'nw', { x: 20, y: 10 }, page)).toEqual({ x: 120, y: 110, width: 180, height: 40 });
    expect(resizeRect(r, 'e', { x: 20, y: 99 }, page)).toEqual({ ...r, width: 220 }); // 右边的手柄只改宽度
  });

  it('拖过头会翻转，但不会小于最小尺寸', () => {
    expect(resizeRect(r, 'e', { x: -250, y: 0 }, page)).toEqual({ ...r, x: 50, width: 50 });
    expect(resizeRect(r, 's', { x: 0, y: -50 }, page).height).toBe(4);
  });

  it('页面旋转后手柄的指针方向跟着转', () => {
    expect(handleCursor('n', 0)).toBe('n-resize');
    expect(handleCursor('n', 90)).toBe('e-resize');
    expect(handleCursor('nw', 270)).toBe('sw-resize');
  });

  it('转换成 PDF 坐标：y 翻转，并加上裁剪框的偏移', () => {
    expect(rectToPdf(r, { x: 0, y: 0, ...page })).toEqual({ x: 100, y: 650, width: 200, height: 50 });
    expect(rectToPdf(r, { x: 10, y: 20, ...page })).toEqual({ x: 110, y: 670, width: 200, height: 50 });
  });
});

import { fitSize, imagePlacement, resizeRectKeepAspect } from './coords';

describe('签名（等比例）', () => {
  const sig = { x: 100, y: 100, width: 200, height: 100 };

  it('拖右下角放大，比例不变，左上角不动', () => {
    expect(resizeRectKeepAspect(sig, 'se', { x: 100, y: 0 }, page)).toEqual({ x: 100, y: 100, width: 300, height: 150 });
    // 竖着拖得更多，就按竖的算
    expect(resizeRectKeepAspect(sig, 'se', { x: 0, y: 100 }, page)).toEqual({ x: 100, y: 100, width: 400, height: 200 });
  });

  it('拖左上角缩小，右下角不动', () => {
    expect(resizeRectKeepAspect(sig, 'nw', { x: 100, y: 50 }, page)).toEqual({ x: 200, y: 150, width: 100, height: 50 });
  });

  it('不会超出页面，也不会小于最小尺寸', () => {
    expect(resizeRectKeepAspect(sig, 'se', { x: 1000, y: 0 }, page)).toEqual({ x: 100, y: 100, width: 500, height: 250 });
    expect(resizeRectKeepAspect(sig, 'se', { x: -500, y: -500 }, page)).toEqual({ x: 100, y: 100, width: 24, height: 12 });
  });

  it('新放的签名大小', () => {
    expect(fitSize(4, 160, 80)).toEqual({ width: 160, height: 40 });
    expect(fitSize(1, 160, 80)).toEqual({ width: 80, height: 80 });
  });

  it('导出：转完之后正好铺满原来的矩形', () => {
    const box = { x: 0, y: 0, ...page };
    // 页面坐标 (100,100,200,100) → PDF 坐标左下角 (100, 600)
    expect(imagePlacement(sig, 0, box)).toEqual({ x: 100, y: 600, width: 200, height: 100, rotate: 0 });
    // 图片顺时针转 90°（PDF 里逆时针 270°）：图片本身是 100×200，绕左下角转完后要落在矩形里
    expect(imagePlacement(sig, 90, box)).toEqual({ x: 100, y: 700, width: 100, height: 200, rotate: 270 });
    expect(imagePlacement(sig, 270, box)).toEqual({ x: 300, y: 600, width: 100, height: 200, rotate: 90 });
    expect(imagePlacement(sig, 180, box)).toEqual({ x: 300, y: 700, width: 200, height: 100, rotate: 180 });
  });
});
