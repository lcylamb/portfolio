import { describe, expect, it } from 'vitest';
import type { NodeSchema } from '../../schema/types';
import {
  countErrors,
  pickFirstErrorPath,
  validate,
  validateAtPath,
} from '../validate';

/**
 * 校验测试。用一份「缩小版信息采集」schema 当夹具 ——
 * 它同时覆盖了 group / 条件显隐 / 列表 / 表格锁定四条路径。
 */
const schema: NodeSchema[] = [
  {
    kind: 'group',
    name: 'basic',
    title: '基础信息',
    children: [
      {
        name: 'reporterName',
        title: '报案人',
        widget: 'text',
        rules: { required: true, pattern: 'personName' },
      },
      {
        name: 'reporterPhone',
        title: '联系电话',
        widget: 'text',
        rules: { required: true, pattern: 'phone' },
      },
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
        // 只有报销场景为「差旅」时才要求填供应商
        rules: {
          required: true,
          requiredWhen: {
            field: 'claimScene',
            op: 'eq',
            value: 'TRAVEL',
          },
        },
        visibleWhen: { field: 'claimScene', op: 'eq', value: 'TRAVEL' },
      },
      {
        name: 'claimNo',
        title: '报销单号',
        widget: 'text',
        rules: { required: true },
        // 只读字段不该被要求填写 —— 用户根本没有输入口
        disabledWhen: { field: 'claimScene', op: 'notEmpty' },
      },
    ],
  },
  {
    kind: 'list',
    name: 'invoiceList',
    title: '发票明细',
    children: [
      {
        name: 'itemName',
        title: '费用项目',
        widget: 'text',
        rules: { required: true },
      },
      {
        name: 'amount',
        title: '金额',
        widget: 'money',
        rules: { required: true, pattern: 'money', min: 0.01 },
      },
    ],
  },
  {
    kind: 'table',
    name: 'feeTable',
    title: '费用明细',
    columns: [
      {
        name: 'feeName',
        title: '费用项目',
        widget: 'text',
        rules: { required: true },
      },
      {
        name: 'feeAmount',
        title: '金额',
        widget: 'money',
        rules: { required: true, pattern: 'money' },
      },
      {
        name: 'approvedAmount',
        title: '复核金额',
        widget: 'money',
        rules: { required: true },
        // 已复核的行不允许改，也就不该校验必填
        editableWhen: { field: 'settled', op: 'neq', value: true },
      },
    ],
  },
];

describe('validate — 必填与格式', () => {
  it('空值触发必填，错误 key 是完整路径', () => {
    const errors = validate(schema, { basic: {}, invoiceList: [], feeTable: [] });
    expect(errors['basic.reporterName']).toBe('请填写报案人');
    expect(errors['basic.reporterPhone']).toBe('请填写联系电话');
  });

  it('非必填且为空时**不**做格式校验', () => {
    const errors = validate(schema, {
      basic: {
        reporterName: '张三',
        reporterPhone: '13800138000',
        claimScene: 'ENTERTAIN',
      },
      invoiceList: [],
      feeTable: [],
    });
    // claimScene 是 ENTERTAIN，vendorName 不可见，不该报错
    expect(errors['basic.vendorName']).toBeUndefined();
    expect(countErrors(errors)).toBe(0);
  });

  it('手机号 / 姓名正则', () => {
    const errors = validate(schema, {
      basic: {
        reporterName: '张',
        reporterPhone: '12345',
        claimScene: 'ENTERTAIN',
      },
      invoiceList: [],
      feeTable: [],
    });
    expect(errors['basic.reporterName']).toContain('2-20 位');
    expect(errors['basic.reporterPhone']).toContain('11 位手机号');
  });

  it('允许少数民族姓名的分隔点，但不允许首尾有点', () => {
    const ok = validate(schema, {
      basic: {
        reporterName: '阿依古丽·买买提',
        reporterPhone: '13800138000',
        claimScene: 'ENTERTAIN',
      },
      invoiceList: [],
      feeTable: [],
    });
    expect(ok['basic.reporterName']).toBeUndefined();

    const bad = validate(schema, {
      basic: {
        reporterName: '·张三',
        reporterPhone: '13800138000',
        claimScene: 'ENTERTAIN',
      },
      invoiceList: [],
      feeTable: [],
    });
    expect(bad['basic.reporterName']).toBeDefined();
  });
});

