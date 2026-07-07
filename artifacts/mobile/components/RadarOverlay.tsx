import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import Colors from '@/constants/colors';

// Animierter Ring-Wrapper (SVG Animated Circle geht nicht direkt – wir nutzen Animated.View)
function PulseRing({
  size,
  delay,
  color,
}: {
  size: number;
  delay: number;
  color: string;
}) {
  const scale   = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1,   duration: 2200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0,   duration: 2200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 0.3, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, opacity, scale]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          width:  size,
          height: size,
          borderRadius: size / 2,
          borderColor:  color,
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  );
}

type Props = {
  visible?:  boolean;
  size?:     number;  // Durchmesser der Overlay-Fläche in dp
  color?:    string;
};

export function RadarOverlay({ visible = true, size = 260, color = Colors.light.tint }: Props) {
  if (!visible) return null;

  const center = { lat: 0, lon: 0 };
  void center;

  return (
    <View pointerEvents="none" style={[styles.container, { width: size, height: size }]}>
      {/* Statischer innerer Kreis */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={size * 0.08}
          fill={color}
          fillOpacity={0.9}
        />
        {/* Äußerer statischer Ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={size * 0.46}
          fill="none"
          stroke={color}
          strokeWidth={1}
          strokeOpacity={0.15}
        />
      </Svg>

      {/* Pulsierende Ringe – gestaffelt für Radar-Optik */}
      <PulseRing size={size * 0.3}  delay={0}    color={color} />
      <PulseRing size={size * 0.55} delay={600}  color={color} />
      <PulseRing size={size * 0.82} delay={1200} color={color} />
      <PulseRing size={size * 0.96} delay={1800} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  ring: {
    position:    'absolute',
    borderWidth: 1.5,
  },
});
