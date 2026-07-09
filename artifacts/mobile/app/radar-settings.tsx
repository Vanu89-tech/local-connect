import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/colors';
import { RadarIntent, RadarVisibility } from '@/lib/proximity';
import { useProximity } from '@/context/ProximityContext';

const RADIUS_STEPS = [200, 300, 500, 750, 1000, 1500, 2000];
const LOD_RADIUS_STEPS = [500, 750, 1000, 1500, 2000, 3000, 5000];

const VISIBILITY_OPTIONS: { value: RadarVisibility; label: string; desc: string; icon: string }[] = [
  { value: 'public',  label: 'Öffentlich', desc: 'Alle können dich sehen',      icon: 'globe' },
  { value: 'friends', label: 'Freunde',    desc: 'Nur Freunde können dich sehen', icon: 'users' },
  { value: 'hidden',  label: 'Unsichtbar', desc: 'Du siehst andere, sie dich nicht', icon: 'eye-off' },
];

const INTENT_OPTIONS: { value: RadarIntent; label: string; desc: string; icon: string }[] = [
  { value: 'active',  label: 'Aktiv',         desc: 'Einfach in der Nähe & erreichbar', icon: 'zap' },
  { value: 'hangout', label: 'Abhängen',       desc: 'Ich hab Zeit, wer kommt?',         icon: 'coffee' },
  { value: 'date',    label: 'Kennenlernen',   desc: 'Ich bin offen für ein Date',       icon: 'heart' },
];

