import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { KeyboardEvent } from 'react';
import { useDocStore } from '../store/useDocStore';
import { scrollToPage } from '../lib/scrollToPage';
import { Thumbnail } from './Thumbnail';
import { CloseIcon, RotateLeftIcon, RotateRightIcon, TrashIcon } from './Icons';

// 合并多个文件时，用不同颜色标出每页来自哪个文件
const SOURCE_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#db2777', '#0891b2'];

export function ThumbnailSidebar() {
  const { pages, files, selectedIds, currentPageId, select, selectAll, clearSelection, movePage, rotatePages, deletePages } =
    useDocStore();

  const sensors = useSensors(
    // 移动超过 5px 才算拖拽，这样普通点击不会被当成拖拽
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const multiFile = files.length > 1;
  const fileIndex = new Map(files.map((f, i) => [f.id, i]));
  const selected = new Set(selectedIds);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) movePage(String(active.id), String(over.id));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
      e.preventDefault();
      deletePages(selectedIds);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      selectAll();
    } else if (e.key === 'Escape') {
      clearSelection();
    }
  };

  return (
    <aside className="sidebar" tabIndex={-1} onKeyDown={handleKeyDown}>
      <div className="sidebar-header">
        {selectedIds.length > 0 ? (
          <>
            <span className="sidebar-title">已选 {selectedIds.length} 页</span>
            <div className="sidebar-actions">
              <button className="mini-btn" title="向左旋转所选" onClick={() => rotatePages(selectedIds, -90)}><RotateLeftIcon size={14} /></button>
              <button className="mini-btn" title="向右旋转所选" onClick={() => rotatePages(selectedIds, 90)}><RotateRightIcon size={14} /></button>
              <button className="mini-btn danger" title="删除所选（Delete）" onClick={() => deletePages(selectedIds)}><TrashIcon size={14} /></button>
              <button className="mini-btn" title="取消选择（Esc）" onClick={clearSelection}><CloseIcon size={14} /></button>
            </div>
          </>
        ) : (
          <span className="sidebar-hint">拖动排序 · Ctrl/Shift 多选</span>
        )}
      </div>

      {multiFile && (
        <ul className="source-legend">
          {files.map((f, i) => (
            <li key={f.id} title={f.name}>
              <span className="source-dot" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
              <span className="source-name">{f.name}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="thumb-list">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {pages.map((page, i) => (
              <Thumbnail
                key={page.id}
                page={page}
                pageNumber={i + 1}
                selected={selected.has(page.id)}
                current={page.id === currentPageId}
                sourceColor={
                  multiFile ? SOURCE_COLORS[(fileIndex.get(page.sourceId) ?? 0) % SOURCE_COLORS.length] : null
                }
                sourceName={files[fileIndex.get(page.sourceId) ?? 0]?.name ?? ''}
                onClick={(e) => {
                  const toggle = e.ctrlKey || e.metaKey;
                  select(page.id, { toggle, range: e.shiftKey });
                  if (!toggle && !e.shiftKey) scrollToPage(page.id);
                }}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </aside>
  );
}
