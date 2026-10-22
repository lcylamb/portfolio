// 作品页。每个作品一段实话：做了什么、能做到哪、还差什么。
// 状态照实写 —— 公开页面上的夸大描述，撑不过任何一次追问。
// 双语：文案按 lang 取，英文版由 /en/works 复用本组件。

import { Btn } from './ui';
import { lp, type Locale } from './i18n';

const ENGINE_POINTS = {
  zh: [
    '条件可序列化：显隐、只读、条件必填统一为 { field, op, value } 表达式，后端可直接下发；表达力上限是有意收窄的',
    '「被校验 ⇔ 被提交」是测试钉住的不变量，例外只有只读字段和锁定的单元格',
    '纯逻辑层零依赖：path / schema / controller 不 import React、不碰 DOM，44 个单测在 node 直跑',
    '控件注册表：换 antd 或自研组件库，只改一个文件',
  ],
  en: [
    'Conditions are serializable: visibility, readonly and conditional required are all { field, op, value } expressions the backend can deliver directly; the expressive ceiling is deliberately low',
    '"Validated ⇔ submitted" is an invariant pinned by tests; the only exceptions are readonly fields and locked cells',
    'The pure-logic layer has zero dependencies: path / schema / controller import no React and touch no DOM — all 44 tests run in plain node',
    'Widget registry: swapping antd or a custom library means changing exactly one file',
  ],
} as const;

const PILOT_POINTS = {
  zh: [
    '手写 ReAct 执行循环（决策 → 工具调用 → 观察 → 再决策），不依赖任何 Agent 框架，function calling 的每一步都看得见',
    '9 个浏览器工具：导航 / 快照 / 可访问性树 / 点击 / 输入 / 下拉选择 / 按键 / 文本断言 / 数量断言；断言带轮询等待，动态页面元素延迟出现也能正确判定',
    '用可访问性树给模型提供「元素 → 建议 CSS 选择器」的映射，比塞整段 DOM 省 token、定位更稳',
    '失败反思重试（Reflexion）：断言失败或工具报错时强制模型先分析原因、换策略，禁止原样重试',
    '任务记忆（RAG）：本地多语言 embedding + 向量检索，任务经验确定性摘要后跨任务复用——同一任务第二次跑命中经验、步数更少',
    'MCP 双角色：既是暴露 9 个工具的 MCP Server，也能作为 Host 挂载外部 MCP Server',
    '可复现评测：8 条固定用例（待办 / 保险报案 / 门户），npm run verify 输出步数与 token 成本，通过率 8/8；另在 TodoMVC、SauceDemo、the-internet 等真实站点跑了 10+ 场景，过程中抓出并修复了断言不等待的工具层缺陷',
    '安全护栏：域名白名单、最大步数、整体超时；部署态支持访问口令 + 每日用量配额（SQLite 持久化），带 Dockerfile 与 compose',
  ],
  en: [
    'A hand-written ReAct loop (decide → call tool → observe → decide again); no agent framework — every function-calling step is visible',
    '9 browser tools: navigate / snapshot / accessibility tree / click / type / select / key / text assertion / count assertion; assertions poll with a wait budget, so lazily-rendered elements are judged correctly',
    "The accessibility tree gives the model an 'element → suggested CSS selector' mapping — cheaper in tokens and more stable than feeding it the whole DOM",
    'Reflexion: on failed assertions or tool errors the model must analyze the cause and change strategy — repeating the same call verbatim is blocked',
    'Task memory (RAG): local multilingual embeddings + vector retrieval; task experience is deterministically summarized and reused — a repeated task hits the memory and finishes in fewer steps',
    'MCP both ways: exposes its 9 tools as an MCP Server, and acts as an MCP Host mounting external servers',
    'Reproducible eval: 8 fixed cases (todo / insurance claim / portal) via npm run verify with step counts and token costs — 8/8 passing; plus 10+ scenarios on real sites (TodoMVC, SauceDemo, the-internet), which surfaced and fixed a real assertion-without-waiting bug',
    'Guardrails: domain allowlist, max steps, overall timeout; deployed mode adds an access token and a persisted daily usage quota (SQLite), with Dockerfile and compose included',
  ],
} as const;

