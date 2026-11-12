import type { AppLanguage } from '@/src/api/types';
import { useSettingsStore } from '@/src/store/settings-store';

const en = {
  'dash.greetingClear': 'All clear · nothing pending',
  'dash.greetingPending': '{count} item{s} need attention',
  'dash.needAttention': 'Need attention',
  'dash.sectionStatus': 'Status',
  'dash.sectionDoNow': 'Do now',
  'dash.allClearTitle': 'All clear',
  'dash.allClearBody': 'Dues, renewals, and device sync look fine',
  'dash.duesTitle': '{amount} pending',
  'dash.duesSub': 'Collect fees',
  'dash.expiringTitle': '{count} memberships ending',
  'dash.expiringSub': 'Renew or send reminder',
  'dash.checkinIssueTitle': '{count} check-in issue{s}',
  'dash.checkinIssueSub': 'Unpaid / expired members',
  'dash.syncTitle': '{count} device pending',
  'dash.syncSub': 'Sync fingerprints',
  'dash.fastActions': 'Fast actions',
  'dash.addMember': 'Add',
  'dash.collectFee': 'Collect',
  'dash.checkIn': 'Check-in',
  'dash.duesPill': '{amount} dues',
  'dash.expiringPill': '{count} ending',
  'dash.checkinIssuePill': '{count} issue{s}',
  'dash.syncPill': '{count} sync',
  'dash.allClearPill': 'All clear',
  'dash.numbers': "Today's numbers",
  'dash.inGym': 'In the gym',
  'dash.viewAll': 'All',
  'dash.noCheckins': 'No check-ins yet',
  'dash.manualCheckin': 'Manual check-in →',
  'dash.renewSoon': 'Renew soon',
  'dash.members': 'Members',
  'dash.noExpiring': 'No memberships ending soon',
  'dash.renew': 'Renew',
  'dash.memberHomeHint': 'Your workout and diet are here',
  'dash.diet': 'Diet',
  'dash.dietSub': 'Meals & water',
  'dash.workout': 'Workout',
  'dash.workoutSub': "Today's plan",
  'dash.headerEyebrow': 'Gym desk',
} as const;

type DictKey = keyof typeof en;

const ur: Record<DictKey, string> = {
  'dash.greetingClear': 'Sab theek hai · kuch pending nahi',
  'dash.greetingPending': '{count} cheez{s} abhi karo',
  'dash.needAttention': 'Need attention',
  'dash.sectionStatus': 'Status',
  'dash.sectionDoNow': 'Abhi karo',
  'dash.allClearTitle': 'All clear',
  'dash.allClearBody': 'Dues, renewals aur device sync sab theek',
  'dash.duesTitle': '{amount} pending',
  'dash.duesSub': 'Fee collect karo',
  'dash.expiringTitle': '{count} memberships ending',
  'dash.expiringSub': 'Renew ya WhatsApp reminder',
  'dash.checkinIssueTitle': '{count} check-in issue{s}',
  'dash.checkinIssueSub': 'Unpaid / expired members',
  'dash.syncTitle': '{count} device pending',
  'dash.syncSub': 'Fingerprint sync karo',
  'dash.fastActions': 'Fast actions',
  'dash.addMember': 'Add',
  'dash.collectFee': 'Collect',
  'dash.checkIn': 'Check-in',
  'dash.duesPill': '{amount} dues',
  'dash.expiringPill': '{count} ending',
  'dash.checkinIssuePill': '{count} issue{s}',
  'dash.syncPill': '{count} sync',
  'dash.allClearPill': 'All clear',
  'dash.numbers': 'Aaj ke numbers',
  'dash.inGym': 'Ab gym mein',
  'dash.viewAll': 'Sab',
  'dash.noCheckins': 'Abhi koi check-in nahi',
  'dash.manualCheckin': 'Manual check-in →',
  'dash.renewSoon': 'Jaldi renew',
  'dash.members': 'Members',
  'dash.noExpiring': 'Koi membership jaldi end nahi ho rahi',
  'dash.renew': 'Renew',
  'dash.memberHomeHint': 'Aaj ka workout aur diet yahan se',
  'dash.diet': 'Diet',
  'dash.dietSub': 'Meals & water',
  'dash.workout': 'Workout',
  'dash.workoutSub': 'Aaj ka plan',
  'dash.headerEyebrow': 'Gym desk',
};

const dictionaries: Record<AppLanguage, Record<DictKey, string>> = {
  en,
  ur_roman: ur,
};

export function t(
  key: DictKey,
  vars?: Record<string, string | number>,
  lang?: AppLanguage,
): string {
  const language = lang ?? useSettingsStore.getState().language ?? 'en';
  const dict = dictionaries[language] || en;
  let out = dict[key] || en[key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  // plural helper: {s} → "s" when count !== 1
  if (vars && 'count' in vars) {
    const plural = Number(vars.count) === 1 ? '' : 's';
    out = out.replace(/\{s\}/g, plural);
  } else {
    out = out.replace(/\{s\}/g, 's');
  }
  return out;
}

export function useT() {
  const language = useSettingsStore((s) => s.language);
  return (key: DictKey, vars?: Record<string, string | number>) => t(key, vars, language);
}
