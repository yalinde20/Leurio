// Aucune couleur littérale hors de tokens.scss et ionic.scss : les styles passent par les tokens --lr-*.
export default {
  customSyntax: 'postcss-scss',
  ignoreFiles: ['src/theme/tokens.scss', 'src/theme/ionic.scss'],
  rules: {
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color'],
  },
};
