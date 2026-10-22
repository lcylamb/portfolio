// 构建后修正：把 out/en/** 下所有 HTML 的 <html lang="zh-CN"> 改成 lang="en"。
//
// 为什么需要它：根 layout 只有一份 <html>，静态导出没法按路由换 lang 属性；
// 运行时的修正由 SiteFooter（客户端组件）的 useEffect 兜底，
// 但爬虫看的是静态源码，所以源码里也要对 —— 在这里补。
//
// 用法：next build 之后跑（package.json 的 build 脚本已串联）。

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const EN_DIR = join(process.cwd(), 'out', 'en');

let count = 0;

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p);
    } else if (entry.name.endsWith('.html')) {
      const html = readFileSync(p, 'utf8');
      if (html.includes('<html lang="zh-CN"')) {
        writeFileSync(p, html.replace('<html lang="zh-CN"', '<html lang="en"'));
        count++;
      }
    }
  }
}

try {
  walk(EN_DIR);
  console.log(`set-en-lang: ${count} file(s) under out/en/ → lang="en"`);
} catch {
  console.log('set-en-lang: out/en/ 不存在，跳过（本次构建没有英文页？）');
}
