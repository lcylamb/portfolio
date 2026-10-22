import { describe, expect, it } from 'vitest';
import {
  deletePath,
  getPath,
  hasPath,
  moveInArray,
  pushToArray,
  removeFromArray,
  setPath,
} from '../path';

/**
 * `path.ts` 的特征化测试。
 *
 * 这些用例不是「覆盖代码行」，而是把三条**容易在重构中被悄悄改掉**的语义
 * 钉死：结构化共享、越界返回同引用、`hasPath` 与 `getPath` 的分工。
 */

describe('getPath / hasPath', () => {
  it('穿透对象与数组', () => {
    const values = { a: { b: [{ c: 1 }] } };
    expect(getPath(values, 'a.b.0.c')).toBe(1);
    expect(getPath(values, 'a.b.9.c')).toBeUndefined();
    expect(getPath(values, '')).toBeUndefined();
  });

  it('数组下标用数字或数字字符串等价', () => {
    const values = { list: ['x', 'y'] };
    expect(getPath(values, 'list.1')).toBe('y');
  });

  /**
   * 这条差异是 `conditions.ts` 里 `resolve()` 敢用 `hasPath` 的唯一依据：
   * 显式写为 undefined 的字段必须被认成「局部有」，否则列表项会穿透到根，
   * 静默读到同名顶层字段。
   */
  it('hasPath 认「显式为 undefined」为存在，getPath 则区分不出', () => {
    const scope = { invoiceKind: undefined };
    expect(hasPath(scope, 'invoiceKind')).toBe(true);
    expect(getPath(scope, 'invoiceKind')).toBeUndefined();
  });

  it('hasPath 不穿透继承属性', () => {
    const scope = Object.create({ inherited: 1 });
    expect(hasPath(scope, 'inherited')).toBe(false);
  });
});

describe('setPath', () => {
  it('只克隆路径上的节点，兄弟引用复用', () => {
    const before = { keep: { deep: [1, 2] }, touch: { v: 1 } };
    const after = setPath(before, 'touch.v', 2);

    expect(after.touch.v).toBe(2);
    expect(after).not.toBe(before);
    expect(after.touch).not.toBe(before.touch);
    // 关键断言：没被触碰的子树必须是同一个引用，否则「结构化共享」是假的
    expect(after.keep).toBe(before.keep);
    expect(before.touch.v).toBe(1);
  });

  it('穿过缺失的中间层时自动补对象，不抛错', () => {
    const after = setPath({}, 'a.b.c', 1);
    expect(after).toEqual({ a: { b: { c: 1 } } });
  });

  it('数组按下标写入并保留其余项引用', () => {
    const inner = { v: 1 };
    const before = { list: [inner, { v: 2 }] };
    const after = setPath(before, 'list.1.v', 9);

    expect(after.list[1]).toEqual({ v: 9 });
    expect(after.list[0]).toBe(inner);
  });
});

describe('deletePath', () => {
  it('对象删 key，数组走 splice（不留空洞）', () => {
    expect(deletePath({ a: 1, b: 2 }, 'b')).toEqual({ a: 1 });
    expect(deletePath({ list: [1, 2, 3] }, 'list.1')).toEqual({ list: [1, 3] });
  });

  it('父路径不存在时原样返回同引用', () => {
    const before = { a: 1 };
    expect(deletePath(before, 'x.y')).toBe(before);
  });
});

describe('数组工具', () => {
  it('moveInArray 越界时返回同一个引用（调用方可据此判断点击无效）', () => {
    const before = { list: [1, 2] };
    expect(moveInArray(before, 'list', 0, -1)).toBe(before);
    expect(moveInArray(before, 'list', 1, 1)).toBe(before);
  });

  it('moveInArray 正常交换', () => {
    expect(moveInArray({ list: [1, 2, 3] }, 'list', 0, 1)).toEqual({
      list: [2, 1, 3],
    });
  });

  it('pushToArray 对不存在的路径降级成新建数组', () => {
    expect(pushToArray({}, 'list', { a: 1 })).toEqual({ list: [{ a: 1 }] });
  });

  it('removeFromArray 对非数组路径不改动', () => {
    const before = { list: 'not-an-array' };
    expect(removeFromArray(before, 'list', 0)).toBe(before);
  });
});
