import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';

export default [
  {
    files: ['**/*.js', '**/*.mjs'],
    ...sonarjs.configs.recommended,
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.serviceworker, ...globals.node },
    },
  },
];
