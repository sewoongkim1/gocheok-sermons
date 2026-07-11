import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages(커스텀 도메인)에서는 루트 배포이므로 base='/'.
// 프로젝트 페이지(user.github.io/repo)로 배포할 경우 '/gocheok-sermons/'로 바꾸세요.
// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [svelte(), tailwindcss()],
})
