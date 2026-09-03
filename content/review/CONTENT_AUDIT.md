# Wanasatna content audit — complete item inventory

Generated from production JSON under `content/`. This file lists **every** existing content item, not samples.

Assessments in the item list describe the **baseline before the expansion pass**. Cleanup and new items are summarized at the top after the pass lands.

Normalization used by the live matcher (`normalizeTextAnswer`): NFKC, trim, lower-case, Arabic/Persian digits, strip tatweel and diacritics, strip a leading `ال`, collapse hamza/alif, `ى`→`ي`, **`ة`→`ه`**, strip punctuation. Duplicate aliases after this step are invalid. The content README note that matching does not map `ة`→`ه` is outdated relative to code.

## Baseline inventory

| Game | Kind | Categories | Items |
| --- | --- | --- | ---: |
| برا السالفة (`bara-al-salafa`) | word | 6 | 120 |
| ارسم وخمّن (`draw-guess`) | word | 5 | 99 |
| الإمبوستر بالرسم (`imposter-draw`) | word | 5 | 99 |
| تحدي التوقيت (`timing-challenge`) | none | 0 | 0 |
| أسرع إجابة (`fast-answer`) | question | 5 | 97 |
| من كتبها؟ (`who-wrote-it`) | prompt | 4 | 60 |
| القاضي (`judge`) | prompt | 5 | 75 |
| تحدي التخمين (`guessing-challenge`) | identity | 7 | 138 |

**Total production items (excluding تحدي التوقيت):** 688

### Per category (baseline)

| Game | Category id | Arabic name | Enabled | Items |
| --- | --- | --- | --- | ---: |
| برا السالفة | `animals` | حيوانات | true | 20 |
| برا السالفة | `food` | أكلات | true | 20 |
| برا السالفة | `countries` | بلدان | true | 20 |
| برا السالفة | `football` | كرة قدم | true | 20 |
| برا السالفة | `series` | مسلسلات | true | 20 |
| برا السالفة | `games` | ألعاب | true | 20 |
| ارسم وخمّن | `animals` | حيوانات | true | 20 |
| ارسم وخمّن | `food` | أكلات | true | 20 |
| ارسم وخمّن | `nature` | طبيعة وفضاء وطقس | true | 20 |
| ارسم وخمّن | `places` | أماكن ومعالم واضحة | true | 20 |
| ارسم وخمّن | `tech` | تقنيات | true | 19 |
| الإمبوستر بالرسم | `animals` | حيوانات | true | 20 |
| الإمبوستر بالرسم | `food` | أكلات | true | 20 |
| الإمبوستر بالرسم | `nature` | طبيعة وفضاء وطقس | true | 20 |
| الإمبوستر بالرسم | `places` | أماكن ومعالم واضحة | true | 20 |
| الإمبوستر بالرسم | `tech` | تقنيات | true | 19 |
| تحدي التوقيت | — | — | — | 0 |
| أسرع إجابة | `animals` | حيوانات | true | 20 |
| أسرع إجابة | `food` | أكلات | true | 17 |
| أسرع إجابة | `countries` | بلدان | true | 20 |
| أسرع إجابة | `series` | مسلسلات | true | 20 |
| أسرع إجابة | `games` | ألعاب | true | 20 |
| من كتبها؟ | `funny-situations` | مواقف مضحكة | true | 15 |
| من كتبها؟ | `confessions` | اعترافات | true | 15 |
| من كتبها؟ | `light-personal` | أسئلة شخصية خفيفة | true | 15 |
| من كتبها؟ | `what-would-you-do` | ماذا ستفعل؟ | true | 15 |
| القاضي | `worst-answer` | أسوأ إجابة ممكنة | true | 15 |
| القاضي | `invent-something-silly` | اخترع شيء غبي | true | 15 |
| القاضي | `weird-scenarios` | سيناريوهات غريبة | true | 15 |
| القاضي | `complete-the-sentence` | كمل الجملة | true | 15 |
| القاضي | `rapid-response` | تحديات الرد السريع | true | 15 |
| تحدي التخمين | `animals` | حيوانات | true | 20 |
| تحدي التخمين | `food` | أكلات | true | 20 |
| تحدي التخمين | `countries` | بلدان | true | 20 |
| تحدي التخمين | `football` | كرة قدم | true | 20 |
| تحدي التخمين | `series` | مسلسلات | true | 20 |
| تحدي التخمين | `games` | ألعاب | true | 20 |
| تحدي التخمين | `tech` | تقنيات | true | 18 |

### Smallest pools (baseline)

- أسرع إجابة / أكلات: 17 سؤالًا
- تحدي التخمين / تقنيات: 18 هوية
- ارسم وخمّن والإمبوستر بالرسم / تقنيات: 19 كلمة
- من كتبها؟ والقاضي: 15 عنصرًا لكل فئة
- باقي الفئات غالبًا 20
- تحدي التوقيت: لا يوجد كتالوج محتوى

## Question selection / repetition

This is a content-size and match-scoped memory issue, not a broken RNG that secretly samples only 10 IDs.

### How selection actually works

1. **Lobby category lock:** If the host picks a real category, the pool is **only that category**. `random` / عشوائي means all enabled categories for that game (`round-category-store.ts`). `random` is never stored in JSON.
2. **Uniform pick:** `pickRandomWord` / `pickFastAnswerQuestion` / prompt pickers use `Math.floor(Math.random() * pool.length)`. There is no weighted subset and no shuffle-of-the-full-deck that gets stuck.
3. **Within a match:** Unused items are preferred. Fast Answer / Who Wrote It / Judge keep up to **24** recent IDs **on that match**. Guessing Challenge keeps **32** identity IDs. Bara / Draw / Imposter exclude used **canonical texts** for later rounds in the same match.
4. **Fallback when exhausted:** If every eligible item is already used, the picker **falls back to the full eligible pool** and can repeat. That is intentional for long matches, not a 10-item cap.
5. **Across matches:** Recent lists reset when a new match starts. There is **no persistent “don’t show this for a week” memory**.
6. **Fast Answer / Judge / Who Wrote It / Guessing Challenge + عشوائي:** The match first picks a **category** (unused categories first, then reuse), then an item inside that category. A 5-round Fast Answer random match therefore shows **one question from each of five categories**, not five random questions from the global 97.
7. **Eligibility:** All enabled category items in JSON are eligible. No extra runtime filter drops the pool to 10. Guessing Challenge only requires **≥2** identities in a category to offer it.
8. **Duplicate IDs:** Validation forbids duplicate IDs and duplicate canonical texts **inside a category**. That is not shrinking the pool today.

### Why it feels like “the same 10 questions”

- Locked category pools are **17–20 items**. Default Fast Answer is **5 rounds**. A few rematches of حيوانات will recycle the same ~20 questions quickly because nothing is remembered between matches.
- Default Bara / Draw / Imposter are **3 rounds**. Locked to حيوانات = 20 words. After two or three matches the group has seen a large fraction of the pool.
- Random mode still samples **per category**. It does not flatten all 97 Fast Answer questions into one bag each round.
- **No code change in this pass.** Expanding pools is the correct fix. A cross-match cooldown would be a separate, tiny runtime change if still needed after expansion.

## Content sources inspected

- `content/{gameId}/categories.json`, `words.json`, `questions.json`, `settings.json`
- `packages/shared/src/content/{types,normalize,word-picker,validation,categories}.ts`
- Runtime pickers under `apps/server/src/modules/game/plugins/*`
- Previous review notes: `content/review/OWNER_REVIEW.md`, `P8_D1_CHANGES.md`, `P8_D2_CHANGES.md`, `docs/p17-content-catalog.md` (p17 catalog is **stale** vs current JSON; e.g. it still lists Bara cars/movies/tech)

## Item-by-item audit (every existing item)

# برا السالفة

**Game id:** `bara-al-salafa`

**Settings:** `{"minPlayers":3,"maxPlayers":20,"roundTime":60,"countdownTime":3,"rounds":3,"enabledCategories":[]}`

## برا السالفة — حيوانات

**Category id:** `animals` · **enabled:** true · **count:** 20

### 1. `animals-1`

**Category:** حيوانات

**Word / topic:** أسد

**Current aliases:**
- _(none)_

**Recommended aliases:**
- أسد

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 2. `animals-2`

**Category:** حيوانات

**Word / topic:** نمر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- نمر

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 3. `animals-3`

**Category:** حيوانات

**Word / topic:** فيل

**Current aliases:**
- _(none)_

**Recommended aliases:**
- فيل

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 4. `animals-4`

**Category:** حيوانات

**Word / topic:** زرافة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- زرافة

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 5. `animals-5`

**Category:** حيوانات

**Word / topic:** قرد

**Current aliases:**
- _(none)_

**Recommended aliases:**
- قرد

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 6. `animals-6`

**Category:** حيوانات

**Word / topic:** دب

**Current aliases:**
- _(none)_

**Recommended aliases:**
- دب

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 7. `animals-7`

**Category:** حيوانات

**Word / topic:** ذئب

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ذئب

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 8. `animals-8`

**Category:** حيوانات

**Word / topic:** ثعلب

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ثعلب

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 9. `animals-9`

**Category:** حيوانات

**Word / topic:** أرنب

**Current aliases:**
- _(none)_

**Recommended aliases:**
- أرنب

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 10. `animals-10`

**Category:** حيوانات

**Word / topic:** جمل

**Current aliases:**
- _(none)_

**Recommended aliases:**
- جمل

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 11. `animals-11`

**Category:** حيوانات

**Word / topic:** حصان

**Current aliases:**
- _(none)_

**Recommended aliases:**
- حصان

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 12. `animals-12`

**Category:** حيوانات

**Word / topic:** بقرة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بقرة

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 13. `animals-13`

**Category:** حيوانات

**Word / topic:** خروف

**Current aliases:**
- _(none)_

**Recommended aliases:**
- خروف

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 14. `animals-14`

**Category:** حيوانات

**Word / topic:** ماعز

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ماعز

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 15. `animals-15`

**Category:** حيوانات

**Word / topic:** كلب

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كلب

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 16. `animals-16`

**Category:** حيوانات

**Word / topic:** قطة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- قطة

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 17. `animals-17`

**Category:** حيوانات

**Word / topic:** تمساح

**Current aliases:**
- _(none)_

**Recommended aliases:**
- تمساح

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 18. `animals-18`

**Category:** حيوانات

**Word / topic:** ثعبان

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ثعبان

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 19. `animals-19`

**Category:** حيوانات

**Word / topic:** بطريق

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بطريق

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 20. `animals-20`

**Category:** حيوانات

**Word / topic:** دلفين

**Current aliases:**
- _(none)_

**Recommended aliases:**
- دلفين

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

## برا السالفة — أكلات

**Category id:** `food` · **enabled:** true · **count:** 20

### 1. `food-1`

**Category:** أكلات

**Word / topic:** بيتزا

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بيتزا

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 2. `food-2`

**Category:** أكلات

**Word / topic:** برغر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- برغر

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 3. `food-3`

**Category:** أكلات

**Word / topic:** شاورما

**Current aliases:**
- _(none)_

**Recommended aliases:**
- شاورما

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 4. `food-4`

**Category:** أكلات

**Word / topic:** كبسة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كبسة

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 5. `food-5`

**Category:** أكلات

**Word / topic:** مندي

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مندي

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 6. `food-6`

**Category:** أكلات

**Word / topic:** فلافل

**Current aliases:**
- _(none)_

**Recommended aliases:**
- فلافل

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 7. `food-7`

**Category:** أكلات

**Word / topic:** حمص

**Current aliases:**
- _(none)_

**Recommended aliases:**
- حمص

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 8. `food-8`

**Category:** أكلات

**Word / topic:** كنافة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كنافة

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 9. `food-9`

**Category:** أكلات

**Word / topic:** بقلاوة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بقلاوة

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 10. `food-10`

**Category:** أكلات

**Word / topic:** سوشي

**Current aliases:**
- _(none)_

**Recommended aliases:**
- سوشي

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 11. `food-11`

**Category:** أكلات

**Word / topic:** باستا

**Current aliases:**
- _(none)_

**Recommended aliases:**
- باستا

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 12. `food-12`

**Category:** أكلات

**Word / topic:** بشاميل

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بشاميل

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 13. `food-13`

**Category:** أكلات

**Word / topic:** آيس كريم

**Current aliases:**
- _(none)_

**Recommended aliases:**
- آيس كريم

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 14. `food-14`

**Category:** أكلات

**Word / topic:** فشار

**Current aliases:**
- _(none)_

**Recommended aliases:**
- فشار

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 15. `food-15`

**Category:** أكلات

**Word / topic:** دونات

**Current aliases:**
- _(none)_

**Recommended aliases:**
- دونات

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 16. `food-16`

**Category:** أكلات

**Word / topic:** بان كيك

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بان كيك

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 17. `food-17`

**Category:** أكلات

**Word / topic:** وافل

**Current aliases:**
- _(none)_

**Recommended aliases:**
- وافل

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 18. `food-18`

**Category:** أكلات

**Word / topic:** كب كيك

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كب كيك

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 19. `food-19`

**Category:** أكلات

**Word / topic:** سمبوسة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- سمبوسة

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 20. `food-20`

**Category:** أكلات

**Word / topic:** تشيز كيك

**Current aliases:**
- _(none)_

**Recommended aliases:**
- تشيز كيك

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

## برا السالفة — بلدان

**Category id:** `countries` · **enabled:** true · **count:** 20

### 1. `countries-1`

**Category:** بلدان

**Word / topic:** السعودية

**Current aliases:**
- _(none)_

**Recommended aliases:**
- السعودية

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 2. `countries-2`

**Category:** بلدان

**Word / topic:** الأردن

**Current aliases:**
- _(none)_

**Recommended aliases:**
- الأردن

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 3. `countries-3`

**Category:** بلدان

**Word / topic:** مصر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مصر

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 4. `countries-4`

**Category:** بلدان

**Word / topic:** الإمارات

**Current aliases:**
- _(none)_

**Recommended aliases:**
- الإمارات

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 5. `countries-5`

**Category:** بلدان

**Word / topic:** الكويت

**Current aliases:**
- _(none)_

**Recommended aliases:**
- الكويت

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 6. `countries-6`

**Category:** بلدان

**Word / topic:** قطر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- قطر

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 7. `countries-7`

**Category:** بلدان

**Word / topic:** البحرين

**Current aliases:**
- _(none)_

**Recommended aliases:**
- البحرين

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 8. `countries-8`

**Category:** بلدان

**Word / topic:** عُمان

**Current aliases:**
- _(none)_

**Recommended aliases:**
- عُمان

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 9. `countries-9`

**Category:** بلدان

**Word / topic:** المغرب

**Current aliases:**
- _(none)_

**Recommended aliases:**
- المغرب

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 10. `countries-10`

**Category:** بلدان

**Word / topic:** تركيا

**Current aliases:**
- _(none)_

**Recommended aliases:**
- تركيا

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 11. `countries-11`

**Category:** بلدان

**Word / topic:** اليابان

**Current aliases:**
- _(none)_

**Recommended aliases:**
- اليابان

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 12. `countries-12`

**Category:** بلدان

**Word / topic:** الصين

**Current aliases:**
- _(none)_

**Recommended aliases:**
- الصين

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 13. `countries-13`

**Category:** بلدان

**Word / topic:** الهند

**Current aliases:**
- _(none)_

**Recommended aliases:**
- الهند

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 14. `countries-14`

**Category:** بلدان

**Word / topic:** فرنسا

**Current aliases:**
- _(none)_

**Recommended aliases:**
- فرنسا

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 15. `countries-15`

**Category:** بلدان

**Word / topic:** إيطاليا

**Current aliases:**
- _(none)_

**Recommended aliases:**
- إيطاليا

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 16. `countries-16`

**Category:** بلدان

**Word / topic:** إسبانيا

**Current aliases:**
- _(none)_

**Recommended aliases:**
- إسبانيا

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 17. `countries-17`

**Category:** بلدان

**Word / topic:** ألمانيا

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ألمانيا

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 18. `countries-18`

**Category:** بلدان

**Word / topic:** بريطانيا

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بريطانيا

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 19. `countries-19`

**Category:** بلدان

**Word / topic:** أمريكا

**Current aliases:**
- _(none)_

**Recommended aliases:**
- أمريكا

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 20. `countries-20`

**Category:** بلدان

**Word / topic:** البرازيل

**Current aliases:**
- _(none)_

**Recommended aliases:**
- البرازيل

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

## برا السالفة — كرة قدم

**Category id:** `football` · **enabled:** true · **count:** 20

### 1. `football-1`

**Category:** كرة قدم

**Word / topic:** كريستيانو رونالدو

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كريستيانو رونالدو

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 2. `football-2`

**Category:** كرة قدم

**Word / topic:** ليونيل ميسي

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ليونيل ميسي

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 3. `football-3`

**Category:** كرة قدم

**Word / topic:** نيمار

**Current aliases:**
- _(none)_

**Recommended aliases:**
- نيمار

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 4. `football-4`

**Category:** كرة قدم

**Word / topic:** كيليان مبابي

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كيليان مبابي

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 5. `football-5`

**Category:** كرة قدم

**Word / topic:** محمد صلاح

**Current aliases:**
- _(none)_

**Recommended aliases:**
- محمد صلاح

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 6. `football-6`

**Category:** كرة قدم

**Word / topic:** كريم بنزيما

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كريم بنزيما

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 7. `football-7`

**Category:** كرة قدم

**Word / topic:** لوكا مودريتش

