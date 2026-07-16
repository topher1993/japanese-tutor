import { useEffect, useRef } from 'react';
import { Text } from 'react-native';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { Card } from '../components/Card';
import { PlacementTestPanel } from './PlacementTestPanel';
import { useUserProfileContext } from '../services/userProfileContext';
import { PLACEMENT_TEST_VERSION, type PlacementLevel, type PlacementResult } from '../services/placementTestService';
import { track } from '../services/analyticsService';

export function PlacementTestScreen({
  onBack,
  onContinue,
  source = 'home',
}: {
  onBack: () => void;
  onContinue: (level: PlacementLevel) => void;
  source?: 'home' | 'profile';
}) {
  const { ready, profile, updateProfile } = useUserProfileContext();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    track('placement_started', {
      source,
      retake: Boolean(profile?.dynamic.placement),
    });
  }, [profile?.dynamic.placement, source]);

  async function saveResult(result: PlacementResult): Promise<void> {
    await updateProfile({
      dynamic: {
        placement: {
          level: result.recommendedLevel,
          scorePercent: result.scorePercent,
          completedAt: new Date().toISOString(),
          testVersion: PLACEMENT_TEST_VERSION,
        },
        placementPromptDismissed: true,
      },
    });
    track('placement_completed', {
      level: result.recommendedLevel,
      score_percent: result.scorePercent,
      question_count: result.byLevel.reduce((total, bucket) => total + bucket.total, 0),
    });
  }

  if (!ready || !profile) {
    return (
      <ScreenScaffold>
        <Card shadow="card">
          <Text>Loading your placement test…</Text>
        </Card>
      </ScreenScaffold>
    );
  }

  return (
    <PlacementTestPanel
      onBack={onBack}
      onComplete={(result) => { void saveResult(result); }}
      onContinue={onContinue}
    />
  );
}