export default function RadarSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { radarSettings, updateRadarSettings, triggerProximityCheck } = useProximity();
  const activeLodRadiusM = Math.max(500, radarSettings.lodRadiusM ?? 1000);

  const handleRadiusChange = async (m: number) => {
    await updateRadarSettings({ radiusM: m });
  };

  const handleLodRadiusChange = async (m: number) => {
    await updateRadarSettings({ lodRadiusM: m });
  };

  const handleVisibilityChange = async (v: RadarVisibility) => {
    await updateRadarSettings({ visibility: v });
    await triggerProximityCheck();
  };

  const handleIntentChange = async (i: RadarIntent) => {
    await updateRadarSettings({ intent: i });
    await triggerProximityCheck();
  };

  const handleToggleEnabled = async () => {
    await updateRadarSettings({ enabled: !radarSettings.enabled });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.title}>Radar-Einstellungen</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Enable / Disable */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Radar</Text>
          <Pressable
            style={[styles.toggleRow, radarSettings.enabled && styles.toggleRowActive]}
            onPress={handleToggleEnabled}
          >
            <View>
              <Text style={styles.toggleLabel}>
                {radarSettings.enabled ? 'Aktiv' : 'Deaktiviert'}
              </Text>
              <Text style={styles.toggleDesc}>
                {radarSettings.enabled
                  ? 'Du wirst erkannt und erkennst andere'
                  : 'Dein Standort wird nicht geteilt'}
              </Text>
            </View>
            <View style={[styles.pill, radarSettings.enabled && styles.pillActive]}>
              <Text style={[styles.pillText, radarSettings.enabled && styles.pillTextActive]}>
                {radarSettings.enabled ? 'AN' : 'AUS'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Radius */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Erkennungsradius</Text>
          <View style={styles.chipRow}>
            {RADIUS_STEPS.map((m) => {
              const active = radarSettings.radiusM === m;
              return (
                <Pressable
                  key={m}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => handleRadiusChange(m)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {m < 1000 ? `${m}m` : `${m / 1000}km`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>
            Größerer Radius = mehr Treffer, mehr Batterieverbrauch
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LOD-Radius</Text>
          <View style={styles.chipRow}>
            {LOD_RADIUS_STEPS.map((m) => {
              const active = activeLodRadiusM === m;
              return (
                <Pressable
                  key={m}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => handleLodRadiusChange(m)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {m < 1000 ? `${m}m` : `${m / 1000}km`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>
            Steuert, welche Kartensymbole um den unsichtbaren Kartenmittelpunkt sichtbar bleiben
          </Text>
        </View>

        {/* Visibility */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sichtbarkeit</Text>
          {VISIBILITY_OPTIONS.map((opt) => {
            const active = radarSettings.visibility === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[styles.optionRow, active && styles.optionRowActive]}
                onPress={() => handleVisibilityChange(opt.value)}
              >
                <View style={[styles.optionIcon, active && styles.optionIconActive]}>
                  <Feather
                    name={opt.icon as 'globe'}
                    size={18}
                    color={active ? Colors.light.onBright : Colors.light.textSecondary}
                  />
                </View>
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.optionDesc}>{opt.desc}</Text>
                </View>
                {active && (
                  <Feather name="check" size={18} color={Colors.light.tint} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Intent */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ich suche</Text>
          {INTENT_OPTIONS.map((opt) => {
            const active = radarSettings.intent === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[styles.optionRow, active && styles.optionRowActive]}
                onPress={() => handleIntentChange(opt.value)}
              >
                <View style={[styles.optionIcon, active && styles.optionIconActive]}>
                  <Feather
                    name={opt.icon as 'zap'}
                    size={18}
                    color={active ? Colors.light.onBright : Colors.light.textSecondary}
                  />
                </View>
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.optionDesc}>{opt.desc}</Text>
                </View>
                {active && (
                  <Feather name="check" size={18} color={Colors.light.tint} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Skalen-Info */}
        <View style={styles.infoBox}>
          <Feather name="info" size={16} color={Colors.light.tintBlue} style={{ marginRight: 8 }} />
          <Text style={styles.infoText}>
            Das Radar funktioniert für bis zu 10.000 gleichzeitige Nutzer. Dein
            exakter Standort wird niemals geteilt — nur die Distanz zu dir.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.separator,
  },
  backBtn: {
    width:  36,
    height: 36,
    alignItems:     'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize:   17,
    color:      Colors.light.text,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop:        20,
    gap:               24,
  },
  section: { gap: 10 },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize:   13,
    color:      Colors.light.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  toggleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius:    12,
    padding:         16,
    borderWidth:     1,
    borderColor:     Colors.light.separator,
  },
  toggleRowActive: {
    borderColor: Colors.light.tint,
  },
  toggleLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize:   15,
    color:      Colors.light.text,
  },
  toggleDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize:   13,
    color:      Colors.light.textSecondary,
    marginTop:  2,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical:    6,
    borderRadius:      20,
    backgroundColor:   Colors.light.backgroundTertiary,
  },
  pillActive: {
    backgroundColor: Colors.light.tint,
  },
  pillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize:   13,
    color:      Colors.light.textSecondary,
  },
  pillTextActive: {
    color: Colors.light.onBright,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical:    8,
    borderRadius:      20,
    backgroundColor:   Colors.light.backgroundSecondary,
    borderWidth:       1,
    borderColor:       Colors.light.separator,
  },
  chipActive: {
    backgroundColor: Colors.light.tint,
    borderColor:     Colors.light.tint,
  },
  chipText: {
    fontFamily: 'Inter_500Medium',
    fontSize:   14,
    color:      Colors.light.text,
  },
  chipTextActive: {
    color: Colors.light.onBright,
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize:   12,
    color:      Colors.light.textSecondary,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    padding:       14,
    borderRadius:  12,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth:   1,
    borderColor:   Colors.light.separator,
  },
  optionRowActive: {
    borderColor: Colors.light.tint,
  },
  optionIcon: {
    width:          38,
    height:         38,
    borderRadius:   19,
    backgroundColor: Colors.light.backgroundTertiary,
    alignItems:     'center',
    justifyContent: 'center',
  },
  optionIconActive: {
    backgroundColor: Colors.light.tint,
  },
  optionText: { flex: 1 },
  optionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize:   15,
    color:      Colors.light.text,
  },
  optionLabelActive: {
    color: Colors.light.tint,
  },
  optionDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize:   13,
    color:      Colors.light.textSecondary,
    marginTop:  2,
  },
  infoBox: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius:    12,
    padding:         14,
    borderWidth:     1,
    borderColor:     Colors.light.tintBlue + '40',
  },
  infoText: {
    fontFamily: 'Inter_400Regular',
    fontSize:   13,
    color:      Colors.light.textSecondary,
    flex:       1,
    lineHeight: 20,
  },
});
