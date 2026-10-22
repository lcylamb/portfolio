import type { Metadata } from 'next';
import Docs from '@/site/Docs';

export const metadata: Metadata = {
  title: '文档',
  description:
    '动态表单引擎的文档：schema 结构、条件表达式、校验规则、内置控件与 API。',
};

export default function DocsPage() {
  return <Docs lang="zh" />;
}
