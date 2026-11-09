import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useRef, type MouseEvent } from 'react';
import { RotateLeftIcon, RotateRightIcon, TrashIcon } from './Icons';
import { AnnotationLayer } from './AnnotationLayer';
import { usePageCanvas } from '../lib/usePageCanvas';
import { displayRotation, useDocStore, type PageItem } from '../store/useDocStore';

const THUMB_MAX_W = 120;
const THUMB_MAX_H = 160;

type Props = {
  page: PageItem;
  pageNumber: number;
  selected: boolean;
  current: boolean;
  /** 多文件时用来区分来源的颜色，单文件时为 null */
  sourceColor: string | null;
  sourceName: string;
  onClick: (e: MouseEvent) => void;
};

export function Thumbnail({ page, pageNumber, selected, current, sourceColor, sourceName, onClick }: Props) {
  const rotatePages = useDocStore((s) => s.rotatePages);
  const deletePages = useDocStore((s) => s.deletePages);

  // 缩略图要放进固定大小的框里，所以根据旋转后的宽高算缩放比例
  const sideways = displayRotation(page) % 180 !== 0;
  const w = sideways ? page.height : page.width;
  const h = sideways ? page.width : page.height;
  const scale = Math.min(THUMB_MAX_W / w, THUMB_MAX_H / h);

  const { wrapperRef, canvasRef, rendering, cssWidth, cssHeight } = usePageCanvas(page, scale, '300px 0px');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });

  // 主视图滚动到这一页时，让侧栏里的缩略图也滚到可见位置
  const elRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (current) elRef.current?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        elRef.current = el;
      }}
      className={`thumb${selected ? ' selected' : ''}${current ? ' current' : ''}${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onClick}
      title={`${sourceName} · 原第 ${page.pageIndex + 1} 页`}
      {...attributes}
      {...listeners}
    >
      <div className="thumb-frame">
        <div ref={wrapperRef} className="thumb-page" style={{ width: cssWidth, height: cssHeight }}>
          <canvas ref={canvasRef} style={{ width: cssWidth, height: cssHeight }} />
          {rendering && <div className="thumb-loading" />}
          <AnnotationLayer page={page} zoom={scale} interactive={false} />
        </div>
        <div className="thumb-actions" onPointerDown={stop} onClick={stop}>
          <button className="mini-btn" title="向左旋转" onClick={() => rotatePages([page.id], -90)}><RotateLeftIcon size={14} /></button>
          <button className="mini-btn" title="向右旋转" onClick={() => rotatePages([page.id], 90)}><RotateRightIcon size={14} /></button>
          <button className="mini-btn danger" title="删除此页" onClick={() => deletePages([page.id])}><TrashIcon size={14} /></button>
        </div>
      </div>
      <div className="thumb-label">
        {sourceColor && <span className="source-dot" style={{ background: sourceColor }} />}
        {pageNumber}
      </div>
    </div>
  );
}
