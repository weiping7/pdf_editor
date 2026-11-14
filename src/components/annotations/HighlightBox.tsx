import { useRef, type PointerEvent } from 'react';
import {
  HANDLES,
  handleCursor,
  moveRect,
  resizeRect,
  screenDeltaToPage,
  type Handle,
  type Rect,
} from '../../lib/coords';
import { displayRotation, useDocStore, type HighlightAnnotation, type PageItem } from '../../store/useDocStore';

type Props = {
  page: PageItem;
  annot: HighlightAnnotation;
  zoom: number;
  /** 位置和大小（CSS 像素） */
  style: React.CSSProperties;
};

/**
 * 高亮的“操作框”：透明的，负责选中、移动和调整大小。
 * 颜色画在 AnnotationLayer 的颜色层里。
 */

/** 拖动开始时记下的状态；handle 为 null 表示移动整个高亮 */
type DragState = { startX: number; startY: number; rect: Rect; handle: Handle | null };

export function HighlightBox({ page, annot, zoom, style }: Props) {
  const selected = useDocStore((s) => s.selectedAnnot?.annotId === annot.id);
  const drag = useRef<DragState | null>(null);
  const rotation = displayRotation(page);

  const startDrag = (e: PointerEvent<HTMLDivElement>, handle: Handle | null) => {
    e.stopPropagation(); // 不要触发页面上的点击
    if (e.button !== 0) return;
    useDocStore.getState().selectAnnotation({ pageId: page.id, annotId: annot.id });
    const { x, y, width, height } = annot;
    drag.current = { startX: e.clientX, startY: e.clientY, rect: { x, y, width, height }, handle };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const delta = screenDeltaToPage(e.clientX - d.startX, e.clientY - d.startY, rotation, zoom);
    const rect = d.handle ? resizeRect(d.rect, d.handle, delta, page) : moveRect(d.rect, delta, page);
    useDocStore.getState().updateAnnotation(page.id, annot.id, rect);
  };

  const endDrag = () => {
    drag.current = null;
  };

  const dragHandlers = {
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };

  return (
    <div
      className={`highlight-annot${selected ? ' selected' : ''}`}
      style={style}
      title="拖动移动"
      onPointerDown={(e) => startDrag(e, null)}
      onClick={(e) => e.stopPropagation()}
      {...dragHandlers}
    >
      {selected &&
        HANDLES.map((h) => (
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
