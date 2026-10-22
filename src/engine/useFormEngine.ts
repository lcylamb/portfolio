import { useMemo, useRef, useState } from 'react';
import { focusFirstError } from './controller/focus';
import { serializeVisible } from './controller/serialize';
import { countErrors, validate, validateAtPath } from './controller/validate';
import { setPath } from './path';
import { createInitialValues } from './schema/defaults';
import type { FormErrors, FormSchema, FormValues } from './schema/types';

// 引擎的状态入口。
//
// values 由引擎自己持有，不借 antd 的 FormInstance —— 值只有一份真相，
// 校验、提交体、条件显隐全部从这棵树派生。改值的路径也只有一条：
// setPath 的不可变更新（见 path.ts 里的结构化共享）。

export type EngineStatus =
  | { type: 'idle' }
  | { type: 'ok'; message: string }
  | { type: 'error'; message: string };

export function useFormEngine(schema: FormSchema, initialValues?: FormValues) {
  const [values, setValues] = useState<FormValues>(
    () => initialValues ?? createInitialValues(schema.nodes),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<EngineStatus>({ type: 'idle' });

  // 失焦校验要读最新值，而事件回调里拿到的是当次渲染的闭包，用 ref 跟着走
  const latest = useRef(values);
  latest.current = values;

  // 「会提交什么」实时算出来，Playground 右边的数据面板直接用这个
  const payload = useMemo(
    () => serializeVisible(schema.nodes, values),
    [schema.nodes, values],
  );

  function handleChange(path: string, value: unknown) {
    setValues((prev) => setPath(prev, path, value));
    setStatus({ type: 'idle' });

    // 只清这个字段自己的错。用户改 A 的时候，B 的提示不该跟着闪一下
    setErrors((prev) => {
      if (!prev[path]) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }

  // 失焦才校验这一个字段。每敲一下就整表标红，第一次填这个表的人会被劝退
  function handleFieldBlur(path: string) {
    const message = validateAtPath(schema.nodes, latest.current, path);
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[path] = message;
      else delete next[path];
      return next;
    });
  }

  function submit() {
    const next = validate(schema.nodes, latest.current);
    setErrors(next);

    const total = countErrors(next);
    if (total > 0) {
      setStatus({ type: 'error', message: `还有 ${total} 项没通过校验` });
      focusFirstError(next);
      return undefined;
    }

    setStatus({ type: 'ok', message: '校验通过，可以提交' });
    return serializeVisible(schema.nodes, latest.current);
  }

  function reset(next?: FormValues) {
    setValues(next ?? createInitialValues(schema.nodes));
    setErrors({});
    setStatus({ type: 'idle' });
  }

  return {
    values,
    errors,
    payload,
    status,
    handleChange,
    handleFieldBlur,
    submit,
    reset,
  };
}
