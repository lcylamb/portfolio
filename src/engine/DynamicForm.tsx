import { useState } from 'react';
import { FormItem } from './FormItem';
import { FormList } from './FormList';
import { FormTable } from './FormTable';
import { getPath } from './path';
import { evaluate } from './schema/conditions';
import { isGroup, isList, isTable } from './schema/types';
import type {
  FormErrors,
  FormSchema,
  FormValues,
  NodeSchema,
} from './schema/types';

// schema → 视图。四种节点各自分发，visibleWhen 不成立就直接不渲染（不是 display:none）。
//
// 这里不用 Context 传 values / errors：一个字段的可见性可能取决于任意其它字段，
// 本来就会重渲染，Context 省不掉那次渲染，反而让 scope 从哪来说不清。

export interface DynamicFormProps {
  schema: FormSchema;
  values: FormValues;
  errors: FormErrors;
  onChange: (path: string, value: unknown) => void;
  onFieldBlur: (path: string) => void;
}

export function DynamicForm(props: DynamicFormProps) {
  const { schema, values, errors, onChange, onFieldBlur } = props;

  return (
    <form className="df-form" noValidate onSubmit={(e) => e.preventDefault()}>
      {(schema.title || schema.description) && (
        <header className="df-form-head">
          {schema.title && <h3>{schema.title}</h3>}
          {schema.description && <p>{schema.description}</p>}
        </header>
      )}

      <div className="df-grid">
        {schema.nodes.map((node) => (
          <NodeView
            key={node.name}
            node={node}
            path={node.name}
            values={values}
            errors={errors}
            onChange={onChange}
            onFieldBlur={onFieldBlur}
          />
        ))}
      </div>
    </form>
  );
}

function NodeView(props: {
  node: NodeSchema;
  path: string;
  values: FormValues;
  errors: FormErrors;
  local?: unknown;
  onChange: (path: string, value: unknown) => void;
  onFieldBlur: (path: string) => void;
}) {
  const { node, path, values, errors, local, onChange, onFieldBlur } = props;

  if (!evaluate(node.visibleWhen, { root: values, local })) return null;

  if (isGroup(node)) {
    return (
      <GroupView
        node={node}
        path={path}
        values={values}
        errors={errors}
        onChange={onChange}
        onFieldBlur={onFieldBlur}
      />
    );
  }

  if (isList(node)) {
    return (
      <FormList
        node={node}
        path={path}
        values={values}
        errors={errors}
        local={local}
        onChange={onChange}
        onFieldBlur={onFieldBlur}
      />
    );
  }

  if (isTable(node)) {
    return (
      <FormTable
        node={node}
        path={path}
        values={values}
        errors={errors}
        local={local}
        onChange={onChange}
        onFieldBlur={onFieldBlur}
      />
    );
  }

  return (
    <FormItem
      field={node}
      path={path}
      values={values}
      errors={errors}
      local={local}
      onChange={onChange}
      onFieldBlur={onFieldBlur}
    />
  );
}

// 分组不接 local：它的子节点作用域是分组自己那层对象（见下面注释），
// 分组自身的 visibleWhen 已经在 NodeView 里判过了。
function GroupView(props: {
  node: Extract<NodeSchema, { kind: 'group' }>;
  path: string;
  values: FormValues;
  errors: FormErrors;
  onChange: (path: string, value: unknown) => void;
  onFieldBlur: (path: string) => void;
}) {
  const { node, path, values, errors, onChange, onFieldBlur } = props;
  const [collapsed, setCollapsed] = useState(Boolean(node.defaultCollapsed));

  return (
    <section className="df-block df-group" data-path={path}>
      <div className="df-block-head">
        <button
          type="button"
          className={`df-collapse${node.collapsible ? '' : ' is-static'}`}
          aria-expanded={!collapsed}
          onClick={() => node.collapsible && setCollapsed((prev) => !prev)}
        >
          <span className={`df-caret${collapsed ? ' is-collapsed' : ''}`} />
          <h4>{node.title ?? node.name}</h4>
        </button>
      </div>

      {node.description && <p className="df-block-desc">{node.description}</p>}

      {!collapsed && (
        <div className="df-grid">
          {node.children.map((child) => (
            <NodeView
              key={child.name}
              node={child}
              path={`${path}.${child.name}`}
              // 分组内部的局部作用域是分组自己那层对象，条件里的相对路径从这里开始找
              local={getPath(values, path)}
              values={values}
              errors={errors}
              onChange={onChange}
              onFieldBlur={onFieldBlur}
            />
          ))}
        </div>
      )}
    </section>
  );
}
