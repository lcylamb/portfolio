/**
 * Schema 类型定义 —— 引擎的输入契约。
 *
 * ## 唯一的硬约束：整份 Schema 必须能 `JSON.stringify` 走一遍再 `JSON.parse` 回来
 *
 * 这一条决定了下面几乎所有设计。后端不可能下发一个 JavaScript 闭包，
 * 所以「动态显隐」「按条件可编辑」「条件必填」这类逻辑**不能**写成
 * `visibleWhen: (values) => ...` 这种回调，只能退化成**声明式的条件表达式**
 * （`ConditionExpr`）—— 由一个求值器在运行时解释执行。
 *
 * 主项目里对应的是 `FieldsConfig`（后端字段配置）里的 `dataType` /
 * `writableFlag` / `requiredFlag` / `dataValues` 那几个扁平字段：它们是
 * **按字段写死的**，无法表达「A 字段影响 B 字段」。这个引擎把这层补上，
 * 但代价就是条件必须可序列化 —— 见 `README.md` 的「设计取舍」第 1 条。
 *
 * ## 为什么节点是「可辨识联合」而不是一个万能接口
 *
 * `kind` 作为判别式，`NodeSchema` 四种形态各自持有不相交的字段。
 * 好处是渲染层 `switch (node.kind)` 之后 TypeScript 会自动收窄，
 * 不需要任何 `as` 断言 —— 主项目 `FormList.tsx` 里那种
 * `(el as any).xxx` 的写法在这里是不必要的。
 */

/* ------------------------------------------------------------------ *
 * 控件
 * ------------------------------------------------------------------ */

/**
 * 内置控件键。刻意**不是** TS enum —— 渲染器注册表是
 * `Record<string, FieldRenderer>`，允许业务方注册自定义控件，
 * 用 enum 会把扩展点焊死。
 */
export type WidgetKey =
  | 'text'
  | 'textarea'
  | 'number'
  | 'money'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'switch';

export interface OptionItem {
  label: string;
  value: string | number;
}

/* ------------------------------------------------------------------ *
 * 条件表达式
 * ------------------------------------------------------------------ */

export type ConditionOp =
  | 'eq'
  | 'neq'
  | 'in'
  | 'nin'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'notEmpty'
  | 'empty'
  | 'truthy'
  | 'falsy';

/**
 * 一条原子条件。
 *
 * `field` 是**路径**，不是单个 key：列表项内部会用相对路径（如 `invoiceKind`），
 * 列表外会用完整路径（如 `basic.claimScene`）。解析顺序见
 * `conditions.ts` 的 `resolve()`：**先局部作用域，找不到再回退到根** ——
 * 这样同一份 item schema 在任意一层列表里都能复用，不需要把下标写进 schema。
 */
export interface Condition {
  field: string;
  op: ConditionOp;
  value?: unknown;
}

export interface AndExpr {
  and: ConditionExpr[];
}
export interface OrExpr {
  or: ConditionExpr[];
}
export interface NotExpr {
  not: ConditionExpr;
}

export type ConditionExpr = Condition | AndExpr | OrExpr | NotExpr;

/* ------------------------------------------------------------------ *
 * 校验规则
 * ------------------------------------------------------------------ */

/** 内置正则。业务正则走 `pattern` 传字符串源，引擎内部 `new RegExp` */
export type PatternName = 'phone' | 'idcard' | 'money' | 'personName';

export interface Rule {
  required?: boolean;
  /** 条件必填：表达式为真时才认 `required`。与 `required` 是**或**的关系 */
  requiredWhen?: ConditionExpr;
  pattern?: PatternName;
  min?: number;
  max?: number;
  maxLength?: number;
  /** 覆盖任何内置文案。只要给了它，其它规则命中时也用它 */
  message?: string;
}

/* ------------------------------------------------------------------ *
 * 节点
 * ------------------------------------------------------------------ */

