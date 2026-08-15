# Game content

Static JSON under `content/{gameId}/`, loaded **server-side only**. Do not store gameplay catalogs in the database.

## Per-game categories

`random` / **عشوائي** is a virtual lobby option. Never write it into JSON. Random means all enabled categories **for that game**.

| Game | Stored categories |
| --- | --- |
| برا السالفة / أسرع إجابة | animals, food, countries, cars, football, movies, series, games, tech |
| ارسم وخمّن / الإمبوستر بالرسم | animals, food, household, tools, transport, professions, nature, sports, clothing (`ملابس وإكسسوارات`), places |
| تحدي التخمين | trivia 9 + household + tools |
| من كتبها؟ | funny, personal, situations, preferences |
| قاضي | funny, hypothetical, daily, weird |
| تحدي التوقيت | none |

Do not show another game's categories in the lobby.

## Display language

Arabic canonical display: animals, food, countries, football (players/clubs), household, tools, transport, professions, nature, sports, clothing, places, everyday objects.

English canonical display: movies, TV series, video games, car brands/models, tech brands/products/platforms/software.

Examples: `أسد`, `ميسي`, `الهلال` vs `Interstellar`, `Breaking Bad`, `Minecraft`, `Toyota`, `iPhone`.

Aliases may include the other script. Matching is not the same as display. Do not build huge alias lists.

## IDs

Keep item IDs stable. Do not reuse an ID for a different meaning.

## Aliases (Fast Answer / Guessing Challenge)

- The canonical answer must be accepted.
- Keep useful hamza, Latin, and compact spellings.
- Matching does **not** map `ة` → `ه`. Add a common `ه` form when players will type it (`زرافة` / `زرافه`).
- Do not add overly broad aliases (`عثمان`, `دراجة`, `ليونيل`).
- Duplicate aliases after normalization are invalid.
- Guessing Challenge: two identities must not share a normalized accepted answer.

## Draw / Imposter

Words must be drawable in a short party round without writing the answer. No movie/series/game/tech-brand/car-brand/celebrity-name titles.

## Style

- Length targets: drawable nouns ~20 characters, GC identities ~24, Fast Answer questions ~50 (a little longer is OK).
- No current-news / time-sensitive trivia by default.
- Who Wrote It / Judge: Gulf/Saudi conversational tone is allowed. Do not force formal MSA. Prompts must not have one objectively correct answer.

## Expansion and owner review

Quantity expansion is a separate batch (P8-C).

After bulk expansion, produce a **complete review catalog** of every word, question, canonical answer, accepted alias, prompt, and identity/concept, grouped by **GAME → CATEGORY**. Do not send samples or counts only. The owner will Keep / Edit / Remove / Add before P8 closes.
