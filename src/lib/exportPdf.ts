// 只负责“导出”：用 pdf-lib 按编辑器里的页面顺序和旋转生成新的 PDF。
import { displayRotation, type PageItem, type SourceFile } from '../store/useDocStore';

/**
 * 生成新的 PDF。
 * @param files 所有源文件
 * @param pages 要导出的页面（按这个顺序）
 */
export async function buildPdf(files: SourceFile[], pages: PageItem[]): Promise<Uint8Array> {
  // pdf-lib 比较大，用到时才加载，首页打开更快
  const { PDFDocument, degrees } = await import('pdf-lib');

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

  // 2. 按编辑器里的顺序把页面加进新文档
  const cursor = new Map<string, number>(); // 每个源文件已经用到第几个复制页
  for (const page of pages) {
    const copies = copied.get(page.sourceId)!;
    const i = cursor.get(page.sourceId) ?? 0;
    cursor.set(page.sourceId, i + 1);

    const pdfPage = out.addPage(copies[i]);
    // setRotation 设置的是绝对角度，所以要用“自带旋转 + 用户旋转”
    pdfPage.setRotation(degrees(displayRotation(page)));
  }

  return out.save();
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