export interface BaseNode {
  /** 在所属作用域内的键名。**必须唯一**，根节点之间也不能重名 */
  name: string;
  title?: string;
  /** 说明文案，渲染在 label 右侧 */
  description?: string;
  visibleWhen?: ConditionExpr;
}

export interface FieldSchema extends BaseNode {
  kind?: 'field';
  widget: WidgetKey;
  placeholder?: string;
  options?: OptionItem[];
  rules?: Rule;
  defaultValue?: unknown;
  /**
   * 栅格占比（12 栅）。不给时按控件推导：`textarea` / 多选类占满整行，
   * 其余占 1/3 —— 见 `FormItem.tsx` 的 `resolveSpan()`。
   */
  span?: 4 | 6 | 8 | 12;
  /** 只读。值保留、不参与校验（只读字段不该弹「必填」） */
  disabledWhen?: ConditionExpr;
}

export interface GroupSchema extends BaseNode {
  kind: 'group';
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children: NodeSchema[];
}

/** 可增删列表：每一项是一组同构字段 */
export interface ListSchema extends BaseNode {
  kind: 'list';
  min?: number;
  max?: number;
  /** 标题模板，`{index}` 从 1 开始 */
  itemTitleTemplate?: string;
  addText?: string;
  children: FieldSchema[];
}

export interface ColumnSchema {
  name: string;
  title: string;
  widget: WidgetKey;
  width?: number;
  options?: OptionItem[];
  rules?: Rule;
  /** 该单元格能否编辑。**按当前行的数据判定** —— 这是「费用复核」场景的关键 */
  editableWhen?: ConditionExpr;
  align?: 'left' | 'center' | 'right';
}

/**
 * 可编辑表格。
 *
 * 与 `ListSchema` 的区别不是「长得不一样」，而是**语义不同**：
 * list 的每一项是一个独立业务对象（一条明细），字段可以竖向铺开、
 * 可以放 textarea；table 的行是**同构的明细**，必须横向对齐、允许逐单元格锁定。
 * 主项目里前者对应 `FormList`，后者对应 `EditableProTableFormItem`。
 */
export interface TableSchema extends BaseNode {
  kind: 'table';
  min?: number;
  max?: number;
  /** 整表是否可编辑，默认 true。单独的列可用 `editableWhen` 再收窄 */
  editable?: boolean;
  columns: ColumnSchema[];
  /** 需要求和展示的列 name，渲染成 tfoot 合计行 */
  summaryOf?: string[];
}

export type NodeSchema = FieldSchema | GroupSchema | ListSchema | TableSchema;

/**
 * 判别式守卫。
 *
 * 不能写成 `const kind = node.kind ?? 'field'` 再 `if (kind === 'group')` ——
 * 那样 `kind` 会被推成 `string`，`node` 反而失去了收窄，后面每个分支都得
 * 补一个 `as GroupSchema`。主项目里满屏的 `(el as any).xxx` 就是这么来的。
 * 让 TS 按 `kind` 自己收窄，断言一个都不用写。
 */
export function isGroup(node: NodeSchema): node is GroupSchema {
  return node.kind === 'group';
}

export function isList(node: NodeSchema): node is ListSchema {
  return node.kind === 'list';
}

export function isTable(node: NodeSchema): node is TableSchema {
  return node.kind === 'table';
}

/** 排除法拿到字段节点 —— 剩下的一定是 FieldSchema */
export function isFieldNode(node: NodeSchema): node is FieldSchema {
  return !isGroup(node) && !isList(node) && !isTable(node);
}

/* ------------------------------------------------------------------ *
 * 运行时
 * ------------------------------------------------------------------ */

export type FormValues = Record<string, unknown>;

/** 扁平错误表。key 是字段的**完整路径**，如 `invoiceList.0.amount` */
export type FormErrors = Record<string, string>;

export interface FormSchema {
  title?: string;
  description?: string;
  nodes: NodeSchema[];
}
