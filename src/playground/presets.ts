import type { FormSchema, FormValues } from '@/engine';

// 三份预设 schema。它们都是**纯 JSON**，跟后端下发的东西形态完全一致 ——
// 页面里没有任何一处针对这些业务写死的代码，左侧把 JSON 改掉，右边立刻变。

export interface Preset {
  key: string;
  name: string;
  hint: string;
  schema: FormSchema;
  initial: FormValues;
}

// 主场景：费用报销单的填报。
// 一份 schema 里同时覆盖了条件显隐、条件必填、只读回显、可增删列表、可编辑表格。
const expenseForm: FormSchema = {
  title: '费用报销 · 填报',
  description:
    '这一整页的表单结构都来自左侧那份 JSON —— 前端没有为它写任何一行业务代码。',
  nodes: [
    {
      kind: 'group',
      name: 'basic',
      title: '基础信息',
      description: '报销场景会决定下面哪些字段出现、哪些必填。',
      collapsible: true,
      children: [
        {
          name: 'claimNo',
          title: '报销单号',
          widget: 'text',
          span: 4,
          description: '后端回显，只读',
          defaultValue: 'BX20261013001',
          // 选了报销场景之后单号就锁定 —— 这是「只读」而不是「隐藏」，
          // 值照样提交，见 controller/serialize.ts
          disabledWhen: { field: 'claimScene', op: 'notEmpty' },
        },
        {
          name: 'claimScene',
          title: '报销场景',
          widget: 'select',
          span: 4,
          rules: { required: true },
          options: [
            { label: '差旅', value: 'TRAVEL' },
            { label: '业务招待', value: 'ENTERTAIN' },
            { label: '采购', value: 'PURCHASE' },
          ],
        },
        {
          name: 'occurDate',
          title: '发生日期',
          widget: 'date',
          span: 4,
          rules: { required: true },
        },
        {
          name: 'applicantName',
          title: '填报人',
          widget: 'text',
          span: 4,
          rules: { required: true, pattern: 'personName' },
        },
        {
          name: 'contactPhone',
          title: '联系电话',
          widget: 'text',
          span: 4,
          rules: { required: true, pattern: 'phone' },
        },
        {
          name: 'channel',
          title: '提交渠道',
          widget: 'radio',
          span: 4,
          options: [
            { label: '线上', value: 'ONLINE' },
            { label: '柜台', value: 'COUNTER' },
            { label: '代办', value: 'AGENT' },
          ],
        },

        // ---- 差旅分支 ----
        {
          name: 'cityName',
          title: '出差城市',
          widget: 'text',
          span: 8,
          rules: { required: true },
          visibleWhen: { field: 'claimScene', op: 'eq', value: 'TRAVEL' },
        },
        {
          name: 'tripDays',
          title: '出差天数',
          widget: 'number',
          span: 4,
          rules: { required: true, min: 1, max: 99 },
          visibleWhen: { field: 'claimScene', op: 'eq', value: 'TRAVEL' },
        },

        // ---- 招待分支 ----
        {
          name: 'guestCompany',
          title: '招待对象',
          widget: 'text',
          span: 8,
          rules: { required: true },
          visibleWhen: { field: 'claimScene', op: 'eq', value: 'ENTERTAIN' },
        },
        {
          name: 'guestCount',
          title: '招待人数',
          widget: 'number',
          span: 4,
          rules: { required: true, min: 1, max: 99 },
          visibleWhen: { field: 'claimScene', op: 'eq', value: 'ENTERTAIN' },
        },
        {
          name: 'entertainType',
          title: '招待类型',
          widget: 'select',
          span: 4,
          options: [
            { label: '工作餐', value: 'MEAL' },
            { label: '商务宴请', value: 'BANQUET' },
          ],
          visibleWhen: { field: 'claimScene', op: 'eq', value: 'ENTERTAIN' },
        },

        // ---- 采购分支（带一层嵌套联动）----
        {
          name: 'hasAgentPay',
          title: '是否代他人提交',
          widget: 'switch',
          span: 4,
          visibleWhen: { field: 'claimScene', op: 'eq', value: 'PURCHASE' },
        },
        {
          name: 'agentPayeeName',
          title: '实际报销人',
          widget: 'text',
          span: 4,
          rules: { required: true },
          // 两级条件：先要是采购，再要勾了代他人提交
          visibleWhen: {
            and: [
              { field: 'claimScene', op: 'eq', value: 'PURCHASE' },
              { field: 'hasAgentPay', op: 'truthy' },
            ],
          },
        },
        {
          name: 'reasonDesc',
          title: '事由说明',
          widget: 'textarea',
          span: 12,
          placeholder: '时间、用途、参与人',
          rules: { required: true, maxLength: 200 },
          visibleWhen: { field: 'claimScene', op: 'eq', value: 'PURCHASE' },
        },
      ],
    },

    {
      kind: 'list',
      name: 'invoiceList',
      title: '发票明细',
      description:
        '每一项是一组同构字段，可以增删、调序。「发票类型」会控制本项的备注是否出现。',
      itemTitleTemplate: '发票 {index}',
      addText: '+ 添加发票',
      min: 0,
      max: 5,
      children: [
        {
          name: 'invoiceKind',
          title: '发票类型',
          widget: 'select',
          span: 4,
          rules: { required: true },
          options: [
            { label: '增值税专用发票', value: 'VAT_SPECIAL' },
            { label: '增值税普通发票', value: 'VAT_NORMAL' },
            { label: '其他凭证', value: 'OTHER' },
          ],
        },
        {
          name: 'vendorName',
          title: '开票方',
          widget: 'text',
          span: 4,
          rules: { required: true },
        },
        {
          name: 'invoiceAmount',
          title: '价税合计',
          widget: 'money',
          span: 4,
          rules: { required: true, pattern: 'money' },
        },
        {
          name: 'remarkDesc',
          title: '备注',
          widget: 'textarea',
          span: 12,
          rules: { required: true },
          // 列表项内部的条件用的是**相对路径**：先在当前这项里找 invoiceKind，
          // 找不到才回退到根。所以这份 schema 复制到哪一层都能用。
          visibleWhen: { field: 'invoiceKind', op: 'neq', value: 'VAT_SPECIAL' },
        },
      ],
    },

    {
      kind: 'table',
      name: 'feeTable',
      title: '费用明细',
      description:
        '把某行的「已复核」打开，该行的复核金额会被锁定 —— 值照样提交，但不再校验必填。',
      summaryOf: ['applyAmount', 'auditedAmount'],
      columns: [
        {
          name: 'feeName',
          title: '费用项目',
          widget: 'text',
          width: 150,
          rules: { required: true },
        },
        {
          name: 'applyAmount',
          title: '申请金额',
          widget: 'money',
          width: 120,
          align: 'right',
          rules: { required: true, pattern: 'money' },
        },
        {
          name: 'auditedAmount',
          title: '复核金额',
          widget: 'money',
          width: 120,
          align: 'right',
          rules: { required: true, pattern: 'money' },
          // 按当前行的 settled 判定，而不是按整表
          editableWhen: { field: 'settled', op: 'neq', value: true },
        },
        {
          name: 'settled',
          title: '已复核',
          widget: 'switch',
          width: 84,
          align: 'center',
        },
        {
          name: 'remark',
          title: '备注',
          widget: 'text',
          width: 150,
        },
      ],
    },
  ],
};

