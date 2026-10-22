import type { Metadata } from 'next';
import Works from '@/site/Works';

export const metadata: Metadata = {
  title: '作品',
  description:
    '两个在做的东西：一个 JSON Schema 驱动的动态表单引擎，和一个自然语言驱动的浏览器自动化 Agent 工作台。',
};

export default function WorksPage() {
  return <Works />;
}
