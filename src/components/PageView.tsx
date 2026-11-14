import { useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { rectFromPoints, rotateVector, screenToPage, type Point, type Rect } from '../lib/coords';
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
  const highlightColor = useDocStore((s) => s.highlightColor);
  // 正在拖出来的高亮：起点和当前矩形（页面坐标）
  const drawStart = useRef<Point | null>(null);
  const [draft, setDraft] = useState<Rect | null>(null);

  /** 鼠标位置 → 页面坐标 */
  const toPagePoint = (e: { clientX: number; clientY: number; currentTarget: HTMLElement }) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return screenToPage(e.clientX - rect.left, e.clientY - rect.top, displayRotation(page), page, zoom);
  };

  // 高亮工具：按下开始画，拖动改变大小，松开保存
  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (tool !== 'highlight' || e.button !== 0) return;
    e.preventDefault(); // 不要选中页面上的文字
    drawStart.current = toPagePoint(e);
    setDraft(rectFromPoints(drawStart.current, drawStart.current, page));
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drawStart.current) return;
    setDraft(rectFromPoints(drawStart.current, toPagePoint(e), page));
  };

  const handlePointerUp = () => {
    const rect = draft;
    drawStart.current = null;
    setDraft(null);
    // 太小的当作误点，不保存
    if (!rect || rect.width < 3 || rect.height < 3) return;
    const { addAnnotation, selectAnnotation } = useDocStore.getState();
    addAnnotation(page.id, { id: newId(), type: 'highlight', ...rect, color: highlightColor });
    // 高亮工具还开着，可以连续画；不选中刚画的，免得换颜色时把它也改了
    selectAnnotation(null);
  };

  // 用 click 而不是 pointerdown：等浏览器处理完焦点变化再新建，
  // 否则新文字框刚获得焦点就会被抢走焦点
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const { addAnnotation, selectAnnotation, setTool, textStyle } = useDocStore.getState();
    if (tool === 'highlight') return; // 高亮在 pointerup 时已经处理
    if (tool !== 'text') {
      selectAnnotation(null); // 点空白处取消选择
      return;
    }

    const rotation = displayRotation(page);
    const point = toPagePoint(e);
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
        className={`page tool-${tool}`}
        style={{ width: cssWidth, height: cssHeight }}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          drawStart.current = null;
          setDraft(null);
        }}
      >
        <canvas ref={canvasRef} style={{ width: cssWidth, height: cssHeight }} />
        {rendering && <div className="page-loading">加载中…</div>}
        <AnnotationLayer
          page={page}
          zoom={zoom}
          interactive
          draft={draft && { rect: draft, color: highlightColor }}
        />
      </div>
      <div className="page-number">{pageNumber}</div>
    </div>
  );
}
