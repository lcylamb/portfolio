'use client';

import { useEffect, useState } from 'react';

// 主题切换。状态本体不放在 React 里 —— html.dark 类是唯一事实源：
// 布局里那段内联脚本在首帧前按 localStorage / 系统偏好把它设好，
// 这里挂载后读一次，点击时改类 + 落盘。
// 存「用户显式选择」；没存过就跟系统走（prefers-color-scheme）。

const KEY = 'theme';

export default function ThemeToggle() {
  // null = 还没挂载（SSR/水合前），避免闪烁期渲染出错误的图形
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem(KEY, next ? 'dark' : 'light');
    } catch {
      /* 隐身模式等场景下 localStorage 可能不可用 —— 主题保存在内存即可 */
    }
  };

  // ☾ 出现在浅色时（点它去暗色），☀ 出现在暗色时 —— 和语言切换的
  // 「当前语言弱色、目标语言亮」是同一个方向：显示的是要去的地方。
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? '切换到浅色模式' : '切换到深色模式'}
      title={dark ? '浅色' : '深色'}
      className="border-0 bg-transparent p-0 font-mono text-[12px] leading-none text-dim transition-colors hover:text-ink"
    >
      {dark === null ? '◐' : dark ? '☀' : '☾'}
    </button>
  );
}
