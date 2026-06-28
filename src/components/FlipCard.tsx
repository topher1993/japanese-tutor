import React, { useCallback, useEffect, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ds } from '../theme/designSystem';
import { Icon } from './Icon';

// Flip card with a real 3D Y-axis rotation animation.
// Tap to flip, OR swipe horizontally to navigate cards (carousel-style).
// - Tap (no drag): flips front <-> back with spring animation
// - Swipe left past threshold: triggers onSwipeLeft callback
// - Swipe right past threshold: triggers onSwipeRight callback
// - Partial swipe: springs back to center
// - Vertical drag is ignored (lets scroll work normally if wrapped)
// - When the parent signals a new card arrived from a swipe
//   (swipeInDirection="left"|"right"), the new card slides in from the
//   opposite edge with a fade + scale animation.

export interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  cardNumber: number;
  totalCards: number;
  /** Disable haptic feedback (e.g. on web). */
  disableHaptics?: boolean;
  /**
   * Optional absolutely-positioned element rendered in the bottom-right
   * corner of the card shell (above the flip faces).
   */
  cornerBadge?: React.ReactNode;
  /** Swipe-left past threshold fires this. If omitted, swipe is disabled. */
  onSwipeLeft?: () => void;
  /** Swipe-right past threshold fires this. If omitted, swipe is disabled. */
  onSwipeRight?: () => void;
  /** Disable swipe entirely (only tap-to-flip). */
  disableSwipe?: boolean;
  /**
   * If set on mount, the card slides in from the opposite edge
   * (carousel entry animation). Pass 'left' if the previous card was
   * swiped-left (so the new one enters from the right), and 'right' if
   * the previous card was swiped-right. Pass null/undefined for the first
   * mount (no entry animation).
   */
  swipeInDirection?: 'left' | 'right' | null;
}

const FLIP_DURATION_MS = 550;
const SWIPE_THRESHOLD_PX = 80;
const SWIPE_VELOCITY_THRESHOLD = 0.4;
const SWIPE_OUT_DURATION_MS = 180;
const SWIPE_IN_DURATION_MS = 250;