**Current aliases:**
- _(none)_

**Recommended aliases:**
- لوكا مودريتش

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 8. `football-8`

**Category:** كرة قدم

**Word / topic:** روبرت ليفاندوفسكي

**Current aliases:**
- _(none)_

**Recommended aliases:**
- روبرت ليفاندوفسكي

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 9. `football-9`

**Category:** كرة قدم

**Word / topic:** إيرلينغ هالاند

**Current aliases:**
- _(none)_

**Recommended aliases:**
- إيرلينغ هالاند

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 10. `football-10`

**Category:** كرة قدم

**Word / topic:** فينيسيوس جونيور

**Current aliases:**
- _(none)_

**Recommended aliases:**
- فينيسيوس جونيور

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 11. `football-11`

**Category:** كرة قدم

**Word / topic:** رونالدينيو

**Current aliases:**
- _(none)_

**Recommended aliases:**
- رونالدينيو

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 12. `football-12`

**Category:** كرة قدم

**Word / topic:** زين الدين زيدان

**Current aliases:**
- _(none)_

**Recommended aliases:**
- زين الدين زيدان

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 13. `football-13`

**Category:** كرة قدم

**Word / topic:** ديفيد بيكهام

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ديفيد بيكهام

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 14. `football-14`

**Category:** كرة قدم

**Word / topic:** تييري هنري

**Current aliases:**
- _(none)_

**Recommended aliases:**
- تييري هنري

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 15. `football-15`

**Category:** كرة قدم

**Word / topic:** أندريس إنييستا

**Current aliases:**
- _(none)_

**Recommended aliases:**
- أندريس إنييستا

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 16. `football-16`

**Category:** كرة قدم

**Word / topic:** تشافي

**Current aliases:**
- _(none)_

**Recommended aliases:**
- تشافي

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 17. `football-17`

**Category:** كرة قدم

**Word / topic:** سيرجيو راموس

**Current aliases:**
- _(none)_

**Recommended aliases:**
- سيرجيو راموس

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 18. `football-18`

**Category:** كرة قدم

**Word / topic:** بوفون

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بوفون

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 19. `football-19`

**Category:** كرة قدم

**Word / topic:** رونالدو نازاريو

**Current aliases:**
- _(none)_

**Recommended aliases:**
- رونالدو نازاريو

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 20. `football-20`

**Category:** كرة قدم

**Word / topic:** بيليه

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بيليه

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

## برا السالفة — مسلسلات

**Category id:** `series` · **enabled:** true · **count:** 20

### 1. `series-1`

**Category:** مسلسلات

**Word / topic:** Breaking Bad

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Breaking Bad

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 2. `series-2`

**Category:** مسلسلات

**Word / topic:** Game of Thrones

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Game of Thrones

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 3. `series-3`

**Category:** مسلسلات

**Word / topic:** Prison Break

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Prison Break

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 4. `series-4`

**Category:** مسلسلات

**Word / topic:** The Walking Dead

**Current aliases:**
- _(none)_

**Recommended aliases:**
- The Walking Dead

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 5. `series-5`

**Category:** مسلسلات

**Word / topic:** Peaky Blinders

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Peaky Blinders

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 6. `series-6`

**Category:** مسلسلات

**Word / topic:** Stranger Things

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Stranger Things

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 7. `series-7`

**Category:** مسلسلات

**Word / topic:** Money Heist

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Money Heist

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 8. `series-8`

**Category:** مسلسلات

**Word / topic:** The Boys

**Current aliases:**
- _(none)_

**Recommended aliases:**
- The Boys

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 9. `series-9`

**Category:** مسلسلات

**Word / topic:** Dexter

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Dexter

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 10. `series-10`

**Category:** مسلسلات

**Word / topic:** Sherlock

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Sherlock

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 11. `series-11`

**Category:** مسلسلات

**Word / topic:** The Last of Us

**Current aliases:**
- _(none)_

**Recommended aliases:**
- The Last of Us

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 12. `series-12`

**Category:** مسلسلات

**Word / topic:** Squid Game

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Squid Game

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 13. `series-13`

**Category:** مسلسلات

**Word / topic:** Better Call Saul

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Better Call Saul

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 14. `series-14`

**Category:** مسلسلات

**Word / topic:** Vikings

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Vikings

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 15. `series-15`

**Category:** مسلسلات

**Word / topic:** Lost

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Lost

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 16. `series-16`

**Category:** مسلسلات

**Word / topic:** The Witcher

**Current aliases:**
- _(none)_

**Recommended aliases:**
- The Witcher

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 17. `series-17`

**Category:** مسلسلات

**Word / topic:** House of the Dragon

**Current aliases:**
- _(none)_

**Recommended aliases:**
- House of the Dragon

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 18. `series-18`

**Category:** مسلسلات

**Word / topic:** The Sopranos

**Current aliases:**
- _(none)_

**Recommended aliases:**
- The Sopranos

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 19. `series-19`

**Category:** مسلسلات

**Word / topic:** Narcos

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Narcos

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 20. `series-20`

**Category:** مسلسلات

**Word / topic:** Suits

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Suits

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

## برا السالفة — ألعاب

**Category id:** `games` · **enabled:** true · **count:** 20

### 1. `games-1`

**Category:** ألعاب

**Word / topic:** Minecraft

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Minecraft

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 2. `games-2`

**Category:** ألعاب

**Word / topic:** Fortnite

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Fortnite

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 3. `games-3`

**Category:** ألعاب

**Word / topic:** PUBG

**Current aliases:**
- _(none)_

**Recommended aliases:**
- PUBG

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 4. `games-4`

**Category:** ألعاب

**Word / topic:** GTA V

**Current aliases:**
- _(none)_

**Recommended aliases:**
- GTA V

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 5. `games-5`

**Category:** ألعاب

**Word / topic:** Call of Duty

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Call of Duty

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 6. `games-6`

**Category:** ألعاب

**Word / topic:** FIFA

**Current aliases:**
- _(none)_

**Recommended aliases:**
- FIFA

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 7. `games-7`

**Category:** ألعاب

**Word / topic:** Rocket League

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Rocket League

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 8. `games-8`

**Category:** ألعاب

**Word / topic:** Valorant

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Valorant

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 9. `games-9`

**Category:** ألعاب

**Word / topic:** League of Legends

**Current aliases:**
- _(none)_

**Recommended aliases:**
- League of Legends

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 10. `games-10`

**Category:** ألعاب

**Word / topic:** Counter-Strike

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Counter-Strike

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 11. `games-11`

**Category:** ألعاب

**Word / topic:** Overwatch

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Overwatch

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 12. `games-12`

**Category:** ألعاب

**Word / topic:** Marvel Rivals

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Marvel Rivals

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 13. `games-13`

**Category:** ألعاب

**Word / topic:** Among Us

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Among Us

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 14. `games-14`

**Category:** ألعاب

**Word / topic:** The Last of Us

**Current aliases:**
- _(none)_

**Recommended aliases:**
- The Last of Us

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 15. `games-15`

**Category:** ألعاب

**Word / topic:** Red Dead Redemption 2

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Red Dead Redemption 2

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 16. `games-16`

**Category:** ألعاب

**Word / topic:** Resident Evil

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Resident Evil

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 17. `games-17`

**Category:** ألعاب

**Word / topic:** Assassin’s Creed

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Assassin’s Creed

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 18. `games-18`

**Category:** ألعاب

**Word / topic:** God of War

**Current aliases:**
- _(none)_

**Recommended aliases:**
- God of War

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 19. `games-19`

**Category:** ألعاب

**Word / topic:** Elden Ring

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Elden Ring

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

### 20. `games-20`

**Category:** ألعاب

**Word / topic:** Spider-Man

**Current aliases:**
- _(none)_

**Recommended aliases:**
- Spider-Man

**Assessment:** KEEP

**Reason:** موضوع مناسب للنقاش الاجتماعي في برا السالفة.

# ارسم وخمّن

**Game id:** `draw-guess`

**Settings:** `{"minPlayers":2,"maxPlayers":20,"roundTime":60,"rounds":3,"enabledCategories":[]}`

## ارسم وخمّن — حيوانات

**Category id:** `animals` · **enabled:** true · **count:** 20

### 1. `animals-1`

**Category:** حيوانات

**Word / topic:** أسد

**Current aliases:**
- _(none)_

**Recommended aliases:**
- أسد

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 2. `animals-2`

**Category:** حيوانات

**Word / topic:** نمر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- نمر

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 3. `animals-3`

**Category:** حيوانات

**Word / topic:** فيل

**Current aliases:**
- _(none)_

**Recommended aliases:**
- فيل

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 4. `animals-4`

**Category:** حيوانات

**Word / topic:** زرافة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- زرافة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 5. `animals-5`

**Category:** حيوانات

**Word / topic:** قرد

**Current aliases:**
- _(none)_

**Recommended aliases:**
- قرد

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 6. `animals-6`

**Category:** حيوانات

**Word / topic:** دب

**Current aliases:**
- _(none)_

**Recommended aliases:**
- دب

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 7. `animals-7`

**Category:** حيوانات

**Word / topic:** أرنب

**Current aliases:**
- _(none)_

**Recommended aliases:**
- أرنب

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 8. `animals-8`

**Category:** حيوانات

**Word / topic:** جمل

**Current aliases:**
- _(none)_

**Recommended aliases:**
- جمل

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 9. `animals-9`

**Category:** حيوانات

**Word / topic:** حصان

**Current aliases:**
- _(none)_

**Recommended aliases:**
- حصان

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 10. `animals-10`

**Category:** حيوانات

**Word / topic:** قطة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- قطة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 11. `animals-11`

**Category:** حيوانات

**Word / topic:** كلب

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كلب

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 12. `animals-12`

**Category:** حيوانات

**Word / topic:** بطريق

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بطريق

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 13. `animals-13`

**Category:** حيوانات

**Word / topic:** تمساح

**Current aliases:**
- _(none)_

**Recommended aliases:**
- تمساح

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 14. `animals-14`

**Category:** حيوانات

**Word / topic:** ثعبان

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ثعبان

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 15. `animals-15`

**Category:** حيوانات

**Word / topic:** دلفين

**Current aliases:**
- _(none)_

**Recommended aliases:**
- دلفين

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 16. `animals-16`

**Category:** حيوانات

**Word / topic:** أخطبوط

**Current aliases:**
- _(none)_

**Recommended aliases:**
- أخطبوط

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 17. `animals-17`

**Category:** حيوانات

**Word / topic:** سلحفاة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- سلحفاة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 18. `animals-18`

**Category:** حيوانات

**Word / topic:** ضفدع

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ضفدع

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 19. `animals-19`

**Category:** حيوانات

**Word / topic:** نحلة

**Current aliases:**
- النحل

**Recommended aliases:**
- النحل

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 20. `animals-20`

**Category:** حيوانات

**Word / topic:** فراشة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- فراشة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

## ارسم وخمّن — أكلات

**Category id:** `food` · **enabled:** true · **count:** 20

### 1. `food-1`

**Category:** أكلات

**Word / topic:** بيتزا

**Current aliases:**
- Pizza

**Recommended aliases:**
- Pizza

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 2. `food-2`

**Category:** أكلات

**Word / topic:** برغر

**Current aliases:**
- برجر
- Burger

**Recommended aliases:**
- برجر
- Burger

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 3. `food-3`

**Category:** أكلات

**Word / topic:** شاورما

**Current aliases:**
- Shawarma

**Recommended aliases:**
- Shawarma

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 4. `food-4`

**Category:** أكلات

**Word / topic:** كبسة

**Current aliases:**
- Kabsa

**Recommended aliases:**
- Kabsa

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 5. `food-5`

**Category:** أكلات

**Word / topic:** مندي

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مندي

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 6. `food-6`

**Category:** أكلات

**Word / topic:** فلافل

**Current aliases:**
- طعمية

**Recommended aliases:**
- طعمية

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 7. `food-7`

**Category:** أكلات

**Word / topic:** كنافة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كنافة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 8. `food-8`

**Category:** أكلات

**Word / topic:** سوشي

**Current aliases:**
- Sushi

**Recommended aliases:**
- Sushi

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 9. `food-9`

**Category:** أكلات

**Word / topic:** آيس كريم

**Current aliases:**
- مثلجات
- Ice cream

**Recommended aliases:**
- مثلجات
- Ice cream

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 10. `food-10`

**Category:** أكلات

**Word / topic:** دونات

**Current aliases:**
- دونت
- Donut
- Doughnut

**Recommended aliases:**
- دونت
- Donut
- Doughnut

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 11. `food-11`

**Category:** أكلات

**Word / topic:** بان كيك

**Current aliases:**
- Pancake
- Pancakes

**Recommended aliases:**
- Pancake
- Pancakes

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 12. `food-12`

**Category:** أكلات

**Word / topic:** وافل

**Current aliases:**
- Waffle
- Waffles

**Recommended aliases:**
- Waffle
- Waffles

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 13. `food-13`

**Category:** أكلات

**Word / topic:** كب كيك

**Current aliases:**
- Cupcake
- Cup cake

**Recommended aliases:**
- Cupcake
- Cup cake

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 14. `food-14`

**Category:** أكلات

**Word / topic:** سمبوسة

**Current aliases:**
- سمبوسك
- Samosa

**Recommended aliases:**
- سمبوسك
- Samosa

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 15. `food-15`

**Category:** أكلات

**Word / topic:** تشيز كيك

**Current aliases:**
- Cheesecake
- Cheese cake

**Recommended aliases:**
- Cheesecake
- Cheese cake

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 16. `food-16`

**Category:** أكلات

**Word / topic:** بطيخ

**Current aliases:**
- حبحب

**Recommended aliases:**
- حبحب

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 17. `food-17`

**Category:** أكلات

**Word / topic:** أناناس

**Current aliases:**
- Pineapple

**Recommended aliases:**
- Pineapple

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 18. `food-18`

**Category:** أكلات

**Word / topic:** فراولة

**Current aliases:**
- Strawberry

**Recommended aliases:**
- Strawberry

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 19. `food-19`

**Category:** أكلات

**Word / topic:** بيضة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بيضة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 20. `food-20`

**Category:** أكلات

**Word / topic:** فشار

**Current aliases:**
- بوشار
- Popcorn

**Recommended aliases:**
- بوشار
- Popcorn

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

## ارسم وخمّن — طبيعة وفضاء وطقس

**Category id:** `nature` · **enabled:** true · **count:** 20

### 1. `nature-1`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** بركان

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بركان

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 2. `nature-2`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** شلال

**Current aliases:**
- _(none)_

**Recommended aliases:**
- شلال

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 3. `nature-3`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** قمر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- قمر

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 4. `nature-4`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** شمس

**Current aliases:**
- _(none)_

**Recommended aliases:**
- شمس

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 5. `nature-5`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** نيزك

**Current aliases:**
- _(none)_

**Recommended aliases:**
- نيزك

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 6. `nature-6`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** صاروخ

**Current aliases:**
- _(none)_

**Recommended aliases:**
- صاروخ

**Assessment:** KEEP

**Reason:** صاروخ أقرب للفضاء منه للطبيعة، لكن الفئة اسمها «طبيعة وفضاء وطقس». قابل للرسم.

### 7. `nature-7`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** كوكب

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كوكب

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 8. `nature-8`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** نجمة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- نجمة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 9. `nature-9`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** صحراء

**Current aliases:**
- _(none)_

**Recommended aliases:**
- صحراء

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 10. `nature-10`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** غيمة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- غيمة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 11. `nature-11`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** مطر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مطر

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 12. `nature-12`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** برق

**Current aliases:**
- _(none)_

**Recommended aliases:**
- برق

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 13. `nature-13`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** إعصار

**Current aliases:**
- _(none)_

**Recommended aliases:**
- إعصار

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 14. `nature-14`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** قوس قزح

**Current aliases:**
- _(none)_

**Recommended aliases:**
- قوس قزح

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 15. `nature-15`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** شاطئ

**Current aliases:**
- _(none)_

**Recommended aliases:**
- شاطئ

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 16. `nature-16`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** كهف

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كهف

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 17. `nature-17`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** جبل

**Current aliases:**
- _(none)_

**Recommended aliases:**
- جبل

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 18. `nature-18`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** نهر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- نهر

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 19. `nature-19`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** جزيرة

**Current aliases:**
- The Island

**Recommended aliases:**
- جزيرة
- Island

**Assessment:** FIX

**Reason:** الاسم المستعار The Island غير مناسب لكلمة رسم «جزيرة» وقد ي confus مع مسلسل Lost.

### 20. `nature-20`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** ثلج

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ثلج

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

## ارسم وخمّن — أماكن ومعالم واضحة

**Category id:** `places` · **enabled:** true · **count:** 20

### 1. `places-1`

**Category:** أماكن ومعالم واضحة

**Word / topic:** مستشفى

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مستشفى

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 2. `places-2`

**Category:** أماكن ومعالم واضحة

**Word / topic:** مطار

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مطار

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 3. `places-3`

**Category:** أماكن ومعالم واضحة

**Word / topic:** مدرسة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مدرسة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 4. `places-4`

**Category:** أماكن ومعالم واضحة

**Word / topic:** ملعب كرة قدم

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ملعب كرة قدم

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 5. `places-5`

**Category:** أماكن ومعالم واضحة

**Word / topic:** حديقة حيوان

**Current aliases:**
- _(none)_

**Recommended aliases:**
- حديقة حيوان

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 6. `places-6`

**Category:** أماكن ومعالم واضحة

