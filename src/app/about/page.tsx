import type { Metadata } from 'next';
import About from '@/site/About';

export const metadata: Metadata = {
  title: '关于',
  description:
    '前端开发，现在深圳。过去四年做保险中后台——理算、核赔、调度这类流程长、字段多、错一笔要赔钱的系统。',
};

export default function AboutPage() {
  return <About />;
}
