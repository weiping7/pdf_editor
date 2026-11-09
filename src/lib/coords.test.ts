import { describe, expect, it } from 'vitest';
import { BASELINE, hexToRgb, screenDeltaToPage, screenToPage, textLineOps } from './coords';

// A4 竖向：宽 600、高 800（取整数方便心算）
const page = { width: 600, height: 800 };

describe('screenToPage', () => {
  it('不旋转：只按缩放换算', () => {
    expect(screenToPage(100, 200, 0, page, 2)).toEqual({ x: 50, y: 100 });
  });

  it('四个角在各种旋转下都能对应回去', () => {
    // 未旋转页面的左上角 (0,0) 在屏幕上的位置：
    // 90° → 右上角，180° → 右下角，270° → 左下角（顺时针旋转）
    expect(screenToPage(800, 0, 90, page, 1)).toEqual({ x: 0, y: 0 });
    expect(screenToPage(600, 800, 180, page, 1)).toEqual({ x: 0, y: 0 });
    expect(screenToPage(0, 600, 270, page, 1)).toEqual({ x: 0, y: 0 });
    // 未旋转页面的右下角 (600,800)
    expect(screenToPage(0, 600, 90, page, 1)).toEqual({ x: 600, y: 800 });
    expect(screenToPage(0, 0, 180, page, 1)).toEqual({ x: 600, y: 800 });
    expect(screenToPage(800, 0, 270, page, 1)).toEqual({ x: 600, y: 800 });
  });
});

describe('screenDeltaToPage', () => {
  it('和 screenToPage 的差值一致', () => {
    for (const r of [0, 90, 180, 270]) {
      const a = screenToPage(100, 100, r, page, 1.5);
      const b = screenToPage(130, 160, r, page, 1.5);
      const d = screenDeltaToPage(30, 60, r, 1.5);
      expect(b.x - a.x).toBeCloseTo(d.x);
      expect(b.y - a.y).toBeCloseTo(d.y);
    }
  });
});

describe('textLineOps', () => {
  const box = { x: 0, y: 0, width: 600, height: 800 };

  it('不旋转：基线在文字框顶部往下 BASELINE 倍字号，y 轴翻转', () => {
    const [op] = textLineOps('Hi', { x: 100, y: 50 }, 20, 0, box);
    expect(op.x).toBeCloseTo(100);
    expect(op.y).toBeCloseTo(800 - (50 + BASELINE * 20));
    expect(op.rotate).toBe(0);
  });

  it('多行文字每行往下移一个行高', () => {
    const ops = textLineOps('a\nb\nc', { x: 0, y: 0 }, 10, 0, box);
    expect(ops.map((o) => o.text)).toEqual(['a', 'b', 'c']);
    expect(ops[0].y - ops[1].y).toBeCloseTo(12);
    expect(ops[1].y - ops[2].y).toBeCloseTo(12);
  });

  it('裁剪框不从 (0,0) 开始时要加上偏移', () => {
    const [op] = textLineOps('Hi', { x: 10, y: 10 }, 10, 0, { x: 50, y: 30, width: 600, height: 800 });
    expect(op.x).toBeCloseTo(60);
    expect(op.y).toBeCloseTo(30 + 800 - (10 + BASELINE * 10));
  });

  it('文字框顺时针转 90°：基线偏移朝左，PDF 里逆时针 270°', () => {
    const [op] = textLineOps('Hi', { x: 100, y: 50 }, 20, 90, box);
    expect(op.x).toBeCloseTo(100 - BASELINE * 20);
    expect(op.y).toBeCloseTo(800 - 50);
    expect(op.rotate).toBe(270);
  });

  it('文字框转 270°：基线偏移朝右，PDF 里逆时针 90°', () => {
    const [op] = textLineOps('Hi', { x: 100, y: 50 }, 20, 270, box);
    expect(op.x).toBeCloseTo(100 + BASELINE * 20);
    expect(op.y).toBeCloseTo(800 - 50);
    expect(op.rotate).toBe(90);
  });
});

describe('hexToRgb', () => {
  it('换算颜色', () => {
    expect(hexToRgb('#ff8000')).toEqual([1, 128 / 255, 0]);
  });
});
