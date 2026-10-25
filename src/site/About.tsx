// 关于页 = 关于这个人。
// 项目的事在「作品」和「文档」里已经讲完了，这一页不重复；
// 首页的定位句也不再复述 —— 这里讲首页没讲的：路径、家底、当下的状态。

import { BASE } from './i18n';

// 公开仓库里不点公司名，只留行业与角色。
// 业务背景（理赔、中后台）保留 —— 那是读者需要的信息量，公司名不是。
const TIMELINE = {
  zh: [
    {
      period: '2023.09 — 2026.08',
      company: '保险科技公司',
      role: '前端开发 · 理赔中后台 PC 端',
      body: '理赔系统的信息采集与自动理算模块。主要干了三件事：把字段和联动从代码里剥出来变成配置、把上百字段的大表格做顺、把长连接的推送与未读状态做稳。',
    },
    {
      period: '2022.02 — 2023.08',
      company: '互联网科技公司',
      role: '前端开发',
      body: '内部管理系统。业务页面、模块级公用组件，以及从线上日志里定位问题。',
    },
  ],
  en: [
    {
      period: '2023.09 — 2026.08',
      company: 'An insurtech company',
      role: 'Frontend engineer · Claims back-office (PC)',
      body: 'The intake and auto-calculation modules of a claims system. Three things, mainly: pulling fields and their dependencies out of code into configuration, making a hundred-field form usable, and keeping a long-lived push connection (with unread states) stable.',
    },
    {
      period: '2022.02 — 2023.08',
      company: 'An internet company',
      role: 'Frontend engineer',
      body: 'Internal management systems: business pages, shared module-level components, and tracking down production issues from server logs.',
    },
  ],
} as const;

const STACK = {
  zh: [
    { label: '语言与框架', items: 'TypeScript · React 18 · Vue 2 / 3' },
    { label: '中后台', items: 'Umi Max · Ant Design 5 · ProComponents' },
    { label: '工程化', items: 'Vite · Webpack · ESLint · Vitest' },
    { label: '服务端', items: 'Node.js · NestJS' },
    { label: '其它', items: '微信小程序 · LLM 应用接入' },
  ],
  en: [
    { label: 'Languages & frameworks', items: 'TypeScript · React 18 · Vue 2 / 3' },
    { label: 'Back-office', items: 'Umi Max · Ant Design 5 · ProComponents' },
    { label: 'Tooling', items: 'Vite · Webpack · ESLint · Vitest' },
    { label: 'Server', items: 'Node.js · NestJS' },
    { label: 'Also', items: 'WeChat mini programs · LLM integration' },
  ],
} as const;

const COPY = {
  zh: {
    h1: '关于',
    bio: '前端开发，现在深圳。过去四年做保险中后台——理算、核赔、调度这类流程长、字段多、错一笔要赔钱的系统。最近把其中最难的动态表单抽出来重做，也把过程写成了文章。',
    emailNote: '',
    pronun: 'Pluvia Verna — /ˈplu.wi.a ˈwer.na/（拉丁语的「春雨」）',
    expTitle: '做过什么',
    stackTitle: '技术栈',
    hikeTitle: '徒步',
    hikeBody: '周末大多不在城里。下面两张是路上随手拍的，更多在「照片」里。',
  },
  en: {
    h1: 'About',
    bio: 'Frontend developer in Shenzhen. Most of the past four years went into insurance back-office — calculation, adjudication, dispatch: long workflows, hundreds of fields, and mistakes that cost real money. Recently I rebuilt the hardest of those forms and wrote down how.',
    emailNote: '',
    pronun: 'Pluvia Verna — /ˈplu.wi.a ˈwer.na/ (Latin for "spring rain")',
    expTitle: 'Experience',
    stackTitle: 'Stack',
    hikeTitle: 'Hiking',
    hikeBody: "Most weekends I'm not in town. Two shots from the road below; more under Photos.",
  },
} as const;

// 各节共用：节标题（细线 + 15px），以及节里正文的段落/列表语域
const SECTION = 'mt-9';
const H2 = 'm-0 mb-3.5 flex items-center gap-3 text-[15px] font-semibold text-ink';
const P = 'mt-0 mb-2.5 leading-[1.75] text-body';

