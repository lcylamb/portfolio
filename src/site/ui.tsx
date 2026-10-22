// 跨页复用的小件。
//
// 原来 .home-btn / .home-stats 是全局 class，首页和作品页都引它。
// Tailwind 下复用的单位是**组件**而不是 class —— 写在这里之后，
// 想改按钮的圆角只改一处，而且不会留下一个谁都能挂的全局类名。

import Link from 'next/link';
import type { ReactNode } from 'react';

export function Btn(props: {
  href: string;
  primary?: boolean;
  /** 外链：新标签页打开并断开 referrer。站内跳转不要传，否则会丢掉客户端路由。 */
  external?: boolean;
  children: ReactNode;
}) {
  const { href, primary, external, children } = props;
  // 主按钮用黑底而不是蓝底 —— 蓝只留给链接和选中态，这是 Geist 的分法。
  // 形状是 6px 小圆角而不是胶囊：胶囊配上大圆角卡片，整个站会显得「泡泡的」，
  // 这里宁方勿圆，和「工程笔记」的语气一致。
  const skin = primary
    ? 'border-ink bg-ink text-white hover:border-[#383838] hover:bg-[#383838] hover:text-white'
    : 'border-line bg-surface text-ink hover:border-ink';
  return (
    <Link
      className={`inline-block rounded-md border px-5 py-[9px] text-[13.5px] no-underline transition-colors ${skin}`}
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {children}
    </Link>
  );
}

export function Stats(props: { items: { value: string; label: string }[] }) {
  return (
    <div className="mt-10 flex flex-wrap gap-8 border-t border-line pt-6">
      {props.items.map((item) => (
        <div className="flex items-baseline gap-2" key={item.label}>
          <strong className="text-[22px] font-semibold tracking-[-0.02em] text-ink tabular-nums">
            {item.value}
          </strong>
          <span className="text-[12.5px] text-dim">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
