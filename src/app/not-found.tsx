import Link from 'next/link';

// 静态导出会把这一页写成 out/404.html，交给静态托管当兜底页
// （scripts/serve.mjs 本地预览时也是这个行为）。
// 换成文件路由之后才第一次有「页面不存在」这个概念 ——
// hash 路由那版所有路径都落在同一个 HTML 上，写错也照样渲染。

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-[800px] flex-col items-start px-6 pt-20 pb-24">
      <p className="m-0 font-mono text-[13px] text-faint">404</p>
      <h1 className="mt-3 mb-3 text-[26px] font-medium text-ink">
        这页不存在
      </h1>
      <p className="m-0 mb-7 leading-[1.8] text-body">
        地址可能写错了，或者链接已经过期。
      </p>
      <Link
        className="rounded-md border border-line bg-surface px-5 py-[9px] text-[13.5px] text-ink no-underline transition-colors hover:border-ink"
        href="/"
      >
        回首页
      </Link>
    </div>
  );
}
