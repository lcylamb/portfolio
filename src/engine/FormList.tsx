import { createListItemValues } from './schema/defaults';
import { getPath, moveInArray, pushToArray, removeFromArray } from './path';
import { FormItem } from './FormItem';
import type {
  FieldSchema,
  FormErrors,
  FormValues,
  ListSchema,
} from './schema/types';

// 可增删列表：每项是一组同构字段。
// min / max 到了就禁用按钮，而不是点了再弹提示 —— 边界一眼可见。

export function FormList(props: {
  node: ListSchema;
  path: string;
  values: FormValues;
  errors: FormErrors;
  local?: unknown;
  onChange: (path: string, value: unknown) => void;
  onFieldBlur: (path: string) => void;
}) {
  const { node, path, values, errors, onChange, onFieldBlur } = props;

  const rows = asRows(getPath(values, path));
  const min = node.min ?? 0;
  const max = node.max ?? Number.MAX_SAFE_INTEGER;
  const template = node.itemTitleTemplate ?? '第 {index} 项';

  const addItem = () => {
    if (rows.length >= max) return;
    onChange(
      path,
      pushToArray(values, path, createListItemValues(node.children)),
    );
  };

  const removeItem = (index: number) => {
    if (rows.length <= min) return;
    onChange(path, removeFromArray(values, path, index));
  };

  const moveItem = (index: number, offset: -1 | 1) => {
    onChange(path, moveInArray(values, path, index, offset));
  };

  return (
    <section className="df-block df-list" data-path={path}>
      <div className="df-block-head">
        <h4>
          {node.title ?? node.name}
          <span className="df-count">{rows.length} 项</span>
        </h4>
        <button
          type="button"
          className="df-btn is-primary"
          disabled={rows.length >= max}
          onClick={addItem}
        >
          {node.addText ?? '+ 添加一项'}
        </button>
      </div>

      {node.description && <p className="df-block-desc">{node.description}</p>}

      {rows.length === 0 ? (
        <div className="df-empty">暂无数据，点右上角「添加」开始录入</div>
      ) : (
        <div className="df-list-body">
          {rows.map((item, index) => (
            <div className="df-list-item" key={index}>
              <div className="df-list-item-head">
                <span className="df-list-item-title">
                  {template.replace('{index}', String(index + 1))}
                </span>
                <div className="df-actions">
                  <button
                    type="button"
                    className="df-icon-btn"
                    title="上移"
                    disabled={index === 0}
                    onClick={() => moveItem(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="df-icon-btn"
                    title="下移"
                    disabled={index === rows.length - 1}
                    onClick={() => moveItem(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="df-icon-btn is-danger"
                    title="删除"
                    disabled={rows.length <= min}
                    onClick={() => removeItem(index)}
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="df-grid">
                {node.children.map((child: FieldSchema) => (
                  <FormItem
                    key={child.name}
                    field={child}
                    path={`${path}.${index}.${child.name}`}
                    values={values}
                    errors={errors}
                    local={item}
                    onChange={onChange}
                    onFieldBlur={onFieldBlur}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}
