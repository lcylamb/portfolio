import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import { highlightCode } from './highlight';
import { BASE } from './i18n';

// 文章正文的编译。**只在服务端跑** —— 它读磁盘、引 markdown-it，
// 产物是一段 HTML 字符串。
//
// 换成 Next 之后这一块变了性质：原来是 `import raw from '...md?raw'`
// （Vite 的语法），把整篇 markdown 塞进 JS bundle，进了浏览器再编译。
// 现在是在构建期用 fs 读、编译成 HTML，直接写进静态文件。
// 结果：文章正文出现在 HTML 源码里，爬虫和「查看源代码」都拿得到。
//
// 新增文章的步骤：docs/ 下加一个 md 文件，然后在下面的 ARTICLES
// 里登记一条（slug / 标题 / 描述 / 日期）。路由、SEO 元信息、
// 静态导出都从这份登记表生成，不用再动别处。

export interface ArticleMeta {
  /** URL 片段，决定访问地址 /article/<slug>/（英文版 /en/article/<slug>/，slug 双语共用） */
  slug: string;
  file: string;
  title: string;
  description: string;
  date: string;
  /** 英文版的 md 文件、标题与描述。没有英文版时英文路由直接 404 */
  fileEn?: string;
  titleEn?: string;
  descriptionEn?: string;
}

export const ARTICLES: ArticleMeta[] = [
  {
    slug: 'dynamic-form-schema',
    file: '01-from-switch-to-schema.md',
    title: '我把一千三百多行的 if‑else 表单，重写成了一份 JSON',
    description:
      '一次真实的重构：把业务系统里硬编码的表单拆成 schema 驱动（字段名与业务域已脱敏）。四个具体问题、三个设计决定，以及重构付出的代价和边界。',
    date: '2026-09-22',
    fileEn: 'en/01-from-switch-to-schema.md',
    titleEn: 'I Rewrote an if-else Form of Over 1,300 Lines into JSON',
    descriptionEn:
      'A real rewrite: turning a hardcoded form into a schema-driven one (field names and business domain anonymized). Four concrete problems, three design decisions, and what it cost.',
  },
  {
    slug: 'js-garbage-collection',
    file: '02-js-garbage-collection.md',
    title: 'JS 垃圾回收机制：从引用计数到 V8 分代回收',
    description:
      '学习笔记：引用计数为什么怕循环引用，标记清除怎么产生碎片，V8 怎么用分代回收、Scavenge 和三色标记把这些问题一个个解决。',
    date: '2026-08-14',
    fileEn: 'en/02-js-garbage-collection.md',
    titleEn: "JS Garbage Collection: From Reference Counting to V8's Generational GC",
    descriptionEn:
      'Study notes: why reference counting fears circular references, how mark-and-sweep fragments the heap, and how V8 fixes both with generational GC, Scavenge, and tri-color marking.',
  },
  {
    slug: 'form-condition-evaluator',
    file: '03-form-condition-evaluator.md',
    title: '一百行的条件求值器，撑起整张动态表单',
    description:
      '表单引擎系列第二篇：schema 里的显隐、只读、条件必填是怎么被执行的。作用域解析、类型归一化、两个「宁可多显示」的宽容决定，以及为什么不做依赖收集。',
    fileEn: 'en/03-form-condition-evaluator.md',
    titleEn: 'A Hundred-Line Condition Evaluator Powers a Whole Dynamic Form',
    descriptionEn:
      'Part two of the form engine series: how the conditions behind visibility, disabled state and required-if rules actually get evaluated. Scopes, normalization, two deliberate fail-open decisions, and why there is no dependency tracking.',
    date: '2026-10-12',
  },
  {
    slug: 'permission-three-layers',
    file: '04-permission-three-layers.md',
    title: '后台系统的权限，只做路由层等于没做',
    description:
      '路由、按钮、数据三层权限各自的职责与实现：登录态和角色是两回事，前端权限是体验层不是安全边界，权限码的粒度在第一次需求变更前就要想好。',
    fileEn: 'en/04-permission-three-layers.md',
    titleEn: "Route Guards Alone Don't Make a Permission System",
    descriptionEn:
      'Route, action and data permissions each do a different job: login state is not a role, front-end permissions are UX not a security boundary, and permission-code granularity matters before the first requirement change.',
    date: '2026-07-09',
  },
  {
    slug: 'reactivity-defineproperty-to-proxy',
    file: '05-reactivity-defineproperty-to-proxy.md',
    title: 'Vue 响应式：从 defineProperty 到 Proxy',
    description:
      '学习笔记：Vue2 递归劫持的三个缺陷与它的补丁，Proxy 为什么是同一问题的更高抽象层级，Reflect 配合的真正原因，以及一个能跑的 mini reactive。',
    fileEn: 'en/05-reactivity-defineproperty-to-proxy.md',
    titleEn: 'Vue Reactivity: From defineProperty to Proxy',
    descriptionEn:
      "Study notes: the blind spots of recursive defineProperty and Vue2's patches, why Proxy is one level of abstraction higher, the real reason Reflect is required, and a mini reactive implementation you can run.",
    date: '2026-06-11',
  },
  {
    slug: 'fiber-time-slicing',
    file: '06-fiber-time-slicing.md',
    title: 'React Fiber：render 为什么可以停',
    description:
      '学习笔记：从递归调用栈到链表，时间切片怎么把长 render 塞进每帧空闲，render / commit 两阶段为什么边界画得那么硬，双缓存树的交换。垃圾回收那篇的姊妹篇。',
    fileEn: 'en/06-fiber-time-slicing.md',
    titleEn: 'React Fiber: Why Rendering Can Pause',
    descriptionEn:
      'Study notes: from a recursive call stack to a linked list, how time slicing fits long renders into idle frame time, why the render/commit boundary is so hard, and the double-buffered Fiber trees. A companion to the garbage collection post.',
    date: '2026-10-23',
  },
  {
    slug: 'miniprogram-webview',
    file: '07-miniprogram-webview.md',
    title: '小程序里嵌 H5：通信的两条路和四个坑',
    description:
      '实践笔记：H5 到小程序的消息为什么不实时，小程序到 H5 为什么只有 URL，登录态怎么安全打通，以及 postMessage、返回链路、业务域名几个真实的坑。',
    fileEn: 'en/07-miniprogram-webview.md',
    titleEn: 'Embedding H5 in a Mini Program: Two Channels, Four Pitfalls',
    descriptionEn:
      'Practice notes: why postMessage is not real-time, why URL parameters are the only channel back, how to share login state safely, and a few pitfalls that cost us half a day each.',
    date: '2026-05-18',
  },
];

