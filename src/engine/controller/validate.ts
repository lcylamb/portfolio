import { getPath } from '../path';
import { evaluate, type Scope } from '../schema/conditions';
import { isGroup, isList, isTable } from '../schema/types';
import type {
  FormErrors,
  NodeSchema,
  Rule,
  TableSchema,
  ColumnSchema,
} from '../schema/types';

/**
 * 全量校验 —— 返回一张**扁平**的错误表，key 是字段完整路径。
 *
 * ## 为什么是扁平的、而不是跟 values 同构的嵌套对象
 *
 * 嵌套结构在渲染层很难用：列表里第 3 项的第 2 个字段出错时，
 * 组件拿到的是索引路径，回头去嵌套对象里一层层剥，代码会写成一团。
 * 扁平表让组件只要拿自己构造时就知道的那条 `path` 去查表即可 ——
 * 渲染器不需要知道自己在第几层、也不知道自己是 list 还是 table。
 *
 * 主项目里对应的是 antd 的 `errorFields` + `getErrorFieldsName()`：
 * 那边把路径翻成中文 `showName` 只为了拼一句提示语，代价是错误
 * **无法定位到具体控件**，只能靠 `form.scrollToField()`。
 * 这里改成扁平路径后，`focusFirstError()` 可以直接靠
 * `data-path` 属性找 DOM。
 *
 * ## 遍历顺序 = 错误优先级
 *
 * `pickFirstError()` 返回的是错误表里的第一个键，而对象的键顺序
 * 就是**插入顺序**，也就是本函数的遍历顺序，也就是 schema 的书写顺序。
 * 所以「提交时跳到第一个出错字段」这件事不需要额外排序 ——
 * 但反过来说，**schema 的顺序就是用户的填写顺序**，不能乱排。
 */

/**
 * 内置正则。
 *
 * `personName` 这一条值得单独说，因为它**必须把长度和结构写在同一个正则里**：
 *
 * - 结构：用 `[...]+` 打底再放行 `···` 分隔符（少数民族姓名、护照名），
 *   这样首尾带点、连续两个点都会被拒 —— 简单的 `+·` 字符集做不到；
 * - 长度：靠前置断言 `(?=.{2,20}$)` 兜住**整串**长度。
 *   不能只靠重复次数限制，因为 `{2,20}` 加在分段上时，
 *   `阿依古丽·买买提` 这种两段姓名会各自合规但总长超标。
 *
 * 主项目 `Expense` 里姓名只校验了非空，长度交给后端；这里补上是因为
 * 「校验前置」是本引擎对外承诺的一部分 —— 见 README「设计取舍」第 3 条。
 */
const PATTERNS: Record<string, RegExp> = {
  phone: /^1[3-9]\d{9}$/,
  idcard: /^\d{17}[\dXx]$/,
  money: /^\d+(\.\d{1,2})?$/,
  personName:
    /^(?=.{2,20}$)[\u4e00-\u9fa5A-Za-z]+(?:·[\u4e00-\u9fa5A-Za-z]+)*$/,
};

const PATTERN_HINT: Record<string, string> = {
  phone: '格式不正确，应为 11 位手机号',
  idcard: '格式不正确，应为 18 位身份证号',
  money: '请填写合法金额，最多两位小数',
  personName: '仅支持 2-20 位中英文姓名',
};

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/**
 * 单条规则集校验。
 *
 * 短路语义（**很重要**）：一旦命中某条规则就直接 return，
 * 后写的规则不再覆盖前面的文案。所以错误表里每个路径只会有一条消息，
 * 展示层不需要处理「多条错误怎么展示」。
 * 顺序是：必填 → 正则 → 长度 → 数值区间。
 */
