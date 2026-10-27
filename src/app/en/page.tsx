// 英文首页。复用 src/site/Home，只换 lang 和元信息；
// 中文版在根路径（src/app/page.tsx），两边 URL 由 /en 前缀区分。

import type { Metadata } from 'next';
import Home from '@/site/Home';

export const metadata: Metadata = {
  // 模板是 "%s · Pluvia's Trail"，同名会渲染成重复；absolute 直接用整串
  title: { absolute: "Pluvia's Trail" },
  description:
    'Four years of frontend work, the last three in insurance back-office, and a lot of forms. The one I hated most is now just a JSON file. These days I put LLMs into business backends and judge them with evals.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: "Pluvia's Trail",
    title: "Pluvia's Trail",
    description:
      'Four years of frontend work, the last three in insurance back-office, and a lot of forms. The one I hated most is now just a JSON file. These days I put LLMs into business backends and judge them with evals.',
    images: ['https://lcylamb.github.io/portfolio/photos/photo-06.webp'],
  },
};

export default function HomePage() {
  return <Home lang="en" />;
}
