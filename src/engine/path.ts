/**
 * 路径工具 —— 「从根 / 作用域取值」这件事在引擎里出现得太频繁，单独收一层。
 *
 * `schema/` 与 `controller/` 下的所有模块都**只依赖本文件**，不碰 React、
 * 不碰 DOM。这是它们能进 node 环境单测的前提（见 `vitest.config.ts` 的 `test.include`）。
 */

/**
 * 读路径。
 *
 * ⚠️ 路径分隔符是 `.`，因此**字段名里不能出现点号**。
 * 主项目里没有这个问题（字段名是后端的 `attrName`，全小驼峰），
 * 但如果哪天要支持 `a.b` 这种字段名，这里必须整体换成数组路径 ——
 * 别在下游打补丁。
 */
export function getPath(source: unknown, path: string): unknown {
  if (!path) return undefined;
  let cursor: unknown = source;
  for (const seg of path.split('.')) {
    if (seg === '') continue;
    if (cursor === null || cursor === undefined) return undefined;
    cursor = (cursor as Record<string, unknown>)[seg];
  }
  return cursor;
}

/**
 * 路径是否存在（**不读值**）。
 *
 * 与 `getPath` 的区别在取值语义上：`hasPath({a: undefined}, 'a')` 是 `true`，
 * 而 `getPath` 返回 `undefined` —— 两者都会让「是否存在」看起来像 `false`。
 * 条件求值器必须用这个版本，否则一个显式置为 `undefined` 的字段会被误判成
 * 「作用域里没有它」，从而错误地回退到根作用域去取值。
 */
export function hasPath(source: unknown, path: string): boolean {
  if (!path) return false;
  let cursor: unknown = source;
  for (const seg of path.split('.')) {
    if (seg === '') continue;
    if (cursor === null || typeof cursor !== 'object') return false;
    if (!Object.prototype.hasOwnProperty.call(cursor, seg)) return false;
    cursor = (cursor as Record<string, unknown>)[seg];
  }
  return true;
}

/**
 * 不可变写入。
 *
 * 只克隆路径上的节点，兄弟节点**直接复用引用**。这一点在表单场景下很关键：
 * 一份 30 模块、上百字段的案子，用户每敲一个字符就
 * `JSON.parse(JSON.stringify(values))` 全量深拷贝，输入框会肉眼可见地卡
 * —— 而结构化共享让一次输入的代价只跟「字段深度」有关，跟表单规模无关。
 *
 * 数组下标支持数字或数字字符串，两者等价（`'0'` 与 `0` 命中同一个槽）。
 */
export function setPath<T>(source: T, path: string, value: unknown): T {
  const segs = path.split('.').filter((s) => s !== '');
  if (segs.length === 0) return value as T;
  return cloneAlong(source, segs, 0, value) as T;
}

function cloneAlong(
  node: unknown,
  segs: string[],
  index: number,
  value: unknown,
): unknown {
  const key = /^\d+$/.test(segs[index]) ? Number(segs[index]) : segs[index];
  const isLeaf = index === segs.length - 1;

  if (Array.isArray(node)) {
    const next = node.slice();
    next[key as number] = isLeaf
      ? value
      : cloneAlong(node[key as number], segs, index + 1, value);
    return next;
  }

  // 路径穿过一个 undefined / 标量时，就地降级成对象而不是抛错 ——
  // schema 允许字段先隐藏再显示，中间态没有容器是正常的。
  const base =
    node !== null && typeof node === 'object'
      ? (node as Record<string, unknown>)
      : {};
  const next: Record<string, unknown> = { ...base };
  next[key as string] = isLeaf
    ? value
    : cloneAlong(base[key as string], segs, index + 1, value);
  return next;
}

/** 删除路径（对象删 key，数组走 splice）。用于列表删项 */
export function deletePath<T>(source: T, path: string): T {
  const segs = path.split('.').filter((s) => s !== '');
  if (segs.length === 0) return source;

  const parentPath = segs.slice(0, -1).join('.');
  const lastKey = segs[segs.length - 1];

  // ⚠️ 删**顶层**键时 `parentPath` 是空串，而 `getPath(source, '')` 规定返回 undefined
  // （空路径视为无效）。所以这里必须显式兜一层，否则整类「删根字段」会静默失效 ——
  // 静默是因为返回值仍是合法对象，只是那个键没被删掉。
  const parent = parentPath === '' ? source : getPath(source, parentPath);
  if (parent === undefined || parent === null || typeof parent !== 'object')
    return source;

  if (Array.isArray(parent)) {
    const next = parent.slice();
    next.splice(Number(lastKey), 1);
    return setPath(source, parentPath, next);
  }

  const next = { ...(parent as Record<string, unknown>) };
  delete next[lastKey];
  return setPath(source, parentPath, next);
}

/**
 * 数组上移 / 下移。
 *
 * 越界时**原样返回同一个引用**（不复制）—— 让调用方可以直接用
 * `next === prev` 判断「这次点击无效」，也就不必在 UI 层再算一遍边界。
 */
export function moveInArray<T>(
  source: T,
  path: string,
  index: number,
  offset: -1 | 1,
): T {
  const list = getPath(source, path);
  if (!Array.isArray(list)) return source;
  const target = index + offset;
  if (target < 0 || target >= list.length) return source;

  const next = list.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return setPath(source, path, next);
}

/** 在路径指向的数组末尾追加一项 */
export function pushToArray<T>(source: T, path: string, item: unknown): T {
  const list = getPath(source, path);
  const next = Array.isArray(list) ? [...list, item] : [item];
  return setPath(source, path, next);
}

/** 从路径指向的数组删除第 index 项 */
export function removeFromArray<T>(source: T, path: string, index: number): T {
  const list = getPath(source, path);
  if (!Array.isArray(list)) return source;
  const next = list.slice();
  next.splice(index, 1);
  return setPath(source, path, next);
}
