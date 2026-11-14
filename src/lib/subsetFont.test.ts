/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import fontkit from '@pdf-lib/fontkit';
import { loadHarfBuzz, subsetFont } from './subsetFont';

const read = (p: string) => readFileSync(new URL(p, import.meta.url));

describe('中文字体子集', () => {
  it('只保留用到的字，字体小很多，并且仍然是合法字体', async () => {
    const hb = await loadHarfBuzz(async () => read('../../node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm'));
    const full = read('../assets/fonts/NotoSansSC-GB2312.ttf');
    const sub = subsetFont(hb, full, '你好，世界 A1');

    expect(sub.byteLength).toBeLessThan(10_000);
    const font = fontkit.create(sub as never);
    for (const ch of '你好，世界A1') expect(font.hasGlyphForCodePoint(ch.codePointAt(0)!)).toBe(true);
    expect(font.hasGlyphForCodePoint('国'.codePointAt(0)!)).toBe(false); // 没用到的字不在里面
    // 字体里本来就没有的字（生僻字）也不会凭空出现
    expect(fontkit.create(subsetFont(hb, full, '𠮷') as never).hasGlyphForCodePoint(0x20bb7)).toBe(false);
  });
});