// LLM 问答 BFF：已上线，所以这一节写的是「做完了什么」，和上面两个作品同一个时态。
// 每条都对着实测结果写，没验证过的不写。
const BFF_POINTS = {
  zh: [
    '业务域是通用报销单：一张主表（带 status 与 amount）+ 一张明细表，NestJS 分层 + DTO 校验 + Prisma / PostgreSQL，不用任何一家公司的表名字段名，也不绑定具体行业',
    '结构化输出：POST /assistant/ask 固定返回 { conclusion, evidence[], insufficient }。单号格式和问题长度在进模型之前就被 DTO 拦掉，查不到的单号返回 404 —— 而不是让模型编一张出来',
    'SSE 流式：POST /assistant/askStream 逐字下发，前端是一个原生 JS 页面、由 Nest 静态托管，点开就能用；客户端断线即掐掉模型请求，不空烧 token',
    '限流默认开：全局限流守卫 30 次 / 分 / IP，只给 /health 显式豁免 —— 默认开着才防得住「新加了个端点，忘了给它加限流」',
    '10 条评测用例同时打「流式」和「非流式」两个端点，逐条比对增量吐出的字与最终结论是否逐字一致，并按「依据里出现数据之外的字段」统计幻觉率',
    '自己写的 Dockerfile + compose，部署在 Render 上，在线链接就在下面',
  ],
  en: [
    'The business domain is a generic expense claim: one master table (with status and amount) plus one detail table. NestJS layering + DTO validation + Prisma / PostgreSQL — no company-specific table or field names, not tied to any industry',
    'Structured output: POST /assistant/ask always returns { conclusion, evidence[], insufficient }. Malformed claim numbers and overlong questions are stopped by the DTO before they reach the model; an unknown claim number returns 404 — the model never invents one',
    'SSE streaming: POST /assistant/askStream delivers token by token to a plain-JS page served statically by Nest — open it and ask; a dropped client connection cancels the model request instead of burning tokens for nobody',
    'Rate limiting is on by default: a global guard at 30 req/min/IP with an explicit exemption only for /health — defaults are what catch "added an endpoint, forgot to rate-limit it"',
    '10 eval cases hit both the streaming and non-streaming endpoints, checking that streamed deltas assemble into exactly the final answer, and counting hallucinations as "fields in the evidence that are not in the data"',
    'Hand-written Dockerfile + compose, deployed on Render — live link below',
  ],
} as const;

const STATS_LINE = {
  zh: '44 个纯逻辑单测 · 4 种节点类型 · 9 个内置控件 · 0 个 UI 库依赖',
  en: '44 pure-logic unit tests · 4 node kinds · 9 built-in widgets · 0 UI-library dependencies',
} as const;

