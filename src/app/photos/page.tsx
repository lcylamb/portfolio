import type { Metadata } from 'next';
import Photos from '@/site/Photos';

export const metadata: Metadata = {
  title: '照片',
  description: '徒步和旅行路上拍的。',
};

export default function PhotosPage() {
  return <Photos />;
}
