import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  ARTICLES,
  getArticle,
  getArticleMeta,
  renderArticle,
} from '@/site/article-content';

// 英文文章页。与中文版（src/app/article/[slug]/page.tsx）共用 slug 和
// 构建逻辑，差别只有两处：读 docs/en/ 下的 md、元信息用 titleEn/descriptionEn。
// 没有英文版（fileEn 未登记）的 slug 在这里 404。

export function generateStaticParams() {
  return ARTICLES.filter((a) => a.fileEn).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const meta = getArticleMeta(slug, 'en');
  if (!meta) return {};
  return { title: meta.title, description: meta.description };
}

export default async function ArticlePage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const meta = getArticleMeta(slug, 'en');
  const registered = getArticle(slug);
  if (!meta || !registered) notFound();

  const html = renderArticle(slug, 'en');

  return (
    <article className="mx-auto max-w-[800px] px-6 pt-10 pb-24">
      <p className="m-0 mb-4 font-mono text-[12px] text-faint">{registered.date}</p>
      <div
        className="prose-article"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}