const COPY = {
  zh: {
    engineTitle: '动态表单引擎',
    engineIntro:
      '从一千三百多行硬编码表单里抽出来的 schema 驱动引擎。字段、分组、可增删的列表、可编辑的表格，连同显隐、只读、条件必填、按行锁定，全部由后端下发的 JSON 描述；前端不含一行具体业务代码。',
    decisionsTitle: '几个设计决定',
    openPlayground: '打开 Playground',
    readDocs: '读文档',
    sourceCode: '引擎源码',
    rewrite: '重构记',
    statusWorking: '可用',
    statusWip: '进行中',
    statusLive: '已上线',
    pilotIntro:
      '输入一句人话，比如「打开待办页面，加 3 条待办，然后断言数量是 3」。剩下的它自己来：拆步骤、开 Playwright、点、填、断言，失败了反思重试，最后出一份带步数和 token 成本的报告。前端把这中间每一步的思考、调用的工具、页面截图都摊在界面上 —— 不藏。',
    pilotPointsTitle: '已经做出来的',
    pilotNote:
      '目前的状态：本地 npm run dev 即可跑，仓库带 Dockerfile / compose，任何能跑容器的平台可直接部署。刻意没做公网在线演示 —— 它每次运行都烧 LLM 额度，所以部署态先加好了访问口令与每日配额，链接和口令一起发才算完整的打开方式。已知不足照实写：弹窗、拖拽、iframe、文件上传下载还没有对应工具。',
    openSource: 'GitHub 源码',
    bffTitle: 'LLM 问答 BFF',
    bffIntro:
      '后端取数、校验、把边界兜住；模型只干一件事 —— 把查到的数据说成人话。两边靠结构化输出和 SSE 接稳。从数据模型、容器镜像到评测集都是自己写的，现在跑在公网上，点开就能问。',
    bffPointsTitle: '它做了什么',
    openDemo: '打开在线演示',
    bffNote:
      '目前的状态：已部署并跑通（Render 免费实例，闲置会休眠，第一次打开可能要等十几秒）。已知不足照实写进了评测表：问数据里没有的字段时，模型的「数据不够」提示不够干脆，这类用例记成「已知不足」而不是从表里抹掉。',
  },
  en: {
    engineTitle: 'Dynamic Form Engine',
    engineIntro:
      'A schema-driven engine extracted from a 1,300-line hardcoded form. Fields, groups, add/remove lists, editable tables — plus visibility, readonly, conditional required and row locking — all described by JSON delivered from the backend; the frontend contains zero lines of business-specific code.',
    decisionsTitle: 'Design decisions',
    openPlayground: 'Open Playground',
    readDocs: 'Docs',
    sourceCode: 'Engine source',
    rewrite: 'The Rewrite',
    statusWorking: 'working',
    statusWip: 'in progress',
    statusLive: 'live',
    pilotIntro:
      'You type one plain sentence — "open the todo page, add 3 todos, assert the count is 3". The rest it does itself: split into steps, launch Playwright, click, fill, assert, reflect and retry on failure, then produce a report with step counts and token costs. The frontend lays out every thought, tool call and screenshot along the way — nothing hidden.',
    pilotPointsTitle: 'What works today',
    pilotNote:
      'Current state: runs locally with npm run dev; the repo ships a Dockerfile and compose, deployable on any container platform. Deliberately no public live demo — every run burns LLM tokens, so the deployed mode ships with an access token and a daily usage quota first; the link and the token go out together. Known limits, stated as-is: dialogs, drag-and-drop, iframes and file upload/download have no tools yet.',
    openSource: 'Source on GitHub',
    bffTitle: 'LLM Q&A BFF',
    bffIntro:
      "The backend fetches the data, validates it, and holds the boundaries; the model does exactly one thing — say what was found in plain language. The two sides meet through structured output and SSE. The data model, the container image and the eval set are all hand-written; it runs on the public internet, open it and ask.",
    bffPointsTitle: 'What it does',
    openDemo: 'Open the live demo',
    bffNote:
      'Current state: deployed and working (free Render instance — it sleeps when idle, so the first load may take ten-odd seconds). Known weaknesses are written into the eval table as-is: when asked about fields not in the data, the model\'s "insufficient data" reply is not firm enough — such cases are recorded as known issues, not deleted.',
  },
} as const;

// 第二个作品起要上面那条分隔线和大间距。原来靠 .work + .work 选兄弟，
// 现在写成一个带 not(:first-child) 变体的常量，语义一样但不用额外建类名
const WORK =
  '[&:not(:first-child)]:mt-16 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-line [&:not(:first-child)]:pt-12';

// 状态标记：5px 小方块 + mono 灰字（ok=绿/可用，warn=琥珀/进行中）
function Status(props: { tone: 'ok' | 'warn'; label: string }) {
  return (
    <span className="font-mono text-[11.5px] tracking-[0.1em] text-dim">
      <span
        className={`mr-1.5 inline-block h-[5px] w-[5px] rounded-[1px] align-[1px] ${
          props.tone === 'ok' ? 'bg-ok' : 'bg-warn'
        }`}
      />
      {props.label}
    </span>
  );
}

