// 英文首页。复用 src/site/Home，只换 lang 和元信息；
// 中文版在根路径（src/app/page.tsx），两边 URL 由 /en 前缀区分。

import type { Metadata } from 'next';
import Home from '@/site/Home';

export const metadata: Metadata = {
  title: "Pluvia's Trail",
  description:
    'Frontend developer, four years of B-side back-office systems. Recently pulled the dynamic form out of the business code and redesigned it as a JSON-driven schema engine.',
};

export default function HomePage() {
  return <Home lang="en" />;
}
