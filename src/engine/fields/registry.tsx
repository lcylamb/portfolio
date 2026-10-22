import type { ReactNode } from 'react';
import type { OptionItem, WidgetKey } from '../schema/types';

// widget 到控件的映射。加一种控件 = 下面注册表加一行，不动渲染主流程。
// 引擎自己持有 values（见 controller/validate 的入参形态），控件都是受控叶子，
// 所以这里不依赖 antd —— 换成 antd 只改本文件，schema 和校验层一行不动。
// 未注册的 widget 落到 TextField 兜底。

export interface FieldRenderContext {
  widget: WidgetKey | string;
  value: unknown;
  options?: OptionItem[];
  placeholder?: string;
  invalid: boolean;
  disabled: boolean;
  onChange: (value: unknown) => void;
  onBlur: () => void;
}

export type FieldRenderer = (ctx: FieldRenderContext) => ReactNode;

function toText(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

// 数字输入：清空时给 ''，不要给 undefined —— 否则受控 input 立刻回填旧值，看着像删不掉
// 敲到一半的 '-' / '1.' 原样留着交给校验，不在输入阶段 Number 掉
function parseNumber(raw: string): unknown {
  if (raw === '') return '';
  if (!/^-?\d*\.?\d*$/.test(raw)) return raw;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : raw;
}

function TextField(ctx: FieldRenderContext) {
  const { value, placeholder, invalid, disabled, onChange, onBlur } = ctx;
  return (
    <input
      type="text"
      className={`df-control${invalid ? ' is-invalid' : ''}`}
      value={toText(value)}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
    />
  );
}

function TextareaField(ctx: FieldRenderContext) {
  const { value, placeholder, invalid, disabled, onChange, onBlur } = ctx;
  return (
    <textarea
      rows={3}
      className={`df-control${invalid ? ' is-invalid' : ''}`}
      value={toText(value)}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
    />
  );
}

// number / money 共用，差别只在 placeholder（money 会配两位小数的校验规则）
function NumberField(ctx: FieldRenderContext) {
  const { widget, value, placeholder, invalid, disabled, onChange, onBlur } =
    ctx;
  return (
    <input
      type="text"
      inputMode="decimal"
      className={`df-control${invalid ? ' is-invalid' : ''}`}
      value={toText(value)}
      placeholder={placeholder ?? (widget === 'money' ? '0.00' : '')}
      disabled={disabled}
      onChange={(e) => onChange(parseNumber(e.target.value))}
      onBlur={onBlur}
    />
  );
}

function DateField(ctx: FieldRenderContext) {
  const { value, invalid, disabled, onChange, onBlur } = ctx;
  return (
    <input
      type="date"
      className={`df-control${invalid ? ' is-invalid' : ''}`}
      value={toText(value)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
    />
  );
}

function SelectField(ctx: FieldRenderContext) {
  const {
    value,
    options = [],
    placeholder,
    invalid,
    disabled,
    onChange,
    onBlur,
  } = ctx;
  return (
    <select
      className={`df-control${invalid ? ' is-invalid' : ''}`}
      value={toText(value)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
    >
      <option value="">{placeholder ?? '请选择'}</option>
      {options.map((item) => (
        <option key={String(item.value)} value={String(item.value)}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

function RadioField(ctx: FieldRenderContext) {
  const { value, options = [], disabled, onChange, onBlur } = ctx;
  return (
    <div className="df-choice">
      {options.map((item) => {
        const checked = toText(value) === String(item.value);
        return (
          <label
            key={String(item.value)}
            className={`df-chip${checked ? ' is-on' : ''}`}
          >
            <input
              type="radio"
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(item.value)}
              onBlur={onBlur}
            />
            {item.label}
          </label>
        );
      })}
    </div>
  );
}

// 多选：勾选/取消后直接把完整数组回写，不做字段级 diff
function CheckboxField(ctx: FieldRenderContext) {
  const { value, options = [], disabled, onChange, onBlur } = ctx;
  const selected = Array.isArray(value) ? value : [];
  return (
    <div className="df-choice">
      {options.map((item) => {
        const checked = selected.some((v) => String(v) === String(item.value));
        return (
          <label
            key={String(item.value)}
            className={`df-chip${checked ? ' is-on' : ''}`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() =>
                onChange(
                  checked
                    ? selected.filter((v) => String(v) !== String(item.value))
                    : [...selected, item.value],
                )
              }
              onBlur={onBlur}
            />
            {item.label}
          </label>
        );
      })}
    </div>
  );
}

function SwitchField(ctx: FieldRenderContext) {
  const { value, disabled, onChange } = ctx;
  const on = Boolean(value);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`df-switch${on ? ' is-on' : ''}`}
      disabled={disabled}
      onClick={() => onChange(!on)}
    >
      <span className="df-switch-knob" />
    </button>
  );
}

// 键沿用 schema 里的 widget 字面量，不另起一套 kind 体系
const RENDERER_BY_WIDGET: Record<string, FieldRenderer> = {
  text: TextField,
  textarea: TextareaField,
  number: NumberField,
  money: NumberField,
  date: DateField,
  select: SelectField,
  radio: RadioField,
  checkbox: CheckboxField,
  switch: SwitchField,
};

export function renderField(ctx: FieldRenderContext): ReactNode {
  const Renderer = RENDERER_BY_WIDGET[ctx.widget] ?? TextField;
  return Renderer(ctx);
}

export const REGISTERED_WIDGETS = Object.keys(RENDERER_BY_WIDGET);
