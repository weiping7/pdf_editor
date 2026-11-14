import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { screenDeltaToPage } from '../../lib/coords';
import { needsCjkFont } from '../../lib/fonts';
import { displayRotation, useDocStore, type PageItem, type TextAnnotation } from '../../store/useDocStore';

/**
 * 中文版 Chrome 默认最小字号是 12px，缩小页面时小字会被强制放大，和导出结果对不上。
 * 所以文字先按 RENDER_SCALE 倍的字号渲染，再用 transform: scale() 缩回实际大小。
 */
const RENDER_SCALE = 4;

type Props = {
  page: PageItem;
  annot: TextAnnotation;
  zoom: number;
  /** 缩略图里只显示，不能操作 */
  interactive: boolean;
};

export function TextBox({ page, annot, zoom, interactive }: Props) {
  const selected = useDocStore((s) => s.selectedAnnot?.annotId === annot.id);
  const editing = useDocStore((s) => s.editingAnnotId === annot.id);
  const { selectAnnotation, updateAnnotation, deleteAnnotation, setEditing } = useDocStore.getState();

  const editRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  // 输入时文字还没保存到 store，用这个记住“现在有没有中文”，好马上换成和导出一样的字体
  const [typingCjk, setTypingCjk] = useState(false);
  const cjk = editing ? typingCjk : needsCjkFont(annot.text);

  // 进入编辑状态：填入文字、聚焦、光标放到最后
  useEffect(() => {
    const el = editRef.current;
    if (!editing || !el) return;
    el.textContent = annot.text;
    setTypingCjk(needsCjkFont(annot.text));
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // 只在进入编辑时执行一次；编辑过程中文字由浏览器管理
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // 结束编辑：保存文字；空文字直接删除
  const commit = () => {
    const el = editRef.current;
    if (!el) return;
    const text = el.innerText.replace(/\n$/, '');
    if (text.trim() === '') deleteAnnotation(page.id, annot.id);
    else {
      updateAnnotation(page.id, annot.id, { text });
      setEditing(null);
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation(); // 不要触发页面上的“新建文字”
    if (editing || e.button !== 0) return;
    selectAnnotation({ pageId: page.id, annotId: annot.id });
    drag.current = { startX: e.clientX, startY: e.clientY, x: annot.x, y: annot.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    // 屏幕上的拖动距离 → 页面坐标里的距离（页面可能旋转过）
    const delta = screenDeltaToPage(e.clientX - d.startX, e.clientY - d.startY, displayRotation(page), zoom);
    updateAnnotation(page.id, annot.id, {
      x: clamp(d.x + delta.x, 0, page.width - 4),
      y: clamp(d.y + delta.y, 0, page.height - 4),
    });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const scale = zoom / RENDER_SCALE;
  const style = {
    left: annot.x * zoom,
    top: annot.y * zoom,
    color: annot.color,
    fontSize: annot.fontSize * RENDER_SCALE,
    transform: `rotate(${annot.rotation}deg) scale(${scale})`,
    // 边框跟着 scale 一起缩小了，这里放大回来，保持 1~2px
    '--inv-scale': 1 / scale,
  } as React.CSSProperties;

  if (!interactive) {
    return (
      <div className={`text-annot static${cjk ? ' cjk' : ''}`} style={style}>
        {annot.text}
      </div>
    );
  }

  if (editing) {
    return (
      <div
        key="edit"
        ref={editRef}
        className={`text-annot editing${cjk ? ' cjk' : ''}`}
        style={style}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        spellCheck={false}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onBlur={commit}
        onInput={(e) => setTypingCjk(needsCjkFont(e.currentTarget.textContent ?? ''))}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') e.currentTarget.blur();
        }}
      />
    );
  }

  return (
    <div
      key="view"
      className={`text-annot${selected ? ' selected' : ''}${cjk ? ' cjk' : ''}`}
      style={style}
      title="拖动移动，双击编辑"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={() => setEditing(annot.id)}
    >
      {annot.text}
    </div>
  );
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
