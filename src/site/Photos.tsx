// 照片页 = 六个地点的入口索引。每组一个独立页面（/photos/<id>/），
// 这里只放封面、地名和张数 —— 照片多了这里也不会变成一堵墙。
// alt 双语：中文给中文页，英文给 /en/photos。

import Link from 'next/link';
import { BASE, lp, type Locale } from './i18n';

export interface Photo {
  src: string;
  alt: string;
  altEn: string;
}

export interface PhotoGroup {
  /** URL 片段，决定访问地址 /photos/<id>/ */
  id: string;
  name: string;
  nameEn: string;
  photos: Photo[];
  /** 入口封面；不填用第一张 */
  cover?: Photo;
}

// photo-08 与 photo-07 是同一张，已从页面拿掉（文件还在 public/photos）。
export const GROUPS: PhotoGroup[] = [
  {
    id: 'xinjiang',
    name: '新疆',
    nameEn: 'Xinjiang',
    // 封面候选轮换：街道这张木屋、积雪、远山三层都有
    cover: { src: '/photos/photo-06.webp', alt: '湖对岸的雪山', altEn: 'Snow mountains across the lake' },
    photos: [
      { src: '/photos/photo-01.webp', alt: '冰湖边的马队', altEn: 'A horse caravan by a frozen lake' },
      { src: '/photos/photo-02.webp', alt: '雪后的村庄', altEn: 'A village after snowfall' },
      { src: '/photos/photo-03.webp', alt: '雪中的街道', altEn: 'A street in the snow' },
      { src: '/photos/photo-04.webp', alt: '雪中的小屋', altEn: 'A cabin in the snow' },
      { src: '/photos/photo-06.webp', alt: '湖对岸的雪山', altEn: 'Snow mountains across the lake' },
      { src: '/photos/photo-07.webp', alt: '雪原上的公路', altEn: 'A road across the snowfield' },
      { src: '/photos/photo-09.webp', alt: '雪原上的风机', altEn: 'Wind turbines on the snowfield' },
    ],
  },
  {
    id: 'wuwei',
    name: '武威',
    nameEn: 'Wuwei',
    // 封面候选轮换：荒原这张大面积留白，飞机是唯一的动点
    cover: { src: '/photos/photo-17.webp', alt: '荒原上空的飞机', altEn: 'A plane over the wasteland' },
    photos: [
      { src: '/photos/photo-14.webp', alt: '雪山下的黄土塬', altEn: 'Loess plateau under snow mountains' },
      { src: '/photos/photo-15.webp', alt: '荒山下的村庄', altEn: 'A village below barren hills' },
      { src: '/photos/photo-16.webp', alt: '黄土丘陵', altEn: 'Loess hills' },
      { src: '/photos/photo-17.webp', alt: '荒原上空的飞机', altEn: 'A plane over the wasteland' },
      { src: '/photos/photo-19.webp', alt: '沙漠里的徒步队伍', altEn: 'Hikers in the desert' },
    ],
  },
  {
    id: 'wugongshan',
    name: '武功山',
    nameEn: 'Wugong Mountain',
    photos: [
      { src: '/photos/photo-05.webp', alt: '山脊上的云', altEn: 'Clouds over the ridge' },
    ],
  },
  {
    id: 'sanxia',
    name: '三峡',
    nameEn: 'Three Gorges',
    photos: [
      { src: '/photos/photo-10.webp', alt: '江心的山', altEn: 'A hill in the middle of the river' },
      { src: '/photos/photo-11.webp', alt: '绿色的江峡', altEn: 'A green river gorge' },
      { src: '/photos/photo-12.webp', alt: '江峡俯瞰', altEn: 'The gorge from above' },
      { src: '/photos/photo-13.webp', alt: '江上的船', altEn: 'A boat on the river' },
    ],
  },
  {
    id: 'lingbo',
    name: '武汉凌波湖',
    nameEn: 'Lingbo Lake, Wuhan',
    photos: [
      { src: '/photos/photo-20.webp', alt: '日落时的栈桥', altEn: 'A pier at sunset' },
      { src: '/photos/photo-21.webp', alt: '日落时的赛艇', altEn: 'Rowing shells at sunset' },
    ],
  },
  {
    id: 'shenzhen',
    name: '深圳天文台',
    nameEn: 'Shenzhen Observatory',
    photos: [
      { src: '/photos/photo-18.webp', alt: '海边的步道', altEn: 'A coastal walkway' },
    ],
  },
];

export function getGroup(id: string): PhotoGroup | undefined {
  return GROUPS.find((g) => g.id === id);
}

const COPY = {
  zh: { h1: '照片', intro: '不写代码的时候在路上。' },
  en: { h1: 'Photos', intro: "When I'm not writing code, I'm on a trail." },
} as const;

export default function Photos({ lang = 'zh' }: { lang?: Locale }) {
  const t = COPY[lang];
  return (
    <div className="mx-auto max-w-[1120px] px-6 pt-16 pb-20">
      <p className="m-0 mb-5 font-mono text-[11.5px] tracking-[0.18em] text-faint">PHOTOS</p>
      <h1 className="m-0 text-[30px] leading-[1.3] font-semibold tracking-[-0.015em] text-ink">{t.h1}</h1>
      <p className="mt-4 mb-9 max-w-[36em] text-[14.5px] leading-[1.85] text-body">
        {t.intro}
      </p>

      {/* 六个入口：封面用每组第一张，点进去是组页 */}
      <div className="grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
        {GROUPS.map((g) => (
          <Link
            key={g.id}
            href={lp(lang, `/photos/${g.id}`)}
            className="group block no-underline"
          >
            <img
              src={`${BASE}${(g.cover ?? g.photos[0]).src}`}
              alt={lang === 'en' ? (g.cover ?? g.photos[0]).altEn : (g.cover ?? g.photos[0]).alt}
              loading="lazy"
              className="aspect-[3/2] w-full border border-line object-cover"
            />
            <span className="mt-2.5 flex items-baseline gap-2">
              <span className="text-[15px] font-semibold text-ink group-hover:underline">
                {lang === 'en' ? g.nameEn : g.name}
              </span>
              <span className="font-mono text-[11px] text-faint">
                {String(g.photos.length).padStart(2, '0')}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
