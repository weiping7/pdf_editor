# PDF Editor

纯前端的简单 PDF 编辑器（Vite + React + TypeScript + pdf.js + pdf-lib）。
所有处理都在浏览器里完成，文件不会上传到任何服务器。

## 功能

- **页面**：打开多个 PDF 合并，缩略图拖拽排序、旋转、删除，导出全部或只导出选中的页面
- **文字**：添加、拖动、编辑，字号和颜色，支持中文（7000 多个常用简体字）
- **高亮**：拖出半透明色块，可移动、调整大小、换颜色
- **签名**：手写或上传签名图片（自动去白底），可保存常用签名，拖动和等比例缩放
- 手机上也能用；关闭网页前会提醒还没导出的修改

快捷键：`T` 文字、`H` 高亮、`Esc` 取消、`Delete` 删除选中的标注（焦点在侧栏时删除页面）、
`Enter` 编辑选中的文字、`Ctrl+A` 选中所有页面（侧栏里）。

## 运行

```bash
npm install
npm run dev
```

打开 http://localhost:5173 ，点击“打开 PDF”或把 PDF 拖进页面。`sample.pdf` 是测试文件。

- 单元测试：`npm test`
- 构建：`npm run build`（输出到 `dist/`，可以放到任何静态网站上，包括子目录）

## 部署到 GitHub Pages

已经配置好 GitHub Actions（`.github/workflows/deploy.yml`），每次推送到 `main` 分支会自动测试、构建并发布。

第一次需要在 GitHub 上打开一次：仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。
之后网址是 `https://<用户名>.github.io/<仓库名>/`。

## 中文字体

导出中文用的是思源黑体（Noto Sans SC，SIL Open Font License，见 `src/assets/fonts/OFL.txt`）。
完整字体 10MB 太大，所以只保留了 GB2312 的 7445 个字符（简体常用字、标点、全角符号），约 2.2MB，
只在页面上出现中文时才下载。导出时再用 HarfBuzz（WebAssembly）只取出用到的字嵌入 PDF，PDF 只会增加几 KB。

> pdf-lib 自带的字体子集功能（fontkit）会把思源黑体的很多字弄坏，所以没有用它，见 `src/lib/subsetFont.ts`。

字体文件的生成方法（需要 Python 和 `pip install fonttools`）：

```bash
python3 -c "print(''.join(sorted({bytes([a,b]).decode('gb2312','ignore') for a in range(0xA1,0xF8) for b in range(0xA1,0xFF)} - {''})))" > gb2312.txt
pyftsubset NotoSansSC-Regular.ttf --text-file=gb2312.txt \
  --unicodes=U+0020-007E,U+00A0-00FF,U+2000-206F,U+2190-21FF,U+2460-24FF,U+25A0-25FF,U+3000-303F,U+FF00-FFEF \
  --layout-features= --drop-tables+=vhea,vmtx,BASE,STAT,GDEF,GPOS,GSUB --no-hinting \
  --name-IDs=0,1,2,3,4,5,6 --output-file=src/assets/fonts/NotoSansSC-GB2312.ttf
```

## 目前的限制

- 没有撤销 / 重做
- 不能修改 PDF 里原有的文字，只能在上面加文字、高亮和签名
- 有密码的 PDF 暂时不能导出
- 中文只支持 GB2312 里的字（不支持繁体和生僻字），遇到不支持的字导出时会提示是哪个字

## 进度

- [x] 阶段 1：打开 PDF、逐页渲染（懒加载）、缩放
- [x] 阶段 2：缩略图侧栏、拖拽排序、旋转、删除、多选、多文件合并
- [x] 阶段 3：导出（全部或只导出所选页面）
- [x] 阶段 4：文字标注（添加、拖动、编辑、字号、颜色，导出写入 PDF）
- [x] 阶段 5：高亮（拖出色块、移动、调整大小、换颜色，导出为半透明色块）
- [x] 阶段 6：签名（手写或上传图片、保存常用签名、拖动和等比例缩放，导出为图片）
- [x] 阶段 7：中文字体、手机界面、关闭前提醒、部署到 GitHub Pages
