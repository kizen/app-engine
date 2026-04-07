// https://github.com/i18next/i18next-parser
module.exports = {
  locales: ['en'],
  input: ['src/**/*.{ts,tsx}'],
  output: 'locales/$LOCALE/$NAMESPACE.json',
  defaultNamespace: 'translation',
  namespaceSeparator: false,
  keySeparator: false,
  lexers: {
    ts: ['JavascriptLexer'],
    tsx: ['JsxLexer'],
  },
  sort: true,
  keepRemoved: false,
  failOnWarnings: true,
  verbose: false,
};
