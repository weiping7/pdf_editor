/**
 * 字体：英文用 PDF 自带的 Helvetica（不用嵌入），含中文等字符的文字用思源黑体（Noto Sans SC）。
 *
 * 思源黑体完整版有 10MB，这里只保留了 GB2312 的 7445 个常用字符（简体中文、标点、全角符号），
 * 约 2.2MB，并且只在真的用到中文时才下载。导出时用 HarfBuzz 只取出用到的字（见 subsetFont.ts），
 * PDF 只会变大几 KB。
 * 字体文件生成方法见 README。
 */
import cjkFontUrl from '../assets/fonts/NotoSansSC-GB2312.ttf?url';

export { cjkFontUrl };

/** CSS 里 @font-face 的名字（见 index.css） */
export const CJK_FONT_FAMILY = 'Noto Sans SC Subset';

/** 这段文字要不要用中文字体。Helvetica 只能显示 Latin-1（英文、数字、西欧字母） */
export const needsCjkFont = (text: string) => [...text].some((ch) => ch.codePointAt(0)! > 0xff);

/**
 * 第一行文字的基线距离文字框顶部有多远（字号的倍数），行高都是 1.2。
 * 浏览器把行高多出来（或不够）的部分平分到上下，所以基线 = (行高 - 字体高度) / 2 + ascent。
 * - Helvetica/Arial：ascent 0.905，descent 0.212
 * - 思源黑体：ascent 1.16，descent 0.288（字体文件 hhea 表里的值）
 */
export const BASELINE_LATIN = (1.2 - (0.905 + 0.212)) / 2 + 0.905;
export const BASELINE_CJK = (1.2 - (1.16 + 0.288)) / 2 + 1.16;

let fontBytes: Promise<ArrayBuffer> | null = null;

/** 下载中文字体（只下载一次；失败了下次再试） */
export function loadCjkFont(): Promise<ArrayBuffer> {
  fontBytes ??= fetch(cjkFontUrl)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.arrayBuffer();
    })
    .catch(() => {
      fontBytes = null;
      throw new Error('中文字体下载失败，请检查网络后再试');
    });
  return fontBytes;
}
