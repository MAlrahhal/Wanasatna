import { notFound } from 'next/navigation';
import { GuessingChallengeSceneHarness } from './harness-client';

/**
 * Dev-only Real3D visual harness. Absent in production (404).
 */
export default function GuessingChallengeSceneDevPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <GuessingChallengeSceneHarness />;
}
