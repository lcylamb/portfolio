// 双语基础设施。整个站的约定：
//
// 1. 中文是默认语言，URL 在根路径（/、/about、/article/xxx）——存量不动；
// 2. 英文全部挂 /en/ 前缀（/en、/en/about、/en/article/xxx），slug 与中文一致，
//    所以语言切换只需要换前缀；
// 3. Playground 是单语共享页（代码页面，没有值得翻的散文），两边都指向 /playground。
//
// 每个站点组件（Home / About / Works …）都接收一个 lang prop，自己持有两份文案；
// 跨页共用的只有这里导出的类型和 lp() 这个链接前缀助手。

export type Locale = 'zh' | 'en';

/**
 * 部署子路径（GitHub Pages 项目页）。next.config.ts 的 basePath 只会改写
 * next/link、next/image 和静态资源引入——手写的 <img src="/photos/...">
 * 字符串不在其管辖范围，必须自己带上这个前缀。
 */
export const BASE = '/portfolio';

/** 站内链接按语言加前缀：lp('en', '/works') → '/en/works'，中文原样返回 */
export function lp(lang: Locale, path: string): string {
  return lang === 'en' ? '/en' + path : path;
}

/** 从路径判断语言。/en 开头即英文，其余（含 /playground）都是中文 */
export function localeFromPath(pathname: string): Locale {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'zh';
}
