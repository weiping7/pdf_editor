import { useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  drawStrokes,
  imageFileToPng,
  strokesToPng,
  type SignatureImageData,
  type Stroke,
} from '../lib/signature';
import { newId, useDocStore, type SavedSignature } from '../store/useDocStore';
import { CloseIcon } from './Icons';

/** 手写板的逻辑大小（CSS 像素）；实际显示时可以缩小，坐标会按比例换算 */
const PAD_W = 520;
const PAD_H = 180;
const LINE_WIDTH = 2.5;
const PEN_COLORS = [
  { color: '#111111', name: '黑色' },
  { color: '#1d3fb8', name: '蓝色' },
  { color: '#b91c1c', name: '红色' },
];

type Mode = 'draw' | 'upload';

/** 签名对话框：选一个保存过的签名，或者手写 / 上传一个新的 */
export function SignatureDialog() {
  const { savedSignatures, openSignatureDialog, startPlacingSignature, saveSignature, removeSavedSignature } =
    useDocStore();
  const [mode, setMode] = useState<Mode>('draw');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 手写
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [penColor, setPenColor] = useState(PEN_COLORS[0].color);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  // 上传
  const [file, setFile] = useState<File | null>(null);
  const [removeWhite, setRemoveWhite] = useState(true);
  const [uploaded, setUploaded] = useState<SignatureImageData | null>(null);

  const close = () => openSignatureDialog(false);

  // Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 笔画或颜色变了就重画（换颜色时已经写好的字也一起变色）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = PAD_W * dpr;
    canvas.height = PAD_H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    drawStrokes(ctx, strokes, penColor, LINE_WIDTH);
  }, [strokes, penColor, mode]);

  // 选了图片或者切换“去白底”时重新处理
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setError(null);
    imageFileToPng(file, removeWhite)
      .then((data) => !cancelled && setUploaded(data))
      .catch((err) => {
        if (cancelled) return;
        setUploaded(null);
        setError(err instanceof Error && err.message.startsWith('图片') ? err.message : '无法读取这张图片');
      });
    return () => {
      cancelled = true;
    };
  }, [file, removeWhite]);

  /** 鼠标位置 → 手写板坐标（手写板在小屏幕上会被缩小） */
  const padPoint = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * PAD_W) / r.width, y: ((e.clientY - r.top) * PAD_H) / r.height };
  };

  const onPadDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = padPoint(e); // 要在这里算：setStrokes 的回调执行时事件对象已经失效
    setStrokes((s) => [...s, [p]]);
  };

  const onPadMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const p = padPoint(e);
    setStrokes((s) => {
      const last = s[s.length - 1];
      const prev = last[last.length - 1];
      if (Math.hypot(p.x - prev.x, p.y - prev.y) < 1.5) return s; // 太近的点不要，线条更顺
      return [...s.slice(0, -1), [...last, p]];
    });
  };

  const onPadUp = () => {
    drawing.current = false;
  };

  const ready = mode === 'draw' ? strokes.length > 0 : !!uploaded;

  const useCurrent = () => {
    // 生成 PNG 比较慢，所以等点“放到页面上”时才生成
    const data = mode === 'draw' ? strokesToPng(strokes, penColor, LINE_WIDTH) : uploaded;
    if (!data) return;
    const sig: SavedSignature = { id: newId(), ...data };
    if (remember) saveSignature(sig);
    startPlacingSignature(sig);
  };

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="sig-title">
        <div className="modal-header">
          <h2 id="sig-title">签名</h2>
          <button className="mini-btn" onClick={close} title="关闭（Esc）">
            <CloseIcon size={14} />
          </button>
        </div>

        {savedSignatures.length > 0 && (
          <section className="saved-sigs">
            <div className="modal-subtitle">已保存的签名（点一下使用）</div>
            <div className="saved-sig-list">
              {savedSignatures.map((s) => (
                <div key={s.id} className="saved-sig">
                  <button className="saved-sig-btn" onClick={() => startPlacingSignature(s)} title="使用这个签名">
                    <img src={s.image} alt="已保存的签名" />
                  </button>
                  <button
                    className="saved-sig-remove"
                    onClick={() => removeSavedSignature(s.id)}
                    title="从这个浏览器里删除"
                    aria-label="删除这个签名"
                  >
                    <CloseIcon size={10} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'draw'} className={mode === 'draw' ? 'active' : ''} onClick={() => setMode('draw')}>
            手写
          </button>
          <button role="tab" aria-selected={mode === 'upload'} className={mode === 'upload' ? 'active' : ''} onClick={() => setMode('upload')}>
            上传图片
          </button>
        </div>

        {mode === 'draw' ? (
          <div className="sig-draw">
            <div className="sig-pad-wrap">
              <canvas
                ref={canvasRef}
                className="sig-pad"
                onPointerDown={onPadDown}
                onPointerMove={onPadMove}
                onPointerUp={onPadUp}
                onPointerCancel={onPadUp}
              />
              {strokes.length === 0 && <div className="sig-pad-hint">在这里用鼠标或手指写下签名</div>}
              <div className="sig-pad-line" />
            </div>
            <div className="sig-tools">
              <div className="swatches">
                {PEN_COLORS.map((p) => (
                  <button
                    key={p.color}
                    className={`swatch${penColor === p.color ? ' active' : ''}`}
                    style={{ background: p.color }}
                    title={p.name}
                    onClick={() => setPenColor(p.color)}
                  />
                ))}
              </div>
              <button className="btn" onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={!strokes.length}>
                撤销一笔
              </button>
              <button className="btn" onClick={() => setStrokes([])} disabled={!strokes.length}>
                清除
              </button>
            </div>
          </div>
        ) : (
          <div className="sig-upload">
            <label className="btn sig-file-btn">
              {file ? '换一张图片' : '选择图片'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
            </label>
            <label className="check">
              <input type="checkbox" checked={removeWhite} onChange={(e) => setRemoveWhite(e.target.checked)} />
              去掉白色背景（拍照或扫描的签名建议勾选）
            </label>
            <div className="sig-preview">
              {uploaded ? <img src={uploaded.image} alt="签名预览" /> : <span>支持 PNG、JPG，在白纸上签名后拍照即可</span>}
            </div>
          </div>
        )}

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-footer">
          <label className="check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            记住这个签名（只保存在这个浏览器里）
          </label>
          <div className="modal-actions">
            <button className="btn" onClick={close}>
              取消
            </button>
            <button className="btn primary" disabled={!ready} onClick={useCurrent}>
              放到页面上
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