**Word / topic:** مدينة ملاهي

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مدينة ملاهي

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 7. `places-7`

**Category:** أماكن ومعالم واضحة

**Word / topic:** قلعة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- قلعة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 8. `places-8`

**Category:** أماكن ومعالم واضحة

**Word / topic:** أهرامات

**Current aliases:**
- _(none)_

**Recommended aliases:**
- أهرامات

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 9. `places-9`

**Category:** أماكن ومعالم واضحة

**Word / topic:** برج إيفل

**Current aliases:**
- _(none)_

**Recommended aliases:**
- برج إيفل

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 10. `places-10`

**Category:** أماكن ومعالم واضحة

**Word / topic:** برج خليفة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- برج خليفة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 11. `places-11`

**Category:** أماكن ومعالم واضحة

**Word / topic:** خيمة سيرك

**Current aliases:**
- _(none)_

**Recommended aliases:**
- خيمة سيرك

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 12. `places-12`

**Category:** أماكن ومعالم واضحة

**Word / topic:** محطة قطار

**Current aliases:**
- _(none)_

**Recommended aliases:**
- محطة قطار

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 13. `places-13`

**Category:** أماكن ومعالم واضحة

**Word / topic:** مطعم

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مطعم

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 14. `places-14`

**Category:** أماكن ومعالم واضحة

**Word / topic:** فندق

**Current aliases:**
- _(none)_

**Recommended aliases:**
- فندق

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 15. `places-15`

**Category:** أماكن ومعالم واضحة

**Word / topic:** مكتبة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مكتبة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 16. `places-16`

**Category:** أماكن ومعالم واضحة

**Word / topic:** مسجد

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مسجد

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 17. `places-17`

**Category:** أماكن ومعالم واضحة

**Word / topic:** متحف

**Current aliases:**
- _(none)_

**Recommended aliases:**
- متحف

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 18. `places-18`

**Category:** أماكن ومعالم واضحة

**Word / topic:** جسر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- جسر

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 19. `places-19`

**Category:** أماكن ومعالم واضحة

**Word / topic:** منارة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- منارة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 20. `places-20`

**Category:** أماكن ومعالم واضحة

**Word / topic:** محطة وقود

**Current aliases:**
- _(none)_

**Recommended aliases:**
- محطة وقود

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

## ارسم وخمّن — تقنيات

**Category id:** `tech` · **enabled:** true · **count:** 19

### 1. `tech-1`

**Category:** تقنيات

**Word / topic:** هاتف

**Current aliases:**
- _(none)_

**Recommended aliases:**
- هاتف

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 2. `tech-2`

**Category:** تقنيات

**Word / topic:** لابتوب

**Current aliases:**
- _(none)_

**Recommended aliases:**
- لابتوب

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 3. `tech-3`

**Category:** تقنيات

**Word / topic:** كمبيوتر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كمبيوتر

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 4. `tech-4`

**Category:** تقنيات

**Word / topic:** روبوت

**Current aliases:**
- _(none)_

**Recommended aliases:**
- روبوت

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 5. `tech-5`

**Category:** تقنيات

**Word / topic:** كاميرا

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كاميرا

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 6. `tech-6`

**Category:** تقنيات

**Word / topic:** سماعات

**Current aliases:**
- _(none)_

**Recommended aliases:**
- سماعات

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 7. `tech-7`

**Category:** تقنيات

**Word / topic:** لوحة مفاتيح

**Current aliases:**
- _(none)_

**Recommended aliases:**
- لوحة مفاتيح

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 8. `tech-8`

**Category:** تقنيات

**Word / topic:** فأرة كمبيوتر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- فأرة كمبيوتر

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 9. `tech-9`

**Category:** تقنيات

**Word / topic:** شاشة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- شاشة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 10. `tech-10`

**Category:** تقنيات

**Word / topic:** طابعة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- طابعة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 11. `tech-11`

**Category:** تقنيات

**Word / topic:** ساعة ذكية

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ساعة ذكية

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 12. `tech-12`

**Category:** تقنيات

**Word / topic:** شاحن

**Current aliases:**
- _(none)_

**Recommended aliases:**
- شاحن

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 13. `tech-13`

**Category:** تقنيات

**Word / topic:** باور بانك

**Current aliases:**
- _(none)_

**Recommended aliases:**
- باور بانك

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 14. `tech-14`

**Category:** تقنيات

**Word / topic:** درون

**Current aliases:**
- _(none)_

**Recommended aliases:**
- درون

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 15. `tech-15`

**Category:** تقنيات

**Word / topic:** بلايستيشن

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بلايستيشن

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 16. `tech-16`

**Category:** تقنيات

**Word / topic:** يد تحكم

**Current aliases:**
- _(none)_

**Recommended aliases:**
- يد تحكم

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 17. `tech-17`

**Category:** تقنيات

**Word / topic:** نظارة واقع افتراضي

**Current aliases:**
- _(none)_

**Recommended aliases:**
- نظارة واقع افتراضي

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 18. `tech-18`

**Category:** تقنيات

**Word / topic:** ميكروفون

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ميكروفون

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 19. `tech-19`

**Category:** تقنيات

**Word / topic:** فلاش ميموري

**Current aliases:**
- _(none)_

**Recommended aliases:**
- فلاش ميموري

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

# الإمبوستر بالرسم

**Game id:** `imposter-draw`

**Settings:** `{"minPlayers":3,"maxPlayers":20,"roundTime":10,"rounds":3,"enabledCategories":[]}`

## الإمبوستر بالرسم — حيوانات

**Category id:** `animals` · **enabled:** true · **count:** 20

### 1. `animals-1`

**Category:** حيوانات

**Word / topic:** أسد

**Current aliases:**
- _(none)_

**Recommended aliases:**
- أسد

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 2. `animals-2`

**Category:** حيوانات

**Word / topic:** نمر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- نمر

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 3. `animals-3`

**Category:** حيوانات

**Word / topic:** فيل

**Current aliases:**
- _(none)_

**Recommended aliases:**
- فيل

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 4. `animals-4`

**Category:** حيوانات

**Word / topic:** زرافة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- زرافة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 5. `animals-5`

**Category:** حيوانات

**Word / topic:** قرد

**Current aliases:**
- _(none)_

**Recommended aliases:**
- قرد

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 6. `animals-6`

**Category:** حيوانات

**Word / topic:** دب

**Current aliases:**
- _(none)_

**Recommended aliases:**
- دب

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 7. `animals-7`

**Category:** حيوانات

**Word / topic:** أرنب

**Current aliases:**
- _(none)_

**Recommended aliases:**
- أرنب

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 8. `animals-8`

**Category:** حيوانات

**Word / topic:** جمل

**Current aliases:**
- _(none)_

**Recommended aliases:**
- جمل

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 9. `animals-9`

**Category:** حيوانات

**Word / topic:** حصان

**Current aliases:**
- _(none)_

**Recommended aliases:**
- حصان

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 10. `animals-10`

**Category:** حيوانات

**Word / topic:** قطة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- قطة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 11. `animals-11`

**Category:** حيوانات

**Word / topic:** كلب

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كلب

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 12. `animals-12`

**Category:** حيوانات

**Word / topic:** بطريق

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بطريق

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 13. `animals-13`

**Category:** حيوانات

**Word / topic:** تمساح

**Current aliases:**
- _(none)_

**Recommended aliases:**
- تمساح

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 14. `animals-14`

**Category:** حيوانات

**Word / topic:** ثعبان

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ثعبان

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 15. `animals-15`

**Category:** حيوانات

**Word / topic:** دلفين

**Current aliases:**
- _(none)_

**Recommended aliases:**
- دلفين

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 16. `animals-16`

**Category:** حيوانات

**Word / topic:** أخطبوط

**Current aliases:**
- _(none)_

**Recommended aliases:**
- أخطبوط

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 17. `animals-17`

**Category:** حيوانات

**Word / topic:** سلحفاة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- سلحفاة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 18. `animals-18`

**Category:** حيوانات

**Word / topic:** ضفدع

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ضفدع

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 19. `animals-19`

**Category:** حيوانات

**Word / topic:** نحلة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- نحلة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 20. `animals-20`

**Category:** حيوانات

**Word / topic:** فراشة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- فراشة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

## الإمبوستر بالرسم — أكلات

**Category id:** `food` · **enabled:** true · **count:** 20

### 1. `food-1`

**Category:** أكلات

**Word / topic:** بيتزا

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بيتزا

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 2. `food-2`

**Category:** أكلات

**Word / topic:** برغر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- برغر

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 3. `food-3`

**Category:** أكلات

**Word / topic:** شاورما

**Current aliases:**
- _(none)_

**Recommended aliases:**
- شاورما

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 4. `food-4`

**Category:** أكلات

**Word / topic:** كبسة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كبسة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 5. `food-5`

**Category:** أكلات

**Word / topic:** مندي

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مندي

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 6. `food-6`

**Category:** أكلات

**Word / topic:** فلافل

**Current aliases:**
- _(none)_

**Recommended aliases:**
- فلافل

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 7. `food-7`

**Category:** أكلات

**Word / topic:** كنافة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كنافة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 8. `food-8`

**Category:** أكلات

**Word / topic:** سوشي

**Current aliases:**
- _(none)_

**Recommended aliases:**
- سوشي

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 9. `food-9`

**Category:** أكلات

**Word / topic:** آيس كريم

**Current aliases:**
- _(none)_

**Recommended aliases:**
- آيس كريم

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 10. `food-10`

**Category:** أكلات

**Word / topic:** دونات

**Current aliases:**
- _(none)_

**Recommended aliases:**
- دونات

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 11. `food-11`

**Category:** أكلات

**Word / topic:** بان كيك

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بان كيك

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 12. `food-12`

**Category:** أكلات

**Word / topic:** وافل

**Current aliases:**
- _(none)_

**Recommended aliases:**
- وافل

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 13. `food-13`

**Category:** أكلات

**Word / topic:** كب كيك

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كب كيك

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 14. `food-14`

**Category:** أكلات

**Word / topic:** سمبوسة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- سمبوسة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 15. `food-15`

**Category:** أكلات

**Word / topic:** تشيز كيك

**Current aliases:**
- _(none)_

**Recommended aliases:**
- تشيز كيك

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 16. `food-16`

**Category:** أكلات

**Word / topic:** بطيخ

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بطيخ

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 17. `food-17`

**Category:** أكلات

**Word / topic:** أناناس

**Current aliases:**
- _(none)_

**Recommended aliases:**
- أناناس

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 18. `food-18`

**Category:** أكلات

**Word / topic:** فراولة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- فراولة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 19. `food-19`

**Category:** أكلات

**Word / topic:** بيضة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بيضة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 20. `food-20`

**Category:** أكلات

**Word / topic:** فشار

**Current aliases:**
- _(none)_

**Recommended aliases:**
- فشار

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

## الإمبوستر بالرسم — طبيعة وفضاء وطقس

**Category id:** `nature` · **enabled:** true · **count:** 20

### 1. `nature-1`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** بركان

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بركان

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 2. `nature-2`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** شلال

**Current aliases:**
- _(none)_

**Recommended aliases:**
- شلال

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 3. `nature-3`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** قمر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- قمر

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 4. `nature-4`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** شمس

**Current aliases:**
- _(none)_

**Recommended aliases:**
- شمس

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 5. `nature-5`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** نيزك

**Current aliases:**
- _(none)_

**Recommended aliases:**
- نيزك

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 6. `nature-6`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** صاروخ

**Current aliases:**
- _(none)_

**Recommended aliases:**
- صاروخ

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 7. `nature-7`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** كوكب

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كوكب

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 8. `nature-8`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** نجمة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- نجمة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 9. `nature-9`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** صحراء

**Current aliases:**
- _(none)_

**Recommended aliases:**
- صحراء

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 10. `nature-10`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** غيمة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- غيمة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 11. `nature-11`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** مطر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مطر

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 12. `nature-12`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** برق

**Current aliases:**
- _(none)_

**Recommended aliases:**
- برق

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 13. `nature-13`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** إعصار

**Current aliases:**
- _(none)_

**Recommended aliases:**
- إعصار

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 14. `nature-14`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** قوس قزح

**Current aliases:**
- _(none)_

**Recommended aliases:**
- قوس قزح

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 15. `nature-15`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** شاطئ

**Current aliases:**
- _(none)_

**Recommended aliases:**
- شاطئ

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 16. `nature-16`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** كهف

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كهف

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 17. `nature-17`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** جبل

**Current aliases:**
- _(none)_

**Recommended aliases:**
- جبل

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 18. `nature-18`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** نهر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- نهر

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 19. `nature-19`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** جزيرة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- جزيرة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 20. `nature-20`

**Category:** طبيعة وفضاء وطقس

**Word / topic:** ثلج

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ثلج

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

## الإمبوستر بالرسم — أماكن ومعالم واضحة

**Category id:** `places` · **enabled:** true · **count:** 20

### 1. `places-1`

**Category:** أماكن ومعالم واضحة

**Word / topic:** مستشفى

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مستشفى

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 2. `places-2`

**Category:** أماكن ومعالم واضحة

**Word / topic:** مطار

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مطار

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 3. `places-3`

**Category:** أماكن ومعالم واضحة

**Word / topic:** مدرسة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مدرسة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 4. `places-4`

**Category:** أماكن ومعالم واضحة

**Word / topic:** ملعب كرة قدم

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ملعب كرة قدم

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 5. `places-5`

**Category:** أماكن ومعالم واضحة

**Word / topic:** حديقة حيوان

**Current aliases:**
- _(none)_

**Recommended aliases:**
- حديقة حيوان

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 6. `places-6`

**Category:** أماكن ومعالم واضحة

**Word / topic:** مدينة ملاهي

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مدينة ملاهي

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 7. `places-7`

**Category:** أماكن ومعالم واضحة

**Word / topic:** قلعة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- قلعة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 8. `places-8`

**Category:** أماكن ومعالم واضحة

**Word / topic:** أهرامات

**Current aliases:**
- _(none)_

**Recommended aliases:**
- أهرامات

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 9. `places-9`

**Category:** أماكن ومعالم واضحة

**Word / topic:** برج إيفل

**Current aliases:**
- _(none)_

**Recommended aliases:**
- برج إيفل

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 10. `places-10`

**Category:** أماكن ومعالم واضحة

**Word / topic:** برج خليفة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- برج خليفة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 11. `places-11`

**Category:** أماكن ومعالم واضحة

**Word / topic:** خيمة سيرك

**Current aliases:**
- _(none)_

**Recommended aliases:**
- خيمة سيرك

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 12. `places-12`

**Category:** أماكن ومعالم واضحة

**Word / topic:** محطة قطار

**Current aliases:**
- _(none)_

**Recommended aliases:**
- محطة قطار

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 13. `places-13`

**Category:** أماكن ومعالم واضحة

**Word / topic:** مطعم

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مطعم

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 14. `places-14`

**Category:** أماكن ومعالم واضحة

**Word / topic:** فندق

**Current aliases:**
- _(none)_

**Recommended aliases:**
- فندق

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 15. `places-15`

**Category:** أماكن ومعالم واضحة

**Word / topic:** مكتبة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مكتبة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 16. `places-16`

**Category:** أماكن ومعالم واضحة

**Word / topic:** مسجد

**Current aliases:**
- _(none)_

**Recommended aliases:**
- مسجد

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 17. `places-17`

**Category:** أماكن ومعالم واضحة

**Word / topic:** متحف

**Current aliases:**
- _(none)_

**Recommended aliases:**
- متحف

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 18. `places-18`

**Category:** أماكن ومعالم واضحة

**Word / topic:** جسر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- جسر

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 19. `places-19`

**Category:** أماكن ومعالم واضحة

**Word / topic:** منارة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- منارة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 20. `places-20`

**Category:** أماكن ومعالم واضحة

**Word / topic:** محطة وقود

**Current aliases:**
- _(none)_

**Recommended aliases:**
- محطة وقود

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

## الإمبوستر بالرسم — تقنيات

**Category id:** `tech` · **enabled:** true · **count:** 19

### 1. `tech-1`

**Category:** تقنيات

**Word / topic:** هاتف

**Current aliases:**
- _(none)_

**Recommended aliases:**
- هاتف

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 2. `tech-2`

**Category:** تقنيات

**Word / topic:** لابتوب

**Current aliases:**
- _(none)_

**Recommended aliases:**
- لابتوب

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 3. `tech-3`

**Category:** تقنيات

**Word / topic:** كمبيوتر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كمبيوتر

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 4. `tech-4`

**Category:** تقنيات

**Word / topic:** روبوت

**Current aliases:**
- _(none)_

**Recommended aliases:**
- روبوت

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 5. `tech-5`

**Category:** تقنيات

**Word / topic:** كاميرا

**Current aliases:**
- _(none)_

**Recommended aliases:**
- كاميرا

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 6. `tech-6`

**Category:** تقنيات

**Word / topic:** سماعات

**Current aliases:**
- _(none)_

**Recommended aliases:**
- سماعات

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 7. `tech-7`

**Category:** تقنيات

**Word / topic:** لوحة مفاتيح

**Current aliases:**
- _(none)_

**Recommended aliases:**
- لوحة مفاتيح

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 8. `tech-8`

**Category:** تقنيات

**Word / topic:** فأرة كمبيوتر

**Current aliases:**
- _(none)_

**Recommended aliases:**
- فأرة كمبيوتر

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 9. `tech-9`

**Category:** تقنيات

**Word / topic:** شاشة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- شاشة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 10. `tech-10`

