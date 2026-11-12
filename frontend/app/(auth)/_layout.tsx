import { Stack } from 'expo-router';
import { useTheme } from '@/src/theme/ThemeProvider';

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Sign in', headerShown: false }} />
      <Stack.Screen name="otp" options={{ title: 'Sign in', headerShown: false }} />
    </Stack>
  );
}
