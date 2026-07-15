import * as Haptics from 'expo-haptics';

function ignoreHapticError(promise: Promise<void>) {
  void promise.catch(() => undefined);
}

export function selectionHaptic() {
  ignoreHapticError(Haptics.selectionAsync());
}

export function successHaptic() {
  ignoreHapticError(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function warningHaptic() {
  ignoreHapticError(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

export function impactHaptic() {
  ignoreHapticError(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
