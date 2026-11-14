import { useRef, type PointerEvent, type ReactNode } from 'react';
import {
  CORNER_HANDLES,
  HANDLES,
  handleCursor,
  moveRect,
  resizeRect,
  resizeRectKeepAspect,
  screenDeltaToPage,
  type Handle,
  type Rect,
} from '../../lib/coords';
import {
  displayRotation,
  useDocStore,
  type HighlightAnnotation,
  type PageItem,
  type SignatureAnnotation,
} from '../../store/useDocStore';

type Props = {
  page: PageItem;
  annot: HighlightAnnotation | SignatureAnnotation;
  zoom: number;
  className: string;
  children?: ReactNode;
};

/** 拖动开始时记下的状态；handle 为 null 表示移动整个框 */
type DragState = { startX: number; startY: number; rect: Rect; handle: Handle | null };

/**
 * 矩形标注（高亮、签名）的“操作框”：负责选中、移动和调整大小。
 * 签名只有四个角的手柄，并且等比例缩放，免得被拉变形。
 */
export function RectBox({ page, annot, zoom, className, children }: Props) {
  const selected = useDocStore((s) => s.selectedAnnot?.annotId === annot.id);
  const drag = useRef<DragState | null>(null);
  const rotation = displayRotation(page);
  const keepAspect = annot.type === 'signature';

  const startDrag = (e: PointerEvent<HTMLDivElement>, handle: Handle | null) => {
    e.stopPropagation(); // 不要触发页面上的点击
    if (e.button !== 0) return;
    e.preventDefault(); // 不要拖动图片
    useDocStore.getState().selectAnnotation({ pageId: page.id, annotId: annot.id });
    const { x, y, width, height } = annot;
    drag.current = { startX: e.clientX, startY: e.clientY, rect: { x, y, width, height }, handle };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const delta = screenDeltaToPage(e.clientX - d.startX, e.clientY - d.startY, rotation, zoom);
    const rect = !d.handle
      ? moveRect(d.rect, delta, page)
      : keepAspect
        ? resizeRectKeepAspect(d.rect, d.handle, delta, page)
        : resizeRect(d.rect, d.handle, delta, page);
    useDocStore.getState().updateAnnotation(page.id, annot.id, rect);
  };

  const endDrag = () => {
    drag.current = null;
  };

  const dragHandlers = { onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag };

  return (
    <div
      className={`rect-annot ${className}${selected ? ' selected' : ''}`}
      style={{ left: annot.x * zoom, top: annot.y * zoom, width: annot.width * zoom, height: annot.height * zoom }}
      title="拖动移动"
      onPointerDown={(e) => startDrag(e, null)}
      onClick={(e) => e.stopPropagation()}
      {...dragHandlers}
    >
      {children}
      {selected &&
        (keepAspect ? CORNER_HANDLES : HANDLES).map((h) => (
          <div
            key={h}
            className={`hl-handle hl-${h}`}
            style={{ cursor: handleCursor(h, rotation) }}
            onPointerDown={(e) => startDrag(e, h)}
            {...dragHandlers}
          />
        ))}
    </div>
  );
}
