import type { NextConfig } from 'next';

/**
 * 静态导出。
 *
 * 这个站没有一个页面需要在请求时才算得出来：文章在构建期就定死了，
 * Playground 是纯客户端的，照片是静态文件。所以 `output: 'export'`
 * 之后产物就是一堆 HTML/CSS/JS，扔到任何静态托管上都能跑 ——
 * 不需要 Node 运行环境，也就不会有「服务器上的东西」要维护。
 *
 * 换来的代价只有一条：用不了 Route Handler / ISR / 中间件这类运行时能力。
 * 对这个站来说一条都用不上。
 */
const nextConfig: NextConfig = {
  output: 'export',

  // 导出产物里每个路由落成 index.html，链接带尾斜杠：
  // /about/ → about/index.html。绝大多数静态托管（含 GitHub Pages）靠这个找文件。
  trailingSlash: true,

  // 静态导出没有服务端图片优化进程，next/image 在这里只会报错。
  // 照片本来就是自己压好的（1600px / 76 质量），不需要框架再处理一次。
  images: { unoptimized: true },

  // 部署在 GitHub Pages 的项目子路径：https://lcylamb.github.io/portfolio/
  // 站内链接和静态资源会自动带上这个前缀。
  basePath: '/portfolio',
  assetPrefix: '/portfolio/',
};

export default nextConfig;
