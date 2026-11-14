import { useRef } from 'react';
import { MAX_ZOOM, MIN_ZOOM, useDocStore } from '../store/useDocStore';
import { CursorIcon, HighlightIcon, SignatureIcon, TextIcon } from './Icons';

export function Toolbar() {
  const openRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const {
    files, pages, zoom, loading, exporting, currentPageId, tool,
    openFiles, setZoom, exportPdf, setTool, openSignatureDialog,
  } = useDocStore();
  const hasDoc = pages.length > 0;
  const currentIndex = pages.findIndex((p) => p.id === currentPageId);

  const fileInput = (ref: React.RefObject<HTMLInputElement | null>, mode: 'replace' | 'append') => (
    <input
      ref={ref}
      type="file"
      accept="application/pdf,.pdf"
      multiple
      hidden
      onChange={(e) => {
        openFiles(Array.from(e.target.files ?? []), mode);
        e.target.value = ''; // 允许再次选择同一个文件
      }}
    />
  );

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <span className="brand">PDF Editor</span>
        <button className="btn primary" onClick={() => openRef.current?.click()} disabled={loading}>
          {loading ? '处理中…' : '打开 PDF'}
        </button>
        {hasDoc && (
          <button className="btn" onClick={() => addRef.current?.click()} disabled={loading} title="把其他 PDF 的页面加到末尾">
            + 添加 PDF
          </button>
        )}
        {fileInput(openRef, 'replace')}
        {fileInput(addRef, 'append')}
        {hasDoc && (
          <span className="file-info" title={files.map((f) => f.name).join('\n')}>
            {files.length === 1 ? files[0].name : `${files.length} 个文件`}
          </span>
        )}
      </div>

      {hasDoc && (
        <div className="toolbar-group tools">
          <button
            className={`btn tool-btn${tool === 'select' ? ' active' : ''}`}
            onClick={() => setTool('select')}
            title="选择、移动（Esc）"
          >
            <CursorIcon /> <span>选择</span>
          </button>
          <button
            className={`btn tool-btn${tool === 'text' ? ' active' : ''}`}
            onClick={() => setTool(tool === 'text' ? 'select' : 'text')}
            title="添加文字：在页面上点一下（T）"
          >
            <TextIcon /> <span>文字</span>
          </button>
          <button
            className={`btn tool-btn${tool === 'highlight' ? ' active' : ''}`}
            onClick={() => setTool(tool === 'highlight' ? 'select' : 'highlight')}
            title="高亮：在页面上拖出一个框（H）"
          >
            <HighlightIcon /> <span>高亮</span>
          </button>
          <button
            className={`btn tool-btn${tool === 'signature' ? ' active' : ''}`}
            onClick={() => (tool === 'signature' ? setTool('select') : openSignatureDialog(true))}
            title="签名：手写或上传签名，再点页面放上去"
          >
            <SignatureIcon /> <span>签名</span>
          </button>
        </div>
      )}

      {hasDoc && (
        <div className="toolbar-group">
          <button className="btn primary" onClick={() => exportPdf()} disabled={exporting || loading} title="按当前顺序和旋转导出全部页面">
            {exporting ? '导出中…' : '导出 PDF'}
          </button>
          <span className="toolbar-divider" />
          <span className="page-indicator">
            {currentIndex >= 0 ? currentIndex + 1 : '-'} / {pages.length}
          </span>
          <button className="btn icon" onClick={() => setZoom(zoom - 0.25)} disabled={zoom <= MIN_ZOOM} title="缩小">
            −
          </button>
          <button className="btn zoom-value" onClick={() => setZoom(1)} title="恢复 100%">
            {Math.round(zoom * 100)}%
          </button>
          <button className="btn icon" onClick={() => setZoom(zoom + 0.25)} disabled={zoom >= MAX_ZOOM} title="放大">
            +
          </button>
        </div>
      )}
    </header>
  );
}
