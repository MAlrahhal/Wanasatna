export type TimelinePlacementContentEntry = {
  id: string;
  text: string;
  year: number;
  sourceUrl: string;
};

/**
 * Provisional owner-review bank. Sources stay server-side and are never included
 * in live-game payloads. The stable IDs and unique years are gameplay invariants.
 */
export const TIMELINE_PLACEMENT_EVENTS: readonly TimelinePlacementContentEntry[] = [
  {
    id: 'al-hilal-founded',
    text: 'تأسيس النادي الذي أصبح يُعرف بالهلال',
    year: 1957,
    sourceUrl: 'https://alhilal.com/en/history',
  },
  {
    id: 'apollo-11-moon-landing',
    text: 'هبوط أبولو 11 على سطح القمر',
    year: 1969,
    sourceUrl: 'https://www.nasa.gov/mission/apollo-11/',
  },
  {
    id: 'star-wars-first-release',
    text: 'عرض أول فيلم من Star Wars',
    year: 1977,
    sourceUrl: 'https://www.starwars.com/films/star-wars-episode-iv-a-new-hope',
  },
  {
    id: 'macintosh-introduced',
    text: 'تقديم جهاز Macintosh الأول',
    year: 1984,
    sourceUrl: 'https://support.apple.com/en-om/112190',
  },
  {
    id: 'playstation-japan-launch',
    text: 'إطلاق جهاز PlayStation الأول في اليابان',
    year: 1994,
    sourceUrl: 'https://www.playstation.com/en-us/playstation-history/1994-ps-one/',
  },
  {
    id: 'google-founded',
    text: 'تأسيس شركة Google',
    year: 1998,
    sourceUrl:
      'https://blog.google/company-news/inside-google/company-announcements/marking-20ish-years-google/',
  },
  {
    id: 'wikipedia-launched',
    text: 'إطلاق ويكيبيديا',
    year: 2001,
    sourceUrl: 'https://wikimediafoundation.org/news/2016/01/14/wikipedia-15-foundation-endowment/',
  },
  {
    id: 'facebook-launched',
    text: 'إطلاق Facebook',
    year: 2004,
    sourceUrl: 'https://www.meta.com/about/company-info/',
  },
  {
    id: 'iphone-introduced',
    text: 'تقديم أول iPhone',
    year: 2007,
    sourceUrl: 'https://www.apple.com/uk/newsroom/2007/01/09Apple-Reinvents-the-Phone-with-iPhone/',
  },
  {
    id: 'burj-khalifa-opened',
    text: 'افتتاح برج خليفة',
    year: 2010,
    sourceUrl: 'https://www.burjkhalifa.ae/ar/the-tower/making/',
  },
  {
    id: 'gta-v-released',
    text: 'صدور GTA V',
    year: 2013,
    sourceUrl:
      'https://www.rockstargames.com/newswire/article/o349k552518949/grand-theft-auto-v-now-available.html',
  },
  {
    id: 'pokemon-go-released',
    text: 'إطلاق Pokémon GO',
    year: 2016,
    sourceUrl: 'https://pokemongo.com/en/post/launch',
  },
  {
    id: 'saudi-arabia-beats-argentina',
    text: 'فوز السعودية على الأرجنتين في كأس العالم',
    year: 2022,
    sourceUrl:
      'https://www.fifa.com/en/articles/world-cup-qatar-2022-argentina-v-saudi-arabia-match-report-review-first-game-group-e-result',
  },
  {
    id: 'paris-olympics-opening',
    text: 'حفل افتتاح أولمبياد باريس',
    year: 2024,
    sourceUrl:
      'https://library.olympics.com/Default/doc/SYRACUSE/3415954/opening-ceremony-of-the-paris-2024-olympic-games-media-guide-26-07-24-19-30-paris-2024-organising-co?_lg=en-GB',
  },
] as const;

export function validateTimelinePlacementContent(
  entries: readonly TimelinePlacementContentEntry[] = TIMELINE_PLACEMENT_EVENTS,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const years = new Set<number>();
  for (const entry of entries) {
    if (!entry.id || ids.has(entry.id)) errors.push(`duplicate-or-empty-id:${entry.id}`);
    if (!entry.text.trim()) errors.push(`empty-text:${entry.id}`);
    if (!Number.isInteger(entry.year) || years.has(entry.year)) {
      errors.push(`duplicate-or-invalid-year:${entry.year}`);
    }
    if (!entry.sourceUrl.startsWith('https://')) errors.push(`invalid-source:${entry.id}`);
    ids.add(entry.id);
    years.add(entry.year);
  }
  return errors;
}
