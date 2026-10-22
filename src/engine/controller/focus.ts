import type { FormErrors } from '../schema/types';
import { pickFirstErrorPath } from './validate';

// 提交被拦后，把用户带到第一个出错的字段。
// 这是 controller/ 下唯一碰 DOM 的模块 —— 其余（validate / serialize）都保持零依赖。
//
// 和主项目用 antd 的 form.scrollToField() 的区别：那边必须持有 FormInstance，
// 定位能力绑死在表单库上；这里只认 FormItem 渲染出来的 data-path 属性，
// 所以校验结果和视图之间没有额外引用。

export function focusFirstError(errors: FormErrors): string | undefined {
  const path = pickFirstErrorPath(errors);
  if (!path) return undefined;

  const node = document.querySelector<HTMLElement>(`[data-path="${path}"]`);
  if (!node) return path;

  node.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // 抖一下，不然滚过去了用户也不知道该看哪
  node.classList.add('df-shake');
  window.setTimeout(() => node.classList.remove('df-shake'), 700);

  const focusable = node.querySelector<HTMLElement>(
    'input:not([type=radio]):not([type=checkbox]), select, textarea',
  );
  // 等滚动结束再聚焦，否则平滑滚动会被 focus 打断
  window.setTimeout(() => focusable?.focus({ preventScroll: true }), 260);

  return path;
}
