'use client';

import { useState, type ReactNode } from 'react';
import { highlightCode } from './highlight';

// 文档页。左导航 + 右内容。
//
// 必须是客户端组件：左侧目录是 useState 切的（切一次只换右边的内容，
// 不跳路由）。也正是因此，这一页在服务端只产出一个空壳 —— 它是拿来查的，
// 不是拿来被搜的；真正需要 SEO 的是文章页，那一页是纯服务端。
//
// 内容全部对应引擎的真实类型定义（schema/types.ts），不是宣传文案 ——
// 文档写错比没文档更糟，所以每条属性都能在源码里找到出处。
//
// 样式分两层：
//   - 页面外壳（栅格 / 目录 / 当前项高亮）：工具类，写在这下面；
//   - 正文排版（h1/h2/p/code/pre/table）：.prose-docs 一处定义在 globals.css。
//     正文全是语义标签，挂类名既啰嗦又没信息量；这跟文章页是同一套处理。
//
// ---- 双语设计说明 ----
// zh / en 两份文案放在同一个内容对象 C 里（C: Record<'zh' | 'en', DocsContent>）。
// JSX 只有一棵树：各 Section 组件接收当前语言的内容切片（t），从里面取
// 标题 / 段落 / 表格 / 列表渲染，不为双语复制第二棵 JSX 树。
// 约定：
//   - 中文内容逐字保留自原单语版本（存量不动）；
//   - 代码示例里的代码本身（标识符 / 字符串 / JSON）不翻，两版共用；
//   - 代码里的中文注释在 en 版翻成英文（CODE_INSTALL、CODE_SCHEMA_HEAD 各留两份）。

type Lang = 'zh' | 'en';
type Cell = ReactNode;
type Table = { head: string[]; rows: Cell[][] };

