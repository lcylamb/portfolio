import { renderField } from './fields/registry';
import { getPath } from './path';
import { evaluate } from './schema/conditions';
import type { FieldSchema, FormErrors, FormValues } from './schema/types';

// 单字段：label + 控件 + 错误文案。
// 星号是动态的 —— 条件必填成立时立刻出现，用户才知道这个字段什么时候变成了必填。

export function resolveSpan(field: FieldSchema): number {
  if (field.span) return field.span;
  // 长文本和多选占满整行，不然会被压到 1/3 宽没法看
  if (field.widget === 'textarea') return 12;
  if (field.widget === 'checkbox') return 12;
  if (field.widget === 'radio' && (field.options?.length ?? 0) > 3) return 12;
  return 4;
}

export function FormItem(props: {
  field: FieldSchema;
  path: string;
  values: FormValues;
  errors: FormErrors;
  local?: unknown;
  onChange: (path: string, value: unknown) => void;
  onFieldBlur: (path: string) => void;
}) {
  const { field, path, values, errors, local, onChange, onFieldBlur } = props;
  const scope = { root: values, local };

  // 这里用 disabledWhen 判定，validate.ts 用同一个表达式跳过校验，两边不会错位
  const disabled = field.disabledWhen
    ? evaluate(field.disabledWhen, scope)
    : false;

  const required =
    field.rules?.required === true ||
    (field.rules?.requiredWhen
      ? evaluate(field.rules.requiredWhen, scope)
      : false);

  const message = errors[path];
  const span = resolveSpan(field);

  return (
    <div
      // data-path 是「跳到第一个错误字段」的落点，见 controller/focus.ts
      className={`df-item df-span-${span}${message ? ' is-invalid' : ''}`}
      data-path={path}
    >
      <label className="df-label">
        <span className="df-label-text">
          {field.title ?? field.name}
          {required && <i className="df-required">*</i>}
        </span>
        {field.description && (
          <span className="df-label-hint">{field.description}</span>
        )}
      </label>

      {renderField({
        widget: field.widget,
        value: getPath(values, path),
        options: field.options,
        placeholder: field.placeholder,
        invalid: Boolean(message),
        disabled,
        onChange: (value) => onChange(path, value),
        onBlur: () => onFieldBlur(path),
      })}

      {message && <div className="df-error">{message}</div>}
    </div>
  );
}
