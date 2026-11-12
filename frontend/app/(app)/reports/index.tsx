import React, { Fragment, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Screen } from '@/src/components/ui/Screen';
import { PageHeader } from '@/src/components/ui/PageHeader';
import { GlassCard } from '@/src/components/ui/GlassCard';
import { GlassPill } from '@/src/components/ui/GlassPill';
import { GlassIconButton } from '@/src/components/ui/GlassIconButton';
import { GlassDateField } from '@/src/components/ui/GlassDateField';import { Button } from '@/src/components/ui/Button';
import { ErrorView, LoadingView } from '@/src/components/feedback/StateViews';
import { useFloatingTabBarPad } from '@/src/components/ui/FloatingTabBar';
import { useTheme } from '@/src/theme/ThemeProvider';
import { paymentsApi } from '@/src/api/endpoints';
import { formatPkr } from '@/src/utils/currency';
import { addDaysIso, formatDate, todayIso } from '@/src/utils/date';
import type { FeeReport } from '@/src/api/types';
import { parseISO } from 'date-fns';

type RangePreset = { label: string; days: number | 'month' | 'all' };

const RANGE_PRESETS: RangePreset[] = [
  { label: 'This Month', days: 'month' },
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'All Time', days: 'all' },
];

function startOfMonthIso(base = todayIso()) {
  return base.slice(0, 8) + '01';
}

function resolvePreset(preset: RangePreset): { from: string; to: string } {
  const to = todayIso();
  if (preset.days === 'all') return { from: '2000-01-01', to };
  if (preset.days === 'month') return { from: startOfMonthIso(to), to };
  return { from: addDaysIso(to, -(preset.days - 1)), to };
}

function BarChart({
  data,
  color,
  emptyLabel = 'No data in this range',
}: {
  data: { label: string; amountPkr: number }[];
  color: string;
  emptyLabel?: string;
}) {
  const { colors } = useTheme();
  const width = Dimensions.get('window').width - 80;
  const height = 180;

  const points = useMemo(() => {
    // Keep the chart readable: cap at 31 bars.
    if (data.length <= 31) return data;
    return data.slice(-31);
  }, [data]);

  if (!points.length) {
    return (
      <Text style={[styles.chartEmpty, { color: colors.textTertiary }]}>{emptyLabel}</Text>
    );
  }

  const max = Math.max(...points.map((d) => d.amountPkr), 1);
  const gap = 8;
  const barW = Math.max((width - gap * (points.length - 1)) / points.length, 4);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
      <Svg width={Math.max(width, points.length * (barW + gap))} height={height}>
        {points.map((d, i) => {
          const h = Math.max((d.amountPkr / max) * (height - 46), 2);
          const x = i * (barW + gap);
          const y = height - 26 - h;
          return (
            <Fragment key={`${d.label}-${i}`}>
              <Rect x={x} y={y} width={barW} height={h} fill={color} rx={4} />
              <SvgText
                x={x + barW / 2}
                y={height - 16}
                fontSize="9"
                fill={colors.textTertiary}
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
              <SvgText
                x={x + barW / 2}
                y={y - 5}
                fontSize="8"
                fill={colors.textSecondary}
                textAnchor="middle"
              >
                {d.amountPkr >= 1000 ? `${Math.round(d.amountPkr / 1000)}k` : d.amountPkr}
              </SvgText>
            </Fragment>
          );
        })}
      </Svg>
    </ScrollView>
  );
}

