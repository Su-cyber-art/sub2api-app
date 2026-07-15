import { PlatformColor, type ColorValue } from 'react-native';

type IOSPalette = {
  background: ColorValue;
  secondaryBackground: ColorValue;
  tertiaryBackground: ColorValue;
  elevatedBackground: ColorValue;
  label: ColorValue;
  secondaryLabel: ColorValue;
  tertiaryLabel: ColorValue;
  separator: ColorValue;
  fill: ColorValue;
  secondaryFill: ColorValue;
  blue: ColorValue;
  green: ColorValue;
  orange: ColorValue;
  red: ColorValue;
  indigo: ColorValue;
};

export const iosColors: IOSPalette = {
  background: PlatformColor('systemGroupedBackground'),
  secondaryBackground: PlatformColor('secondarySystemGroupedBackground'),
  tertiaryBackground: PlatformColor('tertiarySystemGroupedBackground'),
  elevatedBackground: PlatformColor('systemBackground'),
  label: PlatformColor('label'),
  secondaryLabel: PlatformColor('secondaryLabel'),
  tertiaryLabel: PlatformColor('tertiaryLabel'),
  separator: PlatformColor('separator'),
  fill: PlatformColor('systemGray5'),
  secondaryFill: PlatformColor('systemGray6'),
  blue: PlatformColor('systemBlue'),
  green: PlatformColor('systemGreen'),
  orange: PlatformColor('systemOrange'),
  red: PlatformColor('systemRed'),
  indigo: PlatformColor('systemIndigo'),
};

// SVG colors don't consistently resolve PlatformColor values, so charts use
// Apple's standard light appearance accents while the surrounding UI adapts.
export const iosChartColors = {
  blue: '#007AFF',
  green: '#34C759',
  orange: '#FF9500',
  red: '#FF3B30',
  indigo: '#5856D6',
  gray: '#8E8E93',
};