**Category:** تقنيات

**Word / topic:** طابعة

**Current aliases:**
- _(none)_

**Recommended aliases:**
- طابعة

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 11. `tech-11`

**Category:** تقنيات

**Word / topic:** ساعة ذكية

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ساعة ذكية

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 12. `tech-12`

**Category:** تقنيات

**Word / topic:** شاحن

**Current aliases:**
- _(none)_

**Recommended aliases:**
- شاحن

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 13. `tech-13`

**Category:** تقنيات

**Word / topic:** باور بانك

**Current aliases:**
- _(none)_

**Recommended aliases:**
- باور بانك

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 14. `tech-14`

**Category:** تقنيات

**Word / topic:** درون

**Current aliases:**
- _(none)_

**Recommended aliases:**
- درون

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 15. `tech-15`

**Category:** تقنيات

**Word / topic:** بلايستيشن

**Current aliases:**
- _(none)_

**Recommended aliases:**
- بلايستيشن

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 16. `tech-16`

**Category:** تقنيات

**Word / topic:** يد تحكم

**Current aliases:**
- _(none)_

**Recommended aliases:**
- يد تحكم

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 17. `tech-17`

**Category:** تقنيات

**Word / topic:** نظارة واقع افتراضي

**Current aliases:**
- _(none)_

**Recommended aliases:**
- نظارة واقع افتراضي

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 18. `tech-18`

**Category:** تقنيات

**Word / topic:** ميكروفون

**Current aliases:**
- _(none)_

**Recommended aliases:**
- ميكروفون

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

### 19. `tech-19`

**Category:** تقنيات

**Word / topic:** فلاش ميموري

**Current aliases:**
- _(none)_

**Recommended aliases:**
- فلاش ميموري

**Assessment:** KEEP

**Reason:** اسم قابل للرسم والتعرف في جولة قصيرة.

# تحدي التوقيت

**Game id:** `timing-challenge`

No content catalog. Timing Challenge is interaction/timer gameplay only.

# أسرع إجابة

**Game id:** `fast-answer`

**Settings:** `{"minPlayers":2,"maxPlayers":20,"roundTime":15,"rounds":5,"enabledCategories":[]}`

## أسرع إجابة — حيوانات

**Category id:** `animals` · **enabled:** true · **count:** 20

### 1. `animals-1`

**Category:** حيوانات

**Question:** ما أسرع حيوان بري؟

**Current answers:**
- الفهد الصياد
- الفهد
- الشيتا

**Recommended accepted answers:**
- الفهد الصياد
- الفهد
- الشيتا
- Cheetah

**Assessment:** FIX

**Reason:** سؤال واضح وممتع. الأسماء المقبولة ناقصة: فهد، Cheetah، cheetah. الشيتا مفيد لكن الإنجليزية ناقصة.

### 2. `animals-2`

**Category:** حيوانات

**Question:** ما أكبر حيوان في العالم؟

**Current answers:**
- الحوت الأزرق
- حوت أزرق

**Recommended accepted answers:**
- الحوت الأزرق
- حوت أزرق

**Assessment:** FIX

**Reason:** المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.

### 3. `animals-3`

**Category:** حيوانات

**Question:** كم قلبًا للأخطبوط؟

**Current answers:**
- 3
- ثلاثة
- ثلاث

**Recommended accepted answers:**
- 3
- ثلاثة
- ثلاث

**Assessment:** FIX

**Reason:** المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.

### 4. `animals-4`

**Category:** حيوانات

**Question:** ما الحيوان المعروف بسفينة الصحراء؟

**Current answers:**
- الجمل

**Recommended accepted answers:**
- الجمل

**Assessment:** FIX

**Reason:** المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.

### 5. `animals-5`

**Category:** حيوانات

**Question:** ما الحيوان الذي يغيّر لون جلده للتمويه؟

**Current answers:**
- الحرباء

**Recommended accepted answers:**
- الحرباء

**Assessment:** FIX

**Reason:** المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.

### 6. `animals-6`

**Category:** حيوانات

**Question:** ما أكبر طائر في العالم؟

**Current answers:**
- النعامة

**Recommended accepted answers:**
- النعامة

**Assessment:** FIX

**Reason:** المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.

### 7. `animals-7`

**Category:** حيوانات

**Question:** ما الحيوان الذي يتميز برقبة طويلة جدًا؟

**Current answers:**
- الزرافة

**Recommended accepted answers:**
- الزرافة
- Giraffe

**Assessment:** KEEP

**Reason:** سهل لأن الرقبة الطويلة توجّه للزرافة، وهذا مقبول في لعبة جماعية سريعة. حسّن الأسماء المقبولة.

### 8. `animals-8`

**Category:** حيوانات

**Question:** ما الحيوان الذي يُلقب بملك الغابة؟

**Current answers:**
- الأسد

**Recommended accepted answers:**
- الأسد

**Assessment:** FIX

**Reason:** المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.

### 9. `animals-9`

**Category:** حيوانات

**Question:** كم رجلًا للنملة؟

**Current answers:**
- 6
- ستة
- ست

**Recommended accepted answers:**
- 6
- ستة
- ست

**Assessment:** FIX

**Reason:** المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.

### 10. `animals-10`

**Category:** حيوانات

**Question:** ما الحيوان الذي يعيش في القطب الجنوبي ويشتهر بلونه الأسود والأبيض؟

**Current answers:**
- البطريق

**Recommended accepted answers:**
- البطريق

**Assessment:** FIX

**Reason:** المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.

### 11. `animals-11`

**Category:** حيوانات

**Question:** ما الحيوان البحري الذي له ثمانية أذرع؟

**Current answers:**
- الأخطبوط

**Recommended accepted answers:**
- الأخطبوط

**Assessment:** FIX

**Reason:** المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.

### 12. `animals-12`

**Category:** حيوانات

**Question:** ما الحيوان الذي يحمل صغاره في كيس؟

**Current answers:**
- الكنغر

**Recommended accepted answers:**
- الكنغر

**Assessment:** FIX

**Reason:** المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.

### 13. `animals-13`

**Category:** حيوانات

**Question:** ما الحيوان الذي يشتهر ببطئه ويحمل صدفة؟

**Current answers:**
- السلحفاة

**Recommended accepted answers:**
- السلحفاة

**Assessment:** FIX

**Reason:** المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.

### 14. `animals-14`

**Category:** حيوانات

**Question:** ما الحيوان المعروف بخطوطه السوداء والبيضاء؟

**Current answers:**
- الحمار الوحشي
- حمار وحشي
- الزيبرا

**Recommended accepted answers:**
- الحمار الوحشي
- حمار وحشي
- الزيبرا

**Assessment:** FIX

**Reason:** المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.

### 15. `animals-15`

**Category:** حيوانات

**Question:** ما الحشرة التي تنتج العسل؟

**Current answers:**
- النحلة
- النحل

**Recommended accepted answers:**
- النحلة
- النحل

**Assessment:** FIX

**Reason:** المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.

### 16. `animals-16`

**Category:** حيوانات

**Question:** ما الحيوان الذي يُعرف بقدرته الكبيرة على تقليد أصوات البشر؟

**Current answers:**
- الببغاء

**Recommended accepted answers:**
- الببغاء

**Assessment:** FIX

**Reason:** المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.

### 17. `animals-17`

**Category:** حيوانات

**Question:** ما أكبر حيوان بري؟

**Current answers:**
- الفيل

**Recommended accepted answers:**
- الفيل
- Elephant

**Assessment:** KEEP

**Reason:** ليس تكرارًا حقيقيًا مع animals-20: السؤال عن الحجم لا عن الخرطوم. الإجابتيان نفس الحيوان وهذا مقبول.

### 18. `animals-18`

**Category:** حيوانات

**Question:** ما الحيوان الذي يعيش في الماء واليابسة ويبدأ حياته كشرغوف؟

**Current answers:**
- الضفدع

**Recommended accepted answers:**
- الضفدع

**Assessment:** FIX

**Reason:** المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.

### 19. `animals-19`

**Category:** حيوانات

**Question:** ما الحيوان الذي يشتهر ببناء السدود؟

**Current answers:**
- القندس
- البيفر

**Recommended accepted answers:**
- القندس
- البيفر

**Assessment:** FIX

**Reason:** المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.

### 20. `animals-20`

**Category:** حيوانات

**Question:** ما الحيوان الذي يستخدم خرطومه للشرب؟

**Current answers:**
- الفيل

**Recommended accepted answers:**
- الفيل
- Elephant

**Assessment:** KEEP

**Reason:** سؤال مختلف عن animals-17 رغم أن الإجابة فيل. أبقِه للتنويع.

## أسرع إجابة — أكلات

**Category id:** `food` · **enabled:** true · **count:** 17

### 1. `food-1`

**Category:** أكلات

**Question:** ما الأكلة الإيطالية الدائرية المشهورة بالجبن والصلصة؟

**Current answers:**
- بيتزا
- Pizza

**Recommended accepted answers:**
- بيتزا
- Pizza

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 2. `food-2`

**Category:** أكلات

**Question:** ما الأكلة التي تتكون غالبًا من خبز ولحم وطبقات إضافية؟

**Current answers:**
- برغر
- برجر
- Burger

**Recommended accepted answers:**
- برغر
- برجر
- Burger
- Hamburger

**Assessment:** KEEP

**Reason:** قد يتداخل ذهنيًا مع ساندويتش، لكن في السياق الشعبي الإجابة المقصودة واضحة: برغر.

### 3. `food-3`

**Category:** أكلات

**Question:** ما الأكلة الشامية التي تُلف غالبًا بالخبز وتحتوي لحمًا أو دجاجًا؟

**Current answers:**
- شاورما
- Shawarma

**Recommended accepted answers:**
- شاورما
- Shawarma

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 4. `food-4`

**Category:** أكلات

**Question:** ما الطبق السعودي الشهير الذي يُحضّر بالأرز واللحم أو الدجاج؟

**Current answers:**
- كبسة
- Kabsa

**Recommended accepted answers:**
- كبسة
- Kabsa

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 5. `food-5`

**Category:** أكلات

**Question:** ما الأكلة المصنوعة غالبًا من الحمص أو الفول وتُقلى على شكل أقراص؟

**Current answers:**
- فلافل
- طعمية

**Recommended accepted answers:**
- فلافل
- طعمية

**Assessment:** FIX

**Reason:** المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.

### 6. `food-6`

**Category:** أكلات

**Question:** ما الأكلة اليابانية المشهورة التي قد تحتوي أرزًا وسمكًا؟

**Current answers:**
- سوشي
- Sushi

**Recommended accepted answers:**
- سوشي
- Sushi

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 7. `food-7`

**Category:** أكلات

**Question:** ما الحلوى الباردة المصنوعة من الحليب أو الكريمة والمنكهات؟

**Current answers:**
- آيس كريم
- مثلجات
- Ice cream

**Recommended accepted answers:**
- آيس كريم
- مثلجات
- Ice cream

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 8. `food-8`

**Category:** أكلات

**Question:** ما الحلوى المقلية الدائرية التي غالبًا يكون في وسطها ثقب؟

**Current answers:**
- دونات
- دونت
- Donut
- Doughnut

**Recommended accepted answers:**
- دونات
- دونت
- Donut
- Doughnut

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 9. `food-9`

**Category:** أكلات

**Question:** ما الطعام الذي يُحضّر على شكل أقراص من عجينة سائلة ويؤكل غالبًا في الإفطار؟

**Current answers:**
- بان كيك
- Pancake
- Pancakes

**Recommended accepted answers:**
- بان كيك
- Pancake
- Pancakes

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 10. `food-10`

**Category:** أكلات

**Question:** ما الحلوى الشبكية التي تُطهى في جهاز خاص وتؤكل مع الصوصات؟

**Current answers:**
- وافل
- Waffle
- Waffles

**Recommended accepted answers:**
- وافل
- Waffle
- Waffles

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 11. `food-11`

**Category:** أكلات

**Question:** ما الحلوى الصغيرة التي تشبه الكيك وتُخبز عادة في قالب ورقي؟

**Current answers:**
- كب كيك
- Cupcake
- Cup cake

**Recommended accepted answers:**
- كب كيك
- Cupcake
- Cup cake

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 12. `food-12`

**Category:** أكلات

**Question:** ما المعجنات المثلثة المحشوة غالبًا باللحم أو الجبن أو الخضار؟

**Current answers:**
- سمبوسة
- سمبوسك
- Samosa

**Recommended accepted answers:**
- سمبوسة
- سمبوسك
- Samosa

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 13. `food-13`

**Category:** أكلات

**Question:** ما الحلوى التي تعتمد بشكل أساسي على الجبن وتُقدم ككيكة؟

**Current answers:**
- تشيز كيك
- Cheesecake
- Cheese cake

**Recommended accepted answers:**
- تشيز كيك
- Cheesecake
- Cheese cake

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 14. `food-14`

**Category:** أكلات

**Question:** ما الفاكهة الكبيرة ذات القشرة الخضراء والداخل الأحمر غالبًا؟

**Current answers:**
- بطيخ
- حبحب

**Recommended accepted answers:**
- بطيخ
- حبحب

**Assessment:** FIX

**Reason:** المحتوى جيد، لكن تغطية الأسماء المقبولة العربية/الإنجليزية غير مكتملة.

### 15. `food-15`

**Category:** أكلات

**Question:** ما الفاكهة ذات القشرة الخشنة والتاج الورقي؟

**Current answers:**
- أناناس
- Pineapple

**Recommended accepted answers:**
- أناناس
- Pineapple

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 16. `food-16`

**Category:** أكلات

**Question:** ما الفاكهة الحمراء الصغيرة التي تحمل بذورها على سطحها؟

**Current answers:**
- فراولة
- Strawberry

**Recommended accepted answers:**
- فراولة
- Strawberry

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 17. `food-17`

**Category:** أكلات

**Question:** ما الطعام الذي يُصنع من حبوب الذرة عند تسخينها حتى تنفجر؟

**Current answers:**
- فشار
- بوشار
- Popcorn

**Recommended accepted answers:**
- فشار
- بوشار
- Popcorn

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

## أسرع إجابة — بلدان

**Category id:** `countries` · **enabled:** true · **count:** 20

### 1. `countries-1`

**Category:** بلدان

**Question:** ما عاصمة السعودية؟

**Current answers:**
- الرياض
- Riyadh

**Recommended accepted answers:**
- الرياض
- Riyadh

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 2. `countries-2`

**Category:** بلدان

**Question:** ما الدولة التي تقع فيها مدينة دبي؟

**Current answers:**
- الإمارات
- الإمارات العربية المتحدة
- UAE

**Recommended accepted answers:**
- الإمارات
- الإمارات العربية المتحدة
- UAE

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 3. `countries-3`

**Category:** بلدان

**Question:** ما الدولة التي تشتهر ببرج إيفل؟

**Current answers:**
- فرنسا
- France

**Recommended accepted answers:**
- فرنسا
- France

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 4. `countries-4`

**Category:** بلدان

**Question:** ما الدولة التي تقع فيها الأهرامات؟

**Current answers:**
- مصر
- Egypt

**Recommended accepted answers:**
- مصر
- Egypt

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 5. `countries-5`

**Category:** بلدان

**Question:** ما عاصمة اليابان؟

**Current answers:**
- طوكيو
- توكيو
- Tokyo

**Recommended accepted answers:**
- طوكيو
- توكيو
- Tokyo

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 6. `countries-6`

**Category:** بلدان

**Question:** ما الدولة التي تشتهر بتاج محل؟

**Current answers:**
- الهند
- India

**Recommended accepted answers:**
- الهند
- India

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 7. `countries-7`

**Category:** بلدان

**Question:** ما الدولة التي تقع فيها مدينة إسطنبول؟

**Current answers:**
- تركيا
- Turkey

**Recommended accepted answers:**
- تركيا
- Turkey

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 8. `countries-8`

**Category:** بلدان

**Question:** ما عاصمة المغرب؟

**Current answers:**
- الرباط
- Rabat

**Recommended accepted answers:**
- الرباط
- Rabat

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 9. `countries-9`

**Category:** بلدان

**Question:** ما أكبر دولة في العالم من حيث المساحة؟

**Current answers:**
- روسيا
- Russia

**Recommended accepted answers:**
- روسيا
- Russia

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 10. `countries-10`

**Category:** بلدان

**Question:** ما الدولة التي تشتهر بالبيتزا والباستا؟

**Current answers:**
- إيطاليا
- Italy

**Recommended accepted answers:**
- إيطاليا
- Italy

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 11. `countries-11`

**Category:** بلدان

**Question:** ما الدولة التي تقع فيها مدينة أمستردام؟

**Current answers:**
- هولندا
- Netherlands
- Nederland

**Recommended accepted answers:**
- هولندا
- Netherlands
- Nederland

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 12. `countries-12`

**Category:** بلدان

**Question:** ما عاصمة الأردن؟

**Current answers:**
- عمّان
- Amman

**Recommended accepted answers:**
- عمّان
- Amman

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 13. `countries-13`

**Category:** بلدان

**Question:** ما الدولة التي تقع فيها مدينة برشلونة؟

**Current answers:**
- إسبانيا
- Spain

**Recommended accepted answers:**
- إسبانيا
- Spain

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 14. `countries-14`

**Category:** بلدان

**Question:** ما عاصمة البرازيل؟

**Current answers:**
- برازيليا
- Brasilia

**Recommended accepted answers:**
- برازيليا
- Brasilia

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 15. `countries-15`

