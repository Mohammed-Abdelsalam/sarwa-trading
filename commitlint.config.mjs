export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'repo',
        'config',
        'contracts',
        'domain',
        'i18n',
        'core',
        'ui',
        'tokens',
        'server',
        'mobile',
        'web',
        'admin',
        'docs',
        'ci',
        'ai',
        'deps',
      ],
    ],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
  },
};
