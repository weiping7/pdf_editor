import { getSelectedAnnotation, useDocStore } from '../store/useDocStore';
import { TrashIcon } from './Icons';

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72];
const TEXT_COLORS = ['#111111', '#6b7280', '#dc2626', '#ea580c', '#16a34a', '#2563eb', '#7c3aed', '#ffffff'];
const HIGHLIGHT_COLORS = ['#facc15', '#4ade80', '#38bdf8', '#f472b6', '#fb923c', '#a78bfa'];

/** 选了文字/高亮工具，或者选中了某个标注时显示的属性栏 */
export function PropertyBar() {
  const state = useDocStore();
  const { tool, selectedAnnot, textStyle, highlightColor, setTextStyle, setHighlightColor, deleteAnnotation } = state;
  const annot = getSelectedAnnotation(state);

  // 显示哪一种属性：优先看选中的标注，没有就看当前工具
  const kind = annot?.type ?? (tool === 'select' ? null : tool);
  if (!kind) return null;

  const deleteButton = annot && selectedAnnot && (
    <button
      className="btn danger-btn"
      title="删除（Delete）"
      onClick={() => deleteAnnotation(selectedAnnot.pageId, selectedAnnot.annotId)}
    >
      <TrashIcon size={14} /> 删除
    </button>
  );

  if (kind === 'highlight') {
    const color = annot?.type === 'highlight' ? annot.color : highlightColor;
    return (
      <div className="property-bar">
        <span className="property-label">{annot ? '高亮' : '在页面上拖动，框出要高亮的地方'}</span>
        <ColorField colors={HIGHLIGHT_COLORS} value={color} onChange={setHighlightColor} />
        {deleteButton}
      </div>
    );
  }

  // 选中了文字就显示它的样式，否则显示“新建文字”的默认样式
  const style = annot?.type === 'text' ? annot : textStyle;
  return (
    <div className="property-bar">
      <span className="property-label">{annot ? '文字' : '点击页面添加文字'}</span>

      <label className="property-field">
        字号
        <select value={style.fontSize} onChange={(e) => setTextStyle({ fontSize: Number(e.target.value) })}>
          {/* 字号不在列表里时（以后可能支持自定义）也能显示 */}
          {[...new Set([...FONT_SIZES, style.fontSize])]
            .sort((a, b) => a - b)
            .map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
        </select>
      </label>

      <ColorField colors={TEXT_COLORS} value={style.color} onChange={(color) => setTextStyle({ color })} />
      {deleteButton}
    </div>
  );
}

function ColorField({ colors, value, onChange }: { colors: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <div className="property-field">
      颜色
      <div className="swatches">
        {colors.map((c) => (
          <button
            key={c}
            className={`swatch${value === c ? ' active' : ''}`}
            style={{ background: c }}
            title={c}
            onMouseDown={(e) => e.preventDefault()} // 不抢焦点，编辑文字时也能改颜色
            onClick={() => onChange(c)}
          />
        ))}
        <input
          type="color"
          className="color-input"
          value={value}
          title="自定义颜色"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
