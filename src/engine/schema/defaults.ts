import { isGroup, isList, isTable } from './types';
import type { FieldSchema, NodeSchema, OptionItem } from './types';

/**
 * 按 schema 生成一份「完整的空值」。
 *
 * 为什么必须**递归铺满**、而不是给个 `{}` 让运行时按需创建：
 *
 * 1. 条件求值器要能区分「字段存在但为空」和「字段不存在」（见
 *    `path.ts` 的 `hasPath`）—— 只有预先铺满，局部作用域才稳定；
 * 2. 受控组件拿到 `undefined` 会在 React 里触发
 *    「uncontrolled → controlled」告警，必须有个确定的初值；
 * 3. 切 schema（如单据状态从「填报」走到「复核」）时，宿主可以用
 *    `{ ...createInitialValues(next), ...已填值 }` 合并，未出现的字段自然被丢弃。
 *
 * ⚠️ 列表与表格**初始为空数组**，不预置一行。预置行看起来「页面更饱满」，
 * 但会让「没有任何明细项」和「有一个空明细项」变得无法区分 ——
 * 提交时前者该被拦、后者该被校验，语义完全不同。
 */
export function createInitialValues(
  nodes: NodeSchema[],
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const node of nodes) {
    if (isGroup(node)) {
      values[node.name] = createInitialValues(node.children);
      continue;
    }

    if (isList(node) || isTable(node)) {
      values[node.name] = [];
      continue;
    }

    values[node.name] =
      node.defaultValue !== undefined ? node.defaultValue : blankOf(node);
  }

  return values;
}

/** 单个字段的空值。控件语义不同，空值也不同 —— 多选必须是 `[]` 而不是 `''` */
export function blankOf(field: Pick<FieldSchema, 'widget'>): unknown {
  if (field.widget === 'checkbox') return [];
  if (field.widget === 'switch') return false;
  return '';
}

/** 列表「添加一项」时的初始项 */
export function createListItemValues(
  children: FieldSchema[],
): Record<string, unknown> {
  const item: Record<string, unknown> = {};
  for (const field of children) {
    item[field.name] =
      field.defaultValue !== undefined ? field.defaultValue : blankOf(field);
  }
  return item;
}

/** 表格「添加一行」时的初始行。列没有 defaultValue 概念，一律用控件空值 */
export function createTableRowValues(
  columns: { name: string; widget: FieldSchema['widget'] }[],
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const column of columns) {
    row[column.name] = blankOf(column as Pick<FieldSchema, 'widget'>);
  }
  return row;
}

/**
 * 把「枚举选项」取成展示文案。
 *
 * 表格里的只读单元格、以及提交前的数据预览都要用。找不到匹配项时
 * **原样返回**而不是返回 `—`：后端下发了前端不认识的新枚举值时，
 * 显示原始码好过显示一个空占位（至少能看出「这是个没登记的码」）。
 */
export function resolveOptionLabel(
  options: OptionItem[] | undefined,
  value: unknown,
): string {
  if (value === undefined || value === null || value === '') return '—';

  if (options?.length) {
    const hit = options.find(
      (option) => String(option.value) === String(value),
    );
    return hit ? hit.label : String(value);
  }

  if (Array.isArray(value)) return value.length ? value.join('、') : '—';
  if (typeof value === 'boolean') return value ? '是' : '否';

  return String(value);
}