describe('validate — 显隐', () => {
  it('隐藏字段跳过校验', () => {
    const errors = validate(schema, {
      basic: {
        reporterName: '张三',
        reporterPhone: '13800138000',
        claimScene: 'ENTERTAIN',
      },
      invoiceList: [],
      feeTable: [],
    });
    expect(errors['basic.vendorName']).toBeUndefined();
  });

  it('切换上游字段后，同一份数据立刻开始报错（条件必填生效）', () => {
    const values = {
      basic: {
        reporterName: '张三',
        reporterPhone: '13800138000',
        claimScene: 'TRAVEL',
      },
      invoiceList: [],
      feeTable: [],
    };
    expect(validate(schema, values)['basic.vendorName']).toBe(
      '请填写开票方',
    );
  });

  it('只读字段跳过校验', () => {
    const errors = validate(schema, {
      basic: {
        reporterName: '张三',
        reporterPhone: '13800138000',
        claimScene: 'ENTERTAIN',
      },
      invoiceList: [],
      feeTable: [],
    });
    // claimNo 必填但被 disabledWhen 锁住
    expect(errors['basic.claimNo']).toBeUndefined();
  });
});

describe('validate — 列表与表格', () => {
  it('列表逐项校验，路径带下标', () => {
    const errors = validate(schema, {
      basic: {
        reporterName: '张三',
        reporterPhone: '13800138000',
        claimScene: 'ENTERTAIN',
      },
      invoiceList: [
        { itemName: '手机', amount: '' },
        { itemName: '', amount: 'abc' },
      ],
      feeTable: [],
    });
    expect(errors['invoiceList.0.amount']).toBe('请填写金额');
    expect(errors['invoiceList.1.itemName']).toBe('请填写费用项目');
    expect(errors['invoiceList.1.amount']).toContain('合法金额');
  });

  it('表格锁定单元格跳过校验', () => {
    const errors = validate(schema, {
      basic: {
        reporterName: '张三',
        reporterPhone: '13800138000',
        claimScene: 'ENTERTAIN',
      },
      invoiceList: [],
      feeTable: [
        {
          feeName: '挂号费',
          feeAmount: '10',
          approvedAmount: '',
          settled: true,
        },
        {
          feeName: '药费',
          feeAmount: '20',
          approvedAmount: '',
          settled: false,
        },
      ],
    });
    // 第一行 settled=true → approvedAmount 锁定 → 不报错
    expect(errors['feeTable.0.approvedAmount']).toBeUndefined();
    // 第二行可编辑 → 报错
    expect(errors['feeTable.1.approvedAmount']).toBe('请填写复核金额');
  });
});

describe('错误优先级', () => {
  /**
   * `pickFirstErrorPath` 依赖「对象键顺序 = 遍历顺序 = schema 顺序」。
   * 这条不变量一旦被打破（比如中间加了排序），提交时跳转的位置就会漂，
   * 而且不会报错、只会「跳得不那么准」—— 所以必须钉住。
   */
  it('第一个错误 = schema 里最靠前的那个', () => {
    const errors = validate(schema, { basic: {}, invoiceList: [], feeTable: [] });
    expect(pickFirstErrorPath(errors)).toBe('basic.reporterName');
  });

  it('validateAtPath 只返回目标路径的消息', () => {
    const values = { basic: {}, invoiceList: [], feeTable: [] };
    expect(validateAtPath(schema, values, 'basic.reporterPhone')).toBe(
      '请填写联系电话',
    );
    expect(validateAtPath(schema, values, 'basic.reporterName')).toBeDefined();
  });
});
