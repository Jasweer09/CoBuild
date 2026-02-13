import config from '@cobuild/eslint-config';

export default [
  ...config,
  {
    ignores: ['src/generated/**'],
  },
];
