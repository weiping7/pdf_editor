import type { MouseEvent } from 'react';
import { rotateVector, screenToPage } from '../lib/coords';
import { usePageCanvas } from '../lib/usePageCanvas';
import { displayRotation, newId, useDocStore, type PageItem, type Rotation } from '../store/useDocStore';
import { AnnotationLayer } from './AnnotationLayer';

type Props = {
  page: PageItem;
  pageNumber: number;
  zoom: number;
};

/** 主视图中的一页 */
export function PageView({ page, pageNumber, zoom }: Props) {
  const { wrapperRef, canvasRef, rendering, cssWidth, cssHeight } = usePageCanvas(page, zoom);
  const tool = useDocStore((s) => s.tool);

  // 用 click 而不是 pointerdown：等浏览器处理完焦点变化再新建，
  // 否则新文字框刚获得焦点就会被抢走焦点
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const { addAnnotation, selectAnnotation, setTool, textStyle } = useDocStore.getState();
    if (tool !== 'text') {
      selectAnnotation(null); // 点空白处取消选择
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const rotation = displayRotation(page);
    const point = screenToPage(e.clientX - rect.left, e.clientY - rect.top, rotation, page, zoom);
    // 文字框反向旋转，抵消页面的旋转，保证在屏幕上是正的
    const boxRotation = ((360 - rotation) % 360) as Rotation;
    // 让点击位置落在第一行文字的中间，而不是文字框的左上角
    const offset = rotateVector({ x: 0, y: -textStyle.fontSize * 0.6 }, boxRotation);

    setTool('select'); // 加完一个就回到选择工具（要在 addAnnotation 之前，否则会清掉编辑状态）
    addAnnotation(
      page.id,
      {
        id: newId(),
        type: 'text',
        x: point.x + offset.x,
        y: point.y + offset.y,
        text: '',
        fontSize: textStyle.fontSize,
        color: textStyle.color,
        rotation: boxRotation,
      },
      true,
    );
  };

  return (
    <div className="page-block" data-page-id={page.id}>
      <div
        ref={wrapperRef}
        className={`page${tool === 'text' ? ' tool-text' : ''}`}
        style={{ width: cssWidth, height: cssHeight }}
        onClick={handleClick}
      >
        <canvas ref={canvasRef} style={{ width: cssWidth, height: cssHeight }} />
        {rendering && <div className="page-loading">加载中…</div>}
        <AnnotationLayer page={page} zoom={zoom} interactive />
      </div>
      <div className="page-number">{pageNumber}</div>
    </div>
  );
}