**Category:** بلدان

**Question:** ما الدولة التي تقع فيها مدينة مكة؟

**Current answers:**
- السعودية
- المملكة العربية السعودية
- Saudi Arabia

**Recommended accepted answers:**
- السعودية
- المملكة العربية السعودية
- Saudi Arabia

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 16. `countries-16`

**Category:** بلدان

**Question:** ما الدولة التي تقع فيها مدينة لندن؟

**Current answers:**
- بريطانيا
- المملكة المتحدة
- UK
- United Kingdom

**Recommended accepted answers:**
- بريطانيا
- المملكة المتحدة
- UK
- United Kingdom
- Britain
- England

**Assessment:** KEEP

**Reason:** لندن → بريطانيا سؤال واضح. countries-18 هو شبه التكرار الحقيقي.

### 17. `countries-17`

**Category:** بلدان

**Question:** ما عاصمة ألمانيا؟

**Current answers:**
- برلين
- Berlin

**Recommended accepted answers:**
- برلين
- Berlin

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 18. `countries-18`

**Category:** بلدان

**Question:** ما الدولة التي تشتهر بساعة بيغ بن؟

**Current answers:**
- بريطانيا
- المملكة المتحدة
- UK

**Recommended accepted answers:**
- بريطانيا
- المملكة المتحدة
- UK
- United Kingdom
- Britain

**Assessment:** REPLACE

**Reason:** شبه تكرار لـ countries-16: نفس الدولة (بريطانيا) بمدخل معلم مشهور. يستبدل بسؤال دولة مختلفة.

### 19. `countries-19`

**Category:** بلدان

**Question:** ما الدولة التي تقع فيها مدينة نيويورك؟

**Current answers:**
- أمريكا
- الولايات المتحدة
- USA
- United States

**Recommended accepted answers:**
- أمريكا
- الولايات المتحدة
- USA
- United States

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 20. `countries-20`

**Category:** بلدان

**Question:** ما عاصمة قطر؟

**Current answers:**
- الدوحة
- Doha

**Recommended accepted answers:**
- الدوحة
- Doha

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

## أسرع إجابة — مسلسلات

**Category id:** `series` · **enabled:** true · **count:** 20

### 1. `series-1`

**Category:** مسلسلات

**Question:** في أي مسلسل يظهر والتر وايت؟

**Current answers:**
- Breaking Bad
- بريكنق باد
- بريكنغ باد

**Recommended accepted answers:**
- Breaking Bad
- بريكنق باد
- بريكنغ باد

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 2. `series-2`

**Category:** مسلسلات

**Question:** من الشخصية الرئيسية في مسلسل Dexter؟

**Current answers:**
- Dexter Morgan
- ديكستر مورغان
- ديكستر

**Recommended accepted answers:**
- Dexter Morgan
- ديكستر مورغان
- ديكستر
- Dexter

**Assessment:** KEEP

**Reason:** الاسم موجود في السؤال، والإجابة ديكستر. سهل ومقبول في اللعب السريع.

### 3. `series-3`

**Category:** مسلسلات

**Question:** في أي مسلسل توجد عائلة Stark؟

**Current answers:**
- Game of Thrones
- جيم أوف ثرونز

**Recommended accepted answers:**
- Game of Thrones
- جيم أوف ثرونز

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 4. `series-4`

**Category:** مسلسلات

**Question:** ما اسم السجن الشهير في بداية مسلسل Prison Break؟

**Current answers:**
- Fox River
- فوكس ريفر

**Recommended accepted answers:**
- Fox River
- فوكس ريفر

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 5. `series-5`

**Category:** مسلسلات

**Question:** في أي مسلسل يظهر Tommy Shelby؟

**Current answers:**
- Peaky Blinders
- بيكي بلايندرز

**Recommended accepted answers:**
- Peaky Blinders
- بيكي بلايندرز

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 6. `series-6`

**Category:** مسلسلات

**Question:** ما اسم المجموعة الخارقة في مسلسل The Boys؟

**Current answers:**
- The Seven
- السبعة
- ذا سفن

**Recommended accepted answers:**
- The Seven
- السبعة
- ذا سفن

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 7. `series-7`

**Category:** مسلسلات

**Question:** في أي مسلسل يظهر Saul Goodman؟

**Current answers:**
- Better Call Saul
- بيتر كول سول

**Recommended accepted answers:**
- Better Call Saul
- بيتر كول سول

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 8. `series-8`

**Category:** مسلسلات

**Question:** ما اسم المدينة التي تدور فيها أحداث Stranger Things؟

**Current answers:**
- Hawkins
- هوكينز

**Recommended accepted answers:**
- Hawkins
- هوكينز

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 9. `series-9`

**Category:** مسلسلات

**Question:** في أي مسلسل يظهر Ragnar Lothbrok؟

**Current answers:**
- Vikings
- فايكنغز
- فايكنجز

**Recommended accepted answers:**
- Vikings
- فايكنغز
- فايكنجز

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 10. `series-10`

**Category:** مسلسلات

**Question:** ما اسم اللعبة القاتلة الشهيرة في مسلسل Squid Game؟

**Current answers:**
- Red Light, Green Light
- الضوء الأحمر والضوء الأخضر

**Recommended accepted answers:**
- Red Light, Green Light
- الضوء الأحمر والضوء الأخضر

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 11. `series-11`

**Category:** مسلسلات

**Question:** في أي مسلسل يظهر Rick Grimes؟

**Current answers:**
- The Walking Dead
- ذا ووكينغ ديد

**Recommended accepted answers:**
- The Walking Dead
- ذا ووكينغ ديد

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 12. `series-12`

**Category:** مسلسلات

**Question:** ما اسم المحقق الشهير في مسلسل Sherlock؟

**Current answers:**
- Sherlock Holmes
- شيرلوك هولمز
- شيرلوك

**Recommended accepted answers:**
- Sherlock Holmes
- شيرلوك هولمز
- شيرلوك

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 13. `series-13`

**Category:** مسلسلات

**Question:** في أي مسلسل تظهر شخصية Geralt of Rivia؟

**Current answers:**
- The Witcher
- ذا ويتشر

**Recommended accepted answers:**
- The Witcher
- ذا ويتشر

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 14. `series-14`

**Category:** مسلسلات

**Question:** ما اسم عائلة التنين الرئيسية في House of the Dragon؟

**Current answers:**
- Targaryen
- تارغاريان
- تارجيريان

**Recommended accepted answers:**
- Targaryen
- تارغاريان
- تارجيريان

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 15. `series-15`

**Category:** مسلسلات

**Question:** في أي مسلسل يظهر Pablo Escobar كشخصية رئيسية؟

**Current answers:**
- Narcos
- ناركوس

**Recommended accepted answers:**
- Narcos
- ناركوس

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 16. `series-16`

**Category:** مسلسلات

**Question:** ما اسم المحامي الرئيسي في مسلسل Suits؟

**Current answers:**
- Harvey Specter
- هارفي سبكتر
- هارفي

**Recommended accepted answers:**
- Harvey Specter
- هارفي سبكتر
- هارفي

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 17. `series-17`

**Category:** مسلسلات

**Question:** في أي مسلسل يظهر Tony Soprano؟

**Current answers:**
- The Sopranos
- ذا سوبرانوز
- سوبرانوز

**Recommended accepted answers:**
- The Sopranos
- ذا سوبرانوز
- سوبرانوز

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 18. `series-18`

**Category:** مسلسلات

**Question:** ما اسم الشخصية التي يلعبها Pedro Pascal في The Last of Us؟

**Current answers:**
- Joel
- جويل

**Recommended accepted answers:**
- Joel
- جويل

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 19. `series-19`

**Category:** مسلسلات

**Question:** في أي مسلسل تدور أحداث سرقة دار السك الإسبانية؟

**Current answers:**
- Money Heist
- La Casa de Papel
- لا كاسا دي بابيل

**Recommended accepted answers:**
- Money Heist
- La Casa de Papel
- لا كاسا دي بابيل

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 20. `series-20`

**Category:** مسلسلات

**Question:** ما اسم المدينة/الجزيرة الغامضة التي تدور حولها أحداث مسلسل Lost؟

**Current answers:**
- الجزيرة
- The Island

**Recommended accepted answers:**
- Lost
- لوست

**Assessment:** REPLACE

**Reason:** إجابة «الجزيرة / The Island» عامة جدًا وسهلة الرفض أو الالتباس. السؤال نفسه ضعيف للكتابة السريعة.

## أسرع إجابة — ألعاب

**Category id:** `games` · **enabled:** true · **count:** 20

### 1. `games-1`

**Category:** ألعاب

**Question:** في أي لعبة يظهر شخصية Steve؟

**Current answers:**
- Minecraft
- ماينكرافت

**Recommended accepted answers:**
- Minecraft
- ماينكرافت

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 2. `games-2`

**Category:** ألعاب

**Question:** ما اسم اللعبة الشهيرة التي يتنافس فيها 100 لاعب تقريبًا حتى يبقى لاعب أو فريق واحد؟

**Current answers:**
- PUBG
- ببجي
- PlayerUnknown's Battlegrounds

**Recommended accepted answers:**
- PUBG
- ببجي
- PlayerUnknown's Battlegrounds

**Assessment:** REPLACE

**Reason:** السؤال ينطبق على عدة ألعاب باتل رويال (PUBG, Fortnite, Warzone). يحتاج إشارة مميزة لإيرنغل/الطائرة العسكرية.

### 3. `games-3`

**Category:** ألعاب

**Question:** في أي لعبة توجد مدينة Los Santos؟

**Current answers:**
- GTA V
- GTA 5
- قراند 5
- Grand Theft Auto V

**Recommended accepted answers:**
- GTA V
- GTA 5
- قراند 5
- Grand Theft Auto V

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 4. `games-4`

**Category:** ألعاب

**Question:** ما اسم لعبة السيارات التي تلعب فيها كرة قدم بالسيارات؟

**Current answers:**
- Rocket League
- روكيت ليق
- روكيت ليغ

**Recommended accepted answers:**
- Rocket League
- روكيت ليق
- روكيت ليغ

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 5. `games-5`

**Category:** ألعاب

**Question:** في أي لعبة يظهر العميل Jett؟

**Current answers:**
- Valorant
- فالورانت

**Recommended accepted answers:**
- Valorant
- فالورانت

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 6. `games-6`

**Category:** ألعاب

**Question:** ما اسم لعبة التصويب الشهيرة التي تحتوي على خرائط مثل Dust II؟

**Current answers:**
- Counter-Strike
- كاونتر سترايك
- CS
- CS2

**Recommended accepted answers:**
- Counter-Strike
- كاونتر سترايك
- CS
- CS2

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 7. `games-7`

**Category:** ألعاب

**Question:** في أي لعبة يظهر البطل Tracer؟

**Current answers:**
- Overwatch
- أوفرواتش

**Recommended accepted answers:**
- Overwatch
- أوفرواتش

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 8. `games-8`

**Category:** ألعاب

**Question:** ما اسم اللعبة التي يكون فيها بعض اللاعبين Impostors؟

**Current answers:**
- Among Us
- امونغ اس

**Recommended accepted answers:**
- Among Us
- امونغ اس

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 9. `games-9`

**Category:** ألعاب

**Question:** في أي لعبة يظهر Joel وEllie؟

**Current answers:**
- The Last of Us
- ذا لاست أوف أس

**Recommended accepted answers:**
- The Last of Us
- ذا لاست أوف أس

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 10. `games-10`

**Category:** ألعاب

**Question:** ما اسم لعبة العالم المفتوح التي بطلها Arthur Morgan؟

**Current answers:**
- Red Dead Redemption 2
- ريد ديد 2
- RDR2

**Recommended accepted answers:**
- Red Dead Redemption 2
- ريد ديد 2
- RDR2

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 11. `games-11`

**Category:** ألعاب

**Question:** ما سلسلة ألعاب الرعب الشهيرة التي تحتوي على شخصيات مثل Leon Kennedy؟

**Current answers:**
- Resident Evil
- ريزدنت إيفل
- رزدنت ايفل

**Recommended accepted answers:**
- Resident Evil
- ريزدنت إيفل
- رزدنت ايفل

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 12. `games-12`

**Category:** ألعاب

**Question:** في أي سلسلة ألعاب يظهر Ezio Auditore؟

**Current answers:**
- Assassin’s Creed
- اساسنز كريد

**Recommended accepted answers:**
- Assassin’s Creed
- اساسنز كريد

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 13. `games-13`

**Category:** ألعاب

**Question:** ما اسم سلسلة الألعاب التي بطلها Kratos؟

**Current answers:**
- God of War
- قاد أوف وور
- جاد أوف وور

**Recommended accepted answers:**
- God of War
- قاد أوف وور
- جاد أوف وور

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 14. `games-14`

**Category:** ألعاب

**Question:** في أي لعبة يظهر عالم The Lands Between؟

**Current answers:**
- Elden Ring
- إلدن رينغ
- الدن رينق

**Recommended accepted answers:**
- Elden Ring
- إلدن رينغ
- الدن رينق

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 15. `games-15`

**Category:** ألعاب

**Question:** ما اسم اللعبة التي تحتوي على شخصيات مثل Iron Man وSpider-Man وDoctor Strange في مواجهات جماعية؟

**Current answers:**
- Marvel Rivals
- مارفل رايفلز
- مارفل ريفالز

**Recommended accepted answers:**
- Marvel Rivals
- مارفل رايفلز
- مارفل ريفالز

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 16. `games-16`

**Category:** ألعاب

**Question:** ما اسم لعبة كرة القدم التي كانت تصدر سابقًا باسم FIFA وأصبحت EA Sports FC؟

**Current answers:**
- EA Sports FC
- EA FC
- فيفا
- FIFA

**Recommended accepted answers:**
- EA Sports FC
- EA FC
- فيفا
- FIFA

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 17. `games-17`

**Category:** ألعاب

**Question:** في أي لعبة يظهر بطل اسمه Geralt؟

**Current answers:**
- The Witcher 3
- ويتشر 3
- The Witcher

**Recommended accepted answers:**
- The Witcher 3
- ويتشر 3
- The Witcher

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 18. `games-18`

**Category:** ألعاب

**Question:** ما اسم لعبة الباتل رويال الشهيرة من Epic Games؟

**Current answers:**
- Fortnite
- فورتنايت

**Recommended accepted answers:**
- Fortnite
- فورتنايت

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 19. `games-19`

**Category:** ألعاب

**Question:** ما اسم لعبة التصويب التي تحتوي على طور Warzone؟

**Current answers:**
- Call of Duty
- كول أوف ديوتي
- COD

**Recommended accepted answers:**
- Call of Duty
- كول أوف ديوتي
- COD

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

### 20. `games-20`

**Category:** ألعاب

**Question:** ما اسم لعبة Spider-Man الشهيرة من Insomniac؟

**Current answers:**
- Marvel’s Spider-Man
- Spider-Man
- سبايدرمان

**Recommended accepted answers:**
- Marvel’s Spider-Man
- Spider-Man
- سبايدرمان

**Assessment:** KEEP

**Reason:** سؤال واضح، إجابة محددة، ومناسب للعب الجماعي السريع.

# من كتبها؟

**Game id:** `who-wrote-it`

**Settings:** `{"minPlayers":3,"maxPlayers":20,"rounds":3,"enabledCategories":[]}`

## من كتبها؟ — مواقف مضحكة

**Category id:** `funny-situations` · **enabled:** true · **count:** 15

### 1. `funny-situations-1`

**Category:** مواقف مضحكة

**Prompt:** وش أغبى شيء سويته وأنت متأكد وقتها إنه فكرة ممتازة؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 2. `funny-situations-2`

**Category:** مواقف مضحكة

**Prompt:** وش أكثر موقف ضحكت فيه بوقت المفروض ما تضحك؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 3. `funny-situations-3`

**Category:** مواقف مضحكة

**Prompt:** وش أغرب عذر قد استخدمته عشان تلغي طلعة؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 4. `funny-situations-4`

**Category:** مواقف مضحكة

**Prompt:** وش أسوأ طبخة أو مشروب حاولت تسويه؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 5. `funny-situations-5`

**Category:** مواقف مضحكة

**Prompt:** وش أكثر مرة انقفطت وأنت تسوي شيء ما تبغى أحد يشوفه؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 6. `funny-situations-6`

**Category:** مواقف مضحكة

**Prompt:** وش أغرب شيء اشتريته وندمت عليه؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 7. `funny-situations-7`

**Category:** مواقف مضحكة

**Prompt:** وش أكثر موقف محرج صار لك قدام ناس كثير؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 8. `funny-situations-8`

**Category:** مواقف مضحكة

**Prompt:** وش أغبى إصابة صارت لك؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 9. `funny-situations-9`

**Category:** مواقف مضحكة

**Prompt:** وش أكثر شيء ضيعته بطريقة غبية؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 10. `funny-situations-10`

**Category:** مواقف مضحكة

**Prompt:** وش أسوأ رسالة أرسلتها للشخص الغلط؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 11. `funny-situations-11`

**Category:** مواقف مضحكة

**Prompt:** وش موقف حاولت تتصرف فيه طبيعي وأنت من داخلك منهار؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 12. `funny-situations-12`

**Category:** مواقف مضحكة

**Prompt:** وش أغرب شيء صدقته وأنت صغير؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 13. `funny-situations-13`

**Category:** مواقف مضحكة

**Prompt:** وش أكثر مرة دخلت مكان غلط بدون ما تنتبه؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 14. `funny-situations-14`

