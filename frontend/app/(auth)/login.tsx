import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/ui/Screen';
import { TextField } from '@/src/components/ui/TextField';
import { Button } from '@/src/components/ui/Button';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassPill } from '@/src/components/ui/GlassPill';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useAuthStore } from '@/src/store/auth-store';
import { useToastStore } from '@/src/store/toast-store';
import {
  loginSchema,
  LoginForm,
  otpPhoneSchema,
  otpVerifySchema,
  setPasswordSchema,
  SetPasswordForm,
} from '@/src/features/auth/schemas';
import { z } from 'zod';

type Mode = 'staff' | 'member';
type MemberStep = 'phone' | 'otp' | 'password';

export default function LoginScreen() {
  const { colors, spacing } = useTheme();
  const login = useAuthStore((s) => s.login);
  const requestOtp = useAuthStore((s) => s.requestOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const setPassword = useAuthStore((s) => s.setPassword);
  const showToast = useToastStore((s) => s.show);

  const [mode, setMode] = useState<Mode>('staff');
  const [memberStep, setMemberStep] = useState<MemberStep>('phone');
  const [loading, setLoading] = useState(false);
  const [memberPhone, setMemberPhone] = useState('');
  const [demoOtp, setDemoOtp] = useState<string | undefined>();

  const staffForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
  });

  const phoneForm = useForm<z.infer<typeof otpPhoneSchema>>({
    resolver: zodResolver(otpPhoneSchema),
    defaultValues: { phone: '' },
  });

  const otpForm = useForm<z.infer<typeof otpVerifySchema>>({
    resolver: zodResolver(otpVerifySchema),
    defaultValues: { phone: '', otp: '' },
  });

  const passwordForm = useForm<SetPasswordForm>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const goToApp = () => router.replace('/(app)/(tabs)');

  const onStaffLogin = async (values: LoginForm) => {
    setLoading(true);
    try {
      await login(values);
      showToast({ title: 'Welcome back', tone: 'success' });
      goToApp();
    } catch (e) {
      Alert.alert('Login failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setLoading(false);
    }
  };

  const onSendOtp = async (values: z.infer<typeof otpPhoneSchema>) => {
    setLoading(true);
    try {
      const res = await requestOtp(values.phone);
      setMemberPhone(values.phone);
      otpForm.setValue('phone', values.phone);
      setDemoOtp(res.demoOtp);
      setMemberStep('otp');
    } catch (e) {
      Alert.alert('Could not send code', e instanceof Error ? e.message : 'Try again');
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async (values: z.infer<typeof otpVerifySchema>) => {
    setLoading(true);
    try {
      await verifyOtp(values);
      const needsPassword = useAuthStore.getState().needsPassword;
      if (needsPassword) {
        setMemberStep('password');
      } else {
        showToast({ title: 'Signed in', tone: 'success' });
        goToApp();
      }
    } catch (e) {
      Alert.alert('Invalid code', e instanceof Error ? e.message : 'Try again');
    } finally {
      setLoading(false);
    }
  };

  const onSetPassword = async (values: SetPasswordForm) => {
    setLoading(true);
    try {
      await setPassword(values.password);
      showToast({
        title: 'Password set',
        message: 'You can now also sign in with phone and password.',
        tone: 'success',
      });
      goToApp();
    } catch (e) {
      Alert.alert('Could not save password', e instanceof Error ? e.message : 'Try again');
    } finally {
      setLoading(false);
    }
  };

  const resetMemberFlow = () => {
    setMemberStep('phone');
    setDemoOtp(undefined);
    passwordForm.reset();
    otpForm.reset({ phone: '', otp: '' });
  };

  return (
    <Screen scroll>
      <View style={{ paddingTop: spacing.xl, paddingHorizontal: 4, paddingBottom: 40 }}>
        {/* Brand */}
        <View style={styles.brandContainer}>
          <GlassCard caustic="violet" borderRadius={32} style={styles.logoGlass}>
            <View style={styles.logoInner}>
              <Ionicons name="fitness" size={36} color="#A78BFA" />
            </View>
          </GlassCard>
          <Text style={[styles.brandTitle, { color: colors.text }]}>IronForge</Text>
          <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>
            Liquid Fitness & Gym Management
          </Text>
        </View>

        {/* Mode switcher */}
        <View style={styles.modeRow}>
          <GlassPill
            label="Staff / Admin"
            size="md"
            active={mode === 'staff'}
            caustic={mode === 'staff' ? 'violet' : 'none'}
            onPress={() => {
              setMode('staff');
              resetMemberFlow();
            }}
          />
          <GlassPill
            label="Member"
            size="md"
            active={mode === 'member'}
            caustic={mode === 'member' ? 'cyan' : 'none'}
            onPress={() => setMode('member')}
          />
        </View>

        {/* STAFF: phone + password */}
        {mode === 'staff' ? (
          <GlassCard caustic="violet" borderRadius={28} contentStyle={styles.formCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="shield-checkmark-outline" size={17} color="#A78BFA" />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Admin sign in</Text>
            </View>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              Use the phone number and password issued by your gym owner.
            </Text>

            <Controller
              control={staffForm.control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label="Phone Number"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={staffForm.formState.errors.phone?.message}
                  placeholder="03001234567"
                  icon="call-outline"
                  pill
                />
              )}
            />
            <Controller
              control={staffForm.control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label="Password"
                  secureTextEntry
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={staffForm.formState.errors.password?.message}
                  placeholder="••••••••"
                  icon="lock-closed-outline"
                  pill
                />
              )}
            />

            <Button
              title="Sign In"
              onPress={staffForm.handleSubmit(onStaffLogin)}
              loading={loading}
              fullWidth
              style={{ marginTop: 10 }}
            />
          </GlassCard>
        ) : null}

        {/* MEMBER: phone → WhatsApp OTP → set password */}
        {mode === 'member' ? (
          <GlassCard caustic="cyan" borderRadius={28} contentStyle={styles.formCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="logo-whatsapp" size={17} color="#22C55E" />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {memberStep === 'phone'
                  ? 'Member sign in'
                  : memberStep === 'otp'
                    ? 'Enter WhatsApp code'
                    : 'Set your password'}
              </Text>
            </View>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              {memberStep === 'phone'
                ? 'Enter your registered number. We will send a one-time code on WhatsApp.'
                : memberStep === 'otp'
                  ? `Code sent to ${memberPhone} on WhatsApp.`
                  : 'Choose a password so you can also sign in without a code next time.'}
            </Text>

            {memberStep === 'phone' ? (
              <>
                <Controller
                  control={phoneForm.control}
                  name="phone"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextField
                      label="Registered Phone"
                      keyboardType="phone-pad"
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      error={phoneForm.formState.errors.phone?.message}
                      placeholder="03XXXXXXXXX"
                      icon="call-outline"
                      pill
                    />
                  )}
                />
                <Button
                  title="Send code on WhatsApp"
                  icon={<Ionicons name="logo-whatsapp" size={17} color="#FFFFFF" />}
                  loading={loading}
                  fullWidth
                  onPress={phoneForm.handleSubmit(onSendOtp)}
                />
              </>
            ) : null}

            {memberStep === 'otp' ? (
              <>
                <Controller
                  control={otpForm.control}
                  name="otp"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextField
                      label="6-digit code"
                      keyboardType="number-pad"
                      maxLength={6}
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      error={otpForm.formState.errors.otp?.message}
                      placeholder="123456"
                      icon="keypad-outline"
                      pill
                    />
                  )}
                />
                {demoOtp ? (
                  <Text style={[styles.demoHint, { color: colors.textTertiary }]}>
                    Demo mode code: {demoOtp}
                  </Text>
                ) : null}
                <Button
                  title="Verify code"
                  loading={loading}
                  fullWidth
                  onPress={otpForm.handleSubmit(onVerifyOtp)}
                />
                <Pressable onPress={() => setMemberStep('phone')} hitSlop={8} style={styles.linkBtn}>
                  <Text style={[styles.linkText, { color: colors.textSecondary }]}>
                    Change number
                  </Text>
                </Pressable>
              </>
            ) : null}

            {memberStep === 'password' ? (
              <>
                <Controller
                  control={passwordForm.control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextField
                      label="New Password"
                      secureTextEntry
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      error={passwordForm.formState.errors.password?.message}
                      placeholder="At least 6 characters"
                      icon="lock-closed-outline"
                      pill
                    />
                  )}
                />
                <Controller
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextField
                      label="Confirm Password"
                      secureTextEntry
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      error={passwordForm.formState.errors.confirmPassword?.message}
                      placeholder="Re-enter password"
                      icon="lock-closed-outline"
                      pill
                    />
                  )}
                />
                <Button
                  title="Save password & continue"
                  loading={loading}
                  fullWidth
                  onPress={passwordForm.handleSubmit(onSetPassword)}
                />
              </>
            ) : null}
          </GlassCard>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandContainer: {
    alignItems: 'center',
    marginBottom: 22,
  },
  logoGlass: {
    marginBottom: 12,
  },
  logoInner: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  brandSubtitle: {
    fontSize: 14,
    marginTop: 4,
    letterSpacing: -0.2,
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  formCard: {
    padding: 22,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cardSub: {
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 16,
  },
  demoHint: {
    fontSize: 11.5,
    marginTop: -4,
    marginBottom: 10,
    fontWeight: '600',
  },
  linkBtn: {
    alignSelf: 'center',
    marginTop: 14,
  },
  linkText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
});
