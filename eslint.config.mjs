// @ts-check
import eslint from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import prettierPlugin from 'eslint-plugin-prettier'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // 1️⃣ Ignore files
  {
    ignores: [
      'eslint.config.mjs',
      '.eslintrc.cjs',
      'dist/**',
      'node_modules/**',
    ],
  },

  // 2️⃣ Base ESLint rules
  eslint.configs.recommended,

  // 3️⃣ TypeScript recommended (type-aware)
  ...tseslint.configs.recommendedTypeChecked,

  // 4️⃣ Disable ESLint rules that conflict with Prettier
  prettierConfig,

  // 5️⃣ Language & environment
  {
    languageOptions: {
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
  },

  // 6️⃣ Custom rules
  {
    rules: {
      // Prettier as formatter
      'prettier/prettier': [
        'error',
        {
          endOfLine: 'auto',
          singleQuote: true,
          trailingComma: 'none',
        },
      ],

      // TypeScript rules
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
)
