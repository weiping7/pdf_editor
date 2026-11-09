import { useEffect, useRef, useState } from 'react';
import { renderPage } from '../lib/pdfRender';
import type { PageItem } from '../store/useDocStore';

type Props = {
  page: PageItem;
  pageNumber: number;
  zoom: number;
};

/** 显示一页 PDF。只有滚动到可见区域附近时才渲染，页面多时不会卡。 */
export function PageView({ page, pageNumber, zoom }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [rendering, setRendering] = useState(true);

  const rotation = (page.baseRotation + page.rotation) % 360;
  const sideways = rotation % 180 !== 0;
  // 页面在屏幕上的 CSS 尺寸（旋转 90/270 度时宽高互换）
  const cssWidth = (sideways ? page.height : page.width) * zoom;
  const cssHeight = (sideways ? page.width : page.height) * zoom;

  // 监听是否进入可视区域（提前 800px 开始渲染）
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { rootMargin: '800px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 可见后渲染；缩放或旋转变化时取消旧任务并重新渲染
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || !canvas) return;
    setRendering(true);
    const task = renderPage(page.sourceId, page.pageIndex, canvas, zoom, rotation);
    task.promise
      .then(() => setRendering(false))
      .catch((err) => console.error('渲染失败', err));
    return () => task.cancel();
  }, [visible, page.sourceId, page.pageIndex, zoom, rotation]);

  return (
    <div className="page-block">
      <div
        ref={wrapperRef}
        className="page"
        style={{ width: cssWidth, height: cssHeight }}
      >
        <canvas ref={canvasRef} style={{ width: cssWidth, height: cssHeight }} />
        {rendering && <div className="page-loading">加载中…</div>}
      </div>
      <div className="page-number">{pageNumber}</div>
    </div>
  );
}
