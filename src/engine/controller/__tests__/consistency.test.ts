import { describe, expect, it } from 'vitest';
import {
  collectVisiblePaths,
  dropStaleErrors,
  serializeVisible,
} from '../serialize';
import { validate } from '../validate';
import type { NodeSchema } from '../../schema/types';

/**
 * 「校验」与「提交」两条链路的**一致性测试**。
 *
 * 这是整个引擎里最容易出幽灵 bug 的地方：两端各自解析一遍 `visibleWhen`，
 * 任何一端单独改动语义，就会造出「校验过了但提交时字段消失」
 * 或者「字段提交了但从来没被校验过」。
 * 下面这条不变量是引擎对外的承诺：
 *
 *   > 一个字段被校验 ⇔ 它出现在提交体里。
 *
 * 例外只有两处，且都是刻意的，单独钉在后面的用例里：
 *   - 只读字段：**提交但不校验**（后端权威值，用户改不了）；
 *   - 表格锁定单元格：**提交但不校验**（同源）。
 */
const schema: NodeSchema[] = [
  {
    kind: 'group',
    name: 'basic',
    title: '基础信息',
    children: [
      {
        name: 'claimScene',
        title: '报销场景',
        widget: 'select',
        rules: { required: true },
      },
      {
        name: 'vendorName',
        title: '开票方',
        widget: 'text',
        rules: { required: true },
        visibleWhen: { field: 'claimScene', op: 'eq', value: 'TRAVEL' },
      },
      {
        name: 'readonlyNo',
        title: '只读单号',
        widget: 'text',
        rules: { required: true },
        disabledWhen: { field: 'claimScene', op: 'notEmpty' },
      },
    ],
  },
  {
    kind: 'list',
    name: 'invoiceList',
    title: '发票明细',
    min: 0,
    children: [
      {
        name: 'itemName',
        title: '名称',
        widget: 'text',
        rules: { required: true },
      },
    ],
  },
  {
    kind: 'table',
    name: 'feeTable',
    title: '费用明细',
    columns: [
      {
        name: 'feeAmount',
        title: '金额',
        widget: 'money',
        rules: { required: true },
      },
      {
        name: 'locked',
        title: '锁定列',
        widget: 'text',
        rules: { required: true },
        editableWhen: { field: 'settled', op: 'neq', value: true },
      },
    ],
  },
];

describe('serializeVisible', () => {
  it('隐藏字段不进提交体', () => {
    const values = {
      basic: {
        claimScene: 'ENTERTAIN',
        vendorName: '不该出现',
        readonlyNo: 'R001',
      },
      invoiceList: [],
      feeTable: [],
    };
    const payload = serializeVisible(schema, values) as any;

    expect(payload.basic.claimScene).toBe('ENTERTAIN');
    expect(payload.basic.vendorName).toBeUndefined();
    // 只读字段必须保留 —— 后端要拿回它的原值
    expect(payload.basic.readonlyNo).toBe('R001');
  });

  it('列表逐项裁剪，长度与项数一致', () => {
    const values = {
      basic: { claimScene: 'ENTERTAIN' },
      invoiceList: [{ itemName: '手机' }, { itemName: '电脑' }],
      feeTable: [],
    };
    const payload = serializeVisible(schema, values) as any;
    expect(payload.invoiceList).toEqual([
      { itemName: '手机' },
      { itemName: '电脑' },
    ]);
  });

  it('表格保留被锁定的单元格（锁定 ≠ 删除）', () => {
    const values = {
      basic: { claimScene: 'ENTERTAIN' },
      invoiceList: [],
      feeTable: [{ feeAmount: '10', locked: 'x', settled: true }],
    };
    const payload = serializeVisible(schema, values) as any;
    expect(payload.feeTable[0]).toEqual({ feeAmount: '10', locked: 'x' });
  });

  it('列表长度与 values 一致，不做过滤（空项照样提交，交由校验拦）', () => {
    const values = {
      basic: { claimScene: 'ENTERTAIN' },
      invoiceList: [{ itemName: '手机' }, { itemName: '' }],
      feeTable: [],
    };
    const payload = serializeVisible(schema, values) as any;
    expect(payload.invoiceList).toHaveLength(2);
  });
});

describe('不变量：被校验 ⇔ 被提交', () => {
  /**
   * 对每一种「上游字段取值 × 列表/表格内容」的组合，
   * 断言 `collectVisiblePaths()`（提交侧的可见面）
   * 与 `validate()` 的报错范围互为子集关系。
   */
  const cases: { title: string; values: unknown }[] = [
    {
      title: '差旅分支 + 空列表 + 空表格',
      values: {
        basic: { claimScene: 'TRAVEL' },
        invoiceList: [],
        feeTable: [],
      },
    },
    {
      title: '招待分支（隐藏开票方）',
      values: {
        basic: { claimScene: 'ENTERTAIN' },
        invoiceList: [{ itemName: '' }],
        feeTable: [],
      },
    },
    {
      title: '表格含锁定行',
      values: {
        basic: { claimScene: 'ENTERTAIN' },
        invoiceList: [],
        feeTable: [{ feeAmount: '', locked: '', settled: true }],
      },
    },
  ];

  it.each(cases)('$title', ({ values }) => {
    const payload = serializeVisible(schema, values) as any;
    const errors = validate(schema, values);
    const visiblePaths = collectVisiblePaths(schema, { root: values }, '');

    // 1. 提交体里的每一个字段路径，都必须在「可见面」里
    const submitted = flattenPayload(payload);
    for (const path of submitted) {
      expect(visiblePaths.has(path)).toBe(true);
    }

    // 2. 每一条错误，都必须指向一个可见字段 ——
    //    否则用户会收到一条他根本点不到的错误
    for (const path of Object.keys(errors)) {
      expect(visiblePaths.has(path)).toBe(true);
    }
  });
});

describe('dropStaleErrors', () => {
  it('剔除已不可见字段的遗留错误', () => {
    const values = {
      basic: { claimScene: 'ENTERTAIN' },
      invoiceList: [],
      feeTable: [],
    };
    const stale = {
      'basic.vendorName': '请填写开票方',
      'basic.claimScene': '请选择报销场景',
    };
    expect(dropStaleErrors(stale, schema, values)).toEqual({
      'basic.claimScene': '请选择报销场景',
    });
  });
});

/** 把提交体按结构展开成完整路径集合，用于与可见面比对 */
function flattenPayload(
  payload: unknown,
  prefix = '',
  out = new Set<string>(),
): Set<string> {
  if (Array.isArray(payload)) {
    payload.forEach((item, index) =>
      flattenPayload(item, prefix ? `${prefix}.${index}` : String(index), out),
    );
    return out;
  }
  if (payload !== null && typeof payload === 'object') {
    for (const [key, value] of Object.entries(
      payload as Record<string, unknown>,
    )) {
      flattenPayload(value, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  if (prefix) out.add(prefix);
  return out;
}
