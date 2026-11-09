import { useRef } from 'react';
import { MAX_ZOOM, MIN_ZOOM, useDocStore } from '../store/useDocStore';

export function Toolbar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { files, pages, zoom, loading, openFiles, setZoom } = useDocStore();
  const hasDoc = pages.length > 0;

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <span className="brand">PDF Editor</span>
        <button className="btn primary" onClick={() => inputRef.current?.click()} disabled={loading}>
          {loading ? '打开中…' : '打开 PDF'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            openFiles(Array.from(e.target.files ?? []));
            e.target.value = ''; // 允许再次选择同一个文件
          }}
        />
        {hasDoc && (
          <span className="file-info" title={files[0]?.name}>
            {files[0]?.name} · 共 {pages.length} 页
          </span>
        )}
      </div>

      {hasDoc && (
        <div className="toolbar-group">
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
