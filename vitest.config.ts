import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * 单测配置。和 Next 的构建彻底分开了 —— 这里只跑引擎的纯逻辑层。
 *
 * 原来这份配置写在 vite.config.ts 里，因为构建和测试共用同一个 Vite。
 * 换成 Next 之后两条链路没有交点：Next 用 Turbopack 打包，测试用 vitest，
 * 所以配置也得分开。这是框架替换的正常代价，不是退化。
 *
 * 被测目录的取舍没变：`path.ts` 与 `schema/` `controller/` 下的模块全部
 * 零 React、零浏览器依赖（不 import 组件、不碰 document），能在 node 直跑。
 * 两个刻意排除在外的：
 *   - `controller/focus.ts` —— controller 里唯一碰 DOM 的模块，必须留在 include 外；
 *   - 渲染层（DynamicForm / FormItem / FormList / FormTable / fields/registry）
 *     —— 它们要拖进 React，进来了也只是把 jsdom 当摆设。
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(rootDir, 'src') },
  },
  test: {
    include: ['src/engine/**/__tests__/**/*.test.ts'],
    environment: 'node',
    // 测试里显式 import { describe, it, expect } from 'vitest'，不开 globals
    globals: false,
  },
});
