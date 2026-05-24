import { Alert, Platform } from 'react-native';

// Lokale In-App Benachrichtigung via Alert.
// Push-Notifications (expo-notifications) erfordern native Config-Plugin in app.json
// und werden in einem separaten Schritt eingerichtet.

export async function requestNotificationPermission(): Promise<boolean> {
  // In-App Alerts benötigen keine Berechtigung
  return Platform.OS !== 'web';
}

export async function getExpoPushToken(): Promise<string | null> {
  // Noch nicht konfiguriert – Push-Token Setup kommt später
  return null;
}

export async function sendLocalNotification(params: {
  title: string;
  body:  string;
  data?: Record<string, unknown>;
}): Promise<void> {
  // Zeigt einen iOS-Alert wenn die App im Vordergrund ist
  Alert.alert(params.title, params.body);
}
