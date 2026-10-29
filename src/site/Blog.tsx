// 博客列表页：站上全部文章，本站的和掘金的混在一起按时间排。
//
// 它是服务端组件，数据来自 site/posts —— 和首页「写过的东西」同一份，
// 加文章只改那一个文件。双语：文案按 lang 取，英文版由 /en/blog 复用。

import { POSTS, PostCard } from './posts';
import type { Locale } from './i18n';

const COPY = {
  zh: {
    h1: '写过的东西',
    intro: '重构里做过的取舍、啃原理时整理的笔记、以及踩过的坑。',
  },
  en: {
    h1: 'Writing',
    intro: 'Trade-offs from a real rewrite, notes on how JS actually works, and the pits I fell into.',
  },
} as const;

export default function Blog({ lang = 'zh' }: { lang?: Locale }) {
  const t = COPY[lang];
  // 排序全在 site/posts 里定：全站一律日期倒序，没有置顶分块。
  return (
    <div className="page-enter mx-auto max-w-[800px] px-6 pt-16 pb-24">
      <p className="m-0 mb-5 font-mono text-[11.5px] tracking-[0.18em] text-faint">
        WRITING
      </p>
      <h1 className="m-0 text-[30px] leading-[1.3] font-semibold tracking-[-0.015em] text-ink">
        {t.h1}
      </h1>
      <p className="mt-4 mb-9 max-w-[36em] text-[14.5px] leading-[1.85] text-body">
        {t.intro}
      </p>
      <div className="border-t border-line">
        {POSTS.map((post) => (
          <PostCard key={post.href} post={post} lang={lang} />
        ))}
      </div>
    </div>
  );
}
