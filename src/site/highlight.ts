import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import tsx from 'highlight.js/lib/languages/typescript';

// 只注册这个站真正用到的语言。按需注册而不是引全量包，
// 全量 highlight.js 会让 bundle 多背几百 KB。
hljs.registerLanguage('typescript', tsx);
hljs.registerLanguage('tsx', tsx);
hljs.registerLanguage('ts', tsx);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', bash);

// 未知语言不猜，老老实实转义后原样输出 —— 错误的高亮比没有高亮更糟
export function highlightCode(code: string, lang?: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true })
        .value;
    } catch {
      // 落到下面的纯转义
    }
  }
  return escapeHtml(code);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
