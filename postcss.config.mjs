// Tailwind v4 在 Next 下走 PostCSS 插件（没有 Vite 插件那条路了）。
// v4 不需要 tailwind.config.js：配置全写在 CSS 的 @theme / @utility 里，
// 所以这个文件只有一行。
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
