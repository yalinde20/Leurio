// Aucune couleur littérale hors de src/theme : les styles passent par les tokens --lr-*.
export default {
  customSyntax: 'postcss-scss',
  ignoreFiles: ['src/theme/**'],
  rules: {
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color'],
  },
};
