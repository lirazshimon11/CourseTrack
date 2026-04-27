import React, { useRef, memo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, PanResponder, Dimensions } from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { Session } from '../types';
import { formatHebrewDate } from '../lib/dateUtils';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 80;

// Duration for the border to travel one full lap (ms)
const LAP_DURATION = 2200;
const BORDER_W = 2;
// Length of the "racing" highlight segment as a fraction of each side
const SEG = 0.45;

interface SessionItemProps {
  session: Session;
  onPress: () => void;
  onStatusChange: (status: 'attended' | 'missed' | 'pending') => void;
  themeColor?: string;
}

/** Animated "racing" border that loops around the card when the session has notes */
const RacingBorder = ({ color, cardW, cardH }: { color: string; cardW: number; cardH: number }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: LAP_DURATION,
        easing: Easing.linear,   // constant speed — no ease-in/out
        useNativeDriver: false,  // JS driver needed for color/position interpolations
        isInteraction: false,    // CRITICAL: prevents blocking FlatList rendering
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Each "phase": top=0->0.25, right=0.25->0.5, bottom=0.5->0.75, left=0.75->1
  // Highlight segment (SEG of each side) starts at one end and exits at the other

  // --- TOP strip (travels right→left in RTL, here left→right visually) ---
  const topLeft = anim.interpolate({
    inputRange: [0, 0.25 - SEG * 0.25, 0.25, 0.3],
    outputRange: [-cardW * SEG, cardW, cardW, cardW],
    extrapolate: 'clamp',
  });
  const topOpacity = anim.interpolate({
    inputRange: [0, 0.001, 0.24, 0.25, 0.26],
    outputRange: [0, 1, 1, 1, 0],
    extrapolate: 'clamp',
  });

  // --- RIGHT strip (travels top→bottom) ---
  const rightTop = anim.interpolate({
    inputRange: [0.25, 0.5 - SEG * 0.25, 0.5, 0.55],
    outputRange: [-cardH * SEG, cardH, cardH, cardH],
    extrapolate: 'clamp',
  });
  const rightOpacity = anim.interpolate({
    inputRange: [0.25, 0.251, 0.49, 0.5, 0.51],
    outputRange: [0, 1, 1, 1, 0],
    extrapolate: 'clamp',
  });

  // --- BOTTOM strip (travels right→left) ---
  const bottomRight = anim.interpolate({
    inputRange: [0.5, 0.75 - SEG * 0.25, 0.75, 0.8],
    outputRange: [-cardW * SEG, cardW, cardW, cardW],
    extrapolate: 'clamp',
  });
  const bottomOpacity = anim.interpolate({
    inputRange: [0.5, 0.501, 0.74, 0.75, 0.76],
    outputRange: [0, 1, 1, 1, 0],
    extrapolate: 'clamp',
  });

  // --- LEFT strip (travels bottom→top) ---
  const leftBottom = anim.interpolate({
    inputRange: [0.75, 1 - SEG * 0.25, 1],
    outputRange: [-cardH * SEG, cardH, cardH],
    extrapolate: 'clamp',
  });
  const leftOpacity = anim.interpolate({
    inputRange: [0.75, 0.751, 0.99, 1],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });

  // Glow opacity on the base border — smooth pulse
  const baseOpacity = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.35, 0.65, 0.35],
    extrapolate: 'clamp',
  });

  const segColor = color;

  return (
    <View
      style={[
        StyleSheet.absoluteFillObject,
        { borderRadius: Radius.md, overflow: 'hidden', pointerEvents: 'none' },
      ]}
    >
      {/* Base semi-transparent border glow */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: Radius.md,
            borderWidth: BORDER_W,
            borderColor: color,
            opacity: baseOpacity,
          },
        ]}
      />

      {/* TOP racing highlight */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: BORDER_W + 2,
          width: cardW * SEG,
          borderRadius: BORDER_W,
          backgroundColor: segColor,
          shadowColor: segColor,
          shadowOpacity: 1,
          shadowRadius: 6,
          elevation: 6,
          transform: [{ translateX: topLeft }],
          opacity: topOpacity,
        }}
      />

      {/* RIGHT racing highlight */}
      <Animated.View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: BORDER_W + 2,
          height: cardH * SEG,
          borderRadius: BORDER_W,
          backgroundColor: segColor,
          shadowColor: segColor,
          shadowOpacity: 1,
          shadowRadius: 6,
          elevation: 6,
          transform: [{ translateY: rightTop }],
          opacity: rightOpacity,
        }}
      />

      {/* BOTTOM racing highlight (right→left, use negative translateX trick) */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          height: BORDER_W + 2,
          width: cardW * SEG,
          borderRadius: BORDER_W,
          backgroundColor: segColor,
          shadowColor: segColor,
          shadowOpacity: 1,
          shadowRadius: 6,
          elevation: 6,
          // bottomRight drives how far from the right side the segment's right edge is
          transform: [{ translateX: bottomRight.interpolate({ inputRange: [0, cardW], outputRange: [0, -cardW] }) }],
          opacity: bottomOpacity,
        }}
      />

      {/* LEFT racing highlight (travels bottom→top) */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: BORDER_W + 2,
          height: cardH * SEG,
          borderRadius: BORDER_W,
          backgroundColor: segColor,
          shadowColor: segColor,
          shadowOpacity: 1,
          shadowRadius: 6,
          elevation: 6,
          transform: [{ translateY: leftBottom.interpolate({ inputRange: [0, cardH], outputRange: [0, -cardH] }) }],
          opacity: leftOpacity,
        }}
      />
    </View>
  );
};

