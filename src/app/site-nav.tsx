'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { localeFromPath, type Locale } from '@/site/i18n';

// 悬浮毛玻璃导航条。它必须是个客户端组件 —— 高亮当前项和语言切换都要读路径，
// 而 usePathname 是 hook。
//
// 双语规则：中文在根路径、英文在 /en 前缀下，两套菜单各自指向自己语言的页面；
// 最右边常驻一个切换链接，把当前路径换到另一种语言的对应页
// （slug 双语一致，所以除了前缀什么都不用换；/playground 是单语页，切过去还是它自己）。

interface NavItem {
  href: string;
  label: string;
  /** 归到这个入口下的子路径前缀，比如文章详情页算博客的一部分 */
  also?: string;
}

const NAV: Record<Locale, NavItem[]> = {
  zh: [
    { href: '/', label: '首页' },
    { href: '/works', label: '作品' },
    // 文章详情页（/article/xxx）在导航里没有自己的位置，归到「Blog」下
    { href: '/blog', label: 'Blog', also: '/article/' },
    { href: '/photos', label: '照片' },
    { href: '/about', label: '关于' },
  ],
  en: [
    { href: '/en', label: 'Home' },
    { href: '/en/works', label: 'Works' },
    { href: '/en/blog', label: 'Blog', also: '/en/article/' },
    { href: '/en/photos', label: 'Photos' },
    { href: '/en/about', label: 'About' },
  ],
};

export default function SiteNav() {
  const pathname = usePathname();
  const lang = localeFromPath(pathname);
  const nav = NAV[lang];
  // 当前路径可能是 '/about'、'/en/about/'，也可能带尾斜杠（trailingSlash: true）。
  // 先归一化，不然高亮和切换都会失效。
  const current = normalize(pathname);

  // 语言切换目标：换前缀即可（slug 双语一致）。
  // 例外：/playground 是单语页，切到英文侧没有对应页，就留在原地。
  const switchHref =
    current === '/playground'
      ? '/playground'
      : lang === 'zh'
        ? current === '/'
          ? '/en'
          : '/en' + current
        : current.slice(3) || '/';

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-line bg-surface">
      <nav className="relative mx-auto flex h-14 max-w-[960px] items-center justify-center px-6 max-xs:px-4">
        {/* 不放字标：名字占着左边，视线会先落在它而不是当前页。
            菜单居中，只留一条底线。
            链接不设水平内边距：下划线直接挂在链接上，宽度就等于字宽。 */}
        <div className="flex min-w-0 items-stretch gap-7 overflow-x-auto [scrollbar-width:none] max-xs:gap-4 [&::-webkit-scrollbar]:hidden">
          {nav.map((item) => {
            const active = resolveActive(current, lang) === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center border-b-2 text-[13.5px] whitespace-nowrap no-underline transition-colors max-xs:text-[13px] ${
                  active
                    ? 'border-ink font-medium text-ink'
                    : 'border-transparent text-dim hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        {/* 语言切换：mono 小字挂在最右，不参与菜单的居中布局。
            当前语言显示为弱色、不可点；目标语言才亮。 */}
        <div className="absolute right-6 flex items-center gap-2 font-mono text-[11.5px] max-xs:right-4">
          {lang === 'en' ? (
            <>
              <span className="text-faint">EN</span>
              <Link className="text-dim no-underline transition-colors hover:text-ink" href={switchHref}>
                中
              </Link>
            </>
          ) : (
            <>
              <span className="text-faint">中</span>
              <Link className="text-dim no-underline transition-colors hover:text-ink" href={switchHref}>
                EN
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

function normalize(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

// 决定当前路径该高亮哪一项。
//
// 规则是「精确命中优先，其次才算归属」：因为 /article/dynamic-form-schema
// 既命中「重构记」这一项，又落在「Blog」的 /article/ 前缀下 ——
// 不先判精确，访问重构记那篇时会把「Blog」点亮，看着像点错了。
function resolveActive(path: string, lang: Locale): string | null {
  const nav = NAV[lang];
  const exact = nav.find((item) => item.href === path);
  if (exact) return exact.href;
  const grouped = nav.find((item) => item.also && path.startsWith(item.also));
  return grouped?.href ?? null;
}
