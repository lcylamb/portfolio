import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GROUPS, getGroup } from '@/site/Photos';
import PhotoGroupPage from '@/site/PhotoGroup';

// 照片组页：/photos/<id>/，六个地点各一个静态页面。
// 组数据登记在 site/Photos.tsx 的 GROUPS 里，导出参数和 SEO 标题都从那来。

export function generateStaticParams() {
  return GROUPS.map((g) => ({ group: g.id }));
}

export async function generateMetadata(props: {
  params: Promise<{ group: string }>;
}): Promise<Metadata> {
  const { group } = await props.params;
  const g = getGroup(group);
  if (!g) return {};
  return { title: `${g.name} · 照片`, description: g.photos.map((p) => p.alt).join('、') };
}

export default async function GroupPage(props: {
  params: Promise<{ group: string }>;
}) {
  const { group } = await props.params;
  const g = getGroup(group);
  if (!g) notFound();
  return <PhotoGroupPage group={g} />;
}
