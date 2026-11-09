// 只负责“显示”：用 pdf.js 加载和渲染 PDF。导出（修改）以后用 pdf-lib 做。
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
// Vite 的 ?url 会把 worker 文件当作静态资源打包，并返回它的 URL
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// sourceId -> 已加载的 pdf.js 文档（loadingTask 用来释放资源）
const docs = new Map<string, PDFDocumentProxy>();
const tasks = new Map<string, PDFDocumentLoadingTask>();

export type PageInfo = {
  pageIndex: number;
  /** 未旋转时的页面尺寸，单位 pt（1pt = 1/72 英寸） */
  width: number;
  height: number;
  /** PDF 文件本身自带的旋转角度（/Rotate） */
  baseRotation: number;
};

/** 加载 PDF，返回每一页的尺寸信息 */
export async function loadPdf(sourceId: string, bytes: ArrayBuffer): Promise<PageInfo[]> {
  // pdf.js 会把传进去的 buffer 转移给 worker（原 buffer 会变空），
  // 而导出时还需要原始字节，所以这里传一份拷贝。
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) });
  tasks.set(sourceId, task);
  const doc = await task.promise;
  docs.set(sourceId, doc);

  const pages: PageInfo[] = [];
  for (let i = 0; i < doc.numPages; i++) {
    const page = await doc.getPage(i + 1); // pdf.js 页码从 1 开始
    const vp = page.getViewport({ scale: 1, rotation: 0 });
    pages.push({ pageIndex: i, width: vp.width, height: vp.height, baseRotation: page.rotate });
  }
  return pages;
}

/** 释放不再使用的文档 */
export async function unloadPdf(sourceId: string) {
  const task = tasks.get(sourceId);
  docs.delete(sourceId);
  tasks.delete(sourceId);
  await task?.destroy();
}

/**
 * 把一页渲染到 canvas 上。
 * @param scale 1 表示 1pt = 1 个 CSS 像素
 * @param rotation 显示的总旋转角度
 * @returns 可以取消的渲染任务（缩放变化或组件卸载时要取消）
 */
export function renderPage(
  sourceId: string,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  scale: number,
  rotation: number,
) {
  let task: RenderTask | null = null;
  let cancelled = false;

  const promise = (async () => {
    const doc = docs.get(sourceId);
    if (!doc) throw new Error(`PDF 未加载：${sourceId}`);
    const page = await doc.getPage(pageIndex + 1);
    if (cancelled) return;

    // 按屏幕像素密度放大 canvas，高分屏上才不会模糊
    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: scale * dpr, rotation });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    task = page.render({ canvas, viewport });
    try {
      await task.promise;
    } catch (err) {
      // 被取消是正常情况，不当作错误
      if ((err as Error)?.name !== 'RenderingCancelledException') throw err;
    }
  })();

  return {
    promise,
    cancel() {
      cancelled = true;
      task?.cancel();
    },
  };
}