function DocTable(props: { head: string[]; rows: Cell[][] }) {
  return (
    <table>
      <thead>
        <tr>
          {props.head.map((item) => (
            <th key={item}>{item}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Code(props: { children: string; lang?: string }) {
  return (
    <pre>
      <code
        dangerouslySetInnerHTML={{
          __html: highlightCode(props.children, props.lang),
        }}
      />
    </pre>
  );
}

// —— 代码示例：代码本身不翻，两版共用；含中文注释的各留一份 ——

const CODE_INSTALL: Record<Lang, string> = {
  zh: `npm install
npm run dev        # 打开 Playground
npm run test:unit  # 44 个纯逻辑用例
npm run build      # 类型检查 + 生产构建`,
  en: `npm install
npm run dev        # open the Playground
npm run test:unit  # 44 pure-logic unit tests
npm run build      # type check + production build`,
};

const CODE_MINIMAL = `import { DynamicForm, useFormEngine } from './engine';

const schema = {
  title: '最小示例',
  nodes: [
    { name: 'name', widget: 'text', title: '姓名',
      rules: { required: true, maxLength: 20 } },
    { name: 'married', widget: 'switch', title: '已婚',
      defaultValue: false },
    { name: 'spouseName', widget: 'text', title: '配偶姓名',
      visibleWhen: { field: 'married', op: 'truthy' },
      rules: { required: true } },
  ],
};

function Demo() {
  const form = useFormEngine(schema);
  return (
    <DynamicForm
      schema={schema}
      values={form.values}
      errors={form.errors}
      onChange={form.handleChange}
      onFieldBlur={form.handleFieldBlur}
    />
  );
}`;

const CODE_CONDITION = `type ConditionExpr =
  | { field: string; op: ConditionOp; value?: unknown }
  | { and: ConditionExpr[] }
  | { or:  ConditionExpr[] }
  | { not: ConditionExpr };`;

const CODE_AND = `{
  "and": [
    { "field": "claimScene", "op": "eq", "value": "PURCHASE" },
    { "field": "hasAgentPay", "op": "truthy" }
  ]
}`;

const CODE_CONTEXT = `interface FieldRenderContext {
  widget: string;
  value: unknown;
  options?: OptionItem[];
  placeholder?: string;
  invalid: boolean;
  disabled: boolean;
  onChange: (value: unknown) => void;
  onBlur: () => void;
}

type FieldRenderer = (ctx: FieldRenderContext) => ReactNode;`;

// schema 结构示例：唯一差别是那条中文注释。
const CODE_SCHEMA_HEAD: Record<Lang, string> = {
  zh: `interface FormSchema {
  title?: string;
  description?: string;
  nodes: NodeSchema[];   // 顶层节点，name 必须唯一
}`,
  en: `interface FormSchema {
  title?: string;
  description?: string;
  nodes: NodeSchema[];   // top-level nodes; names must be unique
}`,
};

// —— 语言无关的表格行（zh / en 共用）——

const DYNAMICFORM_ROWS: Cell[][] = [
  [<code>schema</code>, 'FormSchema'],
  [<code>values</code>, 'FormValues'],
  [<code>errors</code>, 'FormErrors'],
  [<code>onChange</code>, '(path, value) => void'],
  [<code>onFieldBlur</code>, '(path) => void'],
];

const PURE_ROWS: Cell[][] = [
  [
    'controller/validate',
    <code>
      validate · validateAtPath · countErrors · pickFirstErrorPath
    </code>,
  ],
  [
    'controller/serialize',
    <code>serializeVisible · collectVisiblePaths</code>,
  ],
  [
    'schema/conditions',
    <code>evaluate · collectReferencedFields</code>,
  ],
  ['path', <code>getPath · setPath · hasPath · deletePath</code>],
  ['controller/focus', <code>focusFirstError</code>],
];

// —— 内容类型：描述每个 Section 需要哪些文案 ——

interface DocsContent {
  nav: { id: string; title: string }[];
  start: {
    h1: string;
    installCode: string;
    intro: ReactNode;
    h2Minimal: string;
    minimalIntro: ReactNode;
    minimalNote: ReactNode;
  };
  schema: {
    h1: string;
    intro: ReactNode;
    schemaCode: string;
    h2Kinds: string;
    kindsTable: Table;
    h2Common: string;
    commonTable: Table;
    h2Field: string;
    fieldTable: Table;
    h2List: string;
    listTable: Table;
    listNote: ReactNode;
  };
  conditions: {
    h1: string;
    intro: ReactNode;
    h2Ops: string;
    opsTable: Table;
    h2Combine: string;
    combineIntro: ReactNode;
    h2Paths: string;
    pathsIntro: ReactNode;
    step1: ReactNode;
    step2: string;
    pathWarning: ReactNode;
    hasPathPara: ReactNode;
    h2Lenient: string;
    lenient1: ReactNode;
    lenient2: ReactNode;
  };
  rules: {
    h1: string;
    rulesTable: Table;
    h2Patterns: string;
    patternsTable: Table;
    h2Semantics: string;
    semantics: [ReactNode, ReactNode, ReactNode];
    errorNote: ReactNode;
  };
  widgets: {
    h1: string;
    intro: string;
    widgetsTable: Table;
    h2Controlled: string;
    controlledPara: string;
    h2Add: string;
    addPara: ReactNode;
    fallbackNote: ReactNode;
  };
  api: {
    h1: string;
    h2Hook: string;
    hookPara: string;
    hookTable: Table;
    blurNote: string;
    h2DynamicForm: string;
    dynamicFormTable: Table;
    h2Pure: string;
    purePara: string;
    pureTable: Table;
  };
  internals: {
    h1: string;
    intro: string;
    h2Rule1: string;
    rule1a: ReactNode;
    rule1b: ReactNode;
    h2Rule2: string;
    rule2a: ReactNode;
    rule2b: ReactNode;
    h2Rule3: string;
    rule3: ReactNode;
    h2Rule4: string;
    rule4: ReactNode;
    h2NotDoing: string;
    notDoingTable: Table;
  };
}

// —— zh：逐字保留自原单语版本 ——

const zh: DocsContent = {
  nav: [
    { id: 'start', title: '快速开始' },
    { id: 'schema', title: 'Schema 结构' },
    { id: 'conditions', title: '条件表达式' },
    { id: 'rules', title: '校验规则' },
    { id: 'widgets', title: '控件' },
    { id: 'api', title: 'API' },
    { id: 'internals', title: '实现要点' },
  ],

  start: {
    h1: '快速开始',
    installCode: CODE_INSTALL.zh,
    intro: (
      <>
        引擎零运行时依赖 —— 不引 antd、不引表单库，值由引擎自己持有。
        换成你自己的 UI 库，只需要改 <code>src/engine/fields/registry.tsx</code>{' '}
        一个文件。
      </>
    ),
    h2Minimal: '最小可用示例',
    minimalIntro: (
      <>
        下面这份 schema 已经包含三件事：一个必填文本、一个开关、以及
        <strong>一个只在开关打开时才出现且必须填的字段</strong>。
      </>
    ),
    minimalNote: (
      <>
        注意 <code>spouseName</code> 的 <code>visibleWhen</code>：
        开关关掉时它不只是看不见 —— 它既不参与校验，也不会进提交体。
      </>
    ),
  },

  schema: {
    h1: 'Schema 结构',
    intro: (
      <>
        一份表单的输入契约。硬约束只有一条：
        <strong>整份 schema 必须能 JSON 走一遍再回来</strong>。
        这条决定了后面所有的设计。
      </>
    ),
    schemaCode: CODE_SCHEMA_HEAD.zh,
    h2Kinds: '四种节点',
    kindsTable: {
      head: ['kind', '说明'],
      rows: [
        [
          <code>field</code>,
          '单个字段。kind 不给就默认是它，所以最常见的节点写起来最短',
        ],
        [
          <code>group</code>,
          '分组，可折叠。children 是 NodeSchema[]，能继续嵌套任意节点',
        ],
        [
          <code>list</code>,
          '可增删列表。每一项是一组同构字段，children 只能是字段',
        ],
        [
          <code>table</code>,
          '可编辑表格。行是同构明细，必须横向对齐，允许逐单元格锁定',
        ],
      ],
    },
    h2Common: '所有节点共有',
    commonTable: {
      head: ['属性', '类型', '说明'],
      rows: [
        [<code>name</code>, 'string', '作用域内唯一。根节点之间也不能重名'],
        [<code>title</code>, 'string', '标签文案'],
        [<code>description</code>, 'string', '说明，渲染在 label 右侧'],
        [
          <code>visibleWhen</code>,
          'ConditionExpr',
          '不成立时：不渲染、不校验、不进提交体。三件事是同一条规则',
        ],
      ],
    },
    h2Field: '字段（field）',
    fieldTable: {
      head: ['属性', '类型', '说明'],
      rows: [
        [<code>widget</code>, 'WidgetKey', '控件类型，见「控件」一节'],
        [<code>placeholder</code>, 'string', '占位文案'],
        [
          <code>options</code>,
          'OptionItem[]',
          'select / radio / checkbox 的选项',
        ],
        [<code>rules</code>, 'Rule', '校验规则，见「校验规则」一节'],
        [
          <code>defaultValue</code>,
          'unknown',
          '初值。不给则按控件推一个空值',
        ],
        [
          <code>span</code>,
          '4 | 6 | 8 | 12',
          '12 栅占比。不给时按控件推：textarea 与多选占满整行，其余占 1/3',
        ],
        [
          <code>disabledWhen</code>,
          'ConditionExpr',
          '只读。值保留、但不参与校验',
        ],
      ],
    },
    h2List: '列表（list）与表格（table）',
    listTable: {
      head: ['属性', '归属', '说明'],
      rows: [
        [
          <code>min</code>,
          'list / table',
          '最少几条。到下限时删除按钮直接禁用',
        ],
        [
          <code>max</code>,
          'list / table',
          '最多几条。到上限时添加按钮直接禁用',
        ],
        [
          <code>itemTitleTemplate</code>,
          'list',
          '每项标题模板，{index} 从 1 开始。默认「第 {index} 项」',
        ],
        [<code>addText</code>, 'list', '添加按钮文案'],
        [<code>editable</code>, 'table', '整表是否可编辑，默认 true'],
        [
          <code>summaryOf</code>,
          'table',
          '需要求和的列 name，渲染成 tfoot 合计行',
        ],
        [
          <code>columns</code>,
          'table',
          '列定义：name / title / widget / width / options / rules / align，以及 editableWhen',
        ],
      ],
    },
    listNote: (
      <>
        表格的 <code>editableWhen</code> 是<strong>按当前行数据</strong>判定的
        —— 这是「费用复核」场景的关键：
        某一行已复核，该行的复核金额就锁成文本，但值照样提交。
      </>
    ),
  },

  conditions: {
    h1: '条件表达式',
    intro: (
      <>
        显隐、只读、条件必填共用同一种表达式。它必须是可序列化的数据，因为
        <strong>后端下发不了一个 JavaScript 闭包</strong>。
      </>
    ),
    h2Ops: '算子',
    opsTable: {
      head: ['算子', '含义'],
      rows: [
        [<code>eq</code>, '等于（跨类型归一化，见下）'],
        [<code>neq</code>, '不等于'],
        [<code>in</code>, '命中数组中的任一项，value 传数组'],
        [<code>nin</code>, '不命中数组中的任一项'],
        [<code>gt</code>, '大于'],
        [<code>gte</code>, '大于等于'],
        [<code>lt</code>, '小于'],
        [<code>lte</code>, '小于等于'],
        [
          <code>notEmpty</code>,
          '非空（空字符串、空数组、null、undefined 都算空）',
        ],
        [<code>empty</code>, '为空'],
        [<code>truthy</code>, '真值。开关类字段最常用'],
        [<code>falsy</code>, '假值'],
      ],
    },
    h2Combine: '组合',
    combineIntro: (
      <>
        <code>and</code> / <code>or</code> / <code>not</code> 可以任意嵌套。
        下面这条是「场景为采购
        <em>且</em>勾了『是否代他人提交』」：
      </>
    ),
    h2Paths: '路径怎么解析（这段最容易踩）',
    pathsIntro: (
      <>
        <code>field</code> 是<strong>路径</strong>，不是单个
        key。列表项内部用相对路径 （<code>invoiceKind</code>），列表外用完整路径（
        <code>basic.claimScene</code>）。 求值顺序是：
      </>
    ),
    step1: (
      <>
        <strong>先查局部作用域</strong>，也就是当前所在的列表项 / 分组对象；
      </>
    ),
    step2: '找不到，再回退到根。',
    pathWarning: (
      <>
        顺序不能反过来。先查根的话，只要顶层恰好有个同名字段，
        列表项就会静默读到外层的值 —— 而它在页面上只表现为「偶尔显隐不对」，
        极难定位。
      </>
    ),
    hasPathPara: (
      <>
        另外，判断「字段是否存在」用的是 <code>hasPath()</code>，不是{' '}
        <code>getPath() !== undefined</code>。因为一个被显式写成{' '}
        <code>undefined</code> 的字段，仍然算「局部有」，不该穿透到根。
      </>
    ),
    h2Lenient: '两个刻意的宽松',
    lenient1: (
      <>
        <strong>跨类型归一化</strong>：<code>1</code> / <code>'1'</code> /{' '}
        <code>true</code> 在比较时会归一化。后端存的枚举可能是字符串，
        前端控件回传的可能是数字。
      </>
    ),
    lenient2: (
      <>
        <strong>未知算子放行</strong>：遇到不认识的 op，返回真而不是假。
        因为拦住的代价是「字段凭空消失」，而放行的代价只是「多显示一个字段」——
        前者用户无法自救。
      </>
    ),
  },

  rules: {
    h1: '校验规则',
    rulesTable: {
      head: ['属性', '类型', '说明'],
      rows: [
        [<code>required</code>, 'boolean', '必填'],
        [
          <code>requiredWhen</code>,
          'ConditionExpr',
          '条件必填：表达式成立时才认 required。与 required 是「或」的关系',
        ],
        [
          <code>pattern</code>,
          "'phone' | 'idcard' | 'money' | 'personName'",
          '内置正则',
        ],
        [<code>min / max</code>, 'number', '数值范围'],
        [<code>maxLength</code>, 'number', '长度上限'],
        [
          <code>message</code>,
          'string',
          '覆盖内置文案。只要给了它，命中任何一条规则都用它',
        ],
      ],
    },
    h2Patterns: '内置正则',
    patternsTable: {
      head: ['pattern', '规则'],
      rows: [
        [<code>phone</code>, <code>/^1[3-9]\d{'{9}'}$/</code>],
        [<code>idcard</code>, <code>/^\d{'{17}'}[\dXx]$/</code>],
        [<code>money</code>, <code>/^\d+(\.\d{'{1,2}'})?$/</code>],
        [
          <code>personName</code>,
          '允许中间点（少数民族姓名、护照名），但不允许首尾有点',
        ],
      ],
    },
    h2Semantics: '三条语义',
    semantics: [
      <>
        <strong>不可见的字段不校验。</strong>它同时也不会进提交体 ——
        这是同一条规则。
      </>,
      <>
        <strong>只读字段跳过校验。</strong>
        用户改不了它，弹「必填」只会让人对着一个 灰色输入框抓狂。
      </>,
      <>
        <strong>但只读字段的值照样提交。</strong>这两件事不矛盾：
        「用户改不了」和「后端不需要它」是两回事。混在一起，前端就会把
        「没权限改」误传成「用户清空了」。
      </>,
    ],
    errorNote: (
      <>
        错误提示的优先级 = schema 里的顺序。校验产出的是一张扁平路径表， key
        是字段完整路径（如 <code>invoiceList.0.amount</code>）。
      </>
    ),
  },

  widgets: {
    h1: '控件',
    intro: '内置 9 个，键名就用 schema 里的 widget 字面量，不另起一套体系。',
    widgetsTable: {
      head: ['widget', '渲染成'],
      rows: [
        [<code>text</code>, '单行文本'],
        [<code>textarea</code>, '多行文本，默认占满整行'],
        [<code>number</code>, '数字，输入中不做 Number 转换'],
        [<code>money</code>, '同数字，placeholder 给 0.00'],
        [<code>date</code>, '日期'],
        [<code>select</code>, '下拉单选'],
        [<code>radio</code>, '单选按钮组'],
        [<code>checkbox</code>, '多选，回写完整数组'],
        [<code>switch</code>, '开关，回写布尔'],
      ],
    },
    h2Controlled: '控件是受控叶子',
    controlledPara:
      '值由引擎持有，控件只负责渲染和回调。所以引擎不绑任何 UI 库 —— 换成 antd' +
      ' / 自研组件库，只改注册表那一个文件。',
    h2Add: '加一种控件',
    addPara: (
      <>
        在 <code>fields/registry.tsx</code>{' '}
        的注册表里加一行，写一个符合上面签名的函数即可。 不动 schema
        层，不动校验层，不动渲染主流程。
      </>
    ),
    fallbackNote: (
      <>
        未注册的 widget 会落到 <code>text</code> 兜底 —— 配错一个控件名，
        页面上不会白屏，只是变成一个输入框。
      </>
    ),
  },

  api: {
    h1: 'API',
    h2Hook: 'useFormEngine(schema, initialValues?)',
    hookPara: '状态入口。值只有一份真相，校验、提交体、条件显隐全部从它派生。',
    hookTable: {
      head: ['返回', '说明'],
      rows: [
        [<code>values</code>, '表单状态，一棵普通对象树'],
        [<code>errors</code>, '扁平错误表，key 是字段完整路径'],
        [
          <code>payload</code>,
          '当前会提交的那份数据 —— 按显隐裁剪过，实时算出来的',
        ],
        [<code>status</code>, <code>idle | ok | error</code>],
        [
          <code>handleChange</code>,
          '(path, value) => void。改值，并且只清这个字段自己的错',
        ],
        [
          <code>handleFieldBlur</code>,
          '(path) => void。失焦时只校验这一个字段',
        ],
        [
          <code>submit</code>,
          '() => payload | undefined。全量校验；不通过时滚动并聚焦到第一个错误',
        ],
        [<code>reset</code>, '(next?) => void'],
      ],
    },
    blurNote: '为什么失焦才校验：每敲一下就整表标红，第一次填这张表的人会被劝退。',
    h2DynamicForm: 'DynamicForm',
    dynamicFormTable: { head: ['prop', '类型'], rows: DYNAMICFORM_ROWS },
    h2Pure: '纯逻辑导出',
    purePara:
      '下面这些都可以脱离 React 单独使用 —— 它们不 import React、不碰 DOM：',
    pureTable: { head: ['模块', '导出'], rows: PURE_ROWS },
  },

  internals: {
    h1: '实现要点',
    intro: '四条规则撑起了整个引擎。它们同时也是这个项目的边界所在。',
    h2Rule1: '一、隐藏 = 不渲染 + 不校验 + 不提交',
    rule1a: (
      <>
        <code>visibleWhen</code> 不成立时直接 <code>return null</code>，不是{' '}
        <code>display: none</code>。而且校验和序列化各自都会跳过它。
      </>
    ),
    rule1b: (
      <>
        用户在差旅分支填过的值，切到招待再切回来会重新出现 ——
        它一直都在表单状态里。
        但它不会进提交体。否则一张差旅行程就会带上招待相关的字段，
        <strong>而两边都是合法值，后端校验拦不住</strong>。
      </>
    ),
    h2Rule2: '二、「被校验 ⇔ 被提交」',
    rule2a: (
      <>
        校验和序列化各自解析一遍可见性，两者必须语义一致。例外只有两处，且都是刻意的：
        <strong>只读字段</strong>和<strong>表格里被锁定的单元格</strong> ——
        它们提交，但不校验。
      </>
    ),
    rule2b: (
      <>
        这条不变量由 <code>consistency.test.ts</code> 钉住。
        不变量不写测试，就等于没有。
      </>
    ),
    h2Rule3: '三、结构化共享的不可变更新',
    rule3: (
      <>
        <code>setPath</code> 只克隆路径上的节点，兄弟节点保持原引用。
        于是每敲一个字符的代价只跟字段深度有关，跟表单规模无关 ——
        一份上百字段的案子，不会因为一次输入就深拷贝整棵对象树。
      </>
    ),
    h2Rule4: '四、错误定位不依赖 UI 库',
    rule4: (
      <>
        校验产出一张扁平路径表，渲染层把路径写在 <code>data-path</code> 上。
        提交被拦时，<code>focusFirstError</code> 直接查 DOM 滚动 + 聚焦 +
        抖一下提示。 不需要任何 UI 库的 <code>FormInstance</code>。
      </>
    ),
    h2NotDoing: '刻意不做的事',
    notDoingTable: {
      head: ['不做', '原因'],
      rows: [
        [
          '条件里写回调函数',
          '一旦允许传函数，schema 就不再是数据 —— 配置后台、权限校验、服务端预校验全部无从谈起',
        ],
        [
          '「金额大于前三项之和」这类规则',
          '同上。这是表达力的天花板，是设计出来的边界，不是漏了',
        ],
        [
          '给渲染层写单测',
          '它们要拖进 React 和 DOM，进来了也只是把 jsdom 当摆设。想被单测的代码，得先把依赖切干净',
        ],
      ],
    },
  },
};

// —— en：平实的第一人称技术文档腔，短句直陈 ——

const en: DocsContent = {
  nav: [
    { id: 'start', title: 'Quick start' },
    { id: 'schema', title: 'Schema structure' },
    { id: 'conditions', title: 'Condition expressions' },
    { id: 'rules', title: 'Validation rules' },
    { id: 'widgets', title: 'Widgets' },
    { id: 'api', title: 'API' },
    { id: 'internals', title: 'Implementation notes' },
  ],

  start: {
    h1: 'Quick start',
    installCode: CODE_INSTALL.en,
    intro: (
      <>
        The engine has zero runtime dependencies — no antd, no form library.
        It holds the values itself. To swap in your own UI library, you only
        need to touch one file: <code>src/engine/fields/registry.tsx</code>.
      </>
    ),
    h2Minimal: 'A minimal working example',
    minimalIntro: (
      <>
        This one schema already shows three things: a required text field, a
        switch, and <strong>a field that only appears when the switch is on
        and must then be filled in</strong>.
      </>
    ),
    minimalNote: (
      <>
        Look at the <code>visibleWhen</code> on <code>spouseName</code>: when
        the switch is off, the field isn't just hidden — it's skipped by
        validation and left out of the submit payload.
      </>
    ),
  },

  schema: {
    h1: 'Schema structure',
    intro: (
      <>
        The input contract of a form. There is one hard constraint:{' '}
        <strong>the whole schema must survive a JSON round-trip</strong>.
        Every design decision below follows from this.
      </>
    ),
    schemaCode: CODE_SCHEMA_HEAD.en,
    h2Kinds: 'Four node kinds',
    kindsTable: {
      head: ['kind', 'Description'],
      rows: [
        [
          <code>field</code>,
          'A single field. The default when kind is omitted, so the most common node is the shortest to write',
        ],
        [
          <code>group</code>,
          'A collapsible group. children is a NodeSchema[] and can nest any node',
        ],
        [
          <code>list</code>,
          'An add/remove list. Each item is a set of homogeneous fields; children can only be fields',
        ],
        [
          <code>table</code>,
          'An editable table. Rows are homogeneous detail lines that must align horizontally; individual cells can be locked',
        ],
      ],
    },
    h2Common: 'Shared by every node',
    commonTable: {
      head: ['Property', 'Type', 'Description'],
      rows: [
        [<code>name</code>, 'string', "Unique within its scope. Top-level nodes can't share a name either"],
        [<code>title</code>, 'string', 'Label text'],
        [<code>description</code>, 'string', 'Hint text, rendered next to the label'],
        [
          <code>visibleWhen</code>,
          'ConditionExpr',
          "When it doesn't hold: not rendered, not validated, not in the submit payload. Three effects, one rule",
        ],
      ],
    },
    h2Field: 'Fields (field)',
    fieldTable: {
      head: ['Property', 'Type', 'Description'],
      rows: [
        [<code>widget</code>, 'WidgetKey', 'Widget type; see the "Widgets" section'],
        [<code>placeholder</code>, 'string', 'Placeholder text'],
        [
          <code>options</code>,
          'OptionItem[]',
          'Options for select / radio / checkbox',
        ],
        [<code>rules</code>, 'Rule', 'Validation rules; see the "Validation rules" section'],
        [
          <code>defaultValue</code>,
          'unknown',
          'Initial value. If omitted, an empty value is derived from the widget',
        ],
        [
          <code>span</code>,
          '4 | 6 | 8 | 12',
          'Share of the 12-column grid. Defaults per widget: textarea and multi-select take the full row, everything else takes 1/3',
        ],
        [
          <code>disabledWhen</code>,
          'ConditionExpr',
          'Readonly. The value is kept but not validated',
        ],
      ],
    },
    h2List: 'List and table',
    listTable: {
      head: ['Property', 'Applies to', 'Description'],
      rows: [
        [
          <code>min</code>,
          'list / table',
          'Minimum number of items. At the limit the remove button is disabled',
        ],
        [
          <code>max</code>,
          'list / table',
          'Maximum number of items. At the limit the add button is disabled',
        ],
        [
          <code>itemTitleTemplate</code>,
          'list',
          'Title template per item; {index} starts at 1. The default is "第 {index} 项"',
        ],
        [<code>addText</code>, 'list', 'Label of the add button'],
        [<code>editable</code>, 'table', 'Whether the whole table is editable; defaults to true'],
        [
          <code>summaryOf</code>,
          'table',
          'Column names to sum up, rendered as a tfoot total row',
        ],
        [
          <code>columns</code>,
          'table',
          'Column definitions: name / title / widget / width / options / rules / align, plus editableWhen',
        ],
      ],
    },
    listNote: (
      <>
        A table column's <code>editableWhen</code> is evaluated{' '}
        <strong>against the current row's data</strong> — that's the key to
        the expense review scenario: once a row has been reviewed, that row's
        reviewed amount is locked into text, but the value is still submitted.
      </>
    ),
  },

  conditions: {
    h1: 'Condition expressions',
    intro: (
      <>
        Visibility, readonly state and conditional required all share one
        expression type. It has to be serializable data, because{' '}
        <strong>the backend can't deliver a JavaScript closure</strong>.
      </>
    ),
    h2Ops: 'Operators',
    opsTable: {
      head: ['Operator', 'Meaning'],
      rows: [
        [<code>eq</code>, 'Equal (with cross-type normalization, see below)'],
        [<code>neq</code>, 'Not equal'],
        [<code>in</code>, 'Matches any item in an array; pass the array as value'],
        [<code>nin</code>, 'Matches none of the items in an array'],
        [<code>gt</code>, 'Greater than'],
        [<code>gte</code>, 'Greater than or equal'],
        [<code>lt</code>, 'Less than'],
        [<code>lte</code>, 'Less than or equal'],
        [
          <code>notEmpty</code>,
          'Not empty (empty string, empty array, null and undefined all count as empty)',
        ],
        [<code>empty</code>, 'Empty'],
        [<code>truthy</code>, 'Truthy. Most useful for switch fields'],
        [<code>falsy</code>, 'Falsy'],
      ],
    },
    h2Combine: 'Combining',
    combineIntro: (
      <>
        <code>and</code> / <code>or</code> / <code>not</code> nest to any
        depth. This one reads "scene is PURCHASE <em>and</em> hasAgentPay is
        checked":
      </>
    ),
    h2Paths: 'How paths resolve (the easiest part to get wrong)',
    pathsIntro: (
      <>
        <code>field</code> is a <strong>path</strong>, not a single key.
        Inside a list item use a relative path (<code>invoiceKind</code>);
        outside a list use the full path (<code>basic.claimScene</code>).
        Evaluation order:
      </>
    ),
    step1: (
      <>
        <strong>Look up the local scope first</strong> — the list item or
        group object you're currently in;
      </>
    ),
    step2: "if it's not there, fall back to the root.",
    pathWarning: (
      <>
        This order must not be flipped. If the root were checked first, any
        same-named field at the top level would make list items silently read
        the outer value — and on the page this only shows up as "visibility is
        occasionally wrong", which is extremely hard to track down.
      </>
    ),
    hasPathPara: (
      <>
        Also, "does the field exist" is checked with <code>hasPath()</code>,
        not <code>getPath() !== undefined</code>. A field explicitly set to{' '}
        <code>undefined</code> still counts as present locally and should not
        fall through to the root.
      </>
    ),
    h2Lenient: 'Two deliberate leniencies',
    lenient1: (
      <>
        <strong>Cross-type normalization</strong>: <code>1</code> /{' '}
        <code>'1'</code> / <code>true</code> are normalized before
        comparison. The backend may store enum values as strings; the
        frontend widget may return numbers.
      </>
    ),
    lenient2: (
      <>
        <strong>Unknown operators pass</strong>: an unrecognized op evaluates
        to true, not false. Blocking would make a field disappear without a
        trace; passing only shows one extra field — and the user can't
        recover from the former.
      </>
    ),
  },

  rules: {
    h1: 'Validation rules',
    rulesTable: {
      head: ['Property', 'Type', 'Description'],
      rows: [
        [<code>required</code>, 'boolean', 'Required'],
        [
          <code>requiredWhen</code>,
          'ConditionExpr',
          'Conditional required: required counts only when the expression holds. It ORs with required',
        ],
        [
          <code>pattern</code>,
          "'phone' | 'idcard' | 'money' | 'personName'",
          'Built-in regex',
        ],
        [<code>min / max</code>, 'number', 'Numeric range'],
        [<code>maxLength</code>, 'number', 'Length cap'],
        [
          <code>message</code>,
          'string',
          "Overrides the built-in message. Once set, it's used for any rule that fails",
        ],
      ],
    },
    h2Patterns: 'Built-in patterns',
    patternsTable: {
      head: ['pattern', 'Rule'],
      rows: [
        [<code>phone</code>, <code>/^1[3-9]\d{'{9}'}$/</code>],
        [<code>idcard</code>, <code>/^\d{'{17}'}[\dXx]$/</code>],
        [<code>money</code>, <code>/^\d+(\.\d{'{1,2}'})?$/</code>],
        [
          <code>personName</code>,
          'Allows an inner dot (ethnic-minority names, passport names), but no leading or trailing dot',
        ],
      ],
    },
    h2Semantics: 'Three semantics',
    semantics: [
      <>
        <strong>A hidden field is not validated.</strong> It doesn't enter the
        submit payload either — it's one rule, not two.
      </>,
      <>
        <strong>A readonly field skips validation.</strong> The user can't
        change it; yelling "required" at a grey input box just drives people
        mad.
      </>,
      <>
        <strong>But a readonly field's value is still submitted.</strong>{' '}
        These two don't contradict: "the user can't change it" and "the
        backend doesn't need it" are different things. Mixing them up makes
        the frontend report "no permission to edit" as "the user cleared it".
      </>,
    ],
    errorNote: (
      <>
        Error message priority = the order in the schema. Validation produces
        a flat path table whose keys are full field paths (e.g.{' '}
        <code>invoiceList.0.amount</code>).
      </>
    ),
  },

  widgets: {
    h1: 'Widgets',
    intro:
      'Nine built in. The keys are the widget literals from the schema — no separate naming system.',
    widgetsTable: {
      head: ['widget', 'Renders as'],
      rows: [
        [<code>text</code>, 'Single-line text'],
        [<code>textarea</code>, 'Multi-line text, takes the full row by default'],
        [<code>number</code>, 'Number; no Number conversion while typing'],
        [<code>money</code>, 'Same as number, with a 0.00 placeholder'],
        [<code>date</code>, 'Date'],
        [<code>select</code>, 'Dropdown, single select'],
        [<code>radio</code>, 'Radio group'],
        [<code>checkbox</code>, 'Multi-select, writes back the full array'],
        [<code>switch</code>, 'Switch, writes back a boolean'],
      ],
    },
    h2Controlled: 'Widgets are controlled leaves',
    controlledPara:
      'The engine holds the values; widgets only render and call back. That is why the engine is bound to no UI library — switching to antd or an in-house component library means changing exactly one file: the registry.',
    h2Add: 'Adding a widget',
    addPara: (
      <>
        Add one entry to the registry in <code>fields/registry.tsx</code>{' '}
        and write a function matching the signature above. The schema layer
        stays put, the validation layer stays put, the main render flow stays
        put.
      </>
    ),
    fallbackNote: (
      <>
        An unregistered widget falls back to <code>text</code> — one mistyped
        widget name won't blank the page, it just turns into a text input.
      </>
    ),
  },

  api: {
    h1: 'API',
    h2Hook: 'useFormEngine(schema, initialValues?)',
    hookPara:
      'The state entry point. Values have a single source of truth; validation, the submit payload and conditional visibility are all derived from it.',
    hookTable: {
      head: ['Returns', 'Description'],
      rows: [
        [<code>values</code>, 'Form state, a plain object tree'],
        [<code>errors</code>, 'Flat error table; keys are full field paths'],
        [
          <code>payload</code>,
          'What would be submitted right now — trimmed by visibility, computed live',
        ],
        [<code>status</code>, <code>idle | ok | error</code>],
        [
          <code>handleChange</code>,
          '(path, value) => void. Sets the value and clears only this field\'s own error',
        ],
        [
          <code>handleFieldBlur</code>,
          '(path) => void. On blur, validates only this field',
        ],
        [
          <code>submit</code>,
          '() => payload | undefined. Full validation; on failure, scrolls to and focuses the first error',
        ],
        [<code>reset</code>, '(next?) => void'],
      ],
    },
    blurNote:
      'Why validate on blur: turning the whole form red on every keystroke drives away anyone filling it in for the first time.',
    h2DynamicForm: 'DynamicForm',
    dynamicFormTable: { head: ['prop', 'Type'], rows: DYNAMICFORM_ROWS },
    h2Pure: 'Pure logic exports',
    purePara:
      "All of these can be used without React — they don't import React and never touch the DOM:",
    pureTable: { head: ['Module', 'Exports'], rows: PURE_ROWS },
  },

  internals: {
    h1: 'Implementation notes',
    intro:
      'Four rules hold up the whole engine. They are also where this project draws its boundaries.',
    h2Rule1: '1. Hidden = not rendered + not validated + not submitted',
    rule1a: (
      <>
        When <code>visibleWhen</code> doesn't hold, the field returns{' '}
        <code>null</code> outright — not <code>display: none</code>. And
        validation and serialization each skip it on their own.
      </>
    ),
    rule1b: (
      <>
        A value the user typed into the travel branch reappears after
        switching to entertainment and back — it has been in the form state
        all along. But it never enters the submit payload. Otherwise a travel
        itinerary would carry entertainment-related fields,{' '}
        <strong>and since both sides are valid values, backend validation
        can't catch that</strong>.
      </>
    ),
    h2Rule2: '2. "Validated ⇔ submitted"',
    rule2a: (
      <>
        Validation and serialization each resolve visibility once, and the two
        must agree semantically. There are exactly two exceptions, both
        deliberate: <strong>readonly fields</strong> and{' '}
        <strong>locked cells in a table</strong> — they are submitted but not
        validated.
      </>
    ),
    rule2b: (
      <>
        This invariant is pinned down by <code>consistency.test.ts</code>. An
        invariant without a test doesn't exist.
      </>
    ),
    h2Rule3: '3. Immutable updates with structural sharing',
    rule3: (
      <>
        <code>setPath</code> clones only the nodes along the path; siblings
        keep their references. So the cost of each keystroke depends on field
        depth, not on form size — a form with hundreds of fields never
        deep-copies the whole object tree because of one input.
      </>
    ),
    h2Rule4: "4. Error targeting doesn't depend on a UI library",
    rule4: (
      <>
        Validation produces a flat path table; the render layer puts the path
        on <code>data-path</code>. When submit is blocked,{' '}
        <code>focusFirstError</code> queries the DOM directly: scroll + focus
        + a little shake. No UI library's <code>FormInstance</code> needed.
      </>
    ),
    h2NotDoing: "What I deliberately didn't do",
    notDoingTable: {
      head: ['Not doing', 'Why'],
      rows: [
        [
          'Callback functions in conditions',
          'Once functions are allowed, the schema stops being data — a config backend, permission checks and server-side pre-validation all become impossible',
        ],
        [
          'Rules like "amount greater than the sum of the previous three rows"',
          'Same reason. This is the ceiling of expressiveness, a designed boundary, not an oversight',
        ],
        [
          'Unit tests for the render layer',
          'They drag in React and the DOM, and once they do, jsdom is just decoration. Code that wants to be unit-tested has to cut its dependencies first',
        ],
      ],
    },
  },
};

const C: Record<Lang, DocsContent> = { zh, en };

export default function Docs({ lang }: { lang: 'zh' | 'en' }) {
  const [active, setActive] = useState('start');
  const t = C[lang];

  return (
    <div className="mx-auto grid max-w-[1080px] grid-cols-[190px_minmax(0,1fr)] gap-8 px-6 pt-9 pb-24 max-[860px]:grid-cols-1 max-[860px]:gap-4.5">
      {/* top-21 = 84px：悬浮导航条底边在 68px，再留 16px 呼吸 */}
      <nav className="sticky top-21 flex self-start flex-col gap-0.5 max-[860px]:static max-[860px]:flex-row max-[860px]:flex-wrap">
        {t.nav.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rounded-[7px] px-2.5 py-[7px] text-left text-[13.5px] ${
              item.id === active
                ? 'bg-accent-soft text-accent'
                : 'text-dim hover:bg-surface hover:text-ink'
            }`}
            onClick={() => setActive(item.id)}
          >
            {item.title}
          </button>
        ))}
      </nav>

      <div className="prose-docs min-w-0 max-w-[760px]">
        {active === 'start' && <StartSection t={t.start} />}
        {active === 'schema' && <SchemaSection t={t.schema} />}
        {active === 'conditions' && <ConditionsSection t={t.conditions} />}
        {active === 'rules' && <RulesSection t={t.rules} />}
        {active === 'widgets' && <WidgetsSection t={t.widgets} />}
        {active === 'api' && <ApiSection t={t.api} />}
        {active === 'internals' && <InternalsSection t={t.internals} />}
      </div>
    </div>
  );
}

function StartSection({ t }: { t: DocsContent['start'] }) {
  return (
    <>
      <h1>{t.h1}</h1>
      <p>{t.intro}</p>
      <Code lang="bash">{t.installCode}</Code>

      <h2>{t.h2Minimal}</h2>
      <p>{t.minimalIntro}</p>
      <Code>{CODE_MINIMAL}</Code>
      <p className="mb-3.5 rounded-lg bg-page px-3.5 py-[11px] text-[13px] text-dim">
        {t.minimalNote}
      </p>
    </>
  );
}

function SchemaSection({ t }: { t: DocsContent['schema'] }) {
  return (
    <>
      <h1>{t.h1}</h1>
      <p>{t.intro}</p>
      <Code>{t.schemaCode}</Code>

      <h2>{t.h2Kinds}</h2>
      <DocTable head={t.kindsTable.head} rows={t.kindsTable.rows} />

      <h2>{t.h2Common}</h2>
      <DocTable head={t.commonTable.head} rows={t.commonTable.rows} />

      <h2>{t.h2Field}</h2>
      <DocTable head={t.fieldTable.head} rows={t.fieldTable.rows} />

      <h2>{t.h2List}</h2>
      <DocTable head={t.listTable.head} rows={t.listTable.rows} />
      <p className="mb-3.5 rounded-lg bg-page px-3.5 py-[11px] text-[13px] text-dim">
        {t.listNote}
      </p>
    </>
  );
}

function ConditionsSection({ t }: { t: DocsContent['conditions'] }) {
  return (
    <>
      <h1>{t.h1}</h1>
      <p>{t.intro}</p>
      <Code>{CODE_CONDITION}</Code>

      <h2>{t.h2Ops}</h2>
      <DocTable head={t.opsTable.head} rows={t.opsTable.rows} />

      <h2>{t.h2Combine}</h2>
      <p>{t.combineIntro}</p>
      <Code>{CODE_AND}</Code>

      <h2>{t.h2Paths}</h2>
      <p>{t.pathsIntro}</p>
      <ol className="mb-3.5 list-decimal pl-[22px] text-sm leading-[1.85] text-body [&>li]:mb-1.5">
        <li>{t.step1}</li>
        <li>{t.step2}</li>
      </ol>
      <p className="mb-3.5 rounded-r-lg border-l-[3px] border-danger bg-danger-soft px-3.5 py-[11px] text-[13px] text-danger-ink">
        {t.pathWarning}
      </p>
      <p>{t.hasPathPara}</p>

      <h2>{t.h2Lenient}</h2>
      <ul className="mb-3.5 list-disc pl-[22px] text-sm leading-[1.85] text-body [&>li]:mb-1.5">
        <li>{t.lenient1}</li>
        <li>{t.lenient2}</li>
      </ul>
    </>
  );
}

function RulesSection({ t }: { t: DocsContent['rules'] }) {
  return (
    <>
      <h1>{t.h1}</h1>
      <DocTable head={t.rulesTable.head} rows={t.rulesTable.rows} />

      <h2>{t.h2Patterns}</h2>
      <DocTable head={t.patternsTable.head} rows={t.patternsTable.rows} />

      <h2>{t.h2Semantics}</h2>
      <ul className="mb-3.5 list-disc pl-[22px] text-sm leading-[1.85] text-body [&>li]:mb-1.5">
        <li>{t.semantics[0]}</li>
        <li>{t.semantics[1]}</li>
        <li>{t.semantics[2]}</li>
      </ul>
      <p className="mb-3.5 rounded-lg bg-page px-3.5 py-[11px] text-[13px] text-dim">
        {t.errorNote}
      </p>
    </>
  );
}

function WidgetsSection({ t }: { t: DocsContent['widgets'] }) {
  return (
    <>
      <h1>{t.h1}</h1>
      <p>{t.intro}</p>
      <DocTable head={t.widgetsTable.head} rows={t.widgetsTable.rows} />

      <h2>{t.h2Controlled}</h2>
      <p>{t.controlledPara}</p>
      <Code>{CODE_CONTEXT}</Code>

      <h2>{t.h2Add}</h2>
      <p>{t.addPara}</p>
      <p className="mb-3.5 rounded-lg bg-page px-3.5 py-[11px] text-[13px] text-dim">
        {t.fallbackNote}
      </p>
    </>
  );
}

function ApiSection({ t }: { t: DocsContent['api'] }) {
  return (
    <>
      <h1>{t.h1}</h1>
      <h2>{t.h2Hook}</h2>
      <p>{t.hookPara}</p>
      <DocTable head={t.hookTable.head} rows={t.hookTable.rows} />
      <p className="mb-3.5 rounded-lg bg-page px-3.5 py-[11px] text-[13px] text-dim">
        {t.blurNote}
      </p>

      <h2>{t.h2DynamicForm}</h2>
      <DocTable head={t.dynamicFormTable.head} rows={t.dynamicFormTable.rows} />

      <h2>{t.h2Pure}</h2>
      <p>{t.purePara}</p>
      <DocTable head={t.pureTable.head} rows={t.pureTable.rows} />
    </>
  );
}

function InternalsSection({ t }: { t: DocsContent['internals'] }) {
  return (
    <>
      <h1>{t.h1}</h1>
      <p>{t.intro}</p>

      <h2>{t.h2Rule1}</h2>
      <p>{t.rule1a}</p>
      <p>{t.rule1b}</p>

      <h2>{t.h2Rule2}</h2>
      <p>{t.rule2a}</p>
      <p>{t.rule2b}</p>

      <h2>{t.h2Rule3}</h2>
      <p>{t.rule3}</p>

      <h2>{t.h2Rule4}</h2>
      <p>{t.rule4}</p>

      <h2>{t.h2NotDoing}</h2>
      <DocTable head={t.notDoingTable.head} rows={t.notDoingTable.rows} />
    </>
  );
}
