# PDF Editor

纯前端的简单 PDF 编辑器（Vite + React + TypeScript + pdf.js）。

## 运行

```bash
npm install
npm run dev
```

运行单元测试：`npm test`

打开 http://localhost:5173 ，点击“打开 PDF”或把 PDF 拖进页面。`sample.pdf` 是测试文件。

## 进度

- [x] 阶段 1：打开 PDF、逐页渲染（懒加载）、缩放
- [x] 阶段 2：缩略图侧栏、拖拽排序、旋转、删除、多选、多文件合并
- [x] 阶段 3：导出（全部或只导出所选页面）
- [x] 阶段 4：文字标注（添加、拖动、编辑、字号、颜色，导出写入 PDF）
- [x] 阶段 5：高亮（拖出色块、移动、调整大小、换颜色，导出为半透明色块）
- [ ] 阶段 6：签名
- [ ] 阶段 7：中文字体、美化、部署
