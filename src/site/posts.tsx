// 站上「写过的东西」的唯一数据源。
//
// 首页只放最近几条、博客页放全部，两处共用这份列表和同一张卡片组件 ——
// 不然加一篇文章要改两个地方，迟早会有一边漏掉。
//
// 双语：每条带中英两份标题/摘要。站内文章的 href 是中文路径；
// 英文侧由 PostCard 按 lang 加 /en 前缀（文章 slug 双语一致，所以不用单独存英文 href）。
// 没写 titleEn 的文章还没有英文版：英文列表里照登中文标题，链接回落中文页。
//
// 注意这里的数据和 site/article-content.ts 的 ARTICLES 是两回事：
// ARTICLES 管的是「本站有正文的文章」（决定路由和 SEO 元信息），
// POSTS 管的是「对外展示的文章列表」。
// 两边靠 slug 对齐。

import Link from 'next/link';
import { lp, type Locale } from './i18n';

export interface Post {
  date: string;
  title: string;
  note: string;
  /** 站内用 /article/xxx，站外用完整 URL */
  href: string;
  titleEn?: string;
  noteEn?: string;
  /** 置顶：表单引擎系列（站点的原创主线） */
  featured?: boolean;
}

export const POSTS: Post[] = [
  {
    date: '2026-09-22',
    title: '我把一千三百多行的 if‑else 表单，重写成了一份 JSON',
    note: '四个具体问题、三个设计决定，以及重构付出的代价和边界',
    featured: true,
    href: '/article/dynamic-form-schema',
    titleEn: 'I Rewrote an if-else Form of Over 1,300 Lines into JSON',
    noteEn:
      'Four concrete problems, three design decisions, and what the rewrite cost',
  },
  {
    date: '2026-10-12',
    title: '一百行的条件求值器，撑起整张动态表单',
    note: '表单引擎系列第二篇：schema 里的联动条件是怎么被执行的',
    featured: true,
    href: '/article/form-condition-evaluator',
    titleEn: 'A Hundred-Line Condition Evaluator Powers a Whole Dynamic Form',
    noteEn:
      'Part two of the form engine series: how the conditions behind visibility and required-if rules actually get evaluated',
  },
  {
    date: '2026-10-23',
    title: 'React Fiber：render 为什么可以停',
    note: '时间切片、两阶段提交、双缓存树——垃圾回收那篇的姊妹篇',
    href: '/article/fiber-time-slicing',
    titleEn: 'React Fiber: Why Rendering Can Pause',
    noteEn:
      'Time slicing, two-phase commit, double-buffered trees — a companion to the garbage collection post',
  },
  {
    date: '2026-08-14',
    title: 'JS 垃圾回收机制：从引用计数到 V8 分代回收',
    note: '引用计数为什么怕循环引用、标记清除怎么产生碎片，V8 用分代回收一一解决',
    href: '/article/js-garbage-collection',
    titleEn: "JS Garbage Collection: From Reference Counting to V8's Generational GC",
    noteEn:
      'Why reference counting fears cycles and mark-and-sweep leaks fragments — and how V8 solves both with generational GC',
  },
  {
    date: '2026-07-09',
    title: '后台系统的权限，只做路由层等于没做',
    note: '路由、按钮、数据三层权限各自的职责与实现，以及权限码粒度怎么定',
    href: '/article/permission-three-layers',
    titleEn: "Route Guards Alone Don't Make a Permission System",
    noteEn:
      'Route, action and data permissions each do a different job — and permission-code granularity matters before the first requirement change',
  },
  {
    date: '2026-06-11',
    title: 'Vue 响应式：从 defineProperty 到 Proxy',
    note: '三个缺陷与它的补丁、Proxy 为什么是更高一级的抽象、Reflect 配合的真正原因',
    href: '/article/reactivity-defineproperty-to-proxy',
    titleEn: 'Vue Reactivity: From defineProperty to Proxy',
    noteEn:
      'The blind spots of recursive defineProperty, why Proxy is one abstraction level higher, and the real reason Reflect is required',
  },
  {
    date: '2026-05-18',
    title: '小程序里嵌 H5：通信的两条路和四个坑',
    note: 'postMessage 为什么不实时、登录态怎么安全打通，以及几个查了半天的坑',
    href: '/article/miniprogram-webview',
    titleEn: 'Embedding H5 in a Mini Program: Two Channels, Four Pitfalls',
    noteEn:
      'Why postMessage is not real-time, why URL parameters are the only channel back, and how to share login state safely',
  },
];

// 文章条目：编辑部式的清单行，不是卡片。
// mono 日期靠左、标题和中段摘要在右 —— 两栏基线对齐，
// 行与行之间只用细线分隔。悬停只动标题颜色，不抬、不投影。
export function PostCard(props: { post: Post; lang: Locale }) {
  const { post, lang } = props;
  const title = lang === 'en' && post.titleEn ? post.titleEn : post.title;
  const note = lang === 'en' && post.noteEn ? post.noteEn : post.note;
  // 站内文章的英文地址 = 中文 href 加 /en 前缀；站外链接原样。
  // 没有英文版的文章（没写 titleEn）回落到中文页，比给一个 404 链接诚实。
  const href =
    post.href.startsWith('http')
      ? post.href
      : lang === 'en' && post.titleEn
        ? lp(lang, post.href)
        : post.href;
  const skin =
    'group grid grid-cols-[86px_minmax(0,1fr)] items-baseline gap-5 border-b border-line py-[17px] no-underline max-xs:grid-cols-[86px_minmax(0,1fr)]';
  const inner = (
    <>
      <span className="font-mono text-[12px] text-faint">{post.date}</span>
      <span>
        <strong className="text-[15.5px] leading-[1.5] font-medium text-ink transition-colors group-hover:text-accent">
          {title}
        </strong>
        <span className="mt-1 block text-[13px] leading-[1.7] text-dim">
          {note}
        </span>
      </span>
    </>
  );

  // 站内走 Link（前端路由，不整页刷新），站外才用 <a target="_blank">
  if (post.href.startsWith('http')) {
    return (
      <a className={skin} href={href} target="_blank" rel="noreferrer">
        {inner}
      </a>
    );
  }
  return (
    <Link className={skin} href={href}>
      {inner}
    </Link>
  );
}
