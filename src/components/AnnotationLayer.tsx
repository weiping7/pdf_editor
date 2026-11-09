import { displayRotation, type PageItem } from '../store/useDocStore';
import { TextBox } from './annotations/TextBox';

type Props = {
  page: PageItem;
  zoom: number;
  interactive: boolean;
};

/**
 * 标注层：大小等于“未旋转”的页面，再用 CSS 旋转到和 canvas 一样的方向。
 * 这样标注可以一直用页面坐标保存，不用关心页面怎么旋转。
 */
export function AnnotationLayer({ page, zoom, interactive }: Props) {
  if (page.annotations.length === 0) return null;
  return (
    <div
      className="annot-layer"
      style={{
        width: page.width * zoom,
        height: page.height * zoom,
        transform: `translate(-50%, -50%) rotate(${displayRotation(page)}deg)`,
      }}
    >
      {page.annotations.map((a) => (
        <TextBox key={a.id} page={page} annot={a} zoom={zoom} interactive={interactive} />
      ))}
    </div>
  );
}
