export const FEEDBACK_CATEGORIES = ['SUGGESTION', 'PROBLEM', 'OTHER'] as const;
export const FEEDBACK_STATUSES = ['NEW', 'REVIEWED', 'RESOLVED'] as const;
export const FEEDBACK_SOURCES = ['LOBBY', 'GAMEPLAY', 'FINAL_RESULTS'] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number];

export const FEEDBACK_MESSAGE_MIN_LENGTH = 3;
export const FEEDBACK_MESSAGE_MAX_LENGTH = 2_000;

export type CreateFeedbackInput = {
  category: FeedbackCategory;
  message: string;
  source: FeedbackSource;
  roomId?: string;
  gameId?: string;
  route?: string;
  submissionId: string;
};

export type CreateFeedbackData = {
  id: string;
};

export type FeedbackErrorCode = 'VALIDATION_ERROR' | 'RATE_LIMITED' | 'INTERNAL_ERROR';

export type FeedbackActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: FeedbackErrorCode; message: string } };
