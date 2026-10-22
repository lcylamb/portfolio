import { renderField } from './fields/registry';
import { getPath, pushToArray, removeFromArray } from './path';
import { evaluate } from './schema/conditions';
import { createTableRowValues, resolveOptionLabel } from './schema/defaults';
import type { FormErrors, FormValues, TableSchema } from './schema/types';

// 可编辑表格：行是同构明细，整表由列配置驱动。
//
// editableWhen 是按**当前行**的数据判定的（scope.local = 这一行）——
// 报销里「已复核通过的行不允许再改金额」就是靠它。
// 锁住的格子显示文本而 not 表单控件，但**值照样提交**，见 controller/serialize.ts。

export function FormTable(props: {
  node: TableSchema;
  path: string;
  values: FormValues;
  errors: FormErrors;
  local?: unknown;
  onChange: (path: string, value: unknown) => void;
  onFieldBlur: (path: string) => void;
}) {
  const { node, path, values, errors, onChange, onFieldBlur } = props;

  const value = getPath(values, path);
  const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const max = node.max ?? Number.MAX_SAFE_INTEGER;
  const summary = node.summaryOf ?? [];

  const addRow = () => {
    if (rows.length >= max) return;
    onChange(
      path,
      pushToArray(values, path, createTableRowValues(node.columns)),
    );
  };

  const removeRow = (index: number) => {
    onChange(path, removeFromArray(values, path, index));
  };

  return (
    <section className="df-block df-table-block" data-path={path}>
      <div className="df-block-head">
        <h4>
          {node.title ?? node.name}
          <span className="df-count">{rows.length} 行</span>
        </h4>
        <button
          type="button"
          className="df-btn is-primary"
          disabled={rows.length >= max}
          onClick={addRow}
        >
          + 添加一行
        </button>
      </div>

      {node.description && <p className="df-block-desc">{node.description}</p>}

      <div className="df-table-scroll">
        <table className="df-table">
          <colgroup>
            <col style={{ width: 44 }} />
            {node.columns.map((column) => (
              <col key={column.name} style={{ width: column.width }} />
            ))}
            <col style={{ width: 68 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="df-td-index">#</th>
              {node.columns.map((column) => (
                <th
                  key={column.name}
                  style={{ textAlign: column.align ?? 'left' }}
                >
                  {column.title}
                  {column.rules?.required && <i className="df-required">*</i>}
                </th>
              ))}
              <th className="df-td-op">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="df-empty-cell" colSpan={node.columns.length + 2}>
                  暂无数据，点右上角「添加一行」
                </td>
              </tr>
            )}

            {rows.map((row, index) => (
              <tr key={index}>
                <td className="df-td-index">{index + 1}</td>

                {node.columns.map((column) => {
                  const cellPath = `${path}.${index}.${column.name}`;
                  const editable = column.editableWhen
                    ? evaluate(column.editableWhen, {
                        root: values,
                        local: row,
                      })
                    : node.editable !== false;
                  const message = errors[cellPath];

                  return (
                    <td
                      key={column.name}
                      className={message ? 'is-invalid' : undefined}
                    >
                      {editable ? (
                        renderField({
                          widget: column.widget,
                          value: row?.[column.name],
                          options: column.options,
                          invalid: Boolean(message),
                          disabled: false,
                          onChange: (next) => onChange(cellPath, next),
                          onBlur: () => onFieldBlur(cellPath),
                        })
                      ) : (
                        <span
                          className="df-locked"
                          title="按当前条件该单元格不可编辑"
                        >
                          {resolveOptionLabel(
                            column.options,
                            row?.[column.name],
                          )}
                        </span>
                      )}
                      {message && (
                        <div className="df-cell-error">{message}</div>
                      )}
                    </td>
                  );
                })}

                <td className="df-td-op">
                  <button
                    type="button"
                    className="df-icon-btn is-danger"
                    title="删除该行"
                    onClick={() => removeRow(index)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

          {summary.length > 0 && rows.length > 0 && (
            <tfoot>
              <tr>
                <td className="df-td-index">合计</td>
                {node.columns.map((column) => (
                  <td
                    key={column.name}
                    style={{ textAlign: column.align ?? 'left' }}
                  >
                    {summary.includes(column.name)
                      ? formatAmount(sumColumn(rows, column.name))
                      : ''}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

function sumColumn(rows: Record<string, unknown>[], name: string): number {
  return rows.reduce((total, row) => {
    const num = Number(row?.[name]);
    return Number.isFinite(num) ? total + num : total;
  }, 0);
}

function formatAmount(value: number): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
