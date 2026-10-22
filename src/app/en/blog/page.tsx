import type { Metadata } from 'next';
import Blog from '@/site/Blog';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Frontend notes: the trade-offs of a schema-driven form rewrite, study notes on JS internals, and the pits I fell into.',
};

export default function BlogPage() {
  return <Blog lang="en" />;
}
