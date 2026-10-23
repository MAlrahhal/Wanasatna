export type MostLikelyToQuestionDefinition = {
  id: string;
  text: string;
};

/**
 * PROVISIONAL TEST CONTENT — NOT FINAL OWNER-APPROVED CONTENT.
 * The owner will review tone, categories, and any expanded bank before launch.
 */
export const MOST_LIKELY_TO_PROVISIONAL_QUESTIONS: readonly MostLikelyToQuestionDefinition[] = [
  { id: 'mlt-01', text: 'مين أكثر واحد يتأخر عن الموعد وهو يقول «أنا بالطريق»؟' },
  { id: 'mlt-02', text: 'مين أكثر واحد يضحك في وقت المفروض يكون جاد؟' },
  { id: 'mlt-03', text: 'مين أكثر واحد يطلب أكل، ثم يمد يده على طلب غيره؟' },
  { id: 'mlt-04', text: 'مين أكثر واحد يضيع جواله وهو ماسكه بيده؟' },
  { id: 'mlt-05', text: 'مين أكثر واحد يخطط لطلعة كبيرة، وبالأخير يعتذر عنها؟' },
  { id: 'mlt-06', text: 'مين أكثر واحد يقول «آخر قيم» ثم يكمل ساعتين؟' },
  { id: 'mlt-07', text: 'مين أكثر واحد يرسل رسالة في القروب الغلط؟' },
  { id: 'mlt-08', text: 'مين أكثر واحد يشتري شيئًا لأنه عليه خصم، وهو ما يحتاجه؟' },
  { id: 'mlt-09', text: 'مين أكثر واحد ينسى وش كان بيقول بنص السالفة؟' },
  { id: 'mlt-10', text: 'مين أكثر واحد يصير مشهور بسبب موقف محرج بالصدفة؟' },
];

export function validateMostLikelyToProvisionalQuestions(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const texts = new Set<string>();

  if (MOST_LIKELY_TO_PROVISIONAL_QUESTIONS.length !== 10) {
    errors.push('The provisional Most Likely To bank must contain exactly ten questions.');
  }

  for (const question of MOST_LIKELY_TO_PROVISIONAL_QUESTIONS) {
    const normalized = question.text.normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (!/^mlt-\d{2}$/.test(question.id) || ids.has(question.id)) {
      errors.push(`Invalid or duplicate question ID: ${question.id}`);
    }
    if (!normalized.startsWith('مين أكثر واحد') || !normalized.endsWith('؟')) {
      errors.push(`Question ${question.id} does not follow the approved Arabic prompt shape.`);
    }
    if (normalized.length < 25 || normalized.length > 120 || texts.has(normalized)) {
      errors.push(`Question ${question.id} is duplicate or outside the supported length.`);
    }
    ids.add(question.id);
    texts.add(normalized);
  }

  return errors;
}
