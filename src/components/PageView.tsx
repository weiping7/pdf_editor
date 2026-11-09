import { usePageCanvas } from '../lib/usePageCanvas';
import type { PageItem } from '../store/useDocStore';

type Props = {
  page: PageItem;
  pageNumber: number;
  zoom: number;
};

/** 主视图中的一页 */
export function PageView({ page, pageNumber, zoom }: Props) {
  const { wrapperRef, canvasRef, rendering, cssWidth, cssHeight } = usePageCanvas(page, zoom);

  return (
    <div className="page-block" data-page-id={page.id}>
      <div ref={wrapperRef} className="page" style={{ width: cssWidth, height: cssHeight }}>
        <canvas ref={canvasRef} style={{ width: cssWidth, height: cssHeight }} />
        {rendering && <div className="page-loading">加载中…</div>}
      </div>
      <div className="page-number">{pageNumber}</div>
    </div>
  );
}
