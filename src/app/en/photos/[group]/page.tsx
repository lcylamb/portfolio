import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GROUPS, getGroup } from '@/site/Photos';
import PhotoGroupPage from '@/site/PhotoGroup';

// 英文照片组页：/en/photos/<id>/。

export function generateStaticParams() {
  return GROUPS.map((g) => ({ group: g.id }));
}

export async function generateMetadata(props: {
  params: Promise<{ group: string }>;
}): Promise<Metadata> {
  const { group } = await props.params;
  const g = getGroup(group);
  if (!g) return {};
  return { title: `${g.nameEn} · Photos`, description: g.photos.map((p) => p.altEn).join(', ') };
}

export default async function EnGroupPage(props: {
  params: Promise<{ group: string }>;
}) {
  const { group } = await props.params;
  const g = getGroup(group);
  if (!g) notFound();
  return <PhotoGroupPage lang="en" group={g} />;
}
