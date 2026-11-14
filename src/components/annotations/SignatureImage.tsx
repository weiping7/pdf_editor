import type { SignatureAnnotation } from '../../store/useDocStore';

/**
 * 签名图片，铺满外面的框。图片自己转了 90°/270° 时，宽高要和框反过来，
 * 再绕中心转回去。
 */
export function SignatureImage({ annot }: { annot: SignatureAnnotation }) {
  const sideways = annot.rotation % 180 !== 0;
  return (
    <img
      className="signature-img"
      src={annot.image}
      alt="签名"
      draggable={false}
      style={{
        width: sideways ? `${(annot.height / annot.width) * 100}%` : '100%',
        height: sideways ? `${(annot.width / annot.height) * 100}%` : '100%',
        transform: `translate(-50%, -50%) rotate(${annot.rotation}deg)`,
      }}
    />
  );
}
