import { useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { PageView } from './components/PageView';
import { useDocStore } from './store/useDocStore';

export default function App() {
  const { pages, zoom, error, loading, openFiles } = useDocStore();
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className="app"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        openFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <Toolbar />
      {error && <div className="error-bar">{error}</div>}

      <main className="viewer">
        {pages.length === 0 ? (
          <div className="empty">
            <div className="empty-card">
              <div className="empty-icon">📄</div>
              <p>{loading ? '正在打开…' : '把 PDF 拖到这里，或点击左上角“打开 PDF”'}</p>
            </div>
          </div>
        ) : (
          pages.map((page, i) => (
            <PageView key={page.id} page={page} pageNumber={i + 1} zoom={zoom} />
          ))
        )}
      </main>

      {dragging && <div className="drop-overlay">松开以打开 PDF</div>}
    </div>
  );
}
