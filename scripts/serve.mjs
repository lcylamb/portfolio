// 本地预览静态导出产物。
//
// `output: 'export'` 之后没有 `next start` 可用了 —— 那要一个 Node 运行环境，
// 而导出产物里根本没有。所以这里给一个 40 行的静态服务器，
// 用来确认 out/ 里的东西真的能跑（顺便验证路由的文件名对不对）。
//
// 用 node 内置模块：不引依赖，也不依赖 npx 去网上拉东西。

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'out',
);
const port = Number(process.env.PORT ?? 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

if (!existsSync(root)) {
  console.error('没找到 out/ —— 先跑 npm run build');
  process.exit(1);
}

createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);

  // next.config.ts 开了 basePath 后，产物里的链接全部带 /portfolio 前缀。
  // 本地预览时把裸路径重定向过去，行为和线上 Pages 一致。
  if (url === '/' || !url.startsWith('/portfolio')) {
    res.writeHead(308, { location: `/portfolio${url === '/' ? '/' : url}` });
    res.end();
    return;
  }

  // basePath 只改写产物里的链接，不改导出目录结构 —— out/ 里没有
  // portfolio/ 这一层，所以剥掉前缀再落盘找文件。
  let file = path.join(root, url.replace(/^\/portfolio/, '') || '/');

  // 目录（含 trailingSlash 的 /about/）都落到它的 index.html 上
  if (existsSync(file) && statSync(file).isDirectory()) {
    file = path.join(file, 'index.html');
  }
  // 路径写错时退到 404.html，和真实静态托管的行为一致
  if (!existsSync(file)) file = path.join(root, '404.html');

  const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
  // 缓存策略：HTML 一律不缓存（改完构建刷新即见），带哈希的静态资源可以长缓存。
  // 之前不发任何缓存头，浏览器启发式缓存了旧 HTML —— 改动「看起来没生效」就是这么来的。
  const isAsset = url.startsWith('/_next/static/');
  res.writeHead(file.endsWith('404.html') ? 404 : 200, {
    'content-type': type,
    'cache-control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`静态产物预览： http://localhost:${port}`);
});
