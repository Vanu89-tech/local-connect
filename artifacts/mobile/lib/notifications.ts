import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Vordergrund-Handler: Benachrichtigungen auch anzeigen wenn App offen ist
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge:  false,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    // Use ios?.status for iOS; requestPermissionsAsync is safe to call repeatedly
    const existing = await Notifications.getPermissionsAsync();
    if (
      existing.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    ) return true;

    const result = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: false },
    });
    return (
      result.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      result.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
}

export async function getExpoPushToken(): Promise<string | null> {
  try {
    const { data } = await Notifications.getExpoPushTokenAsync();
    return data;
  } catch {
    return null;
  }
}

export async function sendLocalNotification(params: {
  title: string;
  body:  string;
  data?: Record<string, unknown>;
}): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body:  params.body,
        data:  params.data ?? {},
      },
      trigger: null, // sofort
    });
  } catch (e) {
    console.warn('[notifications] send failed:', e);
  }
}