function checkRules(
  rule: Rule | undefined,
  value: unknown,
  scope: Scope,
  path: string,
  errors: FormErrors,
  title: string,
): void {
  if (!rule) return;

  const required =
    rule.required === true ||
    (rule.requiredWhen ? evaluate(rule.requiredWhen, scope) : false);
  if (required && isEmpty(value)) {
    errors[path] = rule.message ?? `请填写${title}`;
    return;
  }

  // 非必填且为空 → 放行。这才是「选填」该有的语义：
  // 没填就不校验格式，否则用户会被一条空值的正则拦住，一头雾水。
  if (isEmpty(value)) return;

  if (rule.pattern) {
    const pattern = PATTERNS[rule.pattern];
    if (pattern && !pattern.test(String(value))) {
      errors[path] = rule.message ?? `${title}${PATTERN_HINT[rule.pattern]}`;
      return;
    }
  }

  if (rule.maxLength !== undefined && String(value).length > rule.maxLength) {
    errors[path] = rule.message ?? `${title}最多 ${rule.maxLength} 个字符`;
    return;
  }

  if (rule.min !== undefined || rule.max !== undefined) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      errors[path] = rule.message ?? `${title}必须是数字`;
      return;
    }
    if (rule.min !== undefined && num < rule.min) {
      errors[path] = rule.message ?? `${title}不能小于 ${rule.min}`;
      return;
    }
    if (rule.max !== undefined && num > rule.max) {
      errors[path] = rule.message ?? `${title}不能大于 ${rule.max}`;
    }
  }
}

function walkNodes(
  nodes: NodeSchema[],
  scope: Scope,
  prefix: string,
  errors: FormErrors,
): void {
  for (const node of nodes) {
    const path = prefix ? `${prefix}.${node.name}` : node.name;

    // 不可见 = 不存在。既不校验、也不进提交体（后者见 serialize.ts）。
    if (!evaluate(node.visibleWhen, scope)) continue;

    if (isGroup(node)) {
      walkNodes(
        node.children,
        { root: scope.root, local: getPath(scope.root, path) },
        path,
        errors,
      );
      continue;
    }

    if (isList(node)) {
      const rows = getPath(scope.root, path);
      const list = Array.isArray(rows) ? rows : [];

      // 空列表的「至少一项」由 list 自己的 min 表达，不在这里报错 ——
      // 报的话错误会挂在一个没有控件的路径上，用户点不到。
      list.forEach((item, index) => {
        walkNodes(
          node.children,
          { root: scope.root, local: item },
          `${path}.${index}`,
          errors,
        );
      });
      continue;
    }

    if (isTable(node)) {
      walkTable(node, scope, path, errors);
      continue;
    }

    // 只读字段跳过校验：它是后端回显的，用户改不了，
    // 弹「必填」只会让用户对着一个灰色输入框抓狂。
    if (node.disabledWhen && evaluate(node.disabledWhen, scope)) continue;
    checkRules(
      node.rules,
      getPath(scope.root, path),
      scope,
      path,
      errors,
      node.title ?? node.name,
    );
  }
}

function walkTable(
  table: TableSchema,
  scope: Scope,
  path: string,
  errors: FormErrors,
): void {
  const rows = getPath(scope.root, path);
  const list = (Array.isArray(rows) ? rows : []) as Record<string, unknown>[];

  list.forEach((row, index) => {
    for (const column of table.columns) {
      const columnScope: Scope = { root: scope.root, local: row };

      // 锁定单元格不校验。这与「只读字段」是同一个理由，但判定依据是**本行数据**
      // —— 例如「已复核通过」的行不允许再改金额，它的必填也就没有意义。
      if (column.editableWhen && !evaluate(column.editableWhen, columnScope))
        continue;

      checkRules(
        column.rules,
        row?.[column.name],
        columnScope,
        `${path}.${index}.${column.name}`,
        errors,
        column.title,
      );
    }
  });
}

/** 校验入口。`values` 是整棵表单数据树 */
export function validate(nodes: NodeSchema[], values: unknown): FormErrors {
  const errors: FormErrors = {};
  walkNodes(nodes, { root: values }, '', errors);
  return errors;
}

/** 取第一个出错的路径。顺序即 schema 顺序，见文件头注释 */
export function pickFirstErrorPath(errors: FormErrors): string | undefined {
  return Object.keys(errors)[0];
}

/** 只校验单个路径 —— 失焦时用，避免用户还没填完就被整表标红 */
export function validateAtPath(
  nodes: NodeSchema[],
  values: unknown,
  targetPath: string,
): string | undefined {
  const all = validate(nodes, values);
  return all[targetPath];
}

/** 统计错误条数，给「提交被拦」的提示用 */
export function countErrors(errors: FormErrors): number {
  return Object.keys(errors).length;
}

export type { ColumnSchema };
