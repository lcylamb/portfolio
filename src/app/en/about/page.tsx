import type { Metadata } from 'next';
import About from '@/site/About';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Frontend developer, based in Shenzhen. Four years of B-side back-office systems, mostly in insurance.',
};

export default function AboutPage() {
  return <About lang="en" />;
}
