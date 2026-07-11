import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages 프로젝트 페이지(sewoongkim1.github.io/gocheok-sermons/)용 base.
// 커스텀 도메인(예: sermon.onlybible.kr) 전환 시 '/'로 바꾸고 public/CNAME 추가.
// https://vite.dev/config/
export default defineConfig({
  base: '/gocheok-sermons/',
  plugins: [svelte(), tailwindcss()],
})
