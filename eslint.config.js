/* Reglas de calidad para todas las apps. Si una regla molesta, se discute en un PR; no se desactiva en el archivo. */
const fs = require('fs');
const globals = require('globals');

/* Apps traídas con migrar-legado (tienen el archivo .legado): mientras se refactorizan, los límites de
   tamaño y complejidad de función son advertencia; los de seguridad siguen siendo error. */
const legado = fs.readdirSync('apps').filter((a) => fs.existsSync(`apps/${a}/.legado`)).map((a) => `apps/${a}/src/server/**/*.js`);

const GAS = Object.fromEntries([
  'SpreadsheetApp', 'DriveApp', 'HtmlService', 'PropertiesService', 'CacheService', 'LockService',
  'Utilities', 'Session', 'ScriptApp', 'MailApp', 'GmailApp', 'UrlFetchApp', 'Logger', 'console', 'Drive',
  'FormApp', 'DocumentApp', 'ContentService', 'XmlService', 'MimeType', 'Browser', 'CalendarApp'
].map((g) => [g, 'readonly']));

module.exports = [
  {
    files: ['apps/*/src/server/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
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
    files: legado,
    rules: {
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': 'warn', complexity: 'warn', 'max-depth': 'warn', 'max-params': 'warn',
      'no-unused-vars': 'warn', eqeqeq: 'warn'
    }
  },
  {
    files: ['apps/*/test/**/*.js', 'scripts/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: globals.node }
  }
];
