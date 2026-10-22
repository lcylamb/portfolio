'use client';

import { useMemo, useState } from 'react';
import { DynamicForm, useFormEngine } from '@/engine';
import type { FormSchema } from '@/engine';
import { PRESETS } from './presets';

// Playground：左边改 schema，中间立刻重渲染，右边实时显示「会提交什么」。
//
// 三栏里最有信息量的是右边 —— 它用的是 serializeVisible()，
// 也就是真正发给后端的那份数据。隐藏字段在这里是**看不到**的，
// 这不是显示问题，是设计：见 controller/serialize.ts。
//
// 客户端组件：整页都是实时交互，服务端渲染不出任何有信息量的东西。

const PANE = 'flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface';
const PANE_HEAD = 'flex shrink-0 items-center gap-2.5 border-b border-line px-3.5 py-2.5';
const PANE_TITLE = 'm-0 text-[13.5px] font-medium';
const PANE_SUB = 'text-[12px] text-faint';
const PANE_BODY = 'min-h-0 flex-1 overflow-auto p-3.5';

export default function Playground() {
  const first = PRESETS[0];

  const [presetKey, setPresetKey] = useState(first.key);
  const [text, setText] = useState(() => JSON.stringify(first.schema, null, 2));
  const [schema, setSchema] = useState<FormSchema>(first.schema);
  const [parseError, setParseError] = useState<string>();

  const engine = useFormEngine(schema, first.initial);

  // 手动改 schema 时**不重置**已填的数据：可见字段照常渲染，被删掉的字段
  // 会被 serializeVisible 自动丢掉，不需要人工同步
  function handleTextChange(next: string) {
    setText(next);
    try {
      const parsed = JSON.parse(next) as FormSchema;
      if (!parsed || !Array.isArray(parsed.nodes)) {
        throw new Error('缺少 nodes 数组');
      }
      setSchema(parsed);
      setParseError(undefined);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : String(e));
    }
  }

  function switchPreset(key: string) {
    const preset = PRESETS.find((item) => item.key === key) ?? first;
    setPresetKey(preset.key);
    setText(JSON.stringify(preset.schema, null, 2));
    setSchema(preset.schema);
    setParseError(undefined);
    engine.reset(preset.initial);
  }

  const activePreset = useMemo(
    () => PRESETS.find((item) => item.key === presetKey) ?? first,
    [presetKey, first],
  );

  // 提交体里每个数组的长度，右边面板顶部用一句话点出来
  const payloadSummary = useMemo(() => {
    const arrays = Object.entries(engine.payload).filter(([, value]) =>
      Array.isArray(value),
    );
    if (arrays.length === 0) return '';
    return arrays
      .map(([key, value]) => `${key} ${(value as unknown[]).length} 条`)
      .join(' · ');
  }, [engine.payload]);

  return (
    // 整页滚动之后 main 不再有固定高度，三栏要自己顶满视口剩下的部分
    // （悬浮导航条占掉 12px 外边距 + 56px 高 = 68px）
    <div className="grid h-[calc(100vh-68px)] min-h-0 grid-cols-[380px_minmax(0,1fr)_340px] gap-3.5 p-3.5 max-[1280px]:h-auto max-[1280px]:grid-cols-1">
      <section className={PANE}>
        <div className={PANE_HEAD}>
          <h2 className={PANE_TITLE}>Schema</h2>
          <span className={PANE_SUB}>后端下发的那份 JSON</span>
        </div>

        <div className="flex flex-wrap gap-1.5 px-3.5 pt-2.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className={`rounded-md border px-2.5 py-[5px] text-[12.5px] ${
                preset.key === presetKey
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line bg-surface text-dim hover:border-line-strong hover:text-ink'
              }`}
              onClick={() => switchPreset(preset.key)}
            >
              {preset.name}
            </button>
          ))}
        </div>

        <div className="mx-3.5 mt-2.5 rounded-lg bg-accent-soft px-[11px] py-[9px] text-[12.5px] leading-[1.6] text-[#1d4ed8]">
          {activePreset.hint}
        </div>

        <textarea
          className="min-h-[320px] w-full flex-1 resize-none border-t border-line bg-[#fbfbfc] px-3 py-3 font-mono text-[12px] leading-[1.65] text-body outline-none [tab-size:2]"
          spellCheck={false}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
        />

        {parseError && (
          <div className="shrink-0 border-t border-line bg-danger-soft px-3.5 py-2 font-mono text-[12px] text-danger">
            JSON 解析失败：{parseError}
          </div>
        )}
      </section>

      <section className={PANE}>
        <div className={PANE_HEAD}>
          <h2 className={PANE_TITLE}>表单预览</h2>
          <span className={PANE_SUB}>
            {schema.nodes.length} 个顶层节点 ·{' '}
            {Object.keys(engine.errors).length} 个错误
          </span>
        </div>

        <div className={PANE_BODY}>
          <DynamicForm
            schema={schema}
            values={engine.values}
            errors={engine.errors}
            onChange={engine.handleChange}
            onFieldBlur={engine.handleFieldBlur}
          />

          <div className="df-form-actions">
            <button
              type="button"
              className="df-btn is-primary"
              onClick={engine.submit}
            >
              提交校验
            </button>
            <button
              type="button"
              className="df-btn"
              onClick={() => engine.reset(activePreset.initial)}
            >
              重置
            </button>
            {engine.status.type !== 'idle' && (
              <span
                className={`df-status ${
                  engine.status.type === 'ok' ? 'is-ok' : 'is-error'
                }`}
              >
                {engine.status.message}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className={PANE}>
        <div className={PANE_HEAD}>
          <h2 className={PANE_TITLE}>提交数据</h2>
          {payloadSummary && <span className={PANE_SUB}>{payloadSummary}</span>}
        </div>

        <div className={PANE_BODY}>
          <div className="mb-3 rounded-lg bg-page px-3 py-[10px] text-[12px] leading-[1.65] text-dim">
            <code className="rounded border border-line bg-white px-1 py-px font-mono text-[11.5px]">
              serializeVisible()
            </code>{' '}
            的输出。被{' '}
            <code className="rounded border border-line bg-white px-1 py-px font-mono text-[11.5px]">
              visibleWhen
            </code>{' '}
            藏起来的字段<strong>不会</strong>出现在这里 ——
            隐藏即不提交，这是业务硬要求，
            不是显示效果。只读字段和被锁定的单元格则相反，它们照样提交。
          </div>
          <pre className="m-0 font-mono text-[12px] leading-[1.65] whitespace-pre-wrap text-body">
            {JSON.stringify(engine.payload, null, 2)}
          </pre>
        </div>
      </section>
    </div>
  );
}
