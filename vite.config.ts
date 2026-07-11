import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

// 커스텀 도메인 sermon.onlybible.kr(루트 서빙)로 배포 → base='/'. (public/CNAME 참고)
// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [svelte(), tailwindcss()],
})