export default function About({ lang = 'zh' }: { lang?: 'zh' | 'en' }) {
  const t = COPY[lang];
  const timeline = TIMELINE[lang];
  const stack = STACK[lang];
  return (
    <div className="page-enter mx-auto max-w-[800px] px-6 pt-16 pb-20">
      <div>
        <p className="m-0 mb-5 font-mono text-[11.5px] tracking-[0.18em] text-faint">ABOUT</p>
        {/* 别的博客关于页的常规做法：一个朴素的开头，然后是平铺直叙的履历。
            「在看机会」不写在这里 —— 写出来整站就成了自我推销；
            看的人自己会从时间线（2026.08 截止）读出状态。 */}
        <h1 className="m-0 text-[30px] leading-[1.3] font-semibold tracking-[-0.015em] text-ink">{t.h1}</h1>
        <p className="mt-4 mb-0 max-w-[36em] text-[14.5px] leading-[1.85] text-body">
          {t.bio}
        </p>
        {/* 联系方式 + 网名出处。mono 小字贴在 bio 下面，像刊头下的刊号行。
            邮箱是唯一的公开联系方式；Pluvia Verna 是站名里 Pluvia 的出处
            （拉丁语「春雨」），读音常被问，索性自己写出来。 */}
        <div className="mt-5 mb-8 grid gap-1.5">
          <a
            className="w-fit font-mono text-[12.5px] text-dim no-underline transition-colors hover:text-ink"
            href="mailto:lcy_lamb@163.com"
          >
            lcy_lamb@163.com
          </a>
          <a
            className="w-fit font-mono text-[12.5px] text-dim no-underline transition-colors hover:text-ink"
            href="https://github.com/lcylamb"
            target="_blank"
            rel="noreferrer"
          >
            github.com/lcylamb
          </a>
          <span className="font-mono text-[12.5px] text-faint">{t.pronun}</span>
        </div>
      </div>

      <section className={SECTION}>
        <h2 className={H2}>{t.expTitle}<span aria-hidden className="h-px flex-1 bg-line" /></h2>
        <div>
          {timeline.map((item) => (
            <div
              className="grid grid-cols-[156px_minmax(0,1fr)] gap-5 border-b border-line py-[18px] last:border-b-0 last:pb-0 max-xs:grid-cols-1 max-xs:gap-1.5"
              key={item.period}
            >
              <span className="pt-0.5 font-mono text-xs tracking-[-0.02em] text-faint">
                {item.period}
              </span>
              <div>
                <h3 className="m-0 mb-1.5 text-[14.5px] font-medium text-ink">
                  {item.company}
                  <span className="ml-2.5 text-[12.5px] font-normal text-dim">
                    {item.role}
                  </span>
                </h3>
                {item.body && (
                  <p className="m-0 text-[13.5px] leading-[1.8] text-body">
                    {item.body}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>{t.stackTitle}<span aria-hidden className="h-px flex-1 bg-line" /></h2>
        <dl className="m-0">
          {stack.map((item) => (
            <div
              className="grid grid-cols-[110px_minmax(0,1fr)] gap-[18px] border-b border-line py-[11px] last:border-b-0 max-xs:grid-cols-1 max-xs:gap-0.5"
              key={item.label}
            >
              <dt className="text-[13px] text-dim">{item.label}</dt>
              <dd className="m-0 text-[13.5px] text-ink">{item.items}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>{t.hikeTitle}<span aria-hidden className="h-px flex-1 bg-line" /></h2>
        <p className={P}>{t.hikeBody}</p>
        {/* 与首页 hero 同一套摆法：无边框、小圆角 */}
        <div className="grid grid-cols-2 gap-3.5 max-xs:grid-cols-1">
          <img
            className="aspect-[3/2] w-full border border-line object-cover"
            src={`${BASE}/photos/photo-07.webp`}
            alt={lang === 'en' ? 'A road across the snowfield' : '雪原上的公路'}
            loading="lazy"
          />
          <img
            className="aspect-[3/2] w-full border border-line object-cover"
            src={`${BASE}/photos/photo-01.webp`}
            alt={lang === 'en' ? 'A horse caravan by a frozen lake' : '冰湖边的马队'}
            loading="lazy"
          />
        </div>
      </section>
    </div>
  );
}
