import {
  Button,
  Chart,
  HStack,
  Image,
  Label,
  ProgressView,
  Spacer,
  Text,
  TextField,
  VStack,
  type ChartDataPoint,
  type LabelProps,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  autocorrectionDisabled,
  bold,
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  keyboardType,
  labelStyle,
  lineLimit,
  multilineTextAlignment,
  monospacedDigit,
  padding,
  textFieldStyle,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, type ReactNode } from 'react';

type SystemImage = NonNullable<LabelProps['systemImage']>;
type StatusTone = 'success' | 'warning' | 'error' | 'neutral';

const SECONDARY = { type: 'hierarchical', style: 'secondary' } as const;
const TERTIARY = { type: 'hierarchical', style: 'tertiary' } as const;

const STATUS_COLOR: Record<StatusTone, 'green' | 'orange' | 'red' | 'secondary'> = {
  success: 'green',
  warning: 'orange',
  error: 'red',
  neutral: 'secondary',
};

export function SwiftUIPageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <HStack alignment="top" spacing={12} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ vertical: 8 })]}>
      <VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <Text modifiers={[font({ textStyle: 'largeTitle', weight: 'bold' }), lineLimit(2)]}>{title}</Text>
        {subtitle ? <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(SECONDARY), lineLimit(3)]}>{subtitle}</Text> : null}
      </VStack>
      {action}
    </HStack>
  );
}

export function SwiftUIIconButton({ label, systemImage, onPress }: { label: string; systemImage: SystemImage; onPress: () => void }) {
  return (
    <Button
      label={label}
      systemImage={systemImage}
      onPress={onPress}
      modifiers={[buttonStyle('borderless'), labelStyle('iconOnly'), accessibilityLabel(label)]}
    />
  );
}

export function SwiftUIStatus({ label, tone }: { label: string; tone: StatusTone }) {
  return <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), foregroundStyle(STATUS_COLOR[tone])]}>{label}</Text>;
}

export function SwiftUIBoundTextField({
  value,
  onTextChange,
  placeholder,
  keyboard = 'default',
  multiline = false,
}: {
  value: string;
  onTextChange: (value: string) => void;
  placeholder?: string;
  keyboard?: 'default' | 'decimal-pad' | 'numeric' | 'web-search';
  multiline?: boolean;
}) {
  const nativeText = useNativeState(value);

  useEffect(() => {
    if (nativeText.get() !== value) nativeText.set(value);
  }, [nativeText, value]);

  return (
    <TextField
      axis={multiline ? 'vertical' : 'horizontal'}
      onTextChange={onTextChange}
      placeholder={placeholder}
      text={nativeText}
      modifiers={[
        textFieldStyle('roundedBorder'),
        keyboardType(keyboard),
        textInputAutocapitalization('never'),
        autocorrectionDisabled(),
        ...(multiline ? [lineLimit({ min: 2, max: 4 })] : []),
      ]}
    />
  );
}

export function SwiftUIMetric({ label, value, tint = 'blue', detail }: {
  label: string;
  value: string;
  tint?: 'blue' | 'green' | 'orange' | 'red' | 'indigo' | 'purple';
  detail?: string;
}) {
  return (
    <VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(SECONDARY)]}>{label}</Text>
      <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' }), foregroundStyle(tint), monospacedDigit(), lineLimit(1)]}>{value}</Text>
      {detail ? <Text modifiers={[font({ textStyle: 'caption2' }), foregroundStyle(TERTIARY), lineLimit(1)]}>{detail}</Text> : null}
    </VStack>
  );
}

export function SwiftUIValueRow({ label, value, systemImage, valueTone = 'secondary' }: {
  label: string;
  value: string;
  systemImage?: SystemImage;
  valueTone?: 'primary' | 'secondary' | 'green' | 'orange' | 'red' | 'blue';
}) {
  const valueStyle = valueTone === 'primary'
    ? ({ type: 'hierarchical', style: 'primary' } as const)
    : valueTone === 'secondary'
      ? SECONDARY
      : valueTone;

  return (
    <HStack spacing={10}>
      {systemImage ? <Label title={label} systemImage={systemImage} /> : <Text>{label}</Text>}
      <Spacer />
      <Text modifiers={[foregroundStyle(valueStyle), monospacedDigit(), lineLimit(2)]}>{value}</Text>
    </HStack>
  );
}

export function SwiftUINavigationRow({ label, value, systemImage, onPress, accessibilityHint }: {
  label: string;
  value?: string;
  systemImage: SystemImage;
  onPress: () => void;
  accessibilityHint?: string;
}) {
  return (
    <Button
      onPress={onPress}
      modifiers={[
        buttonStyle('plain'),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        accessibilityLabel(accessibilityHint ? `${label}，${accessibilityHint}` : label),
      ]}
    >
      <HStack spacing={10} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <Label title={label} systemImage={systemImage} />
        <Spacer />
        {value ? <Text modifiers={[foregroundStyle(SECONDARY), monospacedDigit()]}>{value}</Text> : null}
        <Image systemName="chevron.forward" size={13} modifiers={[foregroundStyle(TERTIARY)]} />
      </HStack>
    </Button>
  );
}

export function SwiftUIStateView({
  title,
  message,
  systemImage = 'exclamationmark.circle',
  tone = 'neutral',
  loading = false,
  action,
}: {
  title: string;
  message: string;
  systemImage?: SystemImage;
  tone?: StatusTone;
  loading?: boolean;
  action?: ReactNode;
}) {
  const color = loading ? 'blue' : STATUS_COLOR[tone];
  return (
    <VStack spacing={10} modifiers={[frame({ maxWidth: Infinity, alignment: 'center' }), padding({ vertical: 24, horizontal: 12 })]}>
      {loading ? <ProgressView /> : <Image systemName={systemImage} size={30} modifiers={[foregroundStyle(color)]} />}
      <Text modifiers={[font({ textStyle: 'headline' }), bold()]}>{title}</Text>
      <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(SECONDARY), lineLimit(5), multilineTextAlignment('center')]}>{message}</Text>
      {action}
    </VStack>
  );
}

export function SwiftUITrendChart({ points, color = '#007AFF', height = 190 }: {
  points: ReadonlyArray<{ label: string; value: number }>;
  color?: string;
  height?: number;
}) {
  const data: ChartDataPoint[] = points.map((point) => ({ x: point.label, y: point.value }));
  return (
    <Chart
      animate
      data={data}
      lineStyle={{ color, width: 2.5 }}
      modifiers={[frame({ height, maxWidth: Infinity })]}
      showGrid
      type="line"
    />
  );
}
