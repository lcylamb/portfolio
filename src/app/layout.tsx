import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import SiteNav from './site-nav';
import SiteFooter from './site-footer';

/**
 * 站点元信息。
 *
 * 这一块是从原来的 index.html 搬过来的，但多出来的部分才是重点：
 * Next 的 metadata 是**按页可覆盖**的（每页 export 自己的 metadata，
 * 子页的 openGraph / title 会盖掉这里的默认值）。原来的 hash 路由做不到这件事 ——
 * 单页应用里所有路径共用一份 <head>，分享到微信里永远是同一个标题。
 *
 * metadataBase 只影响「相对路径的绝对化」（OG 图那些）。
 * 本地默认 localhost，部署时给 SITE_URL 环境变量即可，代码不用改。
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: "Pluvia's Trail",
    template: "%s · Pluvia's Trail",
  },
  description:
    '前端开发。做过四年保险行业的中后台系统，最近把其中最难的一块（动态表单）重新设计成了 schema 驱动的引擎。',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: "Pluvia's Trail",
    title: "Pluvia's Trail",
    description:
      '前端开发。做过四年保险行业的中后台系统，最近把其中最难的一块（动态表单）重新设计成了 schema 驱动的引擎。',
    // 分享卡片没有图就是一个裸链接。先用一张自己的照片顶着，
    // 换成专门做的 1200×630 图会更好，但空着是最差的。
    // og:image 按规范要绝对地址；Pages 上就是 github.io 域 + basePath。
    images: ['https://lcylamb.github.io/portfolio/photos/photo-06.webp'],
  },
};

export default function RootLayout(props: { children: ReactNode }) {
  return (
    // suppressHydrationWarning：html.dark 可能由下面的内联脚本在首帧前加上，
    // 服务端渲染不知道用户的主题选择 —— 这是刻意的差异，不是水合错误。
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 主题防闪烁：CSS/JS 加载前就定好 html.dark。
            存过用存档，没存过跟系统。阻塞式内联脚本，代价可忽略（几十字节）。 */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();",
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <SiteNav />

        <main className="flex-1">{props.children}</main>

        {/* 页脚是客户端组件（SiteFooter）：除了渲染内容，还负责把 <html> 的
            lang 属性按当前路由修正成 zh-CN / en。 */}
        <SiteFooter />
      </body>
    </html>
  );
}