const expenseFormInitial: FormValues = {
  basic: {
    claimNo: 'BX20261013001',
    claimScene: 'ENTERTAIN',
    occurDate: '2026-10-08',
    applicantName: '张三',
    contactPhone: '13800138000',
    channel: 'ONLINE',
    guestCompany: '某某供应链有限公司',
    guestCount: 6,
    entertainType: 'MEAL',
  },
  invoiceList: [
    {
      invoiceKind: 'VAT_NORMAL',
      vendorName: '城南餐饮管理有限公司',
      invoiceAmount: 8640.5,
      remarkDesc: '',
    },
    {
      invoiceKind: 'OTHER',
      vendorName: '城际交通',
      invoiceAmount: 420,
      remarkDesc: '',
    },
  ],
  feeTable: [
    {
      feeName: '餐费',
      applyAmount: 1800,
      auditedAmount: 1800,
      settled: true,
      remark: '',
    },
    {
      feeName: '场地费',
      applyAmount: 2400,
      auditedAmount: '',
      settled: false,
      remark: '',
    },
    {
      feeName: '交通费',
      applyAmount: 4440.5,
      auditedAmount: '',
      settled: false,
      remark: '',
    },
  ],
};

// 第二份：只放一张表，方便看清 editableWhen 与合计行
const feeOnly: FormSchema = {
  title: '费用复核 · 明细',
  description: '只留一张可编辑表格，用来看按行锁定与合计行。',
  nodes: [
    {
      kind: 'table',
      name: 'feeTable',
      title: '费用明细',
      max: 10,
      summaryOf: ['applyAmount', 'auditedAmount'],
      columns: [
        {
          name: 'feeName',
          title: '费用项目',
          widget: 'text',
          width: 160,
          rules: { required: true },
        },
        {
          name: 'applyAmount',
          title: '申请金额',
          widget: 'money',
          width: 130,
          align: 'right',
          rules: { required: true, pattern: 'money' },
        },
        {
          name: 'auditedAmount',
          title: '复核金额',
          widget: 'money',
          width: 130,
          align: 'right',
          rules: { required: true, pattern: 'money' },
          editableWhen: { field: 'settled', op: 'neq', value: true },
        },
        {
          name: 'settled',
          title: '已复核',
          widget: 'switch',
          width: 84,
          align: 'center',
        },
      ],
    },
  ],
};