function buildReportHtml(report: FeeReport, from: string, to: string, gymName: string) {
  const rowsMethod = report.byMethod
    .map(
      (p) =>
        `<tr><td>${p.label}</td><td class="num">${formatPkr(p.amountPkr)}</td></tr>`,
    )
    .join('');
  const rowsDay = report.byDay
    .map((p) => `<tr><td>${p.label}</td><td class="num">${formatPkr(p.amountPkr)}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, Segoe UI, sans-serif; padding: 28px; color: #111; }
    h1 { margin: 0 0 2px; font-size: 22px; }
    h2 { font-size: 15px; margin: 22px 0 8px; }
    .muted { color: #666; font-size: 12px; }
    .kpi { border: 1px solid #ddd; border-radius: 10px; padding: 14px; margin-top: 18px; }
    .kpi .value { font-size: 26px; font-weight: 800; }
    .kpi .due { color: #b91c1c; margin-top: 6px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    td { padding: 7px 4px; border-bottom: 1px solid #eee; }
    td.num { text-align: right; font-weight: 600; }
    footer { margin-top: 26px; font-size: 11px; color: #888; }
  </style>
</head>
<body>
  <h1>${gymName} · Fee Report</h1>
  <div class="muted">${formatDate(from)} → ${formatDate(to)}</div>

  <div class="kpi">
    <div class="muted">Total collected</div>
    <div class="value">${formatPkr(report.totalCollectedPkr)}</div>
    <div class="due">Pending dues ${formatPkr(report.totalDuePkr)}</div>
  </div>

  <h2>By method</h2>
  <table>${rowsMethod || '<tr><td>No payments in range</td><td class="num">—</td></tr>'}</table>

  <h2>By day</h2>
  <table>${rowsDay || '<tr><td>No payments in range</td><td class="num">—</td></tr>'}</table>

  <footer>Generated ${new Date().toLocaleString()} · Currency PKR · Asia/Karachi</footer>
</body>
</html>`;
}

export default function ReportsScreen() {
  const { colors, spacing, isDark } = useTheme();
  const tabPad = useFloatingTabBarPad();

  const initial = resolvePreset(RANGE_PRESETS[0]);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('This Month');
  const [exporting, setExporting] = useState(false);

  const query = useQuery({
    queryKey: ['fee-report', from, to],
    queryFn: () => paymentsApi.report({ from, to }),
  });

  const applyPreset = (preset: RangePreset) => {
    const next = resolvePreset(preset);
    setFrom(next.from);
    setTo(next.to);
    setActivePreset(preset.label);
  };

  const handleExportPdf = async () => {
    if (!query.data) return;
    setExporting(true);
    try {
      const html = buildReportHtml(query.data, from, to, 'Gym');
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Fee Report ${from} to ${to}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Exported', `Saved to ${uri}`);
      }
    } catch (err) {
      Alert.alert('Export failed', (err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  if (query.isLoading) return <LoadingView />;
  if (query.isError || !query.data)
    return (
      <ErrorView
        message={(query.error as Error)?.message}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );

  const report = query.data;

  return (
    <Screen padded={false}>
      <View style={{ paddingTop: 6, paddingHorizontal: spacing.lg, paddingBottom: 4 }}>
        <PageHeader
          title="Financial Reports"
          showBack
          onBack={() => router.back()}
          showSearch={false}
          rightSlot={
            <GlassIconButton
              name="share-outline"
              accessibilityLabel="Export report as PDF"
              onPress={handleExportPdf}
            />
          }
          filterContent={
            <>
              {RANGE_PRESETS.map((preset) => (
                <GlassPill
                  key={preset.label}
                  label={preset.label}
                  size="sm"
                  active={activePreset === preset.label}
                  onPress={() => applyPreset(preset)}
                />
              ))}
            </>
          }
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={query.isFetching}
            onRefresh={() => {
              void query.refetch();
            }}
          />
        }
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: 6,
          paddingBottom: tabPad + 40,
        }}
      >
        {/* Range selector */}
        <Pressable
          onPress={() => setShowRangePicker((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showRangePicker }}
          style={[
            styles.rangeBar,
            {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(255,255,255,0.75)',
              borderColor: isDark
                ? 'rgba(255,255,255,0.15)'
                : 'rgba(255,255,255,0.55)',
            },
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={isDark ? '#2DD4BF' : '#0F766E'}
          />
          <Text style={[styles.rangeText, { color: colors.text }]} numberOfLines={1}>
            {formatDate(from)} → {formatDate(to)}
          </Text>
          <Ionicons
            name={showRangePicker ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textSecondary}
          />
        </Pressable>

        {showRangePicker ? (
          <GlassCard
            borderRadius={20}
            style={{ marginTop: 10 }}
            contentStyle={{ padding: 14 }}
          >
            <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>
              CUSTOM RANGE
            </Text>
            <View style={styles.rangeRow}>
              <GlassDateField
                compact
                value={from}
                onChange={(v) => {
                  setFrom(v);
                  setActivePreset('Custom');
                }}
                maximumDate={parseISO(to)}
                label="From date"
              />
              <Ionicons name="arrow-forward" size={16} color={colors.textTertiary} />
              <GlassDateField
                compact
                value={to}
                onChange={(v) => {
                  setTo(v);
                  setActivePreset('Custom');
                }}
                minimumDate={parseISO(from)}
                maximumDate={new Date()}
                label="To date"
              />
            </View>
          </GlassCard>
        ) : null}

        {/* KPI */}
        <GlassCard
          borderRadius={20}
          style={{ marginTop: 12 }}
          contentStyle={{ padding: 16 }}
        >
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
            Total collected
          </Text>
          <Text style={[styles.kpiValue, { color: colors.text }]}>
            {formatPkr(report.totalCollectedPkr)}
          </Text>
          <View style={[styles.dueRow, { borderTopColor: colors.border }]}>
            <Text style={{ color: colors.danger, fontWeight: '600' }}>Pending dues</Text>
            <Text style={{ color: colors.danger, fontWeight: '700' }}>
              {formatPkr(report.totalDuePkr)}
            </Text>
          </View>
        </GlassCard>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>By day</Text>
        <GlassCard borderRadius={20} contentStyle={{ padding: 12 }}>
          <BarChart data={report.byDay} color={colors.primary} />
        </GlassCard>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>By method</Text>
        <GlassCard borderRadius={20} contentStyle={{ padding: 12 }}>
          <BarChart data={report.byMethod} color={colors.info} />
        </GlassCard>

        <Button
          title="Export as PDF"
          icon={<Ionicons name="download-outline" size={17} color="#FFFFFF" />}
          loading={exporting}
          style={{ marginTop: 20 }}
          onPress={handleExportPdf}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rangeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1.2,
    paddingHorizontal: 16,
    minHeight: 46,
  },
  rangeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  rangeLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kpiLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  dueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 8,
  },
  chartEmpty: {
    textAlign: 'center',
    paddingVertical: 34,
    fontSize: 13,
    fontWeight: '600',
  },
});