function extractBody(source: string): string {
  // 正文从第一个一级标题开始
  const start = source.indexOf('\n# ');
  let body = start === -1 ? source : source.slice(start);

  // 「发布前检查」到文件结尾全部丢弃（如果有的话）
  const end = body.indexOf('## 发布前检查');
  if (end !== -1) body = body.slice(0, end);

  // 丢掉被切走的分隔线留下的尾巴
  body = body.replace(/\n-{3,}\s*$/, '');

  // 仓库地址还是占位符。宁可降级成纯文本，也不能让页面上出现「你的用户名」
  body = body.replace(
    /\[dynamic-form-engine\]\(https:\/\/github\.com\/[^)]*\)/,
    'dynamic-form-engine',
  );

  return body.trim();
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  // highlight 返回完整 <pre> 时 markdown-it 会跳过自己的包裹，
  // class 一并带上，样式由 .prose-article 侧统一给
  highlight(str, lang) {
    return `<pre class="article-code"><code class="hljs">${highlightCode(
      str,
      lang,
    )}</code></pre>`;
  },
});

// 文章 markdown 里写的图片路径是站内绝对路径（/diagrams/...）。
// 开了 basePath 之后 next/link、next/image 会被自动改写，
// 但 markdown 编译出来的裸 <img> 不会 —— 线上就会 404（GC 那篇踩过）。
// 在渲染层统一补前缀，markdown 源文件里维持干净的 /diagrams/... 写法。
const defaultImageRenderer = md.renderer.rules.image;
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const src = tokens[idx].attrGet('src');
  if (typeof src === 'string' && src.startsWith('/'))
    tokens[idx].attrSet('src', `${BASE}${src}`);
  return defaultImageRenderer!(tokens, idx, options, env, self);
};

export function getArticle(slug: string): ArticleMeta | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

/** 取某一语言版本的标题/描述；没有英文版时返回 undefined（调用方负责 404） */
export function getArticleMeta(
  slug: string,
  lang: 'zh' | 'en',
): { title: string; description: string; file: string } | undefined {
  const meta = getArticle(slug);
  if (!meta) return undefined;
  if (lang === 'en') {
    if (!meta.fileEn) return undefined;
    return {
      title: meta.titleEn ?? meta.title,
      description: meta.descriptionEn ?? meta.description,
      file: meta.fileEn,
    };
  }
  return { title: meta.title, description: meta.description, file: meta.file };
}

// 中文写 markdown 有个隐蔽的坑：CommonMark 规定「标点紧贴的定界符」不算合法的
// 强调边界。比如 `是**垃圾回收（GC）**替我们做的` —— 结尾 `**` 前面是全角 `）`
// （属于 punctuation），后面紧跟中文（既非空白也非标点），于是它不满足
// right-flanking 条件，闭合失败，页面上就会原样显示两个星号。
// 这类问题肉眼极难发现（源文件看着完全正常），所以在这里兜一道：
// 渲染完的 HTML 里如果还有裸的 `**`，说明有加粗没被解析，直接让构建失败。
// 代码块里的 `**` 是合法内容（比如幂运算、glob 语法），先剔掉再检查。
function assertNoStrayEmphasis(html: string, slug: string): void {
  const withoutCode = html.replace(/<pre[\s\S]*?<\/pre>/g, '');
  const stray = withoutCode.match(/.{0,40}\*\*.{0,40}/);
  if (stray) {
    throw new Error(
      `文章 ${slug} 里有没被解析的 ** 加粗，页面会原样显示星号：\n` +
        `  …${stray[0]}…\n` +
        `多半是 ** 紧贴了全角标点（如 ）」、）。把标点挪出加粗范围，或在 ** 两侧留一个空格。`,
    );
  }
}

export function renderArticle(slug: string, lang: 'zh' | 'en' = 'zh'): string {
  const meta = getArticleMeta(slug, lang);
  if (!meta) {
    throw new Error(`未登记的文章: ${slug} (${lang})`);
  }
  const file = path.join(process.cwd(), 'docs', meta.file);
  const html = md.render(extractBody(fs.readFileSync(file, 'utf8')));
  assertNoStrayEmphasis(html, slug);
  return html;
}
