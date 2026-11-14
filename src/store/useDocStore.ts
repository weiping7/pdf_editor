import { create } from 'zustand';
import { arrayMove } from '@dnd-kit/sortable';
import { loadPdf, unloadPdf } from '../lib/pdfRender';
import { buildPdf, downloadBytes, exportFileName } from '../lib/exportPdf';

export type Rotation = 0 | 90 | 180 | 270;

export type SourceFile = {
  id: string;
  name: string;
  /** 原始字节，导出时交给 pdf-lib */
  bytes: ArrayBuffer;
};

/** 文字标注。坐标是“页面坐标”：未旋转页面，单位 pt，原点左上角（见 lib/coords.ts） */
export type TextAnnotation = {
  id: string;
  type: 'text';
  /** 文字框左上角 */
  x: number;
  y: number;
  text: string;
  /** 字号，单位 pt */
  fontSize: number;
  /** "#rrggbb" */
  color: string;
  /**
   * 文字框自身的旋转（顺时针，绕左上角）。
   * 在旋转过的页面上添加文字时，用它把文字转回“正”的方向。
   */
  rotation: Rotation;
};

/**
 * 高亮：页面坐标里的矩形。页面只会旋转 90° 的倍数，
 * 所以这个矩形在屏幕上也一直是横平竖直的，不需要自己的旋转角度。
 */
export type HighlightAnnotation = {
  id: string;
  type: 'highlight';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

/** 签名：一张透明背景的 PNG 图片，放在页面坐标的矩形里 */
export type SignatureAnnotation = {
  id: string;
  type: 'signature';
  x: number;
  y: number;
  /** 矩形的宽高（页面坐标）。图片转了 90° 时，宽高和图片本身是反的 */
  width: number;
  height: number;
  /** PNG 的 data URL */
  image: string;
  /** 图片自身的旋转（顺时针），在旋转过的页面上让签名保持正向，和文字一样 */
  rotation: Rotation;
};

export type Annotation = TextAnnotation | HighlightAnnotation | SignatureAnnotation;

/** 画好、可以重复使用的签名 */
export type SavedSignature = { id: string; image: string; width: number; height: number };

export type Tool = 'select' | 'text' | 'highlight' | 'signature';

/** 高亮的透明度，显示和导出一致 */
export const HIGHLIGHT_OPACITY = 0.4;

export type TextStyle = { fontSize: number; color: string };

/** 当前选中的标注 */
export type AnnotRef = { pageId: string; annotId: string };

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
  /** 用户额外加的旋转 */
  rotation: Rotation;
  annotations: Annotation[];
};

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;

/** 页面最终显示的旋转角度 */
export const displayRotation = (p: PageItem) => (p.baseRotation + p.rotation) % 360;

type SelectMode = { toggle?: boolean; range?: boolean };

