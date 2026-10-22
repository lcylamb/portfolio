// 单个地点的照片页（/photos/<id>/）。只做一件事：把这一组的照片
// 用瀑布流铺出来，顶部留一个回索引的入口。

import Link from 'next/link';
import { BASE, lp, type Locale } from './i18n';
import type { PhotoGroup } from './Photos';

const COPY = {
  zh: { back: '照片' },
  en: { back: 'Photos' },
} as const;

export default function PhotoGroupPage({
  lang = 'zh',
  group,
}: {
  lang?: Locale;
  group: PhotoGroup;
}) {
  const t = COPY[lang];
  return (
    <div className="mx-auto max-w-[1120px] px-6 pt-16 pb-20">
      <p className="m-0 mb-5 font-mono text-[11.5px] tracking-[0.18em] text-faint">
        <Link href={lp(lang, '/photos')} className="text-dim no-underline hover:text-ink">
          ← {t.back}
        </Link>
      </p>
      <h1 className="m-0 text-[30px] leading-[1.3] font-semibold tracking-[-0.015em] text-ink">
        {lang === 'en' ? group.nameEn : group.name}
      </h1>
      <p className="mt-4 mb-9 font-mono text-[12px] text-faint">
        {String(group.photos.length).padStart(2, '0')}
      </p>

      {/* 瀑布流靠 photo-masonry（CSS 多列），照片高度不一，按列排才不会有空洞 */}
      <div className="photo-masonry">
        {group.photos.map((photo) => (
          <img
            key={photo.src}
            src={`${BASE}${photo.src}`}
            alt={lang === 'en' ? photo.altEn : photo.alt}
            loading="lazy"
            className="mb-3.5 w-full break-inside-avoid"
          />
        ))}
      </div>
    </div>
  );
}
