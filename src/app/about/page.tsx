import type { Metadata } from 'next';
import About from '@/site/About';

export const metadata: Metadata = {
  title: '关于',
  description: '前端开发，现在深圳。四年 To B 中后台，保险行业居多。',
};

export default function AboutPage() {
  return <About />;
}
