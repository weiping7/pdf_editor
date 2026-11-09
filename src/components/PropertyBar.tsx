import { useDocStore } from '../store/useDocStore';
import { TrashIcon } from './Icons';

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72];
const COLORS = ['#111111', '#6b7280', '#dc2626', '#ea580c', '#16a34a', '#2563eb', '#7c3aed', '#ffffff'];

/** 文字工具或选中文字时显示的属性栏 */
export function PropertyBar() {
  const { tool, selectedAnnot, textStyle, pages, setTextStyle, deleteAnnotation } = useDocStore();

  const annot = selectedAnnot
    ? pages.find((p) => p.id === selectedAnnot.pageId)?.annotations.find((a) => a.id === selectedAnnot.annotId)
    : undefined;
  if (tool !== 'text' && !annot) return null;

  // 选中了文字就显示它的样式，否则显示“新建文字”的默认样式
  const style = annot ?? textStyle;

  return (
    <div className="property-bar">
      <span className="property-label">{annot ? '文字' : '点击页面添加文字'}</span>

      <label className="property-field">
        字号
        <select
          value={style.fontSize}
          onChange={(e) => setTextStyle({ fontSize: Number(e.target.value) })}
        >
          {/* 字号不在列表里时（以后可能支持自定义）也能显示 */}
          {[...new Set([...FONT_SIZES, style.fontSize])].sort((a, b) => a - b).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <div className="property-field">
        颜色
        <div className="swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch${style.color === c ? ' active' : ''}`}
              style={{ background: c }}
              title={c}
              onMouseDown={(e) => e.preventDefault()} // 不抢焦点，编辑中也能改颜色
              onClick={() => setTextStyle({ color: c })}
            />
          ))}
          <input
            type="color"
            className="color-input"
            value={style.color}
            title="自定义颜色"
            onChange={(e) => setTextStyle({ color: e.target.value })}
          />
        </div>
      </div>

      {annot && selectedAnnot && (
        <button
          className="btn danger-btn"
          title="删除这段文字（Delete）"
          onClick={() => deleteAnnotation(selectedAnnot.pageId, selectedAnnot.annotId)}
        >
          <TrashIcon size={14} /> 删除
        </button>
      )}
    </div>
  );
}
