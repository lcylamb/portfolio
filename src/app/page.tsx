// 路由层只做两件事：声明这一页的 title / description，然后把 UI 交出去。
// 页面本身住在 src/site —— app/ 目录留给路由和元信息，
// 这样以后加一页不用在两层之间来回搬代码。

import type { Metadata } from 'next';
import Home from '@/site/Home';

export const metadata: Metadata = {
  title: "Pluvia's Trail",
  description:
    '前端开发，四年 To B 中后台。最近把业务系统里的动态表单抽出来，重新设计成了一份 JSON 驱动的 schema 引擎。',
};

export default function HomePage() {
  return <Home />;
}
