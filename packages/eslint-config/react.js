import eslintReact from '@eslint-react/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ...eslintReact.configs.recommended,
    files: ['**/*.{tsx,jsx}'],
    rules: {
      ...eslintReact.configs.recommended.rules,
      '@eslint-react/no-nested-component-definitions': 'warn',
    },
  },
  {
    files: ['**/*.{tsx,jsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