**Category:** مواقف مضحكة

**Prompt:** وش أغرب حلم تتذكره؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 15. `funny-situations-15`

**Category:** مواقف مضحكة

**Prompt:** وش أكثر شيء سويته عشان تطلع من موقف محرج؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

## من كتبها؟ — اعترافات

**Category id:** `confessions` · **enabled:** true · **count:** 15

### 1. `confessions-1`

**Category:** اعترافات

**Prompt:** وش عادة عندك تعرف إنها مزعجة بس ما وقفتها؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 2. `confessions-2`

**Category:** اعترافات

**Prompt:** وش شيء تدّعي إنك تعرفه وأنت فعليًا ما تعرف عنه شيء؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 3. `confessions-3`

**Category:** اعترافات

**Prompt:** وش أكثر شيء تسوّف فيه دائمًا؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 4. `confessions-4`

**Category:** اعترافات

**Prompt:** وش شيء اشتريته بس عشان الناس تمدحه؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 5. `confessions-5`

**Category:** اعترافات

**Prompt:** وش آخر كذبة بيضاء قلتها؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 6. `confessions-6`

**Category:** اعترافات

**Prompt:** وش شيء تحكم على الناس عليه بسرعة؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 7. `confessions-7`

**Category:** اعترافات

**Prompt:** وش أكثر تطبيق تفتحه بدون سبب؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 8. `confessions-8`

**Category:** اعترافات

**Prompt:** وش شيء مستحيل تعترف فيه بسهولة قدام أهلك؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 9. `confessions-9`

**Category:** اعترافات

**Prompt:** وش عادة طفولية للحين تسويها؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 10. `confessions-10`

**Category:** اعترافات

**Prompt:** وش شيء تقول إنك ما تهتم فيه لكن فعليًا يفرق معك؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 11. `confessions-11`

**Category:** اعترافات

**Prompt:** وش أكثر شيء تضيع وقتك فيه؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 12. `confessions-12`

**Category:** اعترافات

**Prompt:** وش شيء مرة بالغت فيه عشان تطلع بصورة أفضل؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 13. `confessions-13`

**Category:** اعترافات

**Prompt:** وش شيء تخاف أحد يفتح جوالك ويشوفه؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 14. `confessions-14`

**Category:** اعترافات

**Prompt:** وش أكثر شيء تقول ببدأ بكرة عنه؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 15. `confessions-15`

**Category:** اعترافات

**Prompt:** وش رأي عندك غالبًا ما تقوله بصوت عالي؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

## من كتبها؟ — أسئلة شخصية خفيفة

**Category id:** `light-personal` · **enabled:** true · **count:** 15

### 1. `light-personal-1`

**Category:** أسئلة شخصية خفيفة

**Prompt:** وش أكثر شيء يرفع مزاجك بسرعة؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 2. `light-personal-2`

**Category:** أسئلة شخصية خفيفة

**Prompt:** وش مكان تقدر تجلس فيه ساعات بدون ما تمل؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 3. `light-personal-3`

**Category:** أسئلة شخصية خفيفة

**Prompt:** وش أكثر صفة تحبها في أصحابك؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 4. `light-personal-4`

**Category:** أسئلة شخصية خفيفة

**Prompt:** وش شيء بسيط يزعجك بشكل مبالغ؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 5. `light-personal-5`

**Category:** أسئلة شخصية خفيفة

**Prompt:** وش أكثر شيء تسويه إذا طفشت؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 6. `light-personal-6`

**Category:** أسئلة شخصية خفيفة

**Prompt:** وش أفضل وقت في اليوم بالنسبة لك؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 7. `light-personal-7`

**Category:** أسئلة شخصية خفيفة

**Prompt:** وش شيء نفسك تتعلمه قريب؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 8. `light-personal-8`

**Category:** أسئلة شخصية خفيفة

**Prompt:** وش أكثر أكلة ممكن تأكلها أكثر من مرة بالأسبوع؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 9. `light-personal-9`

**Category:** أسئلة شخصية خفيفة

**Prompt:** وش نوع الطلعات اللي تفضلها؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 10. `light-personal-10`

**Category:** أسئلة شخصية خفيفة

**Prompt:** وش شيء صغير ممكن يخرب يومك؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 11. `light-personal-11`

**Category:** أسئلة شخصية خفيفة

**Prompt:** وش أكثر شيء يحمسك للسفر؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 12. `light-personal-12`

**Category:** أسئلة شخصية خفيفة

**Prompt:** وش شيء تتمنى الناس تفهمه عنك بدون ما تشرحه؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 13. `light-personal-13`

**Category:** أسئلة شخصية خفيفة

**Prompt:** وش أفضل هدية ممكن أحد يعطيك إياها؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 14. `light-personal-14`

**Category:** أسئلة شخصية خفيفة

**Prompt:** وش شيء مستحيل تتنازل عنه في يومك؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 15. `light-personal-15`

**Category:** أسئلة شخصية خفيفة

**Prompt:** وش الشيء اللي لو اختفى من حياتك أسبوع بتتضايق جدًا؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

## من كتبها؟ — ماذا ستفعل؟

**Category id:** `what-would-you-do` · **enabled:** true · **count:** 15

### 1. `what-would-you-do-1`

**Category:** ماذا ستفعل؟

**Prompt:** لو صحيت ولقيت مليون ريال بحسابك، وش أول شيء تسويه؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 2. `what-would-you-do-2`

**Category:** ماذا ستفعل؟

**Prompt:** لو قدرت تعيش سنة في أي دولة، وين تختار؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 3. `what-would-you-do-3`

**Category:** ماذا ستفعل؟

**Prompt:** لو انحبست بمصعد مع شخص من الموجودين، مين تختار؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 4. `what-would-you-do-4`

**Category:** ماذا ستفعل؟

**Prompt:** لو تقدر ترجع يوم واحد من حياتك، أي يوم تختار؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 5. `what-would-you-do-5`

**Category:** ماذا ستفعل؟

**Prompt:** لو عطوك تذكرة سفر الآن بدون رجعة لمدة شهر، وين تروح؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 6. `what-would-you-do-6`

**Category:** ماذا ستفعل؟

**Prompt:** لو اضطريت تحذف كل التطبيقات إلا ثلاثة، وش تخلي؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 7. `what-would-you-do-7`

**Category:** ماذا ستفعل؟

**Prompt:** لو صرت مشهور بكرة، وش أول شيء تخاف يصير؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 8. `what-would-you-do-8`

**Category:** ماذا ستفعل؟

**Prompt:** لو تقدر تبدل حياتك مع شخص لمدة يوم، مين تختار؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 9. `what-would-you-do-9`

**Category:** ماذا ستفعل؟

**Prompt:** لو لازم تأكل أكلة وحدة أسبوع كامل، وش تختار؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 10. `what-would-you-do-10`

**Category:** ماذا ستفعل؟

**Prompt:** لو أعطوك قدرة خارقة لمدة 24 ساعة، وش تختار؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 11. `what-would-you-do-11`

**Category:** ماذا ستفعل؟

**Prompt:** لو تقدر توقف الزمن لمدة ساعة، وش بتسوي؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 12. `what-would-you-do-12`

**Category:** ماذا ستفعل؟

**Prompt:** لو لازم تعيش بدون جوال أو بدون سيارة سنة، وش تختار؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 13. `what-would-you-do-13`

**Category:** ماذا ستفعل؟

**Prompt:** لو تقدر تمسح موقف محرج من ذاكرتك، وش هو؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 14. `what-would-you-do-14`

**Category:** ماذا ستفعل؟

**Prompt:** لو أحد عطاك فرصة تبدأ مشروع الآن، وش بتسوي؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 15. `what-would-you-do-15`

**Category:** ماذا ستفعل؟

**Prompt:** لو لازم تختار شخص من القروب يكون مديرك سنة، مين تختار؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

# القاضي

**Game id:** `judge`

**Settings:** `{"minPlayers":3,"maxPlayers":20,"rounds":4,"enabledCategories":[]}`

## القاضي — أسوأ إجابة ممكنة

**Category id:** `worst-answer` · **enabled:** true · **count:** 15

### 1. `worst-answer-1`

**Category:** أسوأ إجابة ممكنة

**Prompt:** عطنا أسوأ عذر ممكن تقوله إذا تأخرت ساعتين.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 2. `worst-answer-2`

**Category:** أسوأ إجابة ممكنة

**Prompt:** وش أسوأ شيء ممكن تقوله في أول موعد؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 3. `worst-answer-3`

**Category:** أسوأ إجابة ممكنة

**Prompt:** وش أسوأ رد ممكن ترسله لشخص قال لك اشتقت لك؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 4. `worst-answer-4`

**Category:** أسوأ إجابة ممكنة

**Prompt:** وش أسوأ سبب ممكن يخليك تنطرد من وظيفة بأول يوم؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 5. `worst-answer-5`

**Category:** أسوأ إجابة ممكنة

**Prompt:** وش أسوأ شيء ممكن تسمعه من الدكتور قبل العملية؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 6. `worst-answer-6`

**Category:** أسوأ إجابة ممكنة

**Prompt:** وش أسوأ نصيحة ممكن تعطيها لشخص داخل اختبار؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 7. `worst-answer-7`

**Category:** أسوأ إجابة ممكنة

**Prompt:** وش أسوأ جملة ممكن تقولها في مقابلة عمل؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 8. `worst-answer-8`

**Category:** أسوأ إجابة ممكنة

**Prompt:** وش أسوأ اسم ممكن تسمي فيه مطعم فاخر؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 9. `worst-answer-9`

**Category:** أسوأ إجابة ممكنة

**Prompt:** وش أسوأ شيء ممكن تقوله لشخص توه قص شعره؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 10. `worst-answer-10`

**Category:** أسوأ إجابة ممكنة

**Prompt:** وش أسوأ رد ممكن تقوله إذا أحد قال لك عندي خبر مهم؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 11. `worst-answer-11`

**Category:** أسوأ إجابة ممكنة

**Prompt:** وش أسوأ هدية ممكن تعطيها لشخص في عيد ميلاده؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 12. `worst-answer-12`

**Category:** أسوأ إجابة ممكنة

**Prompt:** وش أسوأ شيء ممكن تسويه في عزيمة رسمية؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 13. `worst-answer-13`

**Category:** أسوأ إجابة ممكنة

**Prompt:** وش أسوأ اسم ممكن تعطيه لطفلك؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 14. `worst-answer-14`

**Category:** أسوأ إجابة ممكنة

**Prompt:** وش أسوأ عذر ممكن تستخدمه عشان ما ترد على أحد أسبوع؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 15. `worst-answer-15`

**Category:** أسوأ إجابة ممكنة

**Prompt:** وش أسوأ شيء ممكن تحطه في سيرتك الذاتية؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

## القاضي — اخترع شيء غبي

**Category id:** `invent-something-silly` · **enabled:** true · **count:** 15

### 1. `invent-something-silly-1`

**Category:** اخترع شيء غبي

**Prompt:** اخترع اسم تطبيق محد طلبه لكن تتوقع ينجح.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 2. `invent-something-silly-2`

**Category:** اخترع شيء غبي

**Prompt:** اخترع منتج غبي ممكن ينباع بمليون ريال.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 3. `invent-something-silly-3`

**Category:** اخترع شيء غبي

**Prompt:** اخترع رياضة جديدة محد يفهم قوانينها.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 4. `invent-something-silly-4`

**Category:** اخترع شيء غبي

**Prompt:** اخترع اسم مطعم سيئ جدًا.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 5. `invent-something-silly-5`

**Category:** اخترع شيء غبي

**Prompt:** اخترع وظيفة ما لها أي فايدة.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 6. `invent-something-silly-6`

**Category:** اخترع شيء غبي

**Prompt:** اخترع جهاز يحل مشكلة غير موجودة.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 7. `invent-something-silly-7`

**Category:** اخترع شيء غبي

**Prompt:** اخترع مادة دراسية جديدة للجامعة.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 8. `invent-something-silly-8`

**Category:** اخترع شيء غبي

**Prompt:** اخترع اسم شركة تقنية فاشلة.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 9. `invent-something-silly-9`

**Category:** اخترع شيء غبي

**Prompt:** اخترع لعبة فيديو فكرتها سيئة جدًا.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 10. `invent-something-silly-10`

**Category:** اخترع شيء غبي

**Prompt:** اخترع قانون جديد للمدرسة الكل بيكرهه.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 11. `invent-something-silly-11`

**Category:** اخترع شيء غبي

**Prompt:** اخترع اسم عصير ما أحد بيطلبه.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 12. `invent-something-silly-12`

**Category:** اخترع شيء غبي

**Prompt:** اخترع تطبيق مواعدة بطريقة كارثية.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 13. `invent-something-silly-13`

**Category:** اخترع شيء غبي

**Prompt:** اخترع سوبرهيرو قوته ما لها فايدة.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 14. `invent-something-silly-14`

**Category:** اخترع شيء غبي

**Prompt:** اخترع اسم فرقة موسيقية غريب جدًا.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 15. `invent-something-silly-15`

**Category:** اخترع شيء غبي

**Prompt:** اخترع خدمة اشتراك شهرية محد يحتاجها.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

## القاضي — سيناريوهات غريبة

**Category id:** `weird-scenarios` · **enabled:** true · **count:** 15

### 1. `weird-scenarios-1`

**Category:** سيناريوهات غريبة

**Prompt:** صحيت ولقيت نفسك رئيس دولة لمدة يوم، وش أول قرار تسويه؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 2. `weird-scenarios-2`

**Category:** سيناريوهات غريبة

**Prompt:** فجأة كل الحيوانات صارت تتكلم، أي حيوان بيكون أكثر واحد مزعج؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 3. `weird-scenarios-3`

**Category:** سيناريوهات غريبة

**Prompt:** صحيت ولقيت نفسك مشهور عالميًا بدون سبب، وش أول شيء تسويه؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 4. `weird-scenarios-4`

**Category:** سيناريوهات غريبة

**Prompt:** لو صار ممنوع استخدام الجوال أسبوع كامل، وش أكثر شيء الناس بتسويه بدلًا منه؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 5. `weird-scenarios-5`

**Category:** سيناريوهات غريبة

**Prompt:** لو تقدر تضيف زر واحد جديد في جسم الإنسان، وش يسوي؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 6. `weird-scenarios-6`

**Category:** سيناريوهات غريبة

**Prompt:** لو البشر صاروا ينامون ساعة وحدة فقط يوميًا، وش بيتغير؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 7. `weird-scenarios-7`

**Category:** سيناريوهات غريبة

**Prompt:** لو صار عندك ريموت يتحكم بالناس، وش أول زر تضيفه؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 8. `weird-scenarios-8`

**Category:** سيناريوهات غريبة

**Prompt:** لو صرت شبح لمدة 24 ساعة، وش أول شيء تسويه؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 9. `weird-scenarios-9`

**Category:** سيناريوهات غريبة

**Prompt:** لو كل شخص لازم يلبس زي موحد حسب شخصيته، وش يكون زيك؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 10. `weird-scenarios-10`

**Category:** سيناريوهات غريبة

**Prompt:** لو قدرت تغير صوتك لأي صوت بالعالم، وش تختار؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 11. `weird-scenarios-11`

**Category:** سيناريوهات غريبة

**Prompt:** لو كل كذبة تقولها تطلع فوق رأسك كتابة، وش بيصير؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 12. `weird-scenarios-12`

**Category:** سيناريوهات غريبة

**Prompt:** لو صار لازم تختار حيوان يكون مديرك، وش تختار؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 13. `weird-scenarios-13`

**Category:** سيناريوهات غريبة

**Prompt:** لو الإنترنت اختفى للأبد، وش أول شيء بينهار؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 14. `weird-scenarios-14`

**Category:** سيناريوهات غريبة

**Prompt:** لو كل شخص عنده موسيقى دخول مثل المصارعين، وش تكون موسيقاك؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 15. `weird-scenarios-15`

**Category:** سيناريوهات غريبة

**Prompt:** لو قدرت تعيش داخل لعبة أسبوع، أي لعبة تختار؟

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

## القاضي — كمل الجملة

**Category id:** `complete-the-sentence` · **enabled:** true · **count:** 15

### 1. `complete-the-sentence-1`

**Category:** كمل الجملة

**Prompt:** أكثر شيء يخوفني مو الموت، هو...

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 2. `complete-the-sentence-2`

**Category:** كمل الجملة

**Prompt:** لو انقفطت وأنا أسوي شيء غريب، غالبًا بيكون...

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 3. `complete-the-sentence-3`

**Category:** كمل الجملة

**Prompt:** لو صرت مشهور، أول فضيحة لي بتكون...

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 4. `complete-the-sentence-4`

**Category:** كمل الجملة

**Prompt:** أكثر شيء ممكن يخليني أهرب من عزيمة هو...

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 5. `complete-the-sentence-5`

**Category:** كمل الجملة

**Prompt:** لو عندي مليون ريال وما أقدر أصرفها إلا على شيء غبي، بشتري...

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 6. `complete-the-sentence-6`

**Category:** كمل الجملة

**Prompt:** أسوأ شيء ممكن يصير في أول يوم دوام هو...

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 7. `complete-the-sentence-7`

**Category:** كمل الجملة

**Prompt:** لو فتحت مطعم، الشيء الممنوع فيه بيكون...

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 8. `complete-the-sentence-8`

**Category:** كمل الجملة

**Prompt:** أكثر شيء يخليك تعرف إن الطلعة فاشلة من بدايتها هو...

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 9. `complete-the-sentence-9`

