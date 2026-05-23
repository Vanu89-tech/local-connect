import { activeGraphicStyle } from "./graphicStyles";

const style = activeGraphicStyle;
const palette = style.colors;

export default {
  activeStyle: style,
  light: {
    text: palette.ink,
    textSecondary: palette.textSecondary,
    textTertiary: palette.textTertiary,
    background: palette.paper,
    backgroundSecondary: palette.surface,
    backgroundTertiary: palette.surfaceAlt,
    tint: palette.accent,
    tintBlue: palette.accentBlue,
    primary: palette.primary,
    separator: palette.separator,
    card: palette.card,
    cardBorder: palette.separator,
    tabIconDefault: palette.tabIconDefault,
    tabIconSelected: palette.accent,
    like: palette.accent,
    commentIcon: palette.accentBlue,
    placeholder: palette.placeholder,
    danger: palette.danger,
    onBright: palette.onBright,
    onPrimary: palette.onPrimary,
    yellow: palette.yellow,
    mint: palette.mint,
  },
  shape: style.shape,
  shadow: style.shadow,
  typography: style.typography,
  map: style.map,
};
