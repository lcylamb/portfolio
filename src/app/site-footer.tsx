'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { localeFromPath } from '@/site/i18n';

// 页脚。做成客户端组件只有一个原因：html 的 lang 属性。
// 根 layout 是全站共用的一份 <html lang="zh-CN">，静态导出没法按路由换；
// 这里在英文页挂载后把 documentElement.lang 修正为 en，
// 让浏览器和读屏器拿到正确的语言声明（构建产物里的 /en/**/*.html
// 另有 scripts/set-en-lang.mjs 在构建后把源码里的 lang 也改掉，两层保险）。

export default function SiteFooter() {
  const pathname = usePathname();
  const lang = localeFromPath(pathname);

  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  }, [lang]);

  return (
    <footer className="grid-paper flex shrink-0 items-center justify-between gap-4 px-8 py-14 max-xs:flex-col max-xs:items-start max-xs:px-6 max-xs:py-10">
      {/* 页脚年份旁挂一行「网名 · GitHub 号」：简历跳过来的访客不用猜这站是谁的，
            也不用点进 About 才能找到仓库入口。 */}
      <span className="font-mono text-[13px] tracking-[-0.01em] text-dim">
        © 2026 ·{' '}
        <a
          className="text-dim no-underline transition-colors hover:text-ink"
          href="https://github.com/lcylamb"
          target="_blank"
          rel="noreferrer"
        >
          Pluvia · lcylamb
        </a>
      </span>
        {/* Playground 单语共享：两种语言都指向 /playground */}
        <Link
          className="rounded-md bg-[#111] px-5 py-2.5 font-mono text-[13px] text-white no-underline transition-colors hover:bg-[#383838]"
          href="/playground"
        >
        {lang === 'en' ? 'Open Playground' : '打开 Playground'}
      </Link>
    </footer>
  );
}
