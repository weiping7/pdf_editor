/**
 * 字体子集化：从完整字体里只取出用到的字，生成一个很小的新字体再嵌入 PDF。
 *
 * pdf-lib 自带的子集功能（fontkit）处理思源黑体时会把很多字弄坏（导出后显示为空白），
 * 所以改用 HarfBuzz（Chrome、Android 等用的文字引擎）的 WebAssembly 版本来做。
 * 它直接调用 HarfBuzz 的 C 接口（hb_subset_*），只在导出含中文的 PDF 时才加载。
 */

type HbExports = {
  memory: WebAssembly.Memory;
  malloc(size: number): number;
  free(ptr: number): void;
  hb_blob_create(data: number, length: number, mode: number, userData: number, destroy: number): number;
  hb_blob_destroy(blob: number): void;
  hb_blob_get_data(blob: number, lengthPtr: number): number;
  hb_blob_get_length(blob: number): number;
  hb_face_create(blob: number, index: number): number;
  hb_face_destroy(face: number): void;
  hb_face_reference_blob(face: number): number;
  hb_set_add(set: number, codepoint: number): void;
  hb_subset_input_create_or_fail(): number;
  hb_subset_input_destroy(input: number): void;
  hb_subset_input_unicode_set(input: number): number;
  hb_subset_or_fail(face: number, input: number): number;
};

const HB_MEMORY_MODE_WRITABLE = 2;

let hb: Promise<HbExports> | null = null;

/** 加载 HarfBuzz（只加载一次） */
export function loadHarfBuzz(wasm: () => Promise<BufferSource>): Promise<HbExports> {
  hb ??= wasm()
    .then((bytes) => WebAssembly.instantiate(bytes))
    .then(({ instance }) => instance.exports as unknown as HbExports)
    .catch((err) => {
      hb = null;
      throw err;
    });
  return hb;
}

/**
 * 只保留 text 里出现的字符
 * @returns 新字体文件的字节
 */
export function subsetFont(h: HbExports, font: ArrayBuffer | Uint8Array, text: string): Uint8Array {
  const src = font instanceof Uint8Array ? font : new Uint8Array(font);
  const fontPtr = h.malloc(src.byteLength);
  // wasm 内存可能会变大，每次用的时候都重新取
  new Uint8Array(h.memory.buffer).set(src, fontPtr);

  const blob = h.hb_blob_create(fontPtr, src.byteLength, HB_MEMORY_MODE_WRITABLE, 0, 0);
  const face = h.hb_face_create(blob, 0);
  h.hb_blob_destroy(blob);

  const input = h.hb_subset_input_create_or_fail();
  if (!input) {
    h.hb_face_destroy(face);
    h.free(fontPtr);
    throw new Error('字体处理失败（内存不足）');
  }
  const unicodes = h.hb_subset_input_unicode_set(input);
  // 总是带上空格：如果 text 里的字字体全都没有，结果里至少还有一个字，字体仍然合法
  for (const ch of new Set(text + ' ')) h.hb_set_add(unicodes, ch.codePointAt(0)!);

  const result = h.hb_subset_or_fail(face, input);
  h.hb_subset_input_destroy(input);
  h.hb_face_destroy(face);
  if (!result) {
    h.free(fontPtr);
    throw new Error('字体处理失败');
  }

  const outBlob = h.hb_face_reference_blob(result);
  const ptr = h.hb_blob_get_data(outBlob, 0);
  const len = h.hb_blob_get_length(outBlob);
  const out = new Uint8Array(h.memory.buffer, ptr, len).slice(); // 复制出来，wasm 内存马上要释放
  h.hb_blob_destroy(outBlob);
  h.hb_face_destroy(result);
  h.free(fontPtr);
  if (len === 0) throw new Error('字体处理失败');
  return out;
}
