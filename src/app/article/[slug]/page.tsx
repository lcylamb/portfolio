import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ARTICLES, getArticle, renderArticle } from '@/site/article-content';

// 这一页是服务端组件，且在构建期就跑完了 —— 没有任何「进浏览器再算」的部分。
// 所以 out/article/<slug>/index.html 里是有完整正文的。这是换 Next 最实在的
// 收益：原来那版是客户端渲染，文章在页面源码里一个字都搜不到。
//
// 文章列表和元信息都登记在 site/article-content.ts 的 ARTICLES 里，
// 这里的静态导出参数、SEO 标题都从那里来。

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const meta = getArticle(slug);
  if (!meta) return {};
  return { title: meta.title, description: meta.description };
}

export default async function ArticlePage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const meta = getArticle(slug);
  if (!meta) notFound();

  const html = renderArticle(slug);

  return (
    <article className="mx-auto max-w-[800px] px-6 pt-10 pb-24">
      <p className="m-0 mb-4 font-mono text-[12px] text-faint">{meta.date}</p>
      <div
        className="prose-article"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}