type DocState = {
  files: SourceFile[];
  pages: PageItem[];
  /** 侧栏中选中的页面 */
  selectedIds: string[];
  /** Shift 多选的起点 */
  anchorId: string | null;
  /** 主视图中当前看到的页面 */
  currentPageId: string | null;
  zoom: number;
  loading: boolean;
  exporting: boolean;
  error: string | null;

  /** 当前工具 */
  tool: Tool;
  /** 选中的标注 */
  selectedAnnot: AnnotRef | null;
  /** 正在输入文字的标注 id */
  editingAnnotId: string | null;
  /** 新建文字时使用的样式（会记住上次的选择） */
  textStyle: TextStyle;
  /** 新建高亮时使用的颜色 */
  highlightColor: string;
  /** 保存过的签名（也存在浏览器里，下次打开还在） */
  savedSignatures: SavedSignature[];
  /** 签名工具下，点击页面时要放的签名 */
  pendingSignature: SavedSignature | null;
  /** 是否显示签名对话框 */
  signatureDialogOpen: boolean;

  /** replace：替换当前文档；append：追加到末尾（合并） */
  openFiles: (files: File[], mode: 'replace' | 'append') => Promise<void>;
  setZoom: (zoom: number) => void;
  setCurrentPage: (id: string | null) => void;
  select: (id: string, mode?: SelectMode) => void;
  selectAll: () => void;
  clearSelection: () => void;
  movePage: (activeId: string, overId: string) => void;
  rotatePages: (ids: string[], delta: 90 | -90) => void;
  deletePages: (ids: string[]) => void;
  /** 导出 PDF 并下载；onlySelected 为 true 时只导出选中的页（提取页面） */
  exportPdf: (onlySelected?: boolean) => Promise<void>;
  clearError: () => void;

  setTool: (tool: Tool) => void;
  addAnnotation: (pageId: string, annot: Annotation, edit?: boolean) => void;
  updateAnnotation: (pageId: string, annotId: string, patch: Partial<Annotation>) => void;
  deleteAnnotation: (pageId: string, annotId: string) => void;
  selectAnnotation: (ref: AnnotRef | null) => void;
  setEditing: (annotId: string | null) => void;
  /** 修改文字样式：同时作用于选中的文字和以后新建的文字 */
  setTextStyle: (patch: Partial<TextStyle>) => void;
  /** 修改高亮颜色：同时作用于选中的高亮和以后新建的高亮 */
  setHighlightColor: (color: string) => void;
  openSignatureDialog: (open: boolean) => void;
  /** 选好签名，进入“点击页面放置”状态 */
  startPlacingSignature: (sig: SavedSignature) => void;
  saveSignature: (sig: SavedSignature) => void;
  removeSavedSignature: (id: string) => void;
};

const uid = () => crypto.randomUUID();