const SessionItemComponent = ({ session, onPress, onStatusChange, themeColor }: SessionItemProps) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const [swipeTriggered, setSwipeTriggered] = useState<'left' | 'right' | null>(null);
  const [cardSize, setCardSize] = useState({ w: 0, h: 0 });

  const hasNotes = !!(session.notes && session.notes.trim().length > 0);

  const getStatusColor = () => {
    if (session.attendance === 'attended') return '#10B981';
    if (session.attendance === 'missed') return '#EF4444';
    return Colors.textMuted;
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 10,
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
        if (gestureState.dx > SWIPE_THRESHOLD && swipeTriggered !== 'left') {
          setSwipeTriggered('left');
        } else if (gestureState.dx < -SWIPE_THRESHOLD && swipeTriggered !== 'right') {
          setSwipeTriggered('right');
        } else if (Math.abs(gestureState.dx) < SWIPE_THRESHOLD) {
          setSwipeTriggered(null);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD) {
          triggerAction('attended');
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          triggerAction('missed');
        } else {
          snapBack();
        }
      },
    })
  ).current;

  const snapBack = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 40,
      friction: 7,
    }).start(() => setSwipeTriggered(null));
  };

  const triggerAction = (status: 'attended' | 'missed' | 'pending') => {
    setTimeout(() => {
      snapBack();
      setTimeout(() => {
        onStatusChange(status);
      }, 200);
    }, 500);
  };

  const { dayName, datePart } = formatHebrewDate(session.date);
  const timeRange = `\u200E${session.start_time.substring(0, 5)} - ${session.end_time.substring(0, 5)}\u200E`;

  const backgroundColor = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH, -SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD, SCREEN_WIDTH],
    outputRange: ['#EF4444', '#EF4444', 'transparent', '#10B981', '#10B981'],
  });

  const actionTextOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -20, 0, 20, SWIPE_THRESHOLD],
    outputRange: [1, 0, 0, 0, 1],
  });

  const borderColor = themeColor ?? Colors.primary;

  return (
    <View style={styles.outerContainer}>
      <Animated.View style={[styles.background, { backgroundColor }]}>
        <Animated.View
          style={[
            styles.actionContent,
            { opacity: actionTextOpacity, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 30 },
          ]}
        >
          <Text style={styles.actionText}>לא נצפה ✕</Text>
          <Text style={styles.actionText}>נצפה ✓</Text>
        </Animated.View>
      </Animated.View>

      <Animated.View
        style={[styles.container, { transform: [{ translateX }], borderRightColor: getStatusColor() }]}
        {...panResponder.panHandlers}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setCardSize({ w: width, h: height });
        }}
      >
        {/* Racing border — only rendered when notes exist and layout is known */}
        {hasNotes && cardSize.w > 0 && (
          <RacingBorder color={borderColor} cardW={cardSize.w} cardH={cardSize.h} />
        )}

        <Pressable onPress={onPress} style={styles.pressable}>
          <View style={styles.mainContent}>
            <Text style={styles.titleLine}>
              {session.type === 'lecture' ? 'הרצאה' : 'תרגול'} {session.session_number} – {datePart}
            </Text>
            <Text style={styles.subtitleLine}>
              {dayName} • {timeRange}
            </Text>
          </View>

          <View style={styles.statusSection}>
            <Text style={[styles.statusToggle, { color: getStatusColor() }]}>
              {session.attendance === 'attended' ? '✓' : session.attendance === 'missed' ? '✕' : '○'}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
};

export const SessionItem = memo(SessionItemComponent);
export default SessionItem;

const styles = StyleSheet.create({
  outerContainer: {
    marginVertical: 4,
    marginHorizontal: Spacing.md,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontFamily: 'Heebo_700Bold',
    fontSize: FontSize.sm,
  },
  container: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderRightWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  pressable: {
    flex: 1,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainContent: {
    flex: 1,
    alignItems: 'flex-start',
  },
  titleLine: {
    fontSize: FontSize.md,
    fontFamily: 'Heebo_700Bold',
    color: Colors.text,
    marginBottom: 2,
    textAlign: 'left',
  },
  subtitleLine: {
    fontSize: FontSize.sm,
    fontFamily: 'Heebo_400Regular',
    color: Colors.textSecondary,
    textAlign: 'left',
  },
  statusSection: {
    paddingLeft: Spacing.sm,
  },
  statusToggle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});