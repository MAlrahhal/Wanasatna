export const HOME_SECTIONS = {
  top: 'top',
  startPlay: 'start-play',
  games: 'games',
  faq: 'faq',
  contact: 'contact',
} as const;

export type HomeSectionId = (typeof HOME_SECTIONS)[keyof typeof HOME_SECTIONS];

export function scrollToHomeSection(
  sectionId: HomeSectionId,
  block: ScrollLogicalPosition = 'start',
) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block });
}
