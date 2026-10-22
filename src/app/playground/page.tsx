import type { Metadata } from 'next';
import Playground from '@/playground/Playground';

// Playground 自己要拿状态、要挂事件，所以是客户端组件（'use client' 写在它自己文件里）。
// 这一层保持服务端，只用来放 metadata —— 客户端组件是 export 不了 metadata 的。
//
// 顺带说清楚边界：这一页在服务端**只产出一个空壳**，表单是进了浏览器才算出来的。
// 这没关系 —— 它是给人玩的，没有 SEO 价值。

export const metadata: Metadata = {
  title: 'Playground',
  description: '左边改 schema，中间表单立刻重渲染，右边实时显示真正会提交的那份数据。',
};

export default function PlaygroundPage() {
  return <Playground />;
}
