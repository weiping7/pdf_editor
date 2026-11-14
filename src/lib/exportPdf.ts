// 只负责“导出”：用 pdf-lib 按编辑器里的页面顺序和旋转生成新的 PDF。
import { HIGHLIGHT_OPACITY, displayRotation, type PageItem, type SourceFile } from '../store/useDocStore';
import { LINE_HEIGHT, hexToRgb, imagePlacement, rectToPdf, textLineOps } from './coords';

/**
 * 生成新的 PDF。
 * @param files 所有源文件
 * @param pages 要导出的页面（按这个顺序）
 */
export async function buildPdf(files: SourceFile[], pages: PageItem[]): Promise<Uint8Array> {
  // pdf-lib 比较大，用到时才加载，首页打开更快
  const { PDFDocument, StandardFonts, BlendMode, degrees, rgb } = await import('pdf-lib');

  const out = await PDFDocument.create();

  // 1. 每个源文件只解析一次，并且一次性复制它需要的所有页
  const copied = new Map<string, Awaited<ReturnType<typeof out.copyPages>>>();
  for (const file of files) {
    const needed = pages.filter((p) => p.sourceId === file.id);
    if (needed.length === 0) continue;

    let src;
    try {
      src = await PDFDocument.load(file.bytes);
    } catch (err) {
      // pdf-lib 编译成 ES5，自定义错误类的 instanceof 不可靠，所以按错误信息判断
      if (/encrypted/i.test((err as Error)?.message ?? '')) {
        throw new Error(`“${file.name}”有密码保护，暂时无法导出`);
      }
      throw err;
    }
    const copies = await out.copyPages(src, needed.map((p) => p.pageIndex));
    copied.set(file.id, copies);
  }

  // 有文字标注时才嵌入字体（目前用 PDF 标准字体 Helvetica，只支持英文和西欧字符）
  const hasText = pages.some((p) => p.annotations.some((a) => a.type === 'text'));
  const font = hasText ? await out.embedFont(StandardFonts.Helvetica) : null;

  // 同一个签名用在多处时只嵌入一次
  const images = new Map<string, Awaited<ReturnType<typeof out.embedPng>>>();
  const embedSignature = async (dataUrl: string) => {
    let img = images.get(dataUrl);
    if (!img) {
      img = await out.embedPng(dataUrl);
      images.set(dataUrl, img);
    }
    return img;
  };

  // 2. 按编辑器里的顺序把页面加进新文档
  const cursor = new Map<string, number>(); // 每个源文件已经用到第几个复制页
  for (const page of pages) {
    const copies = copied.get(page.sourceId)!;
    const i = cursor.get(page.sourceId) ?? 0;
    cursor.set(page.sourceId, i + 1);

    const pdfPage = out.addPage(copies[i]);
    // setRotation 设置的是绝对角度，所以要用“自带旋转 + 用户旋转”
    pdfPage.setRotation(degrees(displayRotation(page)));

    // 3. 画标注。标注保存的是“未旋转页面”的坐标，正好对应 PDF 页面本身的坐标系，
    //    画完后页面的 /Rotate 会把标注和内容一起旋转。
    const box = pdfPage.getCropBox();

    // 绘制顺序和编辑器一致：高亮 → 签名 → 文字
    for (const a of page.annotations) {
      if (a.type !== 'highlight') continue;
      const [r, g, b] = hexToRgb(a.color);
      pdfPage.drawRectangle({
        ...rectToPdf(a, box),
        color: rgb(r, g, b),
        opacity: HIGHLIGHT_OPACITY,
        blendMode: BlendMode.Multiply, // 正片叠底，和编辑器里的显示一致
      });
    }

    for (const a of page.annotations) {
      if (a.type !== 'signature') continue;
      const img = await embedSignature(a.image);
      const p = imagePlacement(a, a.rotation, box);
      pdfPage.drawImage(img, { x: p.x, y: p.y, width: p.width, height: p.height, rotate: degrees(p.rotate) });
    }

    for (const a of page.annotations) {
      if (a.type !== 'text' || !font || a.text.trim() === '') continue;
      const [r, g, b] = hexToRgb(a.color);
      for (const op of textLineOps(a.text, a, a.fontSize, a.rotation, box)) {
        if (op.text === '') continue;
        assertEncodable(font, op.text);
        pdfPage.drawText(op.text, {
          x: op.x,
          y: op.y,
          size: a.fontSize,
          font,
          color: rgb(r, g, b),
          rotate: degrees(op.rotate),
          lineHeight: a.fontSize * LINE_HEIGHT,
        });
      }
    }
  }

  return out.save();
}

/** 标准字体不支持中文等字符，提前检查并给出看得懂的提示 */
function assertEncodable(font: { encodeText: (t: string) => unknown }, text: string) {
  for (const ch of text) {
    try {
      font.encodeText(ch);
    } catch {
      throw new Error(`文字里有暂不支持的字符“${ch}”，目前只支持英文和数字（中文会在第 7 阶段加入）`);
    }
  }
}

/** 让浏览器下载文件 */
export function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 稍后再释放，避免部分浏览器还没开始下载
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** 根据内容决定下载的文件名 */
export function exportFileName(files: SourceFile[], partial: boolean) {
  const base = files.length === 1 ? files[0].name.replace(/\.pdf$/i, '') : 'merged';
  return `${base}${partial ? '-pages' : '-edited'}.pdf`;
}
