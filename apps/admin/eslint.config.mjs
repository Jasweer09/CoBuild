import config from '@cobuild/eslint-config';

export default [
  ...config,
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
