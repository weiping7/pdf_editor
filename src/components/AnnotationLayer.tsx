import type { Rect } from '../lib/coords';
import { HIGHLIGHT_OPACITY, displayRotation, type PageItem } from '../store/useDocStore';
import { HighlightBox } from './annotations/HighlightBox';
import { TextBox } from './annotations/TextBox';

type Props = {
  page: PageItem;
  zoom: number;
  interactive: boolean;
  /** 正在拖出来的高亮（还没松开鼠标） */
  draft?: { rect: Rect; color: string } | null;
};

/**
 * 标注层：大小等于“未旋转”的页面，再用 CSS 旋转到和 canvas 一样的方向。
 * 这样标注可以一直用页面坐标保存，不用关心页面怎么旋转。
 *
 * 分成两层：
 * - 颜色层：高亮的颜色，用“正片叠底”和下面的 PDF 混合（像真的荧光笔，黑字不会变淡）。
 *   混合模式只能作用于整层，所以单独一层。
 * - 操作层：高亮的选框和手柄、文字。
 */
export function AnnotationLayer({ page, zoom, interactive, draft }: Props) {
  if (page.annotations.length === 0 && !draft) return null;

  const highlights = page.annotations.filter((a) => a.type === 'highlight');
  const texts = page.annotations.filter((a) => a.type === 'text');
  const fills: { key: string; rect: Rect; color: string }[] = highlights.map((a) => ({ key: a.id, rect: a, color: a.color }));
  if (draft) fills.push({ key: 'draft', ...draft });

  const layerStyle = {
    width: page.width * zoom,
    height: page.height * zoom,
    transform: `translate(-50%, -50%) rotate(${displayRotation(page)}deg)`,
  };
  const box = (r: Rect) => ({ left: r.x * zoom, top: r.y * zoom, width: r.width * zoom, height: r.height * zoom });

  return (
    <>
      {fills.length > 0 && (
        <div className="annot-layer highlight-fills" style={layerStyle}>
          {fills.map((f) => (
            <div
              key={f.key}
              className="highlight-fill"
              style={{ ...box(f.rect), background: f.color, opacity: HIGHLIGHT_OPACITY }}
            />
          ))}
        </div>
      )}
      <div className="annot-layer" style={layerStyle}>
        {interactive &&
          highlights.map((a) => <HighlightBox key={a.id} page={page} annot={a} zoom={zoom} style={box(a)} />)}
        {texts.map((a) => (
          <TextBox key={a.id} page={page} annot={a} zoom={zoom} interactive={interactive} />
        ))}
      </div>
    </>
  );
}
