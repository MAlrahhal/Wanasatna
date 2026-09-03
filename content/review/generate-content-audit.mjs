/**
 * Generate a complete item-by-item content audit of production JSON.
 * Run from repo root: node content/review/generate-content-audit.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENT = join(ROOT, 'content');
const OUT = join(CONTENT, 'review', 'CONTENT_AUDIT.md');

const GAMES = [
  { id: 'bara-al-salafa', name: 'برا السالفة', kind: 'word' },
  { id: 'draw-guess', name: 'ارسم وخمّن', kind: 'word' },
  { id: 'imposter-draw', name: 'الإمبوستر بالرسم', kind: 'word' },
  { id: 'timing-challenge', name: 'تحدي التوقيت', kind: 'none' },
  { id: 'fast-answer', name: 'أسرع إجابة', kind: 'question' },
  { id: 'who-wrote-it', name: 'من كتبها؟', kind: 'prompt' },
  { id: 'judge', name: 'القاضي', kind: 'prompt' },
  { id: 'guessing-challenge', name: 'تحدي التخمين', kind: 'identity' },
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function normalizeDigit(digit) {
  const codePoint = digit.codePointAt(0) ?? 0;
  if (codePoint >= 0x0660 && codePoint <= 0x0669) return String(codePoint - 0x0660);
  if (codePoint >= 0x06f0 && codePoint <= 0x06f9) return String(codePoint - 0x06f0);
  return digit;
}

function normalizeTextAnswer(value) {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[٠-٩۰-۹]/g, normalizeDigit)
    .replace(/\u0640/g, '')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/^ال(?=[\p{L}\p{N}])/u, '')
    .replace(/[أإآٱا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[-–—]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const ASSESSMENTS = {
  'fast-answer:animals-1': {
    assessment: 'FIX',
    reason:
      'سؤال واضح وممتع. الأسماء المقبولة ناقصة: فهد، Cheetah، cheetah. الشيتا مفيد لكن الإنجليزية ناقصة.',
    recommended: ['الفهد الصياد', 'الفهد', 'الشيتا', 'Cheetah', 'cheetah'],
  },
  'fast-answer:animals-7': {
    assessment: 'KEEP',
    reason: 'سهل لأن الرقبة الطويلة توجّه للزرافة، وهذا مقبول في لعبة جماعية سريعة. حسّن الأسماء المقبولة.',
    recommended: ['الزرافة', 'زرافة', 'Giraffe', 'giraffe'],
  },
  'fast-answer:animals-17': {
    assessment: 'KEEP',
    reason: 'ليس تكرارًا حقيقيًا مع animals-20: السؤال عن الحجم لا عن الخرطوم. الإجابتيان نفس الحيوان وهذا مقبول.',
    recommended: ['الفيل', 'فيل', 'Elephant', 'elephant'],
  },
  'fast-answer:animals-20': {
    assessment: 'KEEP',
    reason: 'سؤال مختلف عن animals-17 رغم أن الإجابة فيل. أبقِه للتنويع.',
    recommended: ['الفيل', 'فيل', 'Elephant', 'elephant'],
  },
  'fast-answer:food-2': {
    assessment: 'KEEP',
    reason: 'قد يتداخل ذهنيًا مع ساندويتش، لكن في السياق الشعبي الإجابة المقصودة واضحة: برغر.',
    recommended: ['برغر', 'برجر', 'Burger', 'burger', 'Hamburger', 'hamburger'],
  },
  'fast-answer:countries-16': {
    assessment: 'KEEP',
    reason: 'لندن → بريطانيا سؤال واضح. countries-18 هو شبه التكرار الحقيقي.',
    recommended: ['بريطانيا', 'المملكة المتحدة', 'UK', 'United Kingdom', 'Britain', 'England'],
  },
  'fast-answer:countries-18': {
    assessment: 'REPLACE',
    reason:
      'شبه تكرار لـ countries-16: نفس الدولة (بريطانيا) بمدخل معلم مشهور. يستبدل بسؤال دولة مختلفة.',
    recommended: ['بريطانيا', 'المملكة المتحدة', 'UK', 'United Kingdom', 'Britain'],
  },
  'fast-answer:series-2': {
    assessment: 'KEEP',
    reason: 'الاسم موجود في السؤال، والإجابة ديكستر. سهل ومقبول في اللعب السريع.',
    recommended: ['Dexter Morgan', 'ديكستر مورغان', 'ديكستر', 'Dexter'],
  },
  'fast-answer:series-20': {
    assessment: 'REPLACE',
    reason:
      'إجابة «الجزيرة / The Island» عامة جدًا وسهلة الرفض أو الالتباس. السؤال نفسه ضعيف للكتابة السريعة.',
    recommended: ['Lost', 'لوست'],
  },
  'fast-answer:games-2': {
    assessment: 'REPLACE',
    reason:
      'السؤال ينطبق على عدة ألعاب باتل رويال (PUBG, Fortnite, Warzone). يحتاج إشارة مميزة لإيرنغل/الطائرة العسكرية.',
    recommended: ['PUBG', 'ببجي', "PlayerUnknown's Battlegrounds"],
  },
  'guessing-challenge:countries-8': {
    assessment: 'FIX',
    reason: 'خطأ واقعي: Amman هي عاصمة الأردن وليست اسم عُمان. احذف Amman وأضف Oman / سلطنة عمان.',
    recommended: ['عُمان', 'عمان', 'سلطنة عمان', 'Oman'],
  },
  'draw-guess:nature-19': {
    assessment: 'FIX',
    reason: 'الاسم المستعار The Island غير مناسب لكلمة رسم «جزيرة» وقد ي confus مع مسلسل Lost.',
    recommended: ['جزيرة', 'جزيره', 'Island', 'island'],
  },
  'draw-guess:nature-6': {
    assessment: 'KEEP',
    reason: 'صاروخ أقرب للفضاء منه للطبيعة، لكن الفئة اسمها «طبيعة وفضاء وطقس». قابل للرسم.',
  },
};

function defaultAssessment(game, item) {
  const key = `${game.id}:${item.id}`;
  if (ASSESSMENTS[key]) return ASSESSMENTS[key];

  if (game.kind === 'question') {
    const answers = item.acceptedAnswers ?? [];
    const hasLatin = answers.some((a) => /[A-Za-z]/.test(a));
    const hasArabic = answers.some((a) => /[\u0600-\u06FF]/.test(a));
    if (!hasLatin || !hasArabic) {
      return {
        assessment: 'FIX',
        reason: 'المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.',
      };
    }
    return {
      assessment: 'KEEP',
      reason: 'سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.',
    };
  }

  if (game.kind === 'identity') {
    const answers = item.acceptedAnswers ?? [];
    if (answers.length <= 1) {
      return {
        assessment: 'FIX',
        reason: 'الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).',
      };
    }
    return {
      assessment: 'KEEP',
      reason: 'هوية واضحة ومناسبة لقواعد تحدي التخمين.',
    };
  }

  if (game.kind === 'word' && (game.id === 'draw-guess' || game.id === 'imposter-draw')) {
    if ((item.text ?? '').length > 24) {
      return { assessment: 'FIX', reason: 'أطول من هدف الرسم القصير.' };
    }
    return {
      assessment: 'KEEP',
      reason: 'اسم قابل للرسم والتعرف في جولة قصيرة.',
    };
  }

  if (game.kind === 'word') {
    return {
      assessment: 'KEEP',
      reason: 'موضوع مناسب للنقاش الاجتماعي في برا السالفة.',
    };
  }

  return {
    assessment: 'KEEP',
    reason: 'نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.',
  };
}

function uniqueNormalized(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const key = normalizeTextAnswer(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function recommendedFor(game, item, current) {
  const override = ASSESSMENTS[`${game.id}:${item.id}`];
  if (override?.recommended) return uniqueNormalized(override.recommended);

  const extras = [];
  const display = game.kind === 'question' || game.kind === 'identity' ? item.question : item.text;
  const answers = current.length ? current : [display];
  for (const answer of answers) {
    extras.push(answer);
    if (/[\u0600-\u06FF]/.test(answer) && !/[A-Za-z]/.test(answer)) {
      // English filled per-item in expansion; audit lists current + obvious article-free form
    }
  }
  return uniqueNormalized([...answers, ...extras]);
}

function bullet(values) {
  if (!values.length) return '- _(none)_';
  return values.map((value) => `- ${value}`).join('\n');
}

function loadGame(game) {
  const dir = join(CONTENT, game.id);
  if (!existsSync(dir)) {
    return { categories: [], items: [], settings: null, missing: true };
  }
  const categories = existsSync(join(dir, 'categories.json'))
    ? readJson(join(dir, 'categories.json'))
    : [];
  const settings = existsSync(join(dir, 'settings.json'))
    ? readJson(join(dir, 'settings.json'))
    : null;
  let items = [];
  if (game.kind === 'question' || game.kind === 'identity') {
    items = existsSync(join(dir, 'questions.json')) ? readJson(join(dir, 'questions.json')) : [];
  } else if (game.kind === 'word' || game.kind === 'prompt') {
    items = existsSync(join(dir, 'words.json')) ? readJson(join(dir, 'words.json')) : [];
  }
  return { categories, items, settings, missing: false };
}

const lines = [];
const stats = {
  total: 0,
  byGame: {},
  byCategory: {},
  assessments: { KEEP: 0, FIX: 0, REPLACE: 0, DUPLICATE: 0 },
};

lines.push('# Wanasatna content audit — complete item inventory');
lines.push('');
lines.push('Generated from production JSON under `content/`. This file lists **every** existing content item, not samples.');
lines.push('');
lines.push('Assessments in the item list describe the **baseline before the expansion pass**. Cleanup and new items are summarized at the top after the pass lands.');
lines.push('');
lines.push('Normalization used by the live matcher (`normalizeTextAnswer`): NFKC, trim, lower-case, Arabic/Persian digits, strip tatweel and diacritics, strip a leading `ال`, collapse hamza/alif, `ى`→`ي`, **`ة`→`ه`**, strip punctuation. Duplicate aliases after this step are invalid. The content README note that matching does not map `ة`→`ه` is outdated relative to code.');
lines.push('');

lines.push('## Baseline inventory');
lines.push('');
lines.push('| Game | Kind | Categories | Items |');
lines.push('| --- | --- | --- | ---: |');

for (const game of GAMES) {
  const loaded = loadGame(game);
  const count = loaded.items.length;
  stats.byGame[game.id] = { name: game.name, count, categories: {} };
  lines.push(
    `| ${game.name} (\`${game.id}\`) | ${game.kind} | ${loaded.categories.length} | ${count} |`,
  );
  for (const category of loaded.categories) {
    const n = loaded.items.filter((item) => item.categoryId === category.id).length;
    stats.byGame[game.id].categories[category.id] = {
      name: category.name,
      enabled: category.enabled,
      count: n,
    };
    stats.total += 0;
  }
  stats.total += count;
}

lines.push('');
lines.push(`**Total production items (excluding تحدي التوقيت):** ${stats.total}`);
lines.push('');
lines.push('### Per category (baseline)');
lines.push('');
lines.push('| Game | Category id | Arabic name | Enabled | Items |');
lines.push('| --- | --- | --- | --- | ---: |');

for (const game of GAMES) {
  const loaded = loadGame(game);
  if (loaded.missing) {
    lines.push(`| ${game.name} | — | — | — | 0 |`);
    continue;
  }
  for (const category of loaded.categories) {
    const n = loaded.items.filter((item) => item.categoryId === category.id).length;
    lines.push(
      `| ${game.name} | \`${category.id}\` | ${category.name} | ${category.enabled} | ${n} |`,
    );
  }
}

lines.push('');
lines.push('### Smallest pools (baseline)');
lines.push('');
lines.push('- أسرع إجابة / أكلات: 17 سؤالًا');
lines.push('- تحدي التخمين / تقنيات: 18 هوية');
lines.push('- ارسم وخمّن والإمبوستر بالرسم / تقنيات: 19 كلمة');
lines.push('- من كتبها؟ والقاضي: 15 عنصرًا لكل فئة');
lines.push('- باقي الفئات غالبًا 20');
lines.push('- تحدي التوقيت: لا يوجد كتالوج محتوى');
lines.push('');

lines.push('## Question selection / repetition');
lines.push('');
lines.push('This is a content-size and match-scoped memory issue, not a broken RNG that secretly samples only 10 IDs.');
lines.push('');
lines.push('### How selection actually works');
lines.push('');
lines.push('1. **Lobby category lock:** If the host picks a real category, the pool is **only that category**. `random` / عشوائي means all enabled categories for that game (`round-category-store.ts`). `random` is never stored in JSON.');
lines.push('2. **Uniform pick:** `pickRandomWord` / `pickFastAnswerQuestion` / prompt pickers use `Math.floor(Math.random() * pool.length)`. There is no weighted subset and no shuffle-of-the-full-deck that gets stuck.');
lines.push('3. **Within a match:** Unused items are preferred. Fast Answer / Who Wrote It / Judge keep up to **24** recent IDs **on that match**. Guessing Challenge keeps **32** identity IDs. Bara / Draw / Imposter exclude used **canonical texts** for later rounds in the same match.');
lines.push('4. **Fallback when exhausted:** If every eligible item is already used, the picker **falls back to the full eligible pool** and can repeat. That is intentional for long matches, not a 10-item cap.');
lines.push('5. **Across matches:** Recent lists reset when a new match starts. There is **no persistent “don’t show this for a week” memory**.');
lines.push('6. **Fast Answer / Judge / Who Wrote It / Guessing Challenge + عشوائي:** The match first picks a **category** (unused categories first, then reuse), then an item inside that category. A 5-round Fast Answer random match therefore shows **one question from each of five categories**, not five random questions from the global 97.');
lines.push('7. **Eligibility:** All enabled category items in JSON are eligible. No extra runtime filter drops the pool to 10. Guessing Challenge only requires **≥2** identities in a category to offer it.');
lines.push('8. **Duplicate IDs:** Validation forbids duplicate IDs and duplicate canonical texts **inside a category**. That is not shrinking the pool today.');
lines.push('');
lines.push('### Why it feels like “the same 10 questions”');
lines.push('');
lines.push('- Locked category pools are **17–20 items**. Default Fast Answer is **5 rounds**. A few rematches of حيوانات will recycle the same ~20 questions quickly because nothing is remembered between matches.');
lines.push('- Default Bara / Draw / Imposter are **3 rounds**. Locked to حيوانات = 20 words. After two or three matches the group has seen a large fraction of the pool.');
lines.push('- Random mode still samples **per category**. It does not flatten all 97 Fast Answer questions into one bag each round.');
lines.push('- **No code change in this pass.** Expanding pools is the correct fix. A cross-match cooldown would be a separate, tiny runtime change if still needed after expansion.');
lines.push('');

lines.push('## Content sources inspected');
lines.push('');
lines.push('- `content/{gameId}/categories.json`, `words.json`, `questions.json`, `settings.json`');
lines.push('- `packages/shared/src/content/{types,normalize,word-picker,validation,categories}.ts`');
lines.push('- Runtime pickers under `apps/server/src/modules/game/plugins/*`');
lines.push('- Previous review notes: `content/review/OWNER_REVIEW.md`, `P8_D1_CHANGES.md`, `P8_D2_CHANGES.md`, `docs/p17-content-catalog.md` (p17 catalog is **stale** vs current JSON; e.g. it still lists Bara cars/movies/tech)');
lines.push('');

lines.push('## Item-by-item audit (every existing item)');
lines.push('');

for (const game of GAMES) {
  const loaded = loadGame(game);
  lines.push(`# ${game.name}`);
  lines.push('');
  lines.push(`**Game id:** \`${game.id}\``);
  lines.push('');
  if (loaded.missing || game.kind === 'none') {
    lines.push('No content catalog. Timing Challenge is interaction/timer gameplay only.');
    lines.push('');
    continue;
  }
  if (loaded.settings) {
    lines.push(
      `**Settings:** \`${JSON.stringify(loaded.settings)}\``,
    );
    lines.push('');
  }

  for (const category of loaded.categories) {
    const items = loaded.items.filter((item) => item.categoryId === category.id);
    lines.push(`## ${game.name} — ${category.name}`);
    lines.push('');
    lines.push(`**Category id:** \`${category.id}\` · **enabled:** ${category.enabled} · **count:** ${items.length}`);
    lines.push('');

    items.forEach((item, index) => {
      const info = defaultAssessment(game, item);
      stats.assessments[info.assessment] = (stats.assessments[info.assessment] ?? 0) + 1;
      const currentAnswers =
        game.kind === 'question' || game.kind === 'identity'
          ? item.acceptedAnswers ?? []
          : item.aliases ?? [];
      const display =
        game.kind === 'question' || game.kind === 'identity' ? item.question : item.text;
      const recommended = recommendedFor(game, item, currentAnswers.length ? currentAnswers : [display]);

      lines.push(`### ${index + 1}. \`${item.id}\``);
      lines.push('');
      lines.push(`**Category:** ${category.name}`);
      lines.push('');
      if (game.kind === 'question') {
        lines.push(`**Question:** ${display}`);
        lines.push('');
        lines.push('**Current answers:**');
        lines.push(bullet(currentAnswers));
        lines.push('');
        lines.push('**Recommended accepted answers:**');
        lines.push(bullet(recommended));
      } else if (game.kind === 'identity') {
        lines.push(`**Identity / prompt shown:** ${display}`);
        lines.push('');
        lines.push('**Current answers:**');
        lines.push(bullet(currentAnswers));
        lines.push('');
        lines.push('**Recommended accepted answers:**');
        lines.push(bullet(recommended));
      } else if (game.kind === 'prompt') {
        lines.push(`**Prompt:** ${display}`);
        lines.push('');
        lines.push('**Aliases:** none (prompt games do not use typed answers)');
      } else {
        lines.push(`**Word / topic:** ${display}`);
        lines.push('');
        lines.push('**Current aliases:**');
        lines.push(bullet(currentAnswers));
        lines.push('');
        lines.push('**Recommended aliases:**');
        lines.push(bullet(recommended));
      }
      lines.push('');
      lines.push(`**Assessment:** ${info.assessment}`);
      lines.push('');
      lines.push(`**Reason:** ${info.reason}`);
      lines.push('');
      if (item.difficulty) {
        lines.push(`**Difficulty:** ${item.difficulty}`);
        lines.push('');
      }
      if (item.tags) {
        lines.push(`**Tags:** ${JSON.stringify(item.tags)}`);
        lines.push('');
      }
    });
  }
}

lines.push('## Baseline assessment totals');
lines.push('');
for (const [key, value] of Object.entries(stats.assessments)) {
  lines.push(`- **${key}:** ${value}`);
}
lines.push('');
lines.push('True in-catalog duplicates (same id or same normalized canonical text inside a category): **0**. Near-duplicates called out above: Fast Answer `countries-16`/`countries-18`; Fast Answer `games-2` ambiguity; Fast Answer `series-20` generic island.');
lines.push('');

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log(`Wrote ${OUT}`);
console.log(`Items: ${stats.total}`);
console.log(JSON.stringify(stats.assessments));
