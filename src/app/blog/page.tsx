import type { Metadata } from 'next';
import Blog from '@/site/Blog';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    '前端笔记：schema 驱动表单的重构取舍、JS 底层原理学习笔记，以及踩过的坑。',
};

export default function BlogPage() {
  return <Blog />;
}
