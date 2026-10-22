import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * 与内部中后台项目的 `.eslintrc.js` 对齐的三条规则：
 *
 * 1. `no-console` 是 **error**（只放行 warn/error）—— 提交前不留调试输出；
 * 2. `react-hooks/recommended` 必开 —— 这个引擎的渲染器大量递归且
 *    在子组件里用 useState，hooks 规则一旦关掉，列表项里的局部状态
 *    很容易被写成条件调用而无人发现；
 * 3. 忽略构建产物。
 *
 * 与主项目唯一的差异：这里是 flat config（eslint 9），主项目走的是
 * `@umijs/max/eslint` 提供的 legacy 配置链 —— 那边由 Umi 托管，改不得。
 *
 * 文件名是 .mjs 而不是 .js：package.json 里没有 `"type": "module"`
 * （Next 项目的默认形态），配置里又用的是 ESM 语法，只能靠扩展名说清楚。
 */
export default tseslint.config(
  {
    ignores: [
      '.next',
      'out',
      'node_modules',
      '.node_modules_old',
      'coverage',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // 配置文件（next.config.ts / postcss.config.mjs / scripts/*.mjs）跑在 node 里，
  // 但下面那条 ts 规则只给了 browser + node 的合并 globals —— .mjs 落不到它上面，
  // 于是 process / console 会被报成 not defined。这里单独给一份 node globals。
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
