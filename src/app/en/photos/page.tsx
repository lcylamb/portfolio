import type { Metadata } from 'next';
import Photos from '@/site/Photos';

export const metadata: Metadata = {
  title: 'Photos',
  description: 'Taken on hiking trails and on the road.',
};

export default function PhotosPage() {
  return <Photos lang="en" />;
}
