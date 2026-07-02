import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier/flat';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-implicit-coercion': 'error',
      'no-warning-comments': [
        'warn',
        {
          terms: ['todo', 'fixme', 'xxx', 'bug'],
          location: 'anywhere',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  prettierConfig,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    '.vercel/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
