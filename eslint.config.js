import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'demo-dist/**', 'node_modules/**', 'demo/assets/**', 'tests/e2e/**', 'scripts/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mjs,js}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        HTMLElement: 'readonly',
        customElements: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
);