**Category:** كمل الجملة

**Prompt:** لو كنت شرير في فيلم، خطتي الغبية بتكون...

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 10. `complete-the-sentence-10`

**Category:** كمل الجملة

**Prompt:** لو حياتي مسلسل، اسم الحلقة الحالية بيكون...

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 11. `complete-the-sentence-11`

**Category:** كمل الجملة

**Prompt:** الشيء اللي مستحيل أشارك أحد فيه هو...

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 12. `complete-the-sentence-12`

**Category:** كمل الجملة

**Prompt:** لو انحطيت في برنامج واقع، أول مشكلة بسويها هي...

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 13. `complete-the-sentence-13`

**Category:** كمل الجملة

**Prompt:** أغبى شيء ممكن أصير مشهور بسببه هو...

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 14. `complete-the-sentence-14`

**Category:** كمل الجملة

**Prompt:** لو عندي قانون خاص فيني، أول قانون بيكون...

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 15. `complete-the-sentence-15`

**Category:** كمل الجملة

**Prompt:** الشيء اللي لو صار اليوم بقول خلاص كفاية هو...

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

## القاضي — تحديات الرد السريع

**Category id:** `rapid-response` · **enabled:** true · **count:** 15

### 1. `rapid-response-1`

**Category:** تحديات الرد السريع

**Prompt:** عطنا سبب غبي يخليك تطرد شخص من القروب.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 2. `rapid-response-2`

**Category:** تحديات الرد السريع

**Prompt:** عطنا اسم Wi-Fi يخلي الجيران يشكون فيك.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 3. `rapid-response-3`

**Category:** تحديات الرد السريع

**Prompt:** عطنا اسم فيلم عن حياتك.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 4. `rapid-response-4`

**Category:** تحديات الرد السريع

**Prompt:** عطنا لقب سيئ جدًا لصاحبك.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 5. `rapid-response-5`

**Category:** تحديات الرد السريع

**Prompt:** عطنا جملة تخرب أي موعد رومانسي.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 6. `rapid-response-6`

**Category:** تحديات الرد السريع

**Prompt:** عطنا شيء غريب تحطه في حقيبة سفر.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 7. `rapid-response-7`

**Category:** تحديات الرد السريع

**Prompt:** عطنا اسم كوفي مستحيل تدخله.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 8. `rapid-response-8`

**Category:** تحديات الرد السريع

**Prompt:** عطنا شيء تشتريه لو كنت مليونيرًا بشكل غير مسؤول.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 9. `rapid-response-9`

**Category:** تحديات الرد السريع

**Prompt:** عطنا سبب غريب جدًا يمنعك من الزواج.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 10. `rapid-response-10`

**Category:** تحديات الرد السريع

**Prompt:** عطنا شيء لو شفته في بيت شخص بتطلع فورًا.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 11. `rapid-response-11`

**Category:** تحديات الرد السريع

**Prompt:** عطنا اسم وظيفة تتوقع ما تصمد فيها يوم.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 12. `rapid-response-12`

**Category:** تحديات الرد السريع

**Prompt:** عطنا شيء محد المفروض يقوله في جنازة.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 13. `rapid-response-13`

**Category:** تحديات الرد السريع

**Prompt:** عطنا شيء ما ينفع أبدًا يكون اسم طفل.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 14. `rapid-response-14`

**Category:** تحديات الرد السريع

**Prompt:** عطنا سبب يخليك تنسحب من طلعة بعد ما وصلت.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

### 15. `rapid-response-15`

**Category:** تحديات الرد السريع

**Prompt:** عطنا شيء ممكن يخرب قروب أصدقاء كامل.

**Aliases:** none (prompt games do not use typed answers)

**Assessment:** KEEP

**Reason:** نص مناسب لميكانيك اللعبة ولا يحتاج استبدالًا.

# تحدي التخمين

**Game id:** `guessing-challenge`

**Settings:** `{"minPlayers":2,"maxPlayers":4,"rounds":4,"mode":"1v1","enabledCategories":[]}`

## تحدي التخمين — حيوانات

**Category id:** `animals` · **enabled:** true · **count:** 20

### 1. `animals-1`

**Category:** حيوانات

**Identity / prompt shown:** أسد

**Current answers:**
- أسد

**Recommended accepted answers:**
- أسد

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 2. `animals-2`

**Category:** حيوانات

**Identity / prompt shown:** نمر

**Current answers:**
- نمر

**Recommended accepted answers:**
- نمر

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 3. `animals-3`

**Category:** حيوانات

**Identity / prompt shown:** فيل

**Current answers:**
- فيل

**Recommended accepted answers:**
- فيل

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 4. `animals-4`

**Category:** حيوانات

**Identity / prompt shown:** زرافة

**Current answers:**
- زرافة

**Recommended accepted answers:**
- زرافة

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 5. `animals-5`

**Category:** حيوانات

**Identity / prompt shown:** قرد

**Current answers:**
- قرد

**Recommended accepted answers:**
- قرد

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 6. `animals-6`

**Category:** حيوانات

**Identity / prompt shown:** دب

**Current answers:**
- دب

**Recommended accepted answers:**
- دب

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 7. `animals-7`

**Category:** حيوانات

**Identity / prompt shown:** ذئب

**Current answers:**
- ذئب

**Recommended accepted answers:**
- ذئب

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 8. `animals-8`

**Category:** حيوانات

**Identity / prompt shown:** ثعلب

**Current answers:**
- ثعلب

**Recommended accepted answers:**
- ثعلب

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 9. `animals-9`

**Category:** حيوانات

**Identity / prompt shown:** أرنب

**Current answers:**
- أرنب

**Recommended accepted answers:**
- أرنب

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 10. `animals-10`

**Category:** حيوانات

**Identity / prompt shown:** جمل

**Current answers:**
- جمل

**Recommended accepted answers:**
- جمل

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 11. `animals-11`

**Category:** حيوانات

**Identity / prompt shown:** حصان

**Current answers:**
- حصان

**Recommended accepted answers:**
- حصان

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 12. `animals-12`

**Category:** حيوانات

**Identity / prompt shown:** تمساح

**Current answers:**
- تمساح

**Recommended accepted answers:**
- تمساح

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 13. `animals-13`

**Category:** حيوانات

**Identity / prompt shown:** ثعبان

**Current answers:**
- ثعبان

**Recommended accepted answers:**
- ثعبان

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 14. `animals-14`

**Category:** حيوانات

**Identity / prompt shown:** بطريق

**Current answers:**
- بطريق

**Recommended accepted answers:**
- بطريق

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 15. `animals-15`

**Category:** حيوانات

**Identity / prompt shown:** دلفين

**Current answers:**
- دلفين

**Recommended accepted answers:**
- دلفين

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 16. `animals-16`

**Category:** حيوانات

**Identity / prompt shown:** أخطبوط

**Current answers:**
- أخطبوط

**Recommended accepted answers:**
- أخطبوط

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 17. `animals-17`

**Category:** حيوانات

**Identity / prompt shown:** سلحفاة

**Current answers:**
- سلحفاة

**Recommended accepted answers:**
- سلحفاة

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 18. `animals-18`

**Category:** حيوانات

**Identity / prompt shown:** كنغر

**Current answers:**
- كنغر

**Recommended accepted answers:**
- كنغر

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 19. `animals-19`

**Category:** حيوانات

**Identity / prompt shown:** باندا

**Current answers:**
- باندا

**Recommended accepted answers:**
- باندا

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 20. `animals-20`

**Category:** حيوانات

**Identity / prompt shown:** حوت أزرق

**Current answers:**
- حوت أزرق
- الحوت الأزرق

**Recommended accepted answers:**
- حوت أزرق
- الحوت الأزرق

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

## تحدي التخمين — أكلات

**Category id:** `food` · **enabled:** true · **count:** 20

### 1. `food-1`

**Category:** أكلات

**Identity / prompt shown:** بيتزا

**Current answers:**
- بيتزا
- Pizza

**Recommended accepted answers:**
- بيتزا
- Pizza

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 2. `food-2`

**Category:** أكلات

**Identity / prompt shown:** برغر

**Current answers:**
- برغر
- برجر
- Burger

**Recommended accepted answers:**
- برغر
- برجر
- Burger

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 3. `food-3`

**Category:** أكلات

**Identity / prompt shown:** شاورما

**Current answers:**
- شاورما
- Shawarma

**Recommended accepted answers:**
- شاورما
- Shawarma

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 4. `food-4`

**Category:** أكلات

**Identity / prompt shown:** كبسة

**Current answers:**
- كبسة
- Kabsa

**Recommended accepted answers:**
- كبسة
- Kabsa

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 5. `food-5`

**Category:** أكلات

**Identity / prompt shown:** مندي

**Current answers:**
- مندي

**Recommended accepted answers:**
- مندي

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 6. `food-6`

**Category:** أكلات

**Identity / prompt shown:** فلافل

**Current answers:**
- فلافل
- طعمية

**Recommended accepted answers:**
- فلافل
- طعمية

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 7. `food-7`

**Category:** أكلات

**Identity / prompt shown:** حمص

**Current answers:**
- حمص

**Recommended accepted answers:**
- حمص

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 8. `food-8`

**Category:** أكلات

**Identity / prompt shown:** كنافة

**Current answers:**
- كنافة

**Recommended accepted answers:**
- كنافة

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 9. `food-9`

**Category:** أكلات

**Identity / prompt shown:** سوشي

**Current answers:**
- سوشي
- Sushi

**Recommended accepted answers:**
- سوشي
- Sushi

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 10. `food-10`

**Category:** أكلات

**Identity / prompt shown:** آيس كريم

**Current answers:**
- آيس كريم
- مثلجات
- Ice cream

**Recommended accepted answers:**
- آيس كريم
- مثلجات
- Ice cream

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 11. `food-11`

**Category:** أكلات

**Identity / prompt shown:** دونات

**Current answers:**
- دونات
- دونت
- Donut
- Doughnut

**Recommended accepted answers:**
- دونات
- دونت
- Donut
- Doughnut

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 12. `food-12`

**Category:** أكلات

**Identity / prompt shown:** بان كيك

**Current answers:**
- بان كيك
- Pancake
- Pancakes

**Recommended accepted answers:**
- بان كيك
- Pancake
- Pancakes

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 13. `food-13`

**Category:** أكلات

**Identity / prompt shown:** وافل

**Current answers:**
- وافل
- Waffle
- Waffles

**Recommended accepted answers:**
- وافل
- Waffle
- Waffles

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 14. `food-14`

**Category:** أكلات

**Identity / prompt shown:** سمبوسة

**Current answers:**
- سمبوسة
- سمبوسك
- Samosa

**Recommended accepted answers:**
- سمبوسة
- سمبوسك
- Samosa

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 15. `food-15`

**Category:** أكلات

**Identity / prompt shown:** تشيز كيك

**Current answers:**
- تشيز كيك
- Cheesecake
- Cheese cake

**Recommended accepted answers:**
- تشيز كيك
- Cheesecake
- Cheese cake

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 16. `food-16`

**Category:** أكلات

**Identity / prompt shown:** بطيخ

**Current answers:**
- بطيخ
- حبحب

**Recommended accepted answers:**
- بطيخ
- حبحب

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 17. `food-17`

**Category:** أكلات

**Identity / prompt shown:** أناناس

**Current answers:**
- أناناس
- Pineapple

**Recommended accepted answers:**
- أناناس
- Pineapple

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 18. `food-18`

**Category:** أكلات

**Identity / prompt shown:** فراولة

**Current answers:**
- فراولة
- Strawberry

**Recommended accepted answers:**
- فراولة
- Strawberry

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 19. `food-19`

**Category:** أكلات

**Identity / prompt shown:** فشار

**Current answers:**
- فشار
- بوشار
- Popcorn

**Recommended accepted answers:**
- فشار
- بوشار
- Popcorn

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 20. `food-20`

**Category:** أكلات

**Identity / prompt shown:** شوكولاتة

**Current answers:**
- شوكولاتة

**Recommended accepted answers:**
- شوكولاتة

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

## تحدي التخمين — بلدان

**Category id:** `countries` · **enabled:** true · **count:** 20

### 1. `countries-1`

**Category:** بلدان

**Identity / prompt shown:** السعودية

**Current answers:**
- السعودية
- المملكة العربية السعودية
- Saudi Arabia

**Recommended accepted answers:**
- السعودية
- المملكة العربية السعودية
- Saudi Arabia

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 2. `countries-2`

**Category:** بلدان

**Identity / prompt shown:** الأردن

**Current answers:**
- الأردن

**Recommended accepted answers:**
- الأردن

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 3. `countries-3`

**Category:** بلدان

**Identity / prompt shown:** مصر

**Current answers:**
- مصر
- Egypt

**Recommended accepted answers:**
- مصر
- Egypt

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 4. `countries-4`

**Category:** بلدان

**Identity / prompt shown:** الإمارات

**Current answers:**
- الإمارات
- الإمارات العربية المتحدة
- UAE

**Recommended accepted answers:**
- الإمارات
- الإمارات العربية المتحدة
- UAE

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 5. `countries-5`

**Category:** بلدان

**Identity / prompt shown:** الكويت

**Current answers:**
- الكويت

**Recommended accepted answers:**
- الكويت

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 6. `countries-6`

**Category:** بلدان

**Identity / prompt shown:** قطر

**Current answers:**
- قطر

**Recommended accepted answers:**
- قطر

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 7. `countries-7`

**Category:** بلدان

**Identity / prompt shown:** البحرين

**Current answers:**
- البحرين

**Recommended accepted answers:**
- البحرين

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 8. `countries-8`

**Category:** بلدان

**Identity / prompt shown:** عُمان

**Current answers:**
- عُمان
- Amman

**Recommended accepted answers:**
- عُمان
- سلطنة عمان
- Oman

**Assessment:** FIX

**Reason:** خطأ واقعي: Amman هي عاصمة الأردن وليست اسم عُمان. احذف Amman وأضف Oman / سلطنة عمان.

### 9. `countries-9`

**Category:** بلدان

**Identity / prompt shown:** المغرب

**Current answers:**
- المغرب

**Recommended accepted answers:**
- المغرب

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 10. `countries-10`

**Category:** بلدان

**Identity / prompt shown:** تركيا

**Current answers:**
- تركيا
- Turkey

**Recommended accepted answers:**
- تركيا
- Turkey

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 11. `countries-11`

**Category:** بلدان

**Identity / prompt shown:** اليابان

**Current answers:**
- اليابان

**Recommended accepted answers:**
- اليابان

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 12. `countries-12`

**Category:** بلدان

**Identity / prompt shown:** الصين

**Current answers:**
- الصين

**Recommended accepted answers:**
- الصين

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 13. `countries-13`

**Category:** بلدان

**Identity / prompt shown:** الهند

**Current answers:**
- الهند
- India

**Recommended accepted answers:**
- الهند
- India

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 14. `countries-14`

**Category:** بلدان

**Identity / prompt shown:** فرنسا

**Current answers:**
- فرنسا
- France

**Recommended accepted answers:**
- فرنسا
- France

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 15. `countries-15`

**Category:** بلدان

**Identity / prompt shown:** إيطاليا

**Current answers:**
- إيطاليا
- Italy

**Recommended accepted answers:**
- إيطاليا
- Italy

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 16. `countries-16`

**Category:** بلدان

**Identity / prompt shown:** إسبانيا

**Current answers:**
- إسبانيا
- Spain

**Recommended accepted answers:**
- إسبانيا
- Spain

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 17. `countries-17`

**Category:** بلدان

**Identity / prompt shown:** ألمانيا

**Current answers:**
- ألمانيا

**Recommended accepted answers:**
- ألمانيا

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 18. `countries-18`

**Category:** بلدان

**Identity / prompt shown:** بريطانيا

**Current answers:**
- بريطانيا
- المملكة المتحدة
- UK
- United Kingdom

**Recommended accepted answers:**
- بريطانيا
- المملكة المتحدة
- UK
- United Kingdom

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 19. `countries-19`

**Category:** بلدان

**Identity / prompt shown:** أمريكا

**Current answers:**
- أمريكا
- الولايات المتحدة
- USA
- United States

**Recommended accepted answers:**
- أمريكا
- الولايات المتحدة
- USA
- United States

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 20. `countries-20`

**Category:** بلدان

**Identity / prompt shown:** البرازيل

**Current answers:**
- البرازيل

**Recommended accepted answers:**
- البرازيل

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

## تحدي التخمين — كرة قدم

**Category id:** `football` · **enabled:** true · **count:** 20

### 1. `football-1`

**Category:** كرة قدم

**Identity / prompt shown:** كريستيانو رونالدو

**Current answers:**
- كريستيانو رونالدو

**Recommended accepted answers:**
- كريستيانو رونالدو

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 2. `football-2`

**Category:** كرة قدم

**Identity / prompt shown:** ليونيل ميسي

**Current answers:**
- ليونيل ميسي

**Recommended accepted answers:**
- ليونيل ميسي

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 3. `football-3`

**Category:** كرة قدم

**Identity / prompt shown:** نيمار

**Current answers:**
- نيمار

**Recommended accepted answers:**
- نيمار

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 4. `football-4`

**Category:** كرة قدم

**Identity / prompt shown:** كيليان مبابي

**Current answers:**
- كيليان مبابي

**Recommended accepted answers:**
- كيليان مبابي

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 5. `football-5`

**Category:** كرة قدم

**Identity / prompt shown:** محمد صلاح

**Current answers:**
- محمد صلاح