const feeOnlyInitial: FormValues = {
  feeTable: [
    {
      feeName: '餐费',
      applyAmount: 1800,
      auditedAmount: 1800,
      settled: true,
    },
    {
      feeName: '住宿费',
      applyAmount: 5200,
      auditedAmount: '',
      settled: false,
    },
  ],
};

// 第三份：最小可读样本，用来对照左侧 JSON 和右侧渲染
const minimal: FormSchema = {
  title: '最小示例',
  description: '左侧 JSON 只有三个字段，对照着看最快。',
  nodes: [
    {
      name: 'applicant',
      title: '申请人',
      widget: 'text',
      span: 6,
      rules: { required: true, pattern: 'personName' },
    },
    {
      name: 'hasInvoice',
      title: '是否有发票',
      widget: 'switch',
      span: 6,
    },
    {
      name: 'invoiceNo',
      title: '发票号',
      widget: 'text',
      span: 6,
      rules: { required: true },
      visibleWhen: { field: 'hasInvoice', op: 'truthy' },
    },
  ],
};

const minimalInitial: FormValues = {
  applicant: '',
  hasInvoice: false,
  invoiceNo: '',
};

export const PRESETS: Preset[] = [
  {
    key: 'claim',
    name: '费用填报（完整）',
    hint: '先把「报销场景」在差旅 / 招待 / 采购之间来回切，看字段怎么出现消失；再动一动「发票明细」和「费用明细」的开关。',
    schema: expenseForm,
    initial: expenseFormInitial,
  },
  {
    key: 'fee',
    name: '费用复核明细',
    hint: '只有一张表。把某行的「已复核」打开，这一行的复核金额会变成不可编辑的文本，而且不再参与必填校验。',
    schema: feeOnly,
    initial: feeOnlyInitial,
  },
  {
    key: 'minimal',
    name: '最小示例',
    hint: '三个字段：一个文本、一个开关、一个只在开关打开时出现的文本框。',
    schema: minimal,
    initial: minimalInitial,
  },
];
