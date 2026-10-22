import { getPath } from '../path';
import { evaluate, type Scope } from '../schema/conditions';
import { isGroup, isList, isTable } from '../schema/types';
import type { NodeSchema } from '../schema/types';

/**
 * 按显隐规则裁剪出「真正会提交」的数据。
 *
 * ## 为什么要有这一层，而不是直接把 `values` 发出去
 *
 * 引擎的 `values` 里**同时装着所有分支的字段**：差旅的「开票方」和招待的
 * 「招待天数」都在树上，只是其中一个被 `visibleWhen` 藏起来了。
 * 直接把整棵树发给后端会造成两类问题：
 *
 * 1. **脏数据落库**。用户在差旅分支填了「招待天数」，切到招待分支又填一遍，
 *    切回去时那个值还躺在 `values` 里 —— 后端拿到一张差旅单带招待天数，
 *    校验逻辑根本拦不住，因为它们都是「合法值」。
 * 2. **加密成本按字段数线性放大**。主项目的敏感字段要 AES 加密后落库
 *    （`codec/crypto.ts`），多带一个用不上的字段就多一次加解密，
 *    而且后端脱敏规则会误判。
 *
 * 所以「隐藏即不提交」是业务硬要求，不是洁癖。
 *
 * ## 与 `validate()` 的关系
 *
 * 两者共用同一套可见性判定，**必须保持一致**：能被校验的字段一定能提交，
 * 反之亦然。任何一边单独改了 `visibleWhen` 的语义，都会造出
 * 「校验过了但提交时字段没了」或者反过来的幽灵 bug。
 * 单测 `__tests__/consistency.test.ts` 钉的就是这条不变量。
 *
 * ⚠️ 本函数**不做**深拷贝。返回的对象里，数组元素是新建的、标量是直接引用。
 * 引擎的值本身就是不可变更新的（见 `path.ts`），所以共享引用是安全的；
 * 但如果调用方要就地改返回结果，得自己先拷一份。
 */
export function serializeVisible(
  nodes: NodeSchema[],
  values: unknown,
): Record<string, unknown> {
  return pick(nodes, { root: values }, '');
}

function pick(
  nodes: NodeSchema[],
  scope: Scope,
  prefix: string,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const node of nodes) {
    const path = prefix ? `${prefix}.${node.name}` : node.name;
    if (!evaluate(node.visibleWhen, scope)) continue;

    if (isGroup(node)) {
      const local = getPath(scope.root, path);
      output[node.name] = pick(
        node.children,
        { root: scope.root, local },
        path,
      );
      continue;
    }

    if (isList(node)) {
      const rows = getPath(scope.root, path);
      const list = Array.isArray(rows) ? rows : [];
      output[node.name] = list.map((item, index) =>
        pick(
          node.children,
          { root: scope.root, local: item },
          `${path}.${index}`,
        ),
      );
      continue;
    }

    if (isTable(node)) {
      const rows = getPath(scope.root, path);
      const list = (Array.isArray(rows) ? rows : []) as Record<
        string,
        unknown
      >[];

      /**
       * 表格**整行保留所有列**，即使某列当前被 `editableWhen` 锁定。
       *
       * 与字段的区别在于：字段的显隐是「这个字段跟本次单据无关」，
       * 而单元格的锁定是「你有权看、但此刻无权改」。后者依然要提交，
       * 不然前端会把「用户没权限改」误传成「用户清空了」。
       */
      output[node.name] = list.map((row) => {
        const record: Record<string, unknown> = {};
        for (const column of node.columns)
          record[column.name] = row?.[column.name];
        return record;
      });
      continue;
    }

    // 只读字段**保留**。它是后端回显的服务端权威值，提交时要原样带回，
    // 否则后端会以为用户清空了这个字段。这一点与「校验跳过只读字段」不矛盾：
    // 跳过校验是因为用户改不了，保留值是因为后端需要它。
    output[node.name] = getPath(scope.root, path);
  }

  return output;
}

/**
 * 从错误表里剔除「此刻已不可见 / 已只读」的路径。
 *
 * 场景：用户先填了必填的 A，触发校验标红；然后改了上游字段让 A 隐藏。
 * 此时若直接重算校验，被隐藏的 A 自然不再报错 —— 所以**理论上不需要**
 * 这个函数。它存在是为了处理「不想为了清一个错就重算整表」的场景
 * （如大表格里逐单元格失焦校验）：只过滤、不重算，代价是 O(错误数)。
 */
export function dropStaleErrors(
  errors: Record<string, string>,
  nodes: NodeSchema[],
  values: unknown,
): Record<string, string> {
  const visiblePaths = collectVisiblePaths(nodes, { root: values }, '');
  const next: Record<string, string> = {};

  for (const [path, message] of Object.entries(errors)) {
    if (visiblePaths.has(path)) next[path] = message;
  }

  return next;
}

/**
 * 收集「会进提交体」的全部字段路径。
 *
 * ⚠️ 名称叫 visible，但它的定义是**提交语义**，不是「用户能编辑」：
 *
 * - 只读字段（`disabledWhen` 命中）**在里面** —— 它照样提交；
 * - 表格被 `editableWhen` 锁定的单元格**也在里面** —— 同上。
 *
 * 这里曾经错误地按 `editableWhen` 过滤过一遍，理由是「锁定的单元格不校验」。
 * 但那混淆了「校验」和「提交」：`validate()` 跳过锁定格是它自己的选择，
 * 而 `collectVisiblePaths()` 回答的是另一个问题。两者混在一起，
 * `consistency.test.ts` 里那条「提交体 ⊆ 可见面」的不变量会直接被打破。
 */
export function collectVisiblePaths(
  nodes: NodeSchema[],
  scope: Scope,
  prefix: string,
): Set<string> {
  const paths = new Set<string>();

  for (const node of nodes) {
    const path = prefix ? `${prefix}.${node.name}` : node.name;
    if (!evaluate(node.visibleWhen, scope)) continue;

    if (isGroup(node)) {
      collectVisiblePaths(
        node.children,
        { root: scope.root, local: getPath(scope.root, path) },
        path,
      ).forEach((item) => paths.add(item));
      continue;
    }

    if (isList(node)) {
      const rows = getPath(scope.root, path);
      const list = Array.isArray(rows) ? rows : [];
      list.forEach((item, index) => {
        collectVisiblePaths(
          node.children,
          { root: scope.root, local: item },
          `${path}.${index}`,
        ).forEach((child) => paths.add(child));
      });
      continue;
    }

    if (isTable(node)) {
      const rows = getPath(scope.root, path);
      const list = (Array.isArray(rows) ? rows : []) as Record<
        string,
        unknown
      >[];
      list.forEach((_row, index) => {
        for (const column of node.columns) {
          paths.add(`${path}.${index}.${column.name}`);
        }
      });
      continue;
    }

    paths.add(path);
  }

  return paths;
}
