export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Relaxed — our history mixes cases and both are readable
    'subject-case': [0],
    // 100 chars — GitHub displays fine; our scope names are descriptive
    'header-max-length': [2, 'always', 100],
  },
};
