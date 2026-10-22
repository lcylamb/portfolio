import { describe, expect, it } from 'vitest';
import { collectReferencedFields, evaluate } from '../conditions';

/**
 * 条件求值器测试。
 *
 * 重点不在「每个算子能不能算」，而在三条**上线后才会暴露**的语义：
 * 作用域回退顺序、跨类型归一化、以及「读不懂的规则该放行还是拦住」。
 */

describe('作用域解析', () => {
  it('先局部、后根', () => {
    const root = { invoiceKind: 'VAT_SPECIAL' };
    expect(
      evaluate({ field: 'invoiceKind', op: 'eq', value: 'VAT_SPECIAL' }, { root }),
    ).toBe(true);

    // 局部有同名值时，局部优先 —— 这正是列表项能复用同一份 schema 的原因
    const local = { invoiceKind: 'OTHER' };
    expect(
      evaluate(
        { field: 'invoiceKind', op: 'eq', value: 'VAT_SPECIAL' },
        { root, local },
      ),
    ).toBe(false);
  });

  it('局部有该字段但值为 undefined 时，不回退到根', () => {
    const root = { invoiceKind: 'VAT_SPECIAL' };
    const local = { invoiceKind: undefined };
    // 若回退了，这里会变成 true —— 那会让「本行没选」被误判成「按外层走」
    expect(
      evaluate(
        { field: 'invoiceKind', op: 'eq', value: 'VAT_SPECIAL' },
        { root, local },
      ),
    ).toBe(false);
  });
});

describe('归一化', () => {
  it('数字与字符串互通（后端下发 number，select 存 string）', () => {
    expect(
      evaluate({ field: 'type', op: 'eq', value: 1 }, { root: { type: '1' } }),
    ).toBe(true);
    expect(
      evaluate({ field: 'type', op: 'eq', value: '1' }, { root: { type: 1 } }),
    ).toBe(true);
  });

  it('switch 的布尔值按 "true"/"false" 比较', () => {
    expect(
      evaluate(
        { field: 'flag', op: 'eq', value: 'true' },
        { root: { flag: true } },
      ),
    ).toBe(true);
  });

  it('数值比较不走字符串归一化（10 > 9）', () => {
    expect(
      evaluate(
        { field: 'amount', op: 'gt', value: 9 },
        { root: { amount: '10' } },
      ),
    ).toBe(true);
  });

  it('in / nin 针对数组', () => {
    const root = { state: 20 };
    expect(
      evaluate({ field: 'state', op: 'in', value: [10, 20] }, { root }),
    ).toBe(true);
    expect(
      evaluate({ field: 'state', op: 'nin', value: [10, 20] }, { root }),
    ).toBe(false);
  });

  it('空字符串 / 空数组算 empty', () => {
    expect(evaluate({ field: 'a', op: 'empty' }, { root: { a: '' } })).toBe(
      true,
    );
    expect(evaluate({ field: 'a', op: 'empty' }, { root: { a: [] } })).toBe(
      true,
    );
    expect(evaluate({ field: 'a', op: 'notEmpty' }, { root: { a: [1] } })).toBe(
      true,
    );
  });
});

describe('复合表达式', () => {
  const root = { a: 1, b: 2, c: 3 };

  it('and / or / not', () => {
    expect(
      evaluate(
        {
          and: [
            { field: 'a', op: 'eq', value: 1 },
            { field: 'b', op: 'eq', value: 2 },
          ],
        },
        { root },
      ),
    ).toBe(true);
    expect(
      evaluate(
        {
          and: [
            { field: 'a', op: 'eq', value: 1 },
            { field: 'b', op: 'eq', value: 9 },
          ],
        },
        { root },
      ),
    ).toBe(false);
    expect(
      evaluate(
        {
          or: [
            { field: 'a', op: 'eq', value: 9 },
            { field: 'c', op: 'eq', value: 3 },
          ],
        },
        { root },
      ),
    ).toBe(true);
    expect(
      evaluate({ not: { field: 'a', op: 'eq', value: 1 } }, { root }),
    ).toBe(false);
  });

  it('嵌套', () => {
    const expr = {
      and: [
        { field: 'a', op: 'eq' as const, value: 1 },
        {
          or: [
            { field: 'b', op: 'eq' as const, value: 2 },
            { field: 'c', op: 'eq' as const, value: 99 },
          ],
        },
      ],
    };
    expect(evaluate(expr, { root })).toBe(true);
  });
});

describe('容错', () => {
  it('未写条件视为恒真', () => {
    expect(evaluate(undefined, { root: {} })).toBe(true);
  });

  /**
   * 后端灰度：先上了新算子、前端还没跟版。
   * 此时放行（多显示一个字段）远好过拦截（整块表单消失且用户无从下手）。
   */
  it('未知 op 放行而不是拦住', () => {
    expect(
      evaluate(
        { field: 'a', op: 'unknownOp' as never, value: 1 },
        { root: { a: 1 } },
      ),
    ).toBe(true);
  });
});

describe('collectReferencedFields', () => {
  it('递归收集全部引用字段', () => {
    const fields = collectReferencedFields({
      and: [
        { field: 'a', op: 'eq', value: 1 },
        {
          or: [
            { field: 'b', op: 'eq', value: 2 },
            { not: { field: 'c', op: 'empty' } },
          ],
        },
      ],
    });
    expect([...fields].sort()).toEqual(['a', 'b', 'c']);
  });
});
