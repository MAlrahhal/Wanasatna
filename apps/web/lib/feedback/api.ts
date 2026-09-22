import type {
  CreateFeedbackData,
  CreateFeedbackInput,
  FeedbackActionResponse,
} from '@wanasatna/shared';
import { getServerUrl } from '@/lib/config/server-url';

export async function submitFeedback(
  input: CreateFeedbackInput,
): Promise<FeedbackActionResponse<CreateFeedbackData>> {
  try {
    const response = await fetch(`${getServerUrl()}/api/feedback`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const body = (await response.json()) as FeedbackActionResponse<CreateFeedbackData>;
    if (body && typeof body === 'object' && 'success' in body) {
      return body;
    }
  } catch {
    // Fall through to the stable Arabic error below.
  }

  return {
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'تعذر إرسال الملاحظة الآن. حاول مرة أخرى.' },
  };
}