**Recommended accepted answers:**
- محمد صلاح

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 6. `football-6`

**Category:** كرة قدم

**Identity / prompt shown:** كريم بنزيما

**Current answers:**
- كريم بنزيما

**Recommended accepted answers:**
- كريم بنزيما

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 7. `football-7`

**Category:** كرة قدم

**Identity / prompt shown:** لوكا مودريتش

**Current answers:**
- لوكا مودريتش

**Recommended accepted answers:**
- لوكا مودريتش

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 8. `football-8`

**Category:** كرة قدم

**Identity / prompt shown:** روبرت ليفاندوفسكي

**Current answers:**
- روبرت ليفاندوفسكي

**Recommended accepted answers:**
- روبرت ليفاندوفسكي

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 9. `football-9`

**Category:** كرة قدم

**Identity / prompt shown:** إيرلينغ هالاند

**Current answers:**
- إيرلينغ هالاند

**Recommended accepted answers:**
- إيرلينغ هالاند

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 10. `football-10`

**Category:** كرة قدم

**Identity / prompt shown:** فينيسيوس جونيور

**Current answers:**
- فينيسيوس جونيور

**Recommended accepted answers:**
- فينيسيوس جونيور

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 11. `football-11`

**Category:** كرة قدم

**Identity / prompt shown:** رونالدينيو

**Current answers:**
- رونالدينيو

**Recommended accepted answers:**
- رونالدينيو

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 12. `football-12`

**Category:** كرة قدم

**Identity / prompt shown:** زين الدين زيدان

**Current answers:**
- زين الدين زيدان

**Recommended accepted answers:**
- زين الدين زيدان

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 13. `football-13`

**Category:** كرة قدم

**Identity / prompt shown:** ديفيد بيكهام

**Current answers:**
- ديفيد بيكهام

**Recommended accepted answers:**
- ديفيد بيكهام

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 14. `football-14`

**Category:** كرة قدم

**Identity / prompt shown:** أندريس إنييستا

**Current answers:**
- أندريس إنييستا

**Recommended accepted answers:**
- أندريس إنييستا

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 15. `football-15`

**Category:** كرة قدم

**Identity / prompt shown:** تشافي

**Current answers:**
- تشافي

**Recommended accepted answers:**
- تشافي

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 16. `football-16`

**Category:** كرة قدم

**Identity / prompt shown:** سيرجيو راموس

**Current answers:**
- سيرجيو راموس

**Recommended accepted answers:**
- سيرجيو راموس

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 17. `football-17`

**Category:** كرة قدم

**Identity / prompt shown:** بوفون

**Current answers:**
- بوفون

**Recommended accepted answers:**
- بوفون

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 18. `football-18`

**Category:** كرة قدم

**Identity / prompt shown:** رونالدو نازاريو

**Current answers:**
- رونالدو نازاريو

**Recommended accepted answers:**
- رونالدو نازاريو

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 19. `football-19`

**Category:** كرة قدم

**Identity / prompt shown:** بيليه

**Current answers:**
- بيليه

**Recommended accepted answers:**
- بيليه

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 20. `football-20`

**Category:** كرة قدم

**Identity / prompt shown:** مارادونا

**Current answers:**
- مارادونا

**Recommended accepted answers:**
- مارادونا

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

## تحدي التخمين — مسلسلات

**Category id:** `series` · **enabled:** true · **count:** 20

### 1. `series-1`

**Category:** مسلسلات

**Identity / prompt shown:** Breaking Bad

**Current answers:**
- Breaking Bad
- بريكنق باد
- بريكنغ باد

**Recommended accepted answers:**
- Breaking Bad
- بريكنق باد
- بريكنغ باد

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 2. `series-2`

**Category:** مسلسلات

**Identity / prompt shown:** Game of Thrones

**Current answers:**
- Game of Thrones
- جيم أوف ثرونز

**Recommended accepted answers:**
- Game of Thrones
- جيم أوف ثرونز

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 3. `series-3`

**Category:** مسلسلات

**Identity / prompt shown:** Prison Break

**Current answers:**
- Prison Break

**Recommended accepted answers:**
- Prison Break

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 4. `series-4`

**Category:** مسلسلات

**Identity / prompt shown:** The Walking Dead

**Current answers:**
- The Walking Dead
- ذا ووكينغ ديد

**Recommended accepted answers:**
- The Walking Dead
- ذا ووكينغ ديد

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 5. `series-5`

**Category:** مسلسلات

**Identity / prompt shown:** Peaky Blinders

**Current answers:**
- Peaky Blinders
- بيكي بلايندرز

**Recommended accepted answers:**
- Peaky Blinders
- بيكي بلايندرز

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 6. `series-6`

**Category:** مسلسلات

**Identity / prompt shown:** Stranger Things

**Current answers:**
- Stranger Things

**Recommended accepted answers:**
- Stranger Things

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 7. `series-7`

**Category:** مسلسلات

**Identity / prompt shown:** Money Heist

**Current answers:**
- Money Heist
- La Casa de Papel
- لا كاسا دي بابيل

**Recommended accepted answers:**
- Money Heist
- La Casa de Papel
- لا كاسا دي بابيل

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 8. `series-8`

**Category:** مسلسلات

**Identity / prompt shown:** The Boys

**Current answers:**
- The Boys

**Recommended accepted answers:**
- The Boys

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 9. `series-9`

**Category:** مسلسلات

**Identity / prompt shown:** Dexter

**Current answers:**
- Dexter

**Recommended accepted answers:**
- Dexter

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 10. `series-10`

**Category:** مسلسلات

**Identity / prompt shown:** Sherlock

**Current answers:**
- Sherlock

**Recommended accepted answers:**
- Sherlock

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 11. `series-11`

**Category:** مسلسلات

**Identity / prompt shown:** The Last of Us

**Current answers:**
- The Last of Us
- ذا لاست أوف أس

**Recommended accepted answers:**
- The Last of Us
- ذا لاست أوف أس

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 12. `series-12`

**Category:** مسلسلات

**Identity / prompt shown:** Squid Game

**Current answers:**
- Squid Game

**Recommended accepted answers:**
- Squid Game

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 13. `series-13`

**Category:** مسلسلات

**Identity / prompt shown:** Better Call Saul

**Current answers:**
- Better Call Saul
- بيتر كول سول

**Recommended accepted answers:**
- Better Call Saul
- بيتر كول سول

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 14. `series-14`

**Category:** مسلسلات

**Identity / prompt shown:** Vikings

**Current answers:**
- Vikings
- فايكنغز
- فايكنجز

**Recommended accepted answers:**
- Vikings
- فايكنغز
- فايكنجز

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 15. `series-15`

**Category:** مسلسلات

**Identity / prompt shown:** Lost

**Current answers:**
- Lost

**Recommended accepted answers:**
- Lost

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 16. `series-16`

**Category:** مسلسلات

**Identity / prompt shown:** The Witcher

**Current answers:**
- The Witcher
- ذا ويتشر
- The Witcher 3
- ويتشر 3

**Recommended accepted answers:**
- The Witcher
- ذا ويتشر
- The Witcher 3
- ويتشر 3

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 17. `series-17`

**Category:** مسلسلات

**Identity / prompt shown:** House of the Dragon

**Current answers:**
- House of the Dragon

**Recommended accepted answers:**
- House of the Dragon

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 18. `series-18`

**Category:** مسلسلات

**Identity / prompt shown:** The Sopranos

**Current answers:**
- The Sopranos
- ذا سوبرانوز
- سوبرانوز

**Recommended accepted answers:**
- The Sopranos
- ذا سوبرانوز
- سوبرانوز

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 19. `series-19`

**Category:** مسلسلات

**Identity / prompt shown:** Narcos

**Current answers:**
- Narcos
- ناركوس

**Recommended accepted answers:**
- Narcos
- ناركوس

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 20. `series-20`

**Category:** مسلسلات

**Identity / prompt shown:** Suits

**Current answers:**
- Suits

**Recommended accepted answers:**
- Suits

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

## تحدي التخمين — ألعاب

**Category id:** `games` · **enabled:** true · **count:** 20

### 1. `games-1`

**Category:** ألعاب

**Identity / prompt shown:** Minecraft

**Current answers:**
- Minecraft
- ماينكرافت

**Recommended accepted answers:**
- Minecraft
- ماينكرافت

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 2. `games-2`

**Category:** ألعاب

**Identity / prompt shown:** Fortnite

**Current answers:**
- Fortnite
- فورتنايت

**Recommended accepted answers:**
- Fortnite
- فورتنايت

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 3. `games-3`

**Category:** ألعاب

**Identity / prompt shown:** PUBG

**Current answers:**
- PUBG
- ببجي
- PlayerUnknown's Battlegrounds

**Recommended accepted answers:**
- PUBG
- ببجي
- PlayerUnknown's Battlegrounds

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 4. `games-4`

**Category:** ألعاب

**Identity / prompt shown:** GTA V

**Current answers:**
- GTA V
- GTA 5
- قراند 5
- Grand Theft Auto V

**Recommended accepted answers:**
- GTA V
- GTA 5
- قراند 5
- Grand Theft Auto V

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 5. `games-5`

**Category:** ألعاب

**Identity / prompt shown:** Call of Duty

**Current answers:**
- Call of Duty
- كول أوف ديوتي
- COD

**Recommended accepted answers:**
- Call of Duty
- كول أوف ديوتي
- COD

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 6. `games-6`

**Category:** ألعاب

**Identity / prompt shown:** FIFA

**Current answers:**
- FIFA
- EA Sports FC
- EA FC
- فيفا

**Recommended accepted answers:**
- FIFA
- EA Sports FC
- EA FC
- فيفا

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 7. `games-7`

**Category:** ألعاب

**Identity / prompt shown:** Rocket League

**Current answers:**
- Rocket League
- روكيت ليق
- روكيت ليغ

**Recommended accepted answers:**
- Rocket League
- روكيت ليق
- روكيت ليغ

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 8. `games-8`

**Category:** ألعاب

**Identity / prompt shown:** Valorant

**Current answers:**
- Valorant
- فالورانت

**Recommended accepted answers:**
- Valorant
- فالورانت

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 9. `games-9`

**Category:** ألعاب

**Identity / prompt shown:** League of Legends

**Current answers:**
- League of Legends

**Recommended accepted answers:**
- League of Legends

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 10. `games-10`

**Category:** ألعاب

**Identity / prompt shown:** Counter-Strike

**Current answers:**
- Counter-Strike
- كاونتر سترايك
- CS
- CS2

**Recommended accepted answers:**
- Counter-Strike
- كاونتر سترايك
- CS
- CS2

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 11. `games-11`

**Category:** ألعاب

**Identity / prompt shown:** Overwatch

**Current answers:**
- Overwatch
- أوفرواتش

**Recommended accepted answers:**
- Overwatch
- أوفرواتش

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 12. `games-12`

**Category:** ألعاب

**Identity / prompt shown:** Marvel Rivals

**Current answers:**
- Marvel Rivals
- مارفل رايفلز
- مارفل ريفالز

**Recommended accepted answers:**
- Marvel Rivals
- مارفل رايفلز
- مارفل ريفالز

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 13. `games-13`

**Category:** ألعاب

**Identity / prompt shown:** Among Us

**Current answers:**
- Among Us
- امونغ اس

**Recommended accepted answers:**
- Among Us
- امونغ اس

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 14. `games-14`

**Category:** ألعاب

**Identity / prompt shown:** The Last of Us

**Current answers:**
- The Last of Us
- ذا لاست أوف أس

**Recommended accepted answers:**
- The Last of Us
- ذا لاست أوف أس

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 15. `games-15`

**Category:** ألعاب

**Identity / prompt shown:** Red Dead Redemption 2

**Current answers:**
- Red Dead Redemption 2
- ريد ديد 2
- RDR2

**Recommended accepted answers:**
- Red Dead Redemption 2
- ريد ديد 2
- RDR2

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 16. `games-16`

**Category:** ألعاب

**Identity / prompt shown:** Resident Evil

**Current answers:**
- Resident Evil
- ريزدنت إيفل
- رزدنت ايفل

**Recommended accepted answers:**
- Resident Evil
- ريزدنت إيفل
- رزدنت ايفل

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 17. `games-17`

**Category:** ألعاب

**Identity / prompt shown:** Assassin’s Creed

**Current answers:**
- Assassin’s Creed
- اساسنز كريد

**Recommended accepted answers:**
- Assassin’s Creed
- اساسنز كريد

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 18. `games-18`

**Category:** ألعاب

**Identity / prompt shown:** God of War

**Current answers:**
- God of War
- قاد أوف وور
- جاد أوف وور

**Recommended accepted answers:**
- God of War
- قاد أوف وور
- جاد أوف وور

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 19. `games-19`

**Category:** ألعاب

**Identity / prompt shown:** Elden Ring

**Current answers:**
- Elden Ring
- إلدن رينغ
- الدن رينق

**Recommended accepted answers:**
- Elden Ring
- إلدن رينغ
- الدن رينق

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

### 20. `games-20`

**Category:** ألعاب

**Identity / prompt shown:** Spider-Man

**Current answers:**
- Spider-Man
- Marvel’s Spider-Man
- سبايدرمان

**Recommended accepted answers:**
- Spider-Man
- Marvel’s Spider-Man
- سبايدرمان

**Assessment:** KEEP

**Reason:** هوية واضحة ومناسبة لقواعد تحدي التخمين.

## تحدي التخمين — تقنيات

**Category id:** `tech` · **enabled:** true · **count:** 18

### 1. `tech-1`

**Category:** تقنيات

**Identity / prompt shown:** آيفون

**Current answers:**
- آيفون

**Recommended accepted answers:**
- آيفون

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 2. `tech-2`

**Category:** تقنيات

**Identity / prompt shown:** أندرويد

**Current answers:**
- أندرويد

**Recommended accepted answers:**
- أندرويد

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 3. `tech-3`

**Category:** تقنيات

**Identity / prompt shown:** ويندوز

**Current answers:**
- ويندوز

**Recommended accepted answers:**
- ويندوز

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 4. `tech-4`

**Category:** تقنيات

**Identity / prompt shown:** ماك

**Current answers:**
- ماك

**Recommended accepted answers:**
- ماك

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 5. `tech-5`

**Category:** تقنيات

**Identity / prompt shown:** بلايستيشن

**Current answers:**
- بلايستيشن

**Recommended accepted answers:**
- بلايستيشن

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 6. `tech-6`

**Category:** تقنيات

**Identity / prompt shown:** إكس بوكس

**Current answers:**
- إكس بوكس

**Recommended accepted answers:**
- إكس بوكس

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 7. `tech-7`

**Category:** تقنيات

**Identity / prompt shown:** نينتندو سويتش

**Current answers:**
- نينتندو سويتش

**Recommended accepted answers:**
- نينتندو سويتش

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 8. `tech-8`

**Category:** تقنيات

**Identity / prompt shown:** لابتوب

**Current answers:**
- لابتوب

**Recommended accepted answers:**
- لابتوب

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 9. `tech-9`

**Category:** تقنيات

**Identity / prompt shown:** كمبيوتر

**Current answers:**
- كمبيوتر

**Recommended accepted answers:**
- كمبيوتر

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 10. `tech-10`

**Category:** تقنيات

**Identity / prompt shown:** روبوت

**Current answers:**
- روبوت

**Recommended accepted answers:**
- روبوت

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 11. `tech-11`

**Category:** تقنيات

**Identity / prompt shown:** درون

**Current answers:**
- درون

**Recommended accepted answers:**
- درون

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 12. `tech-12`

**Category:** تقنيات

**Identity / prompt shown:** ساعة ذكية

**Current answers:**
- ساعة ذكية

**Recommended accepted answers:**
- ساعة ذكية

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 13. `tech-13`

**Category:** تقنيات

**Identity / prompt shown:** سماعات لاسلكية

**Current answers:**
- سماعات لاسلكية

**Recommended accepted answers:**
- سماعات لاسلكية

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 14. `tech-14`

**Category:** تقنيات

**Identity / prompt shown:** كاميرا

**Current answers:**
- كاميرا

**Recommended accepted answers:**
- كاميرا

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 15. `tech-15`

**Category:** تقنيات

**Identity / prompt shown:** طابعة

**Current answers:**
- طابعة

**Recommended accepted answers:**
- طابعة

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 16. `tech-16`

**Category:** تقنيات

**Identity / prompt shown:** فلاش ميموري

**Current answers:**
- فلاش ميموري

**Recommended accepted answers:**
- فلاش ميموري

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 17. `tech-17`

**Category:** تقنيات

**Identity / prompt shown:** باور بانك

**Current answers:**
- باور بانك

**Recommended accepted answers:**
- باور بانك

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

### 18. `tech-18`

**Category:** تقنيات

**Identity / prompt shown:** نظارة واقع افتراضي

**Current answers:**
- نظارة واقع افتراضي

**Recommended accepted answers:**
- نظارة واقع افتراضي

**Assessment:** FIX

**Reason:** الهوية نفسها جيدة للتخمين، لكن الأسماء المقبولة ناقصة (ترجمات أو اختصارات شائعة).

## Baseline assessment totals

- **KEEP:** 584
- **FIX:** 101
- **REPLACE:** 3
- **DUPLICATE:** 0

True in-catalog duplicates (same id or same normalized canonical text inside a category): **0**. Near-duplicates called out above: Fast Answer `countries-16`/`countries-18`; Fast Answer `games-2` ambiguity; Fast Answer `series-20` generic island.
