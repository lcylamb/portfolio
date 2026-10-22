// 引擎对外入口。宿主只认这一个文件，不必知道内部怎么分层。

export { DynamicForm } from './DynamicForm';
export type { DynamicFormProps } from './DynamicForm';

export { FormItem, resolveSpan } from './FormItem';
export { FormList } from './FormList';
export { FormTable } from './FormTable';

export { useFormEngine } from './useFormEngine';
export type { EngineStatus } from './useFormEngine';

export { REGISTERED_WIDGETS, renderField } from './fields/registry';
export type { FieldRenderContext, FieldRenderer } from './fields/registry';

export {
  createInitialValues,
  createListItemValues,
  createTableRowValues,
  resolveOptionLabel,
} from './schema/defaults';
export { collectReferencedFields, evaluate } from './schema/conditions';

export {
  countErrors,
  pickFirstErrorPath,
  validate,
  validateAtPath,
} from './controller/validate';
export { collectVisiblePaths, serializeVisible } from './controller/serialize';
export { focusFirstError } from './controller/focus';

export { deletePath, getPath, hasPath, setPath } from './path';

export type * from './schema/types';
