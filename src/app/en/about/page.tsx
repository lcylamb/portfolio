import type { Metadata } from 'next';
import About from '@/site/About';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Frontend developer in Shenzhen. Four years of frontend work, the last three in insurance back-office — calculation, adjudication, dispatch: long workflows, hundreds of fields, and mistakes that cost real money.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: "Pluvia's Trail",
    title: 'About · Pluvia\'s Trail',
    description:
      'Frontend developer in Shenzhen. Four years of frontend work, the last three in insurance back-office — calculation, adjudication, dispatch: long workflows, hundreds of fields, and mistakes that cost real money.',
    images: ['https://lcylamb.github.io/portfolio/photos/photo-06.webp'],
  },
};

export default function AboutPage() {
  return <About lang="en" />;
}