export function FlipCard({
  front,
  back,
  cardNumber,
  totalCards,
  disableHaptics,
  cornerBadge,
  onSwipeLeft,
  onSwipeRight,
  disableSwipe = false,
  swipeInDirection = null,
}: FlipCardProps) {
  // Shared value 0..180 — the rotation angle of the front face.
  const flip = useSharedValue(0);

  // Shared value for horizontal swipe translate (in pixels).
  // Range: -SCREEN_WIDTH..+SCREEN_WIDTH during swipe, snaps back to 0.
  const swipeX = useSharedValue(0);

  // Shared value for entry-exit fade (0..1). Used during the swipe-in
  // animation when the card first mounts after a swipe commit.
  const entryOpacity = useSharedValue(swipeInDirection ? 0 : 1);
  const entryScale = useSharedValue(swipeInDirection ? 0.92 : 1);

  // While the entry animation is playing, block PanResponder so the user
  // can't accidentally swipe the new card before it's settled.
  const entryLockRef = useRef<boolean>(swipeInDirection !== null);

  // Track whether the current gesture has moved enough to be a swipe (vs. a tap).
  const isSwipingRef = useRef(false);
  const startTouchXRef = useRef(0);
  const startTouchYRef = useRef(0);

  // On mount (or when swipeInDirection changes), animate the card into place.
  useEffect(() => {
    if (!swipeInDirection) return;
    // The new card came in from the OPPOSITE side of the swipe direction.
    // If user swiped LEFT, the new card slides in from the RIGHT.
    // If user swiped RIGHT, the new card slides in from the LEFT.
    const fromX = swipeInDirection === 'left' ? 420 : -420;
    swipeX.value = fromX;
    // Animate to center with a smooth spring, plus fade + scale-up.
    swipeX.value = withSpring(0, {
      damping: 18,
      stiffness: 140,
      mass: 0.8,
      overshootClamping: false,
    });
    entryOpacity.value = withTiming(1, {
      duration: SWIPE_IN_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
    entryScale.value = withSpring(1, {
      damping: 14,
      stiffness: 160,
      mass: 0.7,
    });
    // Release the entry lock right as the entry animation completes so
    // the card becomes interactive immediately after it settles.
    const lockTimer = setTimeout(() => {
      entryLockRef.current = false;
    }, SWIPE_IN_DURATION_MS);
    return () => clearTimeout(lockTimer);
  }, [swipeInDirection, swipeX, entryOpacity, entryScale]);

  const hapticTick = useCallback(() => {
    if (!disableHaptics) {
      try {
        Haptics.selectionAsync().catch(() => {});
      } catch {
        /* ignore on web */
      }
    }
  }, [disableHaptics]);

  const handlePress = useCallback(() => {
    'worker';
    const isCurrentlyFront = flip.value < 90;
    flip.value = withSpring(isCurrentlyFront ? 180 : 0, {
      damping: 14,
      stiffness: 110,
      mass: 0.9,
      overshootClamping: false,
    });
    hapticTick();
  }, [flip, hapticTick]);

  // Called by the worklet when a swipe commits (passed past threshold).
  const fireSwipeLeft = useCallback(() => {
    hapticTick();
    onSwipeLeft?.();
  }, [onSwipeLeft, hapticTick]);

  const fireSwipeRight = useCallback(() => {
    hapticTick();
    onSwipeRight?.();
  }, [onSwipeRight, hapticTick]);

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture if user starts a horizontal drag, OR if a tap
      // (no movement) — vertical drags are ignored.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
        if (disableSwipe) return false;
        if (entryLockRef.current) return false;
        // Only respond to clearly horizontal movement
        const dx = Math.abs(gesture.dx);
        const dy = Math.abs(gesture.dy);
        if (dx < 6 && dy < 6) return false;
        return dx > dy * 1.2;
      },
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        isSwipingRef.current = false;
        startTouchXRef.current = evt.nativeEvent.pageX;
        startTouchYRef.current = evt.nativeEvent.pageY;
      },
      onPanResponderMove: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
        // Mark as swiping once movement crosses a small threshold — this
        // prevents the inner Pressable's onPress from firing on release.
        if (!isSwipingRef.current && Math.abs(gesture.dx) > 8) {
          isSwipingRef.current = true;
        }
        // Live update the card position
        swipeX.value = gesture.dx;
      },
      onPanResponderRelease: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
        const wasSwiping = isSwipingRef.current;
        isSwipingRef.current = false;

        const dx = gesture.dx;
        const vx = gesture.vx;
        const pastDistance = Math.abs(dx) > SWIPE_THRESHOLD_PX;
        const pastVelocity = Math.abs(vx) > SWIPE_VELOCITY_THRESHOLD;

        if (!wasSwiping) {
          // It was just a tap — let the inner Pressable handle it (flip).
          swipeX.value = withSpring(0, { damping: 18, stiffness: 200 });
          return;
        }

        if (pastDistance || pastVelocity) {
          // Commit the swipe: animate off-screen in the swipe direction,
          // then call the appropriate callback. The new card mounts and
          // animates in from the opposite side (see swipeInDirection).
          const direction = dx < 0 ? -1 : 1;
          const offScreen = direction * 500; // px off-screen
          swipeX.value = withTiming(offScreen, { duration: SWIPE_OUT_DURATION_MS }, (finished) => {
            if (finished) {
              if (direction < 0) runOnJS(fireSwipeLeft)();
              else runOnJS(fireSwipeRight)();
            }
          });
        } else {
          // Didn't pass threshold — spring back to center.
          swipeX.value = withSpring(0, { damping: 18, stiffness: 200, mass: 0.6 });
        }
      },
      onPanResponderTerminate: () => {
        isSwipingRef.current = false;
        swipeX.value = withSpring(0, { damping: 18, stiffness: 200, mass: 0.6 });
      },
    }),
  ).current;

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = `${interpolate(flip.value, [0, 180], [0, 180], Extrapolation.CLAMP)}deg`;
    const opacity = flip.value < 90 ? 1 : 0;
    const scale = interpolate(flip.value, [0, 90, 180], [1, 0.92, 1], Extrapolation.CLAMP);
    return {
      transform: [
        { perspective: 1200 },
        { rotateY },
        { scale },
      ],
      opacity,
    };
  }, []);

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = `${interpolate(flip.value, [0, 180], [180, 360], Extrapolation.CLAMP)}deg`;
    const opacity = flip.value >= 90 ? 1 : 0;
    const scale = interpolate(flip.value, [0, 90, 180], [1, 0.92, 1], Extrapolation.CLAMP);
    return {
      transform: [
        { perspective: 1200 },
        { rotateY },
        { scale },
      ],
      opacity,
    };
  }, []);

  // The shell moves with the swipe, with a slight rotation for that
  // "deck of cards" carousel feel. Also handles the entry animation
  // (fade-in + scale-up combined with translateX-to-center).
  const shellSwipeStyle = useAnimatedStyle(() => {
    const x = swipeX.value;
    const rotate = interpolate(x, [-300, 0, 300], [-12, 0, 12], Extrapolation.CLAMP);
    const scaleVal = interpolate(Math.abs(x), [0, 200], [1, 0.96], Extrapolation.CLAMP);
    return {
      transform: [
        { translateX: x },
        { rotateZ: `${rotate}deg` },
        { scale: scaleVal * entryScale.value },
      ],
      opacity: entryOpacity.value,
    };
  }, []);

  const counterText = totalCards > 0 ? `${cardNumber} of ${totalCards}` : String(cardNumber);
  const [hintText, setHintText] = React.useState('Tap or swipe');
  React.useEffect(() => {
    const id = setTimeout(() => {
      setHintText(flip.value >= 90 ? 'Tap to see Japanese' : 'Tap or swipe');
    }, FLIP_DURATION_MS);
    return () => clearTimeout(id);
  }, [flip.value]);

  // Drive pointerEvents on each face based on whether that face is currently
  // visible. Hidden faces must NOT swallow taps.
  const [frontIsInteractive, setFrontIsInteractive] = React.useState(true);
  const [backIsInteractive, setBackIsInteractive] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    const setInteractivity = () => {
      if (cancelled) return;
      const frontVisible = flip.value < 90;
      setFrontIsInteractive(frontVisible);
      setBackIsInteractive(!frontVisible);
    };
    setInteractivity();
    const timer = setTimeout(setInteractivity, FLIP_DURATION_MS + 50);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [flip.value]);

  return (
    <View
      style={styles.gestureHost}
      {...panResponder.panHandlers}
      collapsable={false}
    >
      <Animated.View style={shellSwipeStyle}>
        <Pressable
          onPress={handlePress}
          // Only handle the tap if PanResponder didn't claim a swipe.
          // Pressable's onPress only fires on quick taps without movement,
          // so this is naturally compatible with PanResponder.
          style={({ pressed }) => [styles.shell, { opacity: pressed ? 0.97 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={hintText}
        >
          <View style={styles.counter}>
            <Text style={styles.counterText}>{counterText}</Text>
            <View style={styles.hint}>
              <Icon name="more" size={14} />
              <Text style={styles.hintText}>{hintText}</Text>
            </View>
          </View>
          <View style={styles.stage}>
            <Animated.View
              style={[styles.face, frontAnimatedStyle]}
              pointerEvents={frontIsInteractive ? 'auto' : 'none'}
            >
              {front}
            </Animated.View>
            <Animated.View
              style={[styles.face, styles.faceBack, backAnimatedStyle]}
              pointerEvents={backIsInteractive ? 'auto' : 'none'}
            >
              {back}
            </Animated.View>
          </View>
          {cornerBadge ? (
            <View style={styles.cornerBadgeSlot} pointerEvents="box-none">
              {cornerBadge}
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  gestureHost: {
    // Outer transparent view that receives PanResponder gestures.
    // Doesn't affect layout — just provides the gesture target.
  },
  shell: {
    backgroundColor: ds.colors.surface,
    borderRadius: ds.radius.xl,
    padding: ds.spacing.lg,
    minHeight: 380,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: ds.colors.border,
    ...ds.shadow.hero,
  },
  counter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: ds.spacing.md,
  },
  counterText: { fontSize: ds.type.caption, fontWeight: '900', color: ds.colors.primary, textTransform: 'uppercase' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.xs, opacity: 0.6 },
  hintText: { fontSize: ds.type.caption, fontWeight: '800', color: ds.colors.textMuted },
  stage: {
    flex: 1,
    position: 'relative',
    minHeight: 300,
    marginTop: ds.spacing.sm,
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ds.spacing.md,
    paddingVertical: ds.spacing.sm,
    backfaceVisibility: 'hidden',
  },
  faceBack: {
    backgroundColor: ds.colors.surfaceMuted,
    borderRadius: ds.radius.lg,
  },
  cornerBadgeSlot: {
    position: 'absolute',
    right: ds.spacing.md,
    bottom: ds.spacing.md,
    zIndex: 10,
    elevation: 10,
  },
});
