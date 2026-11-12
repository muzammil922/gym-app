import { Redirect } from 'expo-router';

/**
 * The OTP flow now lives inside the login screen under the "Member" tab, so
 * this route only exists for old deep links.
 */
export default function OtpRedirect() {
  return <Redirect href="/(auth)/login" />;
}