export default function Works({ lang = 'zh' }: { lang?: Locale }) {
  const t = COPY[lang];
  return (
    <div className="page-enter mx-auto max-w-[800px] px-6 pt-16 pb-24">
      <section className={WORK}>
        <header className="flex items-baseline gap-4">
          <h1 className="m-0 text-[30px] leading-[1.3] font-semibold tracking-[-0.015em] text-ink">{t.engineTitle}</h1>
          <Status tone="ok" label={t.statusWorking} />
        </header>
        <p className="mt-4 mb-0 text-[14.5px] leading-[1.85] text-body">
          {t.engineIntro}
        </p>

        {/* 原来是「大数字 + 小标签」的统计条 —— SaaS 落地页的 boast 组件，
            撑场面用的。压成一行等宽字：信息不变，口号感没了。 */}
        <p className="mt-8 mb-0 border-t border-line pt-5 font-mono text-[12.5px] tracking-[-0.01em] text-dim">
          {STATS_LINE[lang]}
        </p>

        <h2 className="mt-9 mb-3.5 flex items-center gap-3 text-[14.5px] font-semibold text-ink">
          {t.decisionsTitle}
          <span aria-hidden className="h-px flex-1 bg-line" />
        </h2>
        <ul className="m-0 list-disc pl-5 text-sm leading-[1.85] text-body [&>li]:mb-2">
          {ENGINE_POINTS[lang].map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>

        <div className="mt-6.5 flex flex-wrap gap-2.5">
          {/* Playground 单语共享，不加 /en 前缀 */}
          <Btn href="/playground" primary>
            {t.openPlayground}
          </Btn>
          <Btn href={lp(lang, '/docs')}>{t.readDocs}</Btn>
          <Btn href={lp(lang, '/article/dynamic-form-schema')}>{t.rewrite}</Btn>
          <Btn href="https://github.com/lcylamb/portfolio/tree/main/src/engine" external>
            {t.sourceCode}
          </Btn>
        </div>
      </section>

      <section className={WORK}>
        <header className="flex items-baseline gap-4">
          <h1 className="m-0 text-[30px] leading-[1.3] font-semibold tracking-[-0.015em] text-ink">WebPilot</h1>
          <Status tone="ok" label={t.statusWorking} />
        </header>
        <p className="mt-4 mb-0 text-[14.5px] leading-[1.85] text-body">
          {t.pilotIntro}
        </p>

        <h2 className="mt-9 mb-3.5 flex items-center gap-3 text-[14.5px] font-semibold text-ink">
          {t.pilotPointsTitle}
          <span aria-hidden className="h-px flex-1 bg-line" />
        </h2>
        <ul className="m-0 list-disc pl-5 text-sm leading-[1.85] text-body [&>li]:mb-2">
          {PILOT_POINTS[lang].map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>

        <div className="mt-6.5 flex flex-wrap gap-2.5">
          <Btn href="https://github.com/lcylamb/webpilot" external>
            {t.openSource}
          </Btn>
        </div>

        <p className="mt-5 mb-0 border-l-2 border-line-strong bg-page py-3 pr-3.5 pl-4 text-[13px] leading-[1.75] text-dim">
          {t.pilotNote}
        </p>
      </section>

      <section className={WORK}>
        <header className="flex items-baseline gap-4">
          <h1 className="m-0 text-[30px] leading-[1.3] font-semibold tracking-[-0.015em] text-ink">{t.bffTitle}</h1>
          <Status tone="ok" label={t.statusLive} />
        </header>
        <p className="mt-4 mb-0 text-[14.5px] leading-[1.85] text-body">
          {t.bffIntro}
        </p>

        <h2 className="mt-9 mb-3.5 flex items-center gap-3 text-[14.5px] font-semibold text-ink">
          {t.bffPointsTitle}
          <span aria-hidden className="h-px flex-1 bg-line" />
        </h2>
        <ul className="m-0 list-disc pl-5 text-sm leading-[1.85] text-body [&>li]:mb-2">
          {BFF_POINTS[lang].map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>

        <div className="mt-6">
          <Btn href="https://assistant-demo-0rgz.onrender.com/" external primary>
            {t.openDemo}
          </Btn>
        </div>

        <p className="mt-5 mb-0 border-l-2 border-line-strong bg-page py-3 pr-3.5 pl-4 text-[13px] leading-[1.75] text-dim">
          {t.bffNote}
        </p>
      </section>
    </div>
  );
}
