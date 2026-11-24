/* Reglas de calidad para todas las apps. Si una regla molesta, se discute en un PR; no se desactiva en el archivo. */
const globals = require('globals');

const GAS = Object.fromEntries([
  'SpreadsheetApp', 'DriveApp', 'HtmlService', 'PropertiesService', 'CacheService', 'LockService',
  'Utilities', 'Session', 'ScriptApp', 'MailApp', 'UrlFetchApp', 'Logger', 'console'
].map((g) => [g, 'readonly']));

module.exports = [
  {
    files: ['apps/*/src/server/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: GAS
    },
    rules: {
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true, IIFEs: false }],
      complexity: ['error', 12],
      'max-depth': ['error', 3],
      'max-params': ['error', 6],
      'no-unused-vars': ['error', { vars: 'local', args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-undef': 'off',
      eqeqeq: ['error', 'smart'],
      'no-var': 'off',
      'no-eval': 'error',
      'no-implied-eval': 'error'
    }
  },
  {
    files: ['apps/*/test/**/*.js', 'scripts/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: globals.node }
  }
];
