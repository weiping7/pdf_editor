import { describe, expect, it } from 'vitest';
import { alphaBounds, strokesBounds, whiteToAlpha } from './signature';

describe('签名图片处理', () => {
  it('白色变透明，深色保留，中间渐变', () => {
    expect(whiteToAlpha(255, 255, 255, 255)).toBe(0);
    expect(whiteToAlpha(245, 245, 245, 255)).toBe(0);
    expect(whiteToAlpha(20, 20, 80, 255)).toBe(255);
    expect(whiteToAlpha(200, 200, 200, 255)).toBe(128);
  });

  it('找出不透明内容的范围', () => {
    const w = 4, h = 3;
    const d = new Uint8ClampedArray(w * h * 4);
    d[(1 * w + 1) * 4 + 3] = 255;
    d[(2 * w + 2) * 4 + 3] = 255;
    expect(alphaBounds(d, w, h)).toEqual({ x: 1, y: 1, width: 2, height: 2 });
    expect(alphaBounds(new Uint8ClampedArray(w * h * 4), w, h)).toBeNull();
  });

  it('笔画范围包含线宽', () => {
    expect(strokesBounds([[{ x: 10, y: 20 }, { x: 50, y: 30 }]], 2)).toEqual({ x: 8, y: 18, width: 44, height: 14 });
  });
});
