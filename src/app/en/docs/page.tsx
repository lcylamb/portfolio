import type { Metadata } from 'next';
import Docs from '@/site/Docs';

export const metadata: Metadata = {
  title: 'Docs',
  description:
    "The dynamic form engine's documentation: schema structure, condition expressions, validation rules, built-in widgets and the API.",
};

export default function DocsPage() {
  return <Docs lang="en" />;
}
