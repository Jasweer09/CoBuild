import config from '@cobuild/eslint-config';

export default [
  ...config,
  {
    rules: {
      // Next.js pages use default exports
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
