import type { Metadata } from 'next';
import Works from '@/site/Works';

export const metadata: Metadata = {
  title: 'Works',
  description:
    'Two things being built: a JSON-schema-driven dynamic form engine, and a natural-language browser-automation agent workbench.',
};

export default function WorksPage() {
  return <Works lang="en" />;
}
