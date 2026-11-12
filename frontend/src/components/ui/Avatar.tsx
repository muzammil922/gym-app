import React, { useState } from 'react';
import { StyleSheet, Text, View, ViewStyle, Platform } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/src/theme/ThemeProvider';

const AVATAR_PALETTE = [
  { bg: '#EEECFE', text: '#5B4AE8' },
  { bg: '#FFE4E6', text: '#E11D48' },
  { bg: '#FEF3C7', text: '#D97706' },
  { bg: '#DCFCE7', text: '#16A34A' },
  { bg: '#E0F2FE', text: '#0284C7' },
  { bg: '#F3E8FF', text: '#9333EA' },
  { bg: '#FFEDD5', text: '#EA580C' },
];

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}

type Props = {
  name: string;
  uri?: string | null;
  size?: number;
  style?: ViewStyle;
};

export function Avatar({ name, uri, size = 44, style }: Props) {
  const { isDark } = useTheme();
  const [failed, setFailed] = useState(false);
  const initials = getInitials(name);
  const { bg, text } = getAvatarColor(name);
  const showImage = Boolean(uri) && !failed;
  const radius = size / 2;

  return (
    <View
      style={[
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.85)',
          borderTopColor: isDark ? 'rgba(255, 255, 255, 0.42)' : 'rgba(255, 255, 255, 1)',
          backgroundColor: showImage
            ? isDark
              ? 'rgba(255, 255, 255, 0.06)'
              : 'rgba(255, 255, 255, 0.55)'
            : bg,
        },
        style,
      ]}
    >
      {!showImage && Platform.OS === 'ios' ? (
        <BlurView
          intensity={28}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {showImage ? (
        <Image
          source={{ uri: uri! }}
          style={{ width: size, height: size, borderRadius: radius }}
          contentFit="cover"
          transition={180}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text
          style={[
            styles.text,
            {
              color: text,
              fontSize: Math.round(size * 0.4),
            },
          ]}
        >
          {initials}
        </Text>
      )}

      <LinearGradient
        colors={
          isDark
            ? ['rgba(255, 255, 255, 0.22)', 'rgba(255, 255, 255, 0.04)', 'transparent']
            : ['rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0.08)', 'transparent']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.65 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.2,
    position: 'relative',
  },
  text: {
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
