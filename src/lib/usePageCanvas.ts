import { useEffect, useRef, useState } from 'react';
import { renderPage } from './pdfRender';
import { displayRotation, type PageItem } from '../store/useDocStore';

/**
 * 把一页渲染到 canvas，并且只在进入可视区域附近时才渲染（懒加载）。
 * 主视图和缩略图共用。
 * @param scale 1 表示 1pt = 1 个 CSS 像素
 * @param rootMargin 提前多少距离开始渲染
 */
export function usePageCanvas(page: PageItem, scale: number, rootMargin = '800px 0px') {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [rendering, setRendering] = useState(true);
  const rotation = displayRotation(page);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect(); // 渲染过一次就不再需要监听
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  // 缩放或旋转变化时取消旧任务并重新渲染
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || !canvas) return;
    setRendering(true);
    const task = renderPage(page.sourceId, page.pageIndex, canvas, scale, rotation);
    task.promise
      .then(() => setRendering(false))
      .catch((err) => console.error('渲染失败', err));
    return () => task.cancel();
  }, [visible, page.sourceId, page.pageIndex, scale, rotation]);

  // 页面在屏幕上的尺寸（旋转 90/270 度时宽高互换）
  const sideways = rotation % 180 !== 0;
  const cssWidth = (sideways ? page.height : page.width) * scale;
  const cssHeight = (sideways ? page.width : page.height) * scale;

  return { wrapperRef, canvasRef, rendering, cssWidth, cssHeight };
}
