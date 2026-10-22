import { getPath, hasPath } from '../path';
import type { Condition, ConditionExpr, ConditionOp } from './types';

/**
 * 条件表达式求值器。
 *
 * ## 为什么要有作用域（Scope）这一层
 *
 * 列表项 / 表格行内部的字段，引用兄弟字段时**不应该**写完整路径
 * （`invoiceList.0.invoiceKind`）—— 因为 schema 是「每一项都长一样」的，
 * 写死下标等于把 schema 复制 N 份。
 *
 * 所以这里引入 `local`：求值时**先局部、后根**。于是同一份
 * `visibleWhen: { field: 'invoiceKind', op: 'neq', value: 'VAT_SPECIAL' }`
 * 在列表里指向本行，在根上指向顶层字段，schema 一个字都不用改。
 *
 * ⚠️ 顺序不能反过来。先查根的话，只要顶层恰好有个同名字段，
 * 列表项就会静默地读到外层值 —— 这种 bug 在页面上只表现为「偶尔显隐不对」，
 * 极难定位。主项目里 `ProFormDependency` 的依赖名曾经踩过同类的坑。
 */

export interface Scope {
  /** 表单根数据 */
  root: unknown;
  /** 当前作用域（列表项 / 表格行）。根层为 undefined */
  local?: unknown;
}

/**
 * 取值：先局部、后根。
 *
 * 用 `hasPath` 而不是 `getPath(...) !== undefined` 判断「局部有没有」——
 * 见 `path.ts` 里 `hasPath` 的注释：一个被显式写为 `undefined` 的字段
 * 仍然算「局部有」，不该穿透到根。这条差异由一个单测钉住。
 */
function resolve(scope: Scope, field: string): unknown {
  if (scope.local !== undefined && hasPath(scope.local, field)) {
    return getPath(scope.local, field);
  }
  return getPath(scope.root, field);
}

/**
 * 比较前统一归一化。
 *
 * 表单里同一个含义的值会有多种形态：`select` 存字符串 `'1'`、
 * 后端下发的 `value` 是数字 `1`、`switch` 存布尔、多选存数组。
 * 不做归一化的话，条件里写 `value: 1` 而字段实际是 `'1'`，
 * 就会静默不匹配 —— 表现为「选了却没反应」。
 *
 * 归一化策略：数字与布尔一律折成字符串比较；数组保持原样（由 op 处理）。
 */
function normalize(value: unknown): unknown {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return value;
}

function toNumber(value: unknown): number {
  if (value === '' || value === null || value === undefined) return NaN;
  return Number(value);
}

const OPERATORS: Record<
  ConditionOp,
  (actual: unknown, expected: unknown) => boolean
> = {
  eq: (a, b) => normalize(a) === normalize(b),
  neq: (a, b) => normalize(a) !== normalize(b),
  in: (a, b) =>
    Array.isArray(b) && b.some((item) => normalize(item) === normalize(a)),
  nin: (a, b) =>
    Array.isArray(b) && !b.some((item) => normalize(item) === normalize(a)),
  // 数值比较不做 normalize —— '10' > '9' 在字符串语义下是 false，而这里要的是 true
  gt: (a, b) => toNumber(a) > toNumber(b),
  gte: (a, b) => toNumber(a) >= toNumber(b),
  lt: (a, b) => toNumber(a) < toNumber(b),
  lte: (a, b) => toNumber(a) <= toNumber(b),
  notEmpty: (a) =>
    a !== undefined &&
    a !== null &&
    a !== '' &&
    !(Array.isArray(a) && a.length === 0),
  empty: (a) =>
    a === undefined ||
    a === null ||
    a === '' ||
    (Array.isArray(a) && a.length === 0),
  truthy: (a) => Boolean(a),
  falsy: (a) => !a,
};

function isAtomic(expr: ConditionExpr): expr is Condition {
  return typeof (expr as Condition).field === 'string';
}

/**
 * 求值。
 *
 * `undefined` 视为 `true` —— 「没写条件」＝「永远成立」，让调用方
 * 不必到处写 `expr ? evaluate(expr, scope) : true`。
 *
 * 未知的 `op` 也返回 `true`：后端先上了条件新算子、前端还没发版时，
 * 宁可多显示一个字段，也不要整块表单因为一条读不懂的规则而全部消失。
 */
export function evaluate(
  expr: ConditionExpr | undefined,
  scope: Scope,
): boolean {
  if (!expr) return true;

  if (isAtomic(expr)) {
    const operator = OPERATORS[expr.op];
    if (!operator) return true;
    return operator(resolve(scope, expr.field), expr.value);
  }

  if ('and' in expr) return expr.and.every((child) => evaluate(child, scope));
  if ('or' in expr) return expr.or.some((child) => evaluate(child, scope));
  if ('not' in expr) return !evaluate(expr.not, scope);

  return true;
}

/**
 * 收集表达式引用到的全部字段。
 *
 * 目前只用于「预置数据里有哪些字段需要初始化」和调试面板，
 * **不是**用来做增量重算的 —— 本引擎每渲染一次就全量求值一遍。
 * 表单字段数是百级、不是万级，全量求值的开销远小于维护一张
 * 「字段 → 依赖它的表达式」反向索引的复杂度。真到了需要增量的规模，
 * 这个函数是现成的起点。
 */
export function collectReferencedFields(
  expr: ConditionExpr | undefined,
  out = new Set<string>(),
): Set<string> {
  if (!expr) return out;

  if (isAtomic(expr)) {
    out.add(expr.field);
    return out;
  }

  if ('and' in expr)
    expr.and.forEach((child) => collectReferencedFields(child, out));
  else if ('or' in expr)
    expr.or.forEach((child) => collectReferencedFields(child, out));
  else if ('not' in expr) collectReferencedFields(expr.not, out);

  return out;
}