// 签名存在浏览器的 localStorage 里。隐私模式等情况下可能读写失败，失败时只是不记住。
const SIGNATURE_KEY = 'pdf-editor.signatures';
function loadSignatures(): SavedSignature[] {
  try {
    const list = JSON.parse(localStorage.getItem(SIGNATURE_KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function storeSignatures(list: SavedSignature[]) {
  try {
    localStorage.setItem(SIGNATURE_KEY, JSON.stringify(list));
  } catch {
    // 存不下（比如空间满了）就算了，本次使用不受影响
  }
}

const isPdf = (f: File) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');

/** 修改某一页的标注列表 */
const mapAnnots = (pages: PageItem[], pageId: string, fn: (a: Annotation[]) => Annotation[]) =>
  pages.map((p) => (p.id === pageId ? { ...p, annotations: fn(p.annotations) } : p));

export const newId = uid;

/** 找出当前选中的标注 */
export function getSelectedAnnotation(s: Pick<DocState, 'pages' | 'selectedAnnot'>): Annotation | undefined {
  const ref = s.selectedAnnot;
  if (!ref) return undefined;
  return s.pages.find((p) => p.id === ref.pageId)?.annotations.find((a) => a.id === ref.annotId);
}

export const useDocStore = create<DocState>((set, get) => ({
  files: [],
  pages: [],
  selectedIds: [],
  anchorId: null,
  currentPageId: null,
  zoom: 1,
  loading: false,
  exporting: false,
  error: null,
  tool: 'select',
  selectedAnnot: null,
  editingAnnotId: null,
  textStyle: { fontSize: 16, color: '#111111' },
  highlightColor: '#facc15',
  savedSignatures: loadSignatures(),
  pendingSignature: null,
  signatureDialogOpen: false,

  async openFiles(fileList, mode) {
    const pdfs = fileList.filter(isPdf);
    if (pdfs.length === 0) {
      set({ error: '请选择 PDF 文件' });
      return;
    }

    set({ loading: true, error: null });
    const newFiles: SourceFile[] = [];
    const newPages: PageItem[] = [];
    const failed: string[] = [];

    // 多个文件按选择顺序依次加载；某个文件坏了不影响其他文件
    for (const file of pdfs) {
      const source: SourceFile = { id: uid(), name: file.name, bytes: await file.arrayBuffer() };
      try {
        const infos = await loadPdf(source.id, source.bytes);
        newFiles.push(source);
        for (const info of infos) {
          newPages.push({ id: uid(), sourceId: source.id, ...info, rotation: 0, annotations: [] });
        }
      } catch (err) {
        console.error(err);
        failed.push(file.name);
      }
    }

    const error = failed.length ? `无法打开：${failed.join('、')}（文件可能已损坏或有密码）` : null;

    if (mode === 'replace' && newFiles.length > 0) {
      await Promise.all(get().files.map((f) => unloadPdf(f.id)));
      set({
        files: newFiles,
        pages: newPages,
        selectedIds: [],
        anchorId: null,
        selectedAnnot: null,
        editingAnnotId: null,
        currentPageId: newPages[0]?.id ?? null,
        loading: false,
        error,
      });
    } else {
      set((s) => ({
        files: [...s.files, ...newFiles],
        pages: [...s.pages, ...newPages],
        currentPageId: s.currentPageId ?? newPages[0]?.id ?? null,
        loading: false,
        error,
      }));
    }
  },

  setZoom(zoom) {
    set({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom * 100) / 100)) });
  },

  setCurrentPage(id) {
    if (get().currentPageId !== id) set({ currentPageId: id });
  },

  select(id, { toggle, range } = {}) {
    const { pages, selectedIds, anchorId } = get();
    if (range && anchorId) {
      // Shift：选中从起点到当前页之间的所有页
      const a = pages.findIndex((p) => p.id === anchorId);
      const b = pages.findIndex((p) => p.id === id);
      const [from, to] = a < b ? [a, b] : [b, a];
      set({ selectedIds: pages.slice(from, to + 1).map((p) => p.id) });
    } else if (toggle) {
      // Ctrl / Cmd：加入或移出选择
      set({
        selectedIds: selectedIds.includes(id)
          ? selectedIds.filter((x) => x !== id)
          : [...selectedIds, id],
        anchorId: id,
      });
    } else {
      set({ selectedIds: [id], anchorId: id });
    }
  },

  selectAll() {
    set((s) => ({ selectedIds: s.pages.map((p) => p.id) }));
  },

  clearSelection() {
    set({ selectedIds: [], anchorId: null });
  },

  movePage(activeId, overId) {
    set((s) => {
      const from = s.pages.findIndex((p) => p.id === activeId);
      const to = s.pages.findIndex((p) => p.id === overId);
      if (from < 0 || to < 0 || from === to) return s;
      return { pages: arrayMove(s.pages, from, to) };
    });
  },

  rotatePages(ids, delta) {
    const target = new Set(ids);
    set((s) => ({
      pages: s.pages.map((p) =>
        target.has(p.id) ? { ...p, rotation: (((p.rotation + delta) % 360) + 360) % 360 as Rotation } : p,
      ),
    }));
  },

  deletePages(ids) {
    const target = new Set(ids);
    const { pages, files, currentPageId } = get();
    const remaining = pages.filter((p) => !target.has(p.id));

    // 某个源文件的页面全删光了，就释放它
    const usedSources = new Set(remaining.map((p) => p.sourceId));
    const unused = files.filter((f) => !usedSources.has(f.id));
    unused.forEach((f) => unloadPdf(f.id));

    // 当前页被删时，跳到删除位置附近的页
    let nextCurrent = currentPageId;
    if (currentPageId && target.has(currentPageId)) {
      const idx = pages.findIndex((p) => p.id === currentPageId);
      const after = pages.slice(idx).find((p) => !target.has(p.id));
      nextCurrent = after?.id ?? remaining[remaining.length - 1]?.id ?? null;
    }

    set((s) => ({
      pages: remaining,
      files: files.filter((f) => usedSources.has(f.id)),
      selectedIds: s.selectedIds.filter((id) => !target.has(id)),
      anchorId: s.anchorId && target.has(s.anchorId) ? null : s.anchorId,
      selectedAnnot: s.selectedAnnot && target.has(s.selectedAnnot.pageId) ? null : s.selectedAnnot,
      currentPageId: nextCurrent,
    }));
  },

  async exportPdf(onlySelected = false) {
    const { files, pages, selectedIds, exporting } = get();
    if (exporting) return;
    const selected = new Set(selectedIds);
    // 按侧栏里的顺序导出，而不是按点击选择的顺序
    const target = onlySelected ? pages.filter((p) => selected.has(p.id)) : pages;
    if (target.length === 0) return;

    set({ exporting: true, error: null });
    try {
      const bytes = await buildPdf(files, target);
      const usedFiles = files.filter((f) => target.some((p) => p.sourceId === f.id));
      downloadBytes(bytes, exportFileName(usedFiles, onlySelected));
      set({ exporting: false });
    } catch (err) {
      console.error(err);
      set({ exporting: false, error: `导出失败：${(err as Error).message}` });
    }
  },

  clearError() {
    set({ error: null });
  },

  setTool(tool) {
    // 切到文字/高亮工具时取消选中，属性栏改的是“新标注”的样式，而不是之前选中的标注
    const base = { tool, editingAnnotId: null, ...(tool === 'signature' ? {} : { pendingSignature: null }) };
    set(tool === 'select' ? base : { ...base, selectedAnnot: null });
  },

  addAnnotation(pageId, annot, edit = false) {
    set((s) => ({
      pages: mapAnnots(s.pages, pageId, (list) => [...list, annot]),
      selectedAnnot: { pageId, annotId: annot.id },
      editingAnnotId: edit ? annot.id : null,
    }));
  },

  updateAnnotation(pageId, annotId, patch) {
    set((s) => ({
      pages: mapAnnots(s.pages, pageId, (list) =>
        list.map((a) => (a.id === annotId ? ({ ...a, ...patch } as Annotation) : a)),
      ),
    }));
  },

  deleteAnnotation(pageId, annotId) {
    set((s) => ({
      pages: mapAnnots(s.pages, pageId, (list) => list.filter((a) => a.id !== annotId)),
      selectedAnnot: s.selectedAnnot?.annotId === annotId ? null : s.selectedAnnot,
      editingAnnotId: s.editingAnnotId === annotId ? null : s.editingAnnotId,
    }));
  },

  selectAnnotation(ref) {
    const { selectedAnnot, editingAnnotId } = get();
    if (selectedAnnot?.annotId === ref?.annotId) return;
    set({ selectedAnnot: ref, editingAnnotId: ref && ref.annotId === editingAnnotId ? editingAnnotId : null });
  },

  setEditing(annotId) {
    set({ editingAnnotId: annotId });
  },

  setTextStyle(patch) {
    const { selectedAnnot, updateAnnotation } = get();
    set((s) => ({ textStyle: { ...s.textStyle, ...patch } }));
    if (selectedAnnot && getSelectedAnnotation(get())?.type === 'text') {
      updateAnnotation(selectedAnnot.pageId, selectedAnnot.annotId, patch);
    }
  },

  openSignatureDialog(open) {
    set({ signatureDialogOpen: open });
  },

  startPlacingSignature(sig) {
    get().setTool('signature');
    set({ pendingSignature: sig, signatureDialogOpen: false });
  },

  saveSignature(sig) {
    const list = [sig, ...get().savedSignatures.filter((s) => s.id !== sig.id)].slice(0, 6);
    set({ savedSignatures: list });
    storeSignatures(list);
  },

  removeSavedSignature(id) {
    const list = get().savedSignatures.filter((s) => s.id !== id);
    set({ savedSignatures: list });
    storeSignatures(list);
  },

  setHighlightColor(color) {
    const { selectedAnnot, updateAnnotation } = get();
    set({ highlightColor: color });
    if (selectedAnnot && getSelectedAnnotation(get())?.type === 'highlight') {
      updateAnnotation(selectedAnnot.pageId, selectedAnnot.annotId, { color });
    }
  },
}));
