// 首页 = 这个人是谁、在做什么、写过什么。
// 不放对比图、不放特性网格 —— 那些是作品页的事，首页只负责「认识一下」。
//
// 这一页是服务端组件：没有状态、没有事件，编译出来就是静态 HTML。
// 双语：文案按 lang 取，英文版由 /en 路由复用本组件。

import Link from 'next/link';
import type { ReactNode } from 'react';
import { POSTS, PostCard } from './posts';
import { BASE, lp, type Locale } from './i18n';

// 首页只放最近这几篇，全部列表在 /blog。数字写死在这里反而容易对不上，
// 所以条数由「取前几条」决定，「全部 N 篇」的 N 直接读列表长度。
const HOME_POST_LIMIT = 3;

// hero 右侧的照片。以后照片多了可以定期换一张。
const PHOTOS = [
  { src: '/photos/photo-06.webp', alt: '湖对岸的雪山', altEn: 'Snow mountains across the lake' },
];

const COPY = {
  zh: {
    eyebrow: '4 年前端 · 深圳 · 保险 / 中后台',
    p1: '前四年在保险中后台，写过不少表单。最烦的那张，最近被我抽出来重写，现在它只是一份 JSON。',
    p2: '现在在做 LLM 应用：把模型接进业务后端，用评测而不是感觉判断它靠不靠谱。',
    workTitle: '在做的东西',
    writingTitle: '写过的东西',
    moreWorks: '去作品页看细节 →',
    allPosts: (n: number) => `全部 ${n} 篇 →`,
    items: [
      {
        title: '动态表单引擎',
        desc: '把业务系统里一千三百多行的硬编码表单，重新设计成 schema 驱动。44 个纯逻辑单测，在线就能玩。',
      },
      {
        title: 'WebPilot',
        desc: '自然语言驱动的浏览器自动化 Agent：手写 ReAct 执行循环，Playwright 操作浏览器，每一步的思考和截图流式展示在界面上。',
      },
      {
        title: 'LLM 问答 BFF',
        desc: '把 LLM 接进业务后端的参考实现：NestJS 分层、结构化输出、SSE 流式、23 条评测用例。已部署，点开就能问。',
      },
    ],
  },
  en: {
    eyebrow: '4 yrs frontend · Shenzhen · insurance / back-office',
    p1: 'Four years of insurance back-office work, and a lot of forms. The one I hated most is now just a JSON file.',
    p2: 'These days I put LLMs into business backends, and judge them with evals rather than gut feel.',
    workTitle: 'Current work',
    writingTitle: 'Writing',
    moreWorks: 'Details on the Works page →',
    allPosts: (n: number) => `All ${n} posts →`,
    items: [
      {
        title: 'Dynamic Form Engine',
        desc: 'A 1,300-line hardcoded form, redesigned as schema-driven JSON. 44 pure-logic unit tests, playable in the browser.',
      },
      {
        title: 'WebPilot',
        desc: 'A browser-automation agent driven by plain language: hand-written ReAct loop, Playwright under the hood, every thought and screenshot streamed to the UI.',
      },
      {
        title: 'LLM Q&A BFF',
        desc: 'A reference implementation of LLM in a business backend: NestJS layering, structured output, SSE streaming, 23 eval cases. Deployed and live.',
      },
    ],
  },
} as const;

export default function Home({ lang = 'zh' }: { lang?: Locale }) {
  const t = COPY[lang];
  return (
    <div className="page-enter mx-auto max-w-[960px] px-6 pt-20 pb-24">
      {/* hero：左文右图，两栏底边对齐。
          眉题（mono 小字）— 大字名 — 正文，三级的字号落差拉开了层级；
          照片方角 + 细边，像杂志里的插图而不是卡片。 */}
      <section className="grid grid-cols-[minmax(0,1fr)_340px] items-end gap-14 max-[900px]:grid-cols-1 max-[900px]:gap-7">
        <div>
          <p className="m-0 mb-7 font-mono text-[11.5px] tracking-[0.18em] text-faint">
            {t.eyebrow}
          </p>
          <h1 className="m-0 text-[64px] leading-[1.06] font-semibold tracking-[-0.03em] text-ink max-xs:text-[42px]">
            Pluvia
          </h1>
          <div className="mt-8 grid gap-4">
            {/* 首页只做定位和钩子，一句话走人 —— 履历细节
                是关于页的事，这里再说一遍就成了两次自我介绍。
                不写「就是下面第一个」这类指路句 —— 博客不导购。 */}
            <p className="m-0 max-w-[34em] text-[15.5px] leading-[2] text-body">
              {t.p1}
            </p>
            <p className="m-0 max-w-[34em] text-[15.5px] leading-[2] text-body">
              {t.p2}
            </p>
          </div>
        </div>
        <figure className="m-0">
          {PHOTOS.map((photo) => (
            <img
              className="block aspect-[3/2] w-full border border-line object-cover"
              key={photo.src}
              src={`${BASE}${photo.src}`}
              alt={lang === 'en' ? photo.altEn : photo.alt}
            />
          ))}
        </figure>
      </section>

      <Section index="01" title={t.workTitle}>
        {/* 三张等高卡片是 AI 落地页的标准配方。改成细线分隔的行：
            左标题右描述，扫起来快，也更像一个人整理的索引而不是产品页。 */}
        <div className="border-t border-line">
          {t.items.map((item) => (
            <Link
              className="group grid grid-cols-[176px_minmax(0,1fr)] gap-5 border-b border-line py-[15px] no-underline max-xs:grid-cols-1 max-xs:gap-1"
              href={lp(lang, '/works')}
              key={item.title}
            >
              <h3 className="m-0 text-[14.5px] leading-[1.7] font-medium text-ink transition-colors group-hover:text-accent">
                {item.title}
              </h3>
              <p className="m-0 text-[13px] leading-[1.8] text-dim">{item.desc}</p>
            </Link>
          ))}
        </div>
        <Link
          className="mt-4 inline-block text-[13.5px] text-accent no-underline hover:underline"
          href={lp(lang, '/works')}
        >
          {t.moreWorks}
        </Link>
      </Section>

      <Section index="02" title={t.writingTitle}>
        <div className="border-t border-line">
          {POSTS.slice(0, HOME_POST_LIMIT).map((post) => (
            <PostCard key={post.href} post={post} lang={lang} />
          ))}
        </div>
        <Link
          className="mt-4 inline-block text-[13.5px] text-accent no-underline hover:underline"
          href={lp(lang, '/blog')}
        >
          {t.allPosts(POSTS.length)}
        </Link>
      </Section>
    </div>
  );
}

// 章节标题：mono 序号 + 标题 + 一条延伸到行尾的细线。
// 章节之间的分隔靠这条线而不是卡片边框，页面更像「排出来的」而不是「装进去的」。
function Section(props: {
  index: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-20">
      <div className="mb-5 flex items-center gap-4">
        <span className="font-mono text-[11.5px] tracking-[0.1em] text-accent">
          {props.index}
        </span>
        <h2 className="m-0 text-[16px] font-semibold tracking-[0.02em] text-ink">
          {props.title}
        </h2>
        <span aria-hidden className="h-px flex-1 bg-line" />
      </div>
      {props.children}
    </section>
  );
}
