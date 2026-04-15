import React, { useRef, memo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, PanResponder, Dimensions } from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { Session } from '../types';
import { formatHebrewDate } from '../lib/dateUtils';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 80;

interface SessionItemProps {
  session: Session;
  onPress: () => void;
  onStatusChange: (status: 'attended' | 'missed' | 'pending') => void;
}

const SessionItemComponent = ({ session, onPress, onStatusChange }: SessionItemProps) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const [swipeTriggered, setSwipeTriggered] = useState<'left' | 'right' | null>(null);

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
        // Visual feedback during swipe
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
          // Trigger Attended
          triggerAction('attended');
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Trigger Missed
          triggerAction('missed');
        } else {
          // Snap back
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
    // We stay at the current point for a brief moment, then snap back and update
    setTimeout(() => {
      snapBack();
      setTimeout(() => {
        onStatusChange(status);
      }, 200);
    }, 500);
  };

  const { dayName, datePart } = formatHebrewDate(session.date);
  const timeRange = `\u200E${session.start_time.substring(0, 5)} - ${session.end_time.substring(0, 5)}\u200E`;

  // UI colors based on swipe direction
  const backgroundColor = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH, -SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD, SCREEN_WIDTH],
    outputRange: ['#EF4444', '#EF4444', 'transparent', '#10B981', '#10B981'],
  });

  const actionTextOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -20, 0, 20, SWIPE_THRESHOLD],
    outputRange: [1, 0, 0, 0, 1],
  });

  return (
    <View style={styles.outerContainer}>
      <Animated.View style={[styles.background, { backgroundColor }]}>
        <Animated.View style={[styles.actionContent, { opacity: actionTextOpacity, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 30 }]}>
          <Text style={styles.actionText}>לא נצפה ✕</Text>
          <Text style={styles.actionText}>נצפה ✓</Text>
        </Animated.View>
      </Animated.View>

      <Animated.View
        style={[styles.container, { transform: [{ translateX }], borderRightColor: getStatusColor() }]}
        {...panResponder.panHandlers}
      >
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
    backgroundColor: Colors.surface, // Underlying color
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
