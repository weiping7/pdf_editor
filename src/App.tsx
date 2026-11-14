import { useEffect, useRef, useState, type UIEvent } from 'react';
import { Toolbar } from './components/Toolbar';
import { PageView } from './components/PageView';
import { ThumbnailSidebar } from './components/ThumbnailSidebar';
import { getSelectedAnnotation, useDocStore } from './store/useDocStore';
import { CloseIcon } from './components/Icons';
import { PropertyBar } from './components/PropertyBar';

export default function App() {
  const { pages, zoom, error, loading, openFiles, setCurrentPage, clearError } = useDocStore();
  const [dragging, setDragging] = useState(false);
  const scrollFrame = useRef(0);
  const hasDoc = pages.length > 0;

  // 全局快捷键：Delete 删除选中的标注，Esc 取消，T 文字工具，H 高亮工具
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // 正在输入时不处理
      if (target.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
      // 焦点在侧栏时，Delete 由侧栏处理（删页面）
      const inSidebar = !!target.closest('.sidebar');

      const s = useDocStore.getState();
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedAnnot && !inSidebar) {
        e.preventDefault();
        s.deleteAnnotation(s.selectedAnnot.pageId, s.selectedAnnot.annotId);
      } else if (e.key === 'Escape') {
        s.selectAnnotation(null);
        s.setTool('select');
      } else if (/^[th]$/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && s.pages.length > 0) {
        const tool = e.key.toLowerCase() === 't' ? 'text' : 'highlight';
        s.setTool(s.tool === tool ? 'select' : tool);
      } else if (e.key === 'Enter' && s.selectedAnnot && getSelectedAnnotation(s)?.type === 'text') {
        e.preventDefault();
        s.setEditing(s.selectedAnnot.annotId); // 回车进入编辑
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // 滚动时找出“当前页”：视口上方 1/3 处的那一页
  const handleScroll = (e: UIEvent<HTMLElement>) => {
    const viewer = e.currentTarget;
    cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      const line = viewer.getBoundingClientRect().top + viewer.clientHeight / 3;
      for (const block of viewer.querySelectorAll<HTMLElement>('.page-block')) {
        if (block.getBoundingClientRect().bottom >= line) {
          setCurrentPage(block.dataset.pageId ?? null);
          break;
        }
      }
    });
  };

  // 只处理从电脑拖进来的文件；侧栏里拖动缩略图不会触发这些事件
  const isFileDrag = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');

  return (
    <div
      className="app"
      onDragOver={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        setDragging(false);
        // 已经有文档时，拖进来的文件追加到末尾（合并）
        openFiles(Array.from(e.dataTransfer.files), hasDoc ? 'append' : 'replace');
      }}
    >
      <Toolbar />
      <PropertyBar />
      {error && (
        <div className="error-bar">
          <span>{error}</span>
          <button className="mini-btn" onClick={clearError} title="关闭"><CloseIcon size={14} /></button>
        </div>
      )}

      <div className="workspace">
        {hasDoc && <ThumbnailSidebar />}
        <main className="viewer" onScroll={handleScroll}>
          {!hasDoc ? (
            <div className="empty">
              <div className="empty-card">
                <div className="empty-icon">📄</div>
                <p>{loading ? '正在打开…' : '把 PDF 拖到这里，或点击左上角“打开 PDF”'}</p>
                <p className="empty-sub">可以一次选多个文件，会按顺序合并</p>
              </div>
            </div>
          ) : (
            pages.map((page, i) => <PageView key={page.id} page={page} pageNumber={i + 1} zoom={zoom} />)
          )}
        </main>
      </div>

      {dragging && <div className="drop-overlay">{hasDoc ? '松开以添加到末尾' : '松开以打开 PDF'}</div>}
    </div>
  );
}
