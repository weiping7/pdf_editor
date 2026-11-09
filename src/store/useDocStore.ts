import { create } from 'zustand';
import { loadPdf, unloadPdf } from '../lib/pdfRender';

export type Rotation = 0 | 90 | 180 | 270;

export type SourceFile = {
  id: string;
  name: string;
  /** 原始字节，导出时交给 pdf-lib */
  bytes: ArrayBuffer;
};

/**
 * 编辑器里的“一页”。排序、删除、合并都只是在改 pages 数组，
 * 原 PDF 在导出之前一直不动。
 */
export type PageItem = {
  id: string;
  sourceId: string;
  pageIndex: number;
  /** 未旋转时的尺寸，单位 pt */
  width: number;
  height: number;
  /** PDF 自带的旋转 */
  baseRotation: number;
  /** 用户额外加的旋转（第 2 阶段使用） */
  rotation: Rotation;
};

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;

type DocState = {
  files: SourceFile[];
  pages: PageItem[];
  zoom: number;
  loading: boolean;
  error: string | null;
  /** 打开 PDF（第 1 阶段：替换当前文档；第 2 阶段再做多文件合并） */
  openFiles: (files: File[]) => Promise<void>;
  setZoom: (zoom: number) => void;
};

const uid = () => crypto.randomUUID();

export const useDocStore = create<DocState>((set, get) => ({
  files: [],
  pages: [],
  zoom: 1,
  loading: false,
  error: null,

  async openFiles(fileList) {
    const pdfs = fileList.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    );
    if (pdfs.length === 0) {
      set({ error: '请选择 PDF 文件' });
      return;
    }

    set({ loading: true, error: null });
    try {
      const file = pdfs[0];
      const bytes = await file.arrayBuffer();
      const source: SourceFile = { id: uid(), name: file.name, bytes };
      const infos = await loadPdf(source.id, bytes);

      // 释放旧文档
      await Promise.all(get().files.map((f) => unloadPdf(f.id)));

      set({
        files: [source],
        pages: infos.map((info) => ({
          id: uid(),
          sourceId: source.id,
          ...info,
          rotation: 0,
        })),
        loading: false,
      });
    } catch (err) {
      console.error(err);
      set({ loading: false, error: `无法打开文件：${(err as Error).message}` });
    }
  },

  setZoom(zoom) {
    set({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom * 100) / 100)) });
  },
}));
