import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 用相对路径，这样放在任何子目录下都能打开（比如 GitHub Pages 的 https://用户名.github.io/pdf_editor/）
  base: './',
})
