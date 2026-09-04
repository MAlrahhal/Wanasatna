/**
 * Read-only QA catalog for all current content.
 * Does not modify production JSON.
 * Run: node content/review/generate-content-qa.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENT = join(ROOT, 'content');
const REVIEW = join(CONTENT, 'review');

const GAMES = [
  { id: 'bara-al-salafa', name: 'برا السالفة', kind: 'word' },
  { id: 'draw-guess', name: 'ارسم وخمّن', kind: 'word' },
  { id: 'imposter-draw', name: 'الإمبوستر بالرسم', kind: 'word' },
  { id: 'fast-answer', name: 'أسرع إجابة', kind: 'question' },
  { id: 'who-wrote-it', name: 'من كتبها؟', kind: 'prompt' },
  { id: 'judge', name: 'القاضي', kind: 'prompt' },
  { id: 'guessing-challenge', name: 'تحدي التخمين', kind: 'identity' },
];

const GAME_HEADER_TO_ID = {
  'برا السالفة': 'bara-al-salafa',
  'ارسم وخمّن': 'draw-guess',
  'الإمبوستر بالرسم': 'imposter-draw',
  'أسرع إجابة': 'fast-answer',
  'من كتبها؟': 'who-wrote-it',
  القاضي: 'judge',
  'تحدي التخمين': 'guessing-challenge',
};

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  if (/[",]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function normalizeDigit(digit) {
  const codePoint = digit.codePointAt(0) ?? 0;
  if (codePoint >= 0x0660 && codePoint <= 0x0669) return String(codePoint - 0x0660);
  if (codePoint >= 0x06f0 && codePoint <= 0x06f9) return String(codePoint - 0x06f0);
  return digit;
}

function norm(value) {
  return String(value ?? '')
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

function loadOriginalKeys() {
  const audit = readFileSync(join(REVIEW, 'CONTENT_AUDIT.md'), 'utf8');
  const marker = '## Item-by-item audit (every existing item)';
  const idx = audit.indexOf(marker);
  const section = idx >= 0 ? audit.slice(idx) : audit;
  const keys = new Set();
  let currentGame = '';

  for (const line of section.split(/\n/)) {
    const header = line.match(/^# (.+)$/);
    if (header && GAME_HEADER_TO_ID[header[1]]) {
      currentGame = GAME_HEADER_TO_ID[header[1]];
    }
    const item = line.match(/^### \d+\. `([^`]+)`/);
    if (item && currentGame) {
      keys.add(`${currentGame}::${item[1]}`);
    }
  }

  return keys;
}

function hasLatin(value) {
  return /[A-Za-z]/.test(value);
}

function hasArabic(value) {
  return /[\u0600-\u06FF]/.test(value);
}

function displayOf(game, item) {
  if (game.kind === 'question' || game.kind === 'identity') return item.question;
  return item.text;
}

function answersOf(game, item) {
  if (game.kind === 'question' || game.kind === 'identity') return item.acceptedAnswers ?? [];
  return item.aliases ?? [];
}

function questionRevealsAnswer(question, answers) {
  const q = norm(question);
  return answers.some((answer) => {
    const a = norm(answer);
    return a.length >= 3 && q.includes(a);
  });
}

/** Manual overrides: game::id → { status, reason }. Highest priority. */
const OVERRIDES = {
  // Original IDs whose payload was replaced in the expansion pass.
  'fast-answer::countries-18': {
    status: 'NEEDS_REVIEW',
    reason:
      'ORIGINAL ID, replaced wording (كان Big Ben/بريطانيا). السؤال الحالي عن الكنغر/أستراليا جيد مبدئيًا لكن يحتاج تأكيد مالك لأنه لم يعد النص الأصلي.',
  },
  'fast-answer::series-20': {
    status: 'NEEDS_REVIEW',
    reason:
      'ORIGINAL ID, replaced wording. Oceanic 815 → Lost أوضح من «الجزيرة»، لكن رقم الرحلة قد يكون صعبًا على جزء من المجموعة.',
  },
  'fast-answer::games-2': {
    status: 'KEEP',
    reason: 'ORIGINAL ID, replaced wording. إيرنغل + الطائرة يميّزان PUBG عن باقي الباتل رويال.',
  },
  'guessing-challenge::countries-8': {
    status: 'KEEP',
    reason: 'ORIGINAL. أُصلح خطأ Amman. عُمان/Oman/سلطنة عمان مناسبة.',
  },
  'fast-answer::animals-17': {
    status: 'NEAR_DUPLICATE',
    reason: 'ORIGINAL. نفس إجابة animals-20 (فيل) بمدخل مختلف (أكبر بري / خرطوم).',
  },
  'fast-answer::animals-20': {
    status: 'NEAR_DUPLICATE',
    reason: 'ORIGINAL. نفس إجابة animals-17 (فيل).',
  },

  // Fast Answer NEW — defects
  'fast-answer::games-mario': {
    status: 'FIX',
    reason: 'NEW. السؤال يذكر «ماريو» صراحة. الإجابة مكشوفة.',
  },
  'fast-answer::games-skyrim': {
    status: 'FIX',
    reason: 'NEW. السؤال يحتوي Skyrim. الإجابة مكشوفة.',
  },
  'fast-answer::animals-eagle': {
    status: 'FIX',
    reason: 'NEW. «الطائر الجارح الأشهر في الصيد عند العرب» قد يكون صقر أو عقاب.',
  },
  'fast-answer::food-arabic-coffee': {
    status: 'FIX',
    reason: 'NEW. يقبل «قهوة» وهو أوسع من قهوة عربية.',
  },
  'fast-answer::countries-kuwait-capital': {
    status: 'FIX',
    reason: 'NEW. يقبل «الكويت» كعاصمة، وهذا اسم الدولة لا المدينة.',
  },
  'fast-answer::series-eleven': {
    status: 'FIX',
    reason: 'NEW. النقحرة «إلسن» غير طبيعية لـ Eleven؛ المتوقع إليفن/إلفن.',
  },
  'fast-answer::animals-cow-stomachs': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. صياغة التجاويف أدق علميًا من «4 معدات»، لكنه سؤال امتحان أحياء لا حفلة.',
  },
  'fast-answer::animals-spider-legs': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. نفس قالب العدّ الأصلي (كم رجلًا للنملة؟) بإجابة رقمية أخرى.',
  },
  'fast-answer::animals-lioness': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. «أنثى الأسد» قريبة من كشف الإجابة. لغوي أكثر من معلوماتي.',
  },
  'fast-answer::animals-polar-bear': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. «الدب + القطب الشمالي» يكاد يسمي الإجابة.',
  },
  'fast-answer::animals-rhino': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. «قرن فوق أنفه» يوجه مباشرة لوحيد القرن.',
  },
  'fast-answer::animals-hippo': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. حيوان أفريقي ضخم في النهر قد يُفهم تمساح.',
  },
  'fast-answer::food-olive': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. «الثمرة التي يُعصر منها الزيت» يكاد يكشف زيتون.',
  },
  'fast-answer::food-rice': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. يذكر الكبسة والمندي في السؤال — التلميح قوي جدًا، وصعوبة رياض أطفال.',
  },
  'fast-answer::food-kunafa': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. الجبن/القشطة والقطر ينطبق على قطايف وغيرها.',
  },
  'fast-answer::food-banana': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. وصف الموز المقوّس أصعب ما فيه أنه سهل زيادة؛ حشو فواكه.',
  },
  'fast-answer::food-apple': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. وصف التفاح البصري حشو سهل جدًا.',
  },
  'fast-answer::food-chocolate': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. «الحلوى البنية من الكاكاو» سهل وحشوي.',
  },
  'fast-answer::food-mango': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. وصف مانجو بصري؛ حشو فواكه.',
  },
  'fast-answer::series-nevermore': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. يذكر Wednesday ثم يسأل عن المدرسة — لمعجبين فقط.',
  },
  'fast-answer::series-mando': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. «غروغو» تلميح قوي جدًا.',
  },
  'fast-answer::series-peaky-city': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. برمنغهام أصعب من السؤال عن المسلسل، وقد تُخلط مع لندن.',
  },
  'fast-answer::series-baker-street': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. 221B صعب الكتابة في 15 ثانية.',
  },
  'fast-answer::games-efootball': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. نفس مفهوم كرة القدم الإلكترونية بجانب سؤال FIFA/EA FC الأصلي.',
  },
  'fast-answer::games-clash-royale': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. كلاش رويال بجانب سؤال Clash of Clans الجديد — نفس العائلة.',
  },
  'fast-answer::games-dark-souls': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. يذكر FromSoftware وElden Ring؛ نيش بجانب إلدن رينغ الأصلي.',
  },
  'fast-answer::games-lol': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. League of Legends أصلًا في ألعاب برا/تخمين؛ السؤال جيد لكن الفئة تضخمت بنفس العناوين.',
  },

  // Guessing Challenge NEW
  'guessing-challenge::animals-lioness': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. لبوة بجانب أسد في نفس الفئة.',
  },
  'guessing-challenge::animals-orca': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. أوركا/حوت قاتل بجانب الحوت الأزرق الأصلي — نفس عائلة الحيتان.',
  },
  'guessing-challenge::animals-cheetah': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. فهد بجانب أسد/نمر الأصليين — قطة كبيرة إضافية.',
  },
  'guessing-challenge::food-jareesh': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. جريش بجانب هريس — قمح مهروس خليجي متقارب جدًا.',
  },
  'guessing-challenge::food-arabic-coffee': {
    status: 'FIX',
    reason: 'NEW. الهوية «قهوة عربية» وتقبل «قهوة» — واسع.',
  },
  'guessing-challenge::football-ahli': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. الأهلي غامض (سعودي/مصري/إماراتي) بدون تحديد.',
  },
  'guessing-challenge::games-mario': {
    status: 'FIX',
    reason: 'NEW. يقبل «ماريو» ولا «Mario» اللاتيني.',
  },
  'guessing-challenge::series-himym': {
    status: 'FIX',
    reason: 'NEW. لا يوجد مقابل عربي شائع في accepted answers.',
  },
  'guessing-challenge::series-b99': {
    status: 'FIX',
    reason: 'NEW. لا يوجد مقابل عربي.',
  },
  'guessing-challenge::series-true-detective': {
    status: 'FIX',
    reason: 'NEW. لا يوجد مقابل عربي، والعنوان نيش أصلًا.',
  },
  'guessing-challenge::series-expanse': {
    status: 'FIX',
    reason: 'NEW. لا يوجد مقابل عربي، والعنوان نيش أصلًا.',
  },
  'guessing-challenge::games-hollow-knight': {
    status: 'FIX',
    reason: 'NEW. لا يوجد مقابل عربي، والعنوان نيش.',
  },
  'guessing-challenge::games-subway': {
    status: 'FIX',
    reason: 'NEW. لا يوجد مقابل عربي لـ Subway Surfers.',
  },
  'guessing-challenge::tech-usb': {
    status: 'FIX',
    reason: 'NEW. لا يوجد USB الإنجليزي. قريب مفاهيميًا من فلاش ميموري الأصلي.',
  },
  'guessing-challenge::tech-airpods': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. إيربودز بجانب سماعات لاسلكية الأصلية.',
  },
  'guessing-challenge::games-clash-royale': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. كلاش رويال بجانب كلاش أوف كلانس الجديد.',
  },
  'guessing-challenge::games-efootball': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. eFootball/PES بجانب FIFA الأصلي.',
  },
  'guessing-challenge::games-dark-souls': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. دارك سولز بجانب إلدن رينغ الأصلي (نفس الاستوديو/النوع).',
  },
  'guessing-challenge::football-henry': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. لاعب إضافي؛ الفئة الأصلية كانت 20 لاعبًا أصلًا. الأندية هي التنويع الحقيقي.',
  },

  // Drawable NEW
  'draw-guess::nature-sea': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. بحر قريب جدًا من محيط في نفس الفئة.',
  },
  'draw-guess::nature-ocean': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. محيط قريب من بحر.',
  },
  'draw-guess::nature-leaf': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. ورقة شجر قريبة من شجرة الجديدة.',
  },
  'draw-guess::nature-wave': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. موجة قريبة من بحر/شاطئ/محيط.',
  },
  'draw-guess::nature-thunder': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. رعد بجانب برق الأصلي — نفس المشهد غالبًا.',
  },
  'draw-guess::nature-dunes': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. كثبان بجانب صحراء الأصلية.',
  },
  'draw-guess::nature-forest': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. غابة بجانب شجرة الجديدة.',
  },
  'draw-guess::nature-comet': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. مذنب بجانب نيزك الأصلي — صعب تمييزه رسمًا.',
  },
  'draw-guess::places-london-bridge': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. جسر لندن بجانب جسر الأصلي.',
  },
  'draw-guess::tech-usb': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. يو اس بي قريب من فلاش ميموري الأصلي.',
  },
  'draw-guess::tech-earbuds': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. إيربودز قريب من سماعات الأصلية.',
  },
  'draw-guess::tech-webcam': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. كاميرا ويب قريبة من كاميرا الأصلية.',
  },
  'draw-guess::tech-speaker': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. سبيكر قريب من سماعات الأصلية.',
  },
  'draw-guess::tech-hard-disk': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. هارد دسك قريب من فلاش/يو اس بي كشكل صندوق تخزين.',
  },
  'draw-guess::tech-antenna': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. هوائي قريب من ستلايت الجديد.',
  },
  'draw-guess::tech-switch': {
    status: 'FIX',
    reason: 'NEW. المعرّف switch لكن النص «نينتندو» (العلامة لا الجهاز). للرسم سويتش أوضح.',
  },
  'draw-guess::tech-alarm': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. ساعة منبه بجانب ساعة ذكية الأصلية.',
  },
  'draw-guess::food-cake': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. كعكة بجانب كب كيك الأصلي.',
  },
  'draw-guess::food-sandwich': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. ساندويتش قريب من برغر الأصلي.',
  },
  'draw-guess::nature-earth': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. «أرض» عامة جدًا للرسم (كرة أرضية؟ تراب؟).',
  },
  'draw-guess::animals-cow': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. بقرة/خروف/ماعز صعب تمييزها رسمًا في نفس الفئة.',
  },
  'draw-guess::animals-sheep': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. خروف ضمن ثلاثية المزرعة صعبة التمييز.',
  },
  'draw-guess::animals-goat': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. ماعز ضمن ثلاثية المزرعة صعبة التمييز.',
  },

  'imposter-draw::nature-sea': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. نفس مشكلة بحر/محيط في ارسم وخمّن.',
  },
  'imposter-draw::nature-ocean': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. محيط بجانب بحر.',
  },
  'imposter-draw::nature-leaf': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. ورقة شجر بجانب شجرة.',
  },
  'imposter-draw::nature-wave': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. موجة قريبة من بحر/شاطئ.',
  },
  'imposter-draw::nature-thunder': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. رعد بجانب برق.',
  },
  'imposter-draw::nature-dunes': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. كثبان بجانب صحراء.',
  },
  'imposter-draw::nature-forest': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. غابة بجانب شجرة.',
  },
  'imposter-draw::nature-comet': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. مذنب بجانب نيزك.',
  },
  'imposter-draw::places-london-bridge': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. جسر لندن بجانب جسر.',
  },
  'imposter-draw::tech-usb': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. يو اس بي بجانب فلاش ميموري.',
  },
  'imposter-draw::tech-earbuds': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. إيربودز بجانب سماعات.',
  },
  'imposter-draw::tech-webcam': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. كاميرا ويب بجانب كاميرا.',
  },
  'imposter-draw::tech-speaker': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. سبيكر بجانب سماعات.',
  },
  'imposter-draw::tech-hard-disk': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. هارد دسك قريب من وحدات التخزين الأخرى.',
  },
  'imposter-draw::tech-antenna': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. هوائي قريب من ستلايت.',
  },
  'imposter-draw::tech-switch': {
    status: 'FIX',
    reason: 'NEW. النص «نينتندو» بينما المعرّف switch.',
  },
  'imposter-draw::tech-alarm': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. ساعة منبه بجانب ساعة ذكية.',
  },
  'imposter-draw::food-cake': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. كعكة بجانب كب كيك.',
  },
  'imposter-draw::food-sandwich': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. ساندويتش قريب من برغر.',
  },
  'imposter-draw::nature-earth': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. «أرض» عامة للرسم/للإمبوستر.',
  },
  'imposter-draw::animals-cow': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. ثلاثية مزرعة صعبة التمييز، وأسوأ في الإمبوستر.',
  },
  'imposter-draw::animals-sheep': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. خروف ضمن ثلاثية المزرعة.',
  },
  'imposter-draw::animals-goat': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. ماعز ضمن ثلاثية المزرعة.',
  },

  // Bara NEW
  'bara-al-salafa::animals-cheetah': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. فهد بجانب أسد/نمر الأصليين.',
  },
  'bara-al-salafa::animals-whale': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. حوت بجانب دلفين الأصلي — ثديي بحري ضخم إضافي.',
  },
  'bara-al-salafa::food-jareesh': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. جريش بجانب هريس.',
  },
  'bara-al-salafa::food-coffee': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. «قهوة» عامة جدًا بجانب شاي كرك؛ الأصل كان أطباقًا لا مشروبًا فضفاضًا.',
  },
  'bara-al-salafa::football-ahli': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. الأهلي متعدد النوادي.',
  },
  'bara-al-salafa::games-clash-royale': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. كلاش رويال بجانب كلاش أوف كلانس.',
  },
  'bara-al-salafa::games-efootball': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. eFootball بجانب FIFA الأصلي.',
  },
  'bara-al-salafa::games-dark-souls': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. دارك سولز بجانب إلدن رينغ.',
  },

  // Who Wrote It NEW near-dups vs original
  'who-wrote-it::confessions-21': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. التأجيل حتى الأزمة قريب من confessions-3 (تسويف) و-14 (بكرة).',
  },
  'who-wrote-it::confessions-17': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. ادّعاء الانشغال قريب من confessions-11 و-3.',
  },
  'who-wrote-it::confessions-29': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. أول شيء تفتحه في الجوال قريب من confessions-7.',
  },
  'who-wrote-it::confessions-14': {
    status: 'KEEP',
    reason: 'ORIGINAL. تسويف «بكرة» مختلف بما يكفي عن «أكثر شيء تسوّف فيه».',
  },
  'who-wrote-it::funny-situations-16': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. إصلاح شيء وتخريبه قريب من funny-situations-1.',
  },
  'who-wrote-it::light-personal-23': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. ما يهدّيك بعد يوم طويل قريب من light-personal-1.',
  },
  'who-wrote-it::light-personal-29': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. أكلة وأنت محتار قريبة من light-personal-8 (أكلة تكررها).',
  },
  'who-wrote-it::light-personal-25': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. شيء في البيت لا تستغني عنه قريب من light-personal-15.',
  },
  'who-wrote-it::light-personal-22': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. عادة صباحية قريبة من light-personal-14 (شيء لا تتنازل عنه في يومك).',
  },
  'who-wrote-it::light-personal-27': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. صفة تبحث عنها قريبة من light-personal-3.',
  },
  'who-wrote-it::confessions-26': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. تدّعي أنك تكرهه وأنت تحبه قريب من confessions-10.',
  },
  'who-wrote-it::what-would-you-do-5': {
    status: 'KEEP',
    reason: 'ORIGINAL. تذكرة سفر فورية مختلفة عن اختيار دولة لسنة.',
  },

  // Judge NEW
  'judge::invent-something-silly-23': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. خدمة عملاء أسوأ من الانتظار قريبة من invent-16.',
  },
  'judge::invent-something-silly-22': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. رياضة أولمبية ما لها داعي قريبة من invent-3 (رياضة جديدة).',
  },
  'judge::invent-something-silly-29': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. وظيفة في شركة ألعاب قريبة من invent-5 (وظيفة بلا فايدة).',
  },
  'judge::rapid-response-18': {
    status: 'NEAR_DUPLICATE',
    reason: 'NEW. شيء لا يُقال في مصعد قريب من worst-answer-16 (المصعد مع المدير).',
  },
  'judge::complete-the-sentence-25': {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. «لو انكتب على قبري» أثقل من نبرة الحفلة.',
  },
  'judge::worst-answer-13': {
    status: 'KEEP',
    reason: 'ORIGINAL. اسم طفل سيئ.',
  },
};

const NICHE_NEW_IDS = new Set([
  'series-expanse',
  'series-andor',
  'series-true-detective',
  'series-the-wire',
  'series-succession',
  'series-bear',
  'series-fargo',
  'series-arcane',
  'series-crown',
  'series-dark',
  'series-house',
  'games-hollow-knight',
  'games-baldurs',
  'games-dota',
  'games-genshin',
  'games-skyrim',
]);

const FILLER_FRUIT_IDS = new Set([
  'food-apple',
  'food-banana',
  'food-orange',
  'food-mango',
  'food-watermelon',
  'food-grapes',
  'food-lemon',
]);

const FILLER_PLAYER_IDS = new Set([
  'football-kaka',
  'football-neuer',
  'football-de-bruyne',
  'football-van-dijk',
  'football-bellingham',
  'football-ibrahimovic',
  'football-kante',
  'football-henry',
]);

const GENERIC_OBJECT_IDS = new Set([
  'food-coffee',
  'food-chocolate',
  'food-rice',
  'food-pasta',
  'food-tea',
  'food-corn',
  'food-eggplant',
  'places-house',
  'places-bank',
  'places-mall',
  'places-park',
  'places-cinema',
  'tech-cable',
  'tech-battery',
  'tech-calculator',
  'tech-scanner',
  'tech-alarm',
  'nature-earth',
  'nature-galaxy',
  'nature-fog',
  'tech-radio',
]);

const PAD_COUNTRY_IDS = new Set([
  'countries-sweden',
  'countries-switzerland',
  'countries-pakistan',
  'countries-singapore',
  'countries-portugal',
  'countries-greece',
]);

/** NEW items strong enough to sit beside the curated set — still not equally trusted. */
const STRONG_NEW = new Set([
  'fast-answer::animals-owl',
  'fast-answer::animals-panda',
  'fast-answer::animals-flamingo',
  'fast-answer::animals-hedgehog',
  'fast-answer::animals-peacock',
  'fast-answer::animals-koala',
  'fast-answer::animals-bat',
  'fast-answer::animals-seahorse',
  'fast-answer::animals-hyena',
  'fast-answer::animals-firefly',
  'fast-answer::animals-wolf',
  'fast-answer::animals-starfish',
  'fast-answer::food-mandi',
  'fast-answer::food-harees',
  'fast-answer::food-dates',
  'fast-answer::food-mutabbaq',
  'fast-answer::food-mansaf',
  'fast-answer::food-koshari',
  'fast-answer::food-karak',
  'fast-answer::food-labneh',
  'fast-answer::food-luqaimat',
  'fast-answer::food-molokhia',
  'fast-answer::food-biryani',
  'fast-answer::food-basbousa',
  'fast-answer::countries-china-wall',
  'fast-answer::countries-usa-capital',
  'fast-answer::countries-canada',
  'fast-answer::series-friends',
  'fast-answer::series-office',
  'fast-answer::series-daenerys',
  'fast-answer::games-zelda',
  'fast-answer::games-pokemon',
  'fast-answer::games-tetris',
  'fast-answer::games-pacman',
  'fast-answer::games-roblox',
  'fast-answer::games-valorant-spike',
  'bara-al-salafa::animals-kangaroo',
  'bara-al-salafa::animals-owl',
  'bara-al-salafa::animals-panda',
  'bara-al-salafa::animals-peacock',
  'bara-al-salafa::animals-koala',
  'bara-al-salafa::animals-falcon',
  'bara-al-salafa::food-harees',
  'bara-al-salafa::food-karak',
  'bara-al-salafa::food-mansaf',
  'bara-al-salafa::food-koshari',
  'bara-al-salafa::food-mutabbaq',
  'bara-al-salafa::food-luqaimat',
  'bara-al-salafa::food-dates',
  'bara-al-salafa::countries-iraq',
  'bara-al-salafa::countries-lebanon',
  'bara-al-salafa::countries-palestine',
  'bara-al-salafa::countries-yemen',
  'bara-al-salafa::football-hilal',
  'bara-al-salafa::football-nassr',
  'bara-al-salafa::football-barcelona',
  'bara-al-salafa::football-real-madrid',
  'bara-al-salafa::series-friends',
  'bara-al-salafa::series-wednesday',
  'bara-al-salafa::games-mario',
  'bara-al-salafa::games-zelda',
  'bara-al-salafa::games-pokemon',
  'bara-al-salafa::games-roblox',
  'draw-guess::animals-seahorse',
  'draw-guess::animals-peacock',
  'draw-guess::animals-owl',
  'draw-guess::nature-saturn',
  'draw-guess::nature-palm',
  'draw-guess::nature-cactus',
  'draw-guess::places-makkah-clock',
  'draw-guess::places-liberty',
  'draw-guess::places-great-wall',
  'draw-guess::places-colosseum',
  'draw-guess::places-souq',
  'draw-guess::food-luqaimat',
  'draw-guess::food-hummus',
  'draw-guess::tech-wifi',
  'draw-guess::tech-xbox',
  'imposter-draw::animals-seahorse',
  'imposter-draw::animals-peacock',
  'imposter-draw::animals-owl',
  'imposter-draw::nature-saturn',
  'imposter-draw::nature-palm',
  'imposter-draw::nature-cactus',
  'imposter-draw::places-makkah-clock',
  'imposter-draw::places-liberty',
  'imposter-draw::places-great-wall',
  'imposter-draw::places-colosseum',
  'imposter-draw::places-souq',
  'imposter-draw::food-luqaimat',
  'imposter-draw::food-hummus',
  'imposter-draw::tech-wifi',
  'imposter-draw::tech-xbox',
  'guessing-challenge::food-harees',
  'guessing-challenge::food-karak',
  'guessing-challenge::food-mansaf',
  'guessing-challenge::food-koshari',
  'guessing-challenge::food-mutabbaq',
  'guessing-challenge::countries-palestine',
  'guessing-challenge::countries-iraq',
  'guessing-challenge::football-hilal',
  'guessing-challenge::football-nassr',
  'guessing-challenge::football-barcelona',
  'guessing-challenge::football-real-madrid',
  'guessing-challenge::series-friends',
  'guessing-challenge::series-office',
  'guessing-challenge::series-wednesday',
  'guessing-challenge::games-zelda',
  'guessing-challenge::games-pokemon',
  'guessing-challenge::tech-whatsapp',
  'guessing-challenge::tech-tiktok',
  'guessing-challenge::tech-instagram',
  'guessing-challenge::tech-snapchat',
  'guessing-challenge::tech-youtube',
  'who-wrote-it::funny-situations-24',
  'who-wrote-it::funny-situations-28',
  'who-wrote-it::confessions-19',
  'who-wrote-it::light-personal-16',
  'who-wrote-it::what-would-you-do-16',
  'who-wrote-it::what-would-you-do-26',
  'judge::worst-answer-16',
  'judge::worst-answer-21',
  'judge::weird-scenarios-19',
  'judge::complete-the-sentence-19',
  'judge::rapid-response-19',
]);

const CONCEPT_FAMILIES = [
  { label: 'بحر / محيط / موجة', texts: ['بحر', 'محيط', 'موجة'] },
  { label: 'شجرة / ورقة شجر / غابة', texts: ['شجرة', 'ورقة شجر', 'غابة'] },
  { label: 'جسر / جسر لندن', texts: ['جسر', 'جسر لندن'] },
  { label: 'كاميرا / كاميرا ويب', texts: ['كاميرا', 'كاميرا ويب'] },
  { label: 'سماعات / إيربودز / سبيكر', texts: ['سماعات', 'سماعات لاسلكية', 'إيربودز', 'سبيكر'] },
  { label: 'فلاش / USB / هارد', texts: ['فلاش ميموري', 'يو اس بي', 'هارد دسك'] },
  { label: 'أسد / لبوة', texts: ['أسد', 'لبوة'] },
  { label: 'هريس / جريش', texts: ['هريس', 'جريش'] },
  { label: 'FIFA / eFootball', texts: ['fifa', 'efootball'] },
  { label: 'كلاش أوف كلانس / كلاش رويال', texts: ['clash of clans', 'clash royale'] },
  { label: 'إلدن رينغ / دارك سولز', texts: ['elden ring', 'dark souls'] },
  { label: 'House / House of the Dragon', texts: ['house', 'house of the dragon'] },
  { label: 'فواكه حشو', texts: ['تفاح', 'موز', 'برتقال', 'مانجو', 'بطيخ', 'عنب', 'ليمون'] },
  { label: 'حيوانات مزرعة', texts: ['بقرة', 'خروف', 'ماعز'] },
  { label: 'حوت / أوركا / دلفين', texts: ['حوت', 'حوت ازرق', 'اوركا', 'دلفين'] },
  { label: 'نمر / فهد', texts: ['نمر', 'فهد'] },
];

function familyHits(game, items) {
  return CONCEPT_FAMILIES.map((family) => {
    const hit = items.filter((item) => {
      const text = norm(displayOf(game, item));
      const answers = answersOf(game, item).map(norm);
      return family.texts.some((member) => {
        const needle = norm(member);
        return text === needle || answers.includes(needle);
      });
    });
    return hit.length >= 2 ? `${family.label} → ${hit.map((item) => item.id).join(', ')}` : null;
  }).filter(Boolean);
}

function defaultReview(game, item, origin, siblings) {
  const key = `${game.id}::${item.id}`;
  if (OVERRIDES[key] && OVERRIDES[key].status !== 'KEEP') return OVERRIDES[key];
  if (OVERRIDES[key] && origin === 'ORIGINAL') return OVERRIDES[key];

  const display = displayOf(game, item);
  const answers = answersOf(game, item);

  if (origin === 'ORIGINAL') {
    if (OVERRIDES[key]) return OVERRIDES[key];
    const missingEnglish =
      game.kind === 'question' &&
      answers.length > 0 &&
      hasArabic(answers[0] ?? '') &&
      !hasLatin(answers.join(' ')) &&
      !/^\d+$/.test(norm(answers[0] ?? ''));
    if (missingEnglish) {
      return {
        status: 'FIX',
        reason: 'ORIGINAL. الإجابة العربية جيدة غالبًا لكن التغطية الإنجليزية ناقصة.',
      };
    }
    return {
      status: 'KEEP',
      reason: 'ORIGINAL. من المحتوى المُراجع سابقًا؛ لا توجد علة واضحة تستدعي الحذف.',
    };
  }

  // NEW — overrides that are not KEEP already returned. KEEP overrides still apply.
  if (OVERRIDES[key]) return OVERRIDES[key];

  if (game.kind === 'identity' || game.kind === 'word') {
    const self = norm(display);
    const sameText = siblings.filter(
      (other) => other.id !== item.id && other.categoryId === item.categoryId && norm(displayOf(game, other)) === self,
    );
    if (sameText.length) {
      return {
        status: 'DUPLICATE',
        reason: `NEW. نفس النص بعد التطبيع مع ${sameText.map((row) => row.id).join(', ')}.`,
      };
    }
  }

  if (game.kind === 'question' && questionRevealsAnswer(display, answers)) {
    return {
      status: 'FIX',
      reason: 'NEW. نص السؤال يحتوي الإجابة بعد التطبيع.',
    };
  }

  if (game.kind === 'question') {
    const primary = norm(answers[0] ?? '');
    const sameAnswer = siblings.filter((other) => {
      if (other.id === item.id || other.categoryId !== item.categoryId) return false;
      return (other.acceptedAnswers ?? []).some((answer) => norm(answer) === primary && primary.length > 1);
    });
    if (sameAnswer.length >= 1 && primary && !/^\d+$/.test(primary)) {
      return {
        status: 'NEAR_DUPLICATE',
        reason: `NEW. نفس الإجابة الأساسية تقريبًا مع ${sameAnswer.map((row) => row.id).join(', ')}.`,
      };
    }
  }

  if ((game.kind === 'question' || game.kind === 'identity') && answers.length) {
    const joined = answers.join(' ');
    const needsEnglish = hasArabic(joined) && !hasLatin(joined) && !/^\d+$/.test(norm(answers[0] ?? ''));
    const needsArabic = hasLatin(display) && !hasArabic(joined) && game.kind === 'identity';
    if (needsEnglish || needsArabic) {
      return {
        status: 'FIX',
        reason: needsEnglish ? 'NEW. ينقص مقابل إنجليزي شائع.' : 'NEW. ينقص مقابل عربي/نقحرة شائعة.',
      };
    }
  }

  if (game.id === 'fast-answer' && /^ما عاصمة/.test(display)) {
    return {
      status: 'NEEDS_REVIEW',
      reason: 'NEW. نمط «ما عاصمة…» يحول الفئة إلى امتحان جغرافيا.',
    };
  }
  if (game.id === 'fast-answer' && /ما الدولة التي تقع فيها/.test(display)) {
    return {
      status: 'NEEDS_REVIEW',
      reason: 'NEW. نفس قالب «ما الدولة التي تقع فيها مدينة…».',
    };
  }

  if (NICHE_NEW_IDS.has(item.id)) {
    return {
      status: 'NEEDS_REVIEW',
      reason: 'NEW. أضعف شهرة في مجموعة حفلات خليجية عامة من الكتالوج الأصلي.',
    };
  }
  if (FILLER_FRUIT_IDS.has(item.id)) {
    return {
      status: 'NEEDS_REVIEW',
      reason: 'NEW. حشو فواكه عامة. الأصل تجنّب تحويل الفئة إلى قائمة بقالة.',
    };
  }
  if (FILLER_PLAYER_IDS.has(item.id)) {
    return {
      status: 'NEEDS_REVIEW',
      reason: 'NEW. لاعب إضافي على فئة كانت أصلًا 20 لاعبًا. الأندية هي التنويع؛ الأسماء الجديدة تكرار نمط.',
    };
  }
  if (GENERIC_OBJECT_IDS.has(item.id)) {
    return {
      status: 'NEEDS_REVIEW',
      reason: 'NEW. عنصر عام/فضفاض. قد يُرسم أو يُخمَّن بأي شيء، أو يكرّر مفهومًا أبسط من الأصل.',
    };
  }
  if (PAD_COUNTRY_IDS.has(item.id)) {
    return {
      status: 'NEEDS_REVIEW',
      reason: 'NEW. بلد إضافي بأسلوب قائمة أطلس أكثر من موضوع سالفة/تخمين ممتع.',
    };
  }
  if (item.id.startsWith('animals-hamster') || item.id === 'animals-frog' || item.id === 'animals-bee') {
    return {
      status: 'NEEDS_REVIEW',
      reason: 'NEW. حيوان صحيح لكن أقرب للحشو من إضافة شخصية قوية للفئة.',
    };
  }

  if (game.kind === 'prompt') {
    if (STRONG_NEW.has(key)) {
      return {
        status: 'KEEP',
        reason: 'NEW. موقف مميز عن الأصل؛ يبقى أقل ثقة من المحتوى المُراجع حتى تمرير المالك.',
      };
    }
    return {
      status: 'NEEDS_REVIEW',
      reason:
        'NEW. نبرة مناسبة غالبًا، لكن الفئة الأصلية مبنية على قوالب متكررة (وش أسوأ / اخترع / عطنا / لو). تأكد أنه موقف جديد لا إعادة صياغة.',
    };
  }

  if (STRONG_NEW.has(key)) {
    return {
      status: 'KEEP',
      reason:
        'NEW. عنصر قوي مبدئيًا (واضح، شائع، أو خليجي مميز). ليس توقيعًا نهائيًا — أقل ثقة من الأصل.',
    };
  }

  return {
    status: 'NEEDS_REVIEW',
    reason: 'NEW. لم يُراجع بشريًا بعد. لا يُعامل كالمحتوى الأصلي المُختار حتى تمرير المالك.',
  };
}

function uniqueConcepts(game, items) {
  const keys = new Set();
  for (const item of items) {
    if (game.kind === 'question') {
      keys.add(norm((item.acceptedAnswers ?? [])[0] ?? item.question));
    } else {
      keys.add(norm(item.text ?? item.question ?? ''));
    }
  }
  return keys.size;
}

function findClusters(game, items) {
  const byKey = new Map();
  for (const item of items) {
    const key =
      game.kind === 'question'
        ? `ans:${norm((item.acceptedAnswers ?? [])[0] ?? '')}`
        : `txt:${norm(item.text ?? item.question ?? '')}`;
    if (key.endsWith(':')) continue;
    const list = byKey.get(key) ?? [];
    list.push(item.id);
    byKey.set(key, list);
  }
  return [...byKey.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }));
}

function overusedPatterns(game, items) {
  if (game.kind !== 'question') {
    if (game.kind === 'prompt') {
      const starts = new Map();
      for (const item of items) {
        const prefix = String(item.text ?? '').slice(0, 12);
        starts.set(prefix, (starts.get(prefix) ?? 0) + 1);
      }
      return [...starts.entries()]
        .filter(([, count]) => count >= 4)
        .map(([prefix, count]) => `"${prefix}…" ×${count}`);
    }
    return [];
  }
  const patterns = [
    ['ما عاصمة', /^ما عاصمة/],
    ['ما الدولة التي تقع فيها مدينة', /ما الدولة التي تقع فيها/],
    ['في أي مسلسل يظهر', /في أي مسلسل يظهر/],
    ['ما اسم اللعبة/السلسلة', /ما (اسم |سلسلة|لعبة)/],
    ['ما الحيوان الذي', /ما الحيوان/],
    ['ما الأكلة/الطبق', /ما (الأكلة|طبق|الحلوى|الفاكهة)/],
  ];
  return patterns
    .map(([label, re]) => {
      const count = items.filter((item) => re.test(item.question ?? '')).length;
      return count >= 4 ? `${label} ×${count}` : null;
    })
    .filter(Boolean);
}

function loadAll(originalKeys) {
  const games = [];
  for (const game of GAMES) {
    const dir = join(CONTENT, game.id);
    const categories = readJson(join(dir, 'categories.json'));
    const fileName = game.kind === 'question' || game.kind === 'identity' ? 'questions.json' : 'words.json';
    const items = readJson(join(dir, fileName));
    const enriched = items.map((item) => {
      const origin = originalKeys.has(`${game.id}::${item.id}`) ? 'ORIGINAL' : 'NEW';
      return { ...item, origin };
    });
    for (const item of enriched) {
      const review = defaultReview(game, item, item.origin, enriched);
      item.reviewStatus = review.status;
      item.reviewReason = review.reason;
    }
    games.push({ game, categories, items: enriched });
  }
  return games;
}

function pct(part, whole) {
  if (!whole) return '0%';
  return `${Math.round((part / whole) * 1000) / 10}%`;
}

const originalKeys = loadOriginalKeys();
if (originalKeys.size !== 688) {
  console.warn(`Expected 688 original keys, found ${originalKeys.size}`);
}

const loaded = loadAll(originalKeys);

const allItems = loaded.flatMap((entry) =>
  entry.items.map((item) => ({
    gameId: entry.game.id,
    gameName: entry.game.name,
    kind: entry.game.kind,
    categoryId: item.categoryId,
    categoryName: entry.categories.find((category) => category.id === item.categoryId)?.name ?? item.categoryId,
    item,
  })),
);

const statusCounts = {};
const originCounts = { ORIGINAL: 0, NEW: 0 };
for (const row of allItems) {
  originCounts[row.item.origin] += 1;
  statusCounts[row.item.reviewStatus] = (statusCounts[row.item.reviewStatus] ?? 0) + 1;
}

const statusByOrigin = { ORIGINAL: {}, NEW: {} };
for (const row of allItems) {
  const bucket = statusByOrigin[row.item.origin];
  bucket[row.item.reviewStatus] = (bucket[row.item.reviewStatus] ?? 0) + 1;
}

const md = [];
md.push('# Content QA — full current catalog');
md.push('');
md.push('Read-only review dataset. **No production content was modified.**');
md.push('');
md.push('ORIGINAL = the curated 688-item baseline. NEW = expansion items. **New items are not equally trusted.**');
md.push('');
md.push('**Review policy for this pass:** ORIGINAL defaults to KEEP unless a defect was found. NEW defaults to NEEDS_REVIEW. KEEP on NEW is a shortlist of expansion items that look strong enough to consider — still not a curated sign-off. Prefer cutting weak NEW items over keeping a count of 40.');
md.push('');
md.push('Statuses are triage only. Nothing in production JSON was changed.');
md.push('');
md.push('## Dashboard');
md.push('');
md.push(`- **Total current items:** ${allItems.length}`);
md.push(`- **ORIGINAL:** ${originCounts.ORIGINAL} (${pct(originCounts.ORIGINAL, allItems.length)})`);
md.push(`- **NEW:** ${originCounts.NEW} (${pct(originCounts.NEW, allItems.length)})`);
md.push('');
md.push('### Review status counts (all items)');
md.push('');
for (const status of ['KEEP', 'NEEDS_REVIEW', 'FIX', 'REMOVE', 'DUPLICATE', 'NEAR_DUPLICATE']) {
  md.push(`- **${status}:** ${statusCounts[status] ?? 0}`);
}
md.push('');
md.push('### Status × origin');
md.push('');
md.push('| Status | ORIGINAL | NEW |');
md.push('| --- | ---: | ---: |');
for (const status of ['KEEP', 'NEEDS_REVIEW', 'FIX', 'REMOVE', 'DUPLICATE', 'NEAR_DUPLICATE']) {
  md.push(
    `| ${status} | ${statusByOrigin.ORIGINAL[status] ?? 0} | ${statusByOrigin.NEW[status] ?? 0} |`,
  );
}
md.push('');
md.push('### Per game');
md.push('');
md.push('| Game | Total | ORIGINAL | NEW | Original % | New % |');
md.push('| --- | ---: | ---: | ---: | ---: | ---: |');
for (const entry of loaded) {
  const orig = entry.items.filter((item) => item.origin === 'ORIGINAL').length;
  const neu = entry.items.filter((item) => item.origin === 'NEW').length;
  const total = entry.items.length;
  md.push(
    `| ${entry.game.name} | ${total} | ${orig} | ${neu} | ${pct(orig, total)} | ${pct(neu, total)} |`,
  );
}
md.push('');
md.push('### Per category');
md.push('');
md.push('| Game | Category | Total | ORIGINAL | NEW | Original % | New % | KEEP | NEEDS_REVIEW | FIX | NEAR_DUPLICATE | DUPLICATE | REMOVE |');
md.push('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');

for (const entry of loaded) {
  for (const category of entry.categories) {
    const items = entry.items.filter((item) => item.categoryId === category.id);
    const orig = items.filter((item) => item.origin === 'ORIGINAL').length;
    const neu = items.filter((item) => item.origin === 'NEW').length;
    const count = (status) => items.filter((item) => item.reviewStatus === status).length;
    md.push(
      `| ${entry.game.name} | ${category.name} | ${items.length} | ${orig} | ${neu} | ${pct(orig, items.length)} | ${pct(neu, items.length)} | ${count('KEEP')} | ${count('NEEDS_REVIEW')} | ${count('FIX')} | ${count('NEAR_DUPLICATE')} | ${count('DUPLICATE')} | ${count('REMOVE')} |`,
    );
  }
}

md.push('');
md.push('### Suggested owner starting order');
md.push('');
md.push('Start with categories where NEW items are a large share of non-KEEP rows:');
md.push('');

const categoryRisk = [];
for (const entry of loaded) {
  for (const category of entry.categories) {
    const items = entry.items.filter((item) => item.categoryId === category.id);
    const neu = items.filter((item) => item.origin === 'NEW').length;
    const questionableNew = items.filter(
      (item) => item.origin === 'NEW' && item.reviewStatus !== 'KEEP',
    ).length;
    categoryRisk.push({
      game: entry.game.name,
      category: category.name,
      neu,
      questionableNew,
      share: neu ? questionableNew / neu : 0,
    });
  }
}
categoryRisk.sort((a, b) => b.questionableNew - a.questionableNew || b.share - a.share);
md.push('| Priority | Game | Category | NEW items | NEW not KEEP |');
md.push('| ---: | --- | --- | ---: | ---: |');
categoryRisk.slice(0, 12).forEach((row, index) => {
  md.push(`| ${index + 1} | ${row.game} | ${row.category} | ${row.neu} | ${row.questionableNew} |`);
});
md.push('');

const csv = [];
csv.push(
  [
    'origin',
    'review_status',
    'game_id',
    'game_name',
    'category_id',
    'category_name',
    'item_id',
    'kind',
    'prompt',
    'answers_or_aliases',
    'reason',
  ].join(','),
);

function bullets(values) {
  if (!values.length) return '- _(none)_';
  return values.map((value) => `- ${value}`).join('\n');
}

for (const entry of loaded) {
  md.push(`# ${entry.game.name}`);
  md.push('');
  md.push(`**Game id:** \`${entry.game.id}\` · **kind:** ${entry.game.kind}`);
  md.push('');

  for (const category of entry.categories) {
    const items = entry.items.filter((item) => item.categoryId === category.id);
    const orig = items.filter((item) => item.origin === 'ORIGINAL').length;
    const neu = items.filter((item) => item.origin === 'NEW').length;
    const clusters = findClusters(entry.game, items);
    const families = familyHits(entry.game, items);
    const patterns = overusedPatterns(entry.game, items);
    const keep = items.filter((item) => item.reviewStatus === 'KEEP').length;
    const questionable = items.filter((item) =>
      ['NEEDS_REVIEW', 'FIX', 'NEAR_DUPLICATE', 'DUPLICATE', 'REMOVE'].includes(item.reviewStatus),
    ).length;
    const likelyRemove = items.filter((item) =>
      ['REMOVE', 'DUPLICATE', 'NEAR_DUPLICATE'].includes(item.reviewStatus),
    ).length;
    const newKeep = items.filter((item) => item.origin === 'NEW' && item.reviewStatus === 'KEEP').length;
    const concepts = uniqueConcepts(entry.game, items);
    const repeated = clusters.filter((cluster) => cluster.ids.length > 1);
    const padded = neu >= orig && questionable >= Math.max(6, Math.floor(neu * 0.4));

    md.push(`## ${entry.game.name} — ${category.name}`);
    md.push('');
    md.push(`**Category id:** \`${category.id}\``);
    md.push('');
    md.push(`- **Total:** ${items.length}`);
    md.push(`- **ORIGINAL:** ${orig} (${pct(orig, items.length)})`);
    md.push(`- **NEW:** ${neu} (${pct(neu, items.length)})`);
    md.push(`- **Unique concepts (normalized canonical/answer):** ${concepts}`);
    md.push(`- **Repeated-concept clusters:** ${repeated.length}`);
    if (repeated.length) {
      for (const cluster of repeated) {
        md.push(`  - ${cluster.key} → ${cluster.ids.join(', ')}`);
      }
    } else {
      md.push('  - none detected by exact normalized key');
    }
    md.push(`- **Near-duplicate / concept families:** ${families.length ? '' : 'none flagged'}`);
    if (families.length) {
      for (const family of families) {
        md.push(`  - ${family}`);
      }
    }
    md.push(
      `- **Overused question patterns:** ${patterns.length ? patterns.join('؛ ') : 'none flagged at threshold ×4'}`,
    );
    md.push(
      `- **Does it feel varied?** ${
        padded
          ? 'No — expansion looks like padding on top of a stronger original core.'
          : orig >= 15 && newKeep >= 4 && questionable < items.length * 0.35
            ? 'Mostly yes — original set plus a few useful additions.'
            : 'Mixed — review every NEW item before treating the current count as deserved.'
      }`,
    );
    md.push(
      `- **Does it deserve all current items?** No. ${orig} originals were curated; ${neu} new items need an owner pass. A smaller excellent category beats ${items.length} mediocre variations.`,
    );
    md.push(`- **Strong (KEEP):** ${keep} (of which NEW KEEP: ${newKeep})`);
    md.push(`- **Questionable (not KEEP):** ${questionable}`);
    md.push(`- **Likely remove / collapse (REMOVE, DUPLICATE, NEAR_DUPLICATE):** ${likelyRemove}`);
    md.push('');

    items.forEach((item, index) => {
      const display = displayOf(entry.game, item);
      const answers = answersOf(entry.game, item);
      md.push(`### ${index + 1}. \`${item.id}\``);
      md.push('');
      md.push(`- **ID:** \`${item.id}\``);
      md.push(`- **Game:** ${entry.game.name} (\`${entry.game.id}\`)`);
      md.push(`- **Category:** ${category.name} (\`${category.id}\`)`);
      md.push(`- **Origin:** ${item.origin}`);
      md.push(`- **Review status:** ${item.reviewStatus}`);
      if (entry.game.kind === 'question') {
        md.push(`- **Question:** ${display}`);
        md.push('- **Current answers:**');
        md.push(bullets(answers));
        md.push('- **Aliases:** included in answers above (Fast Answer has no separate alias field)');
      } else if (entry.game.kind === 'identity') {
        md.push(`- **Identity:** ${display}`);
        md.push('- **Current answers / aliases:**');
        md.push(bullets(answers));
      } else if (entry.game.kind === 'prompt') {
        md.push(`- **Prompt:** ${display}`);
        md.push('- **Answers:** n/a (open response)');
        md.push('- **Aliases:** n/a');
      } else {
        md.push(`- **Word / topic:** ${display}`);
        md.push('- **Current aliases:**');
        md.push(bullets(answers));
      }
      md.push(`- **Difficulty/tags/metadata:** none in schema`);
      md.push(`- **Reason:** ${item.reviewReason}`);
      md.push('');

      csv.push(
        [
          item.origin,
          item.reviewStatus,
          entry.game.id,
          entry.game.name,
          category.id,
          category.name,
          item.id,
          entry.game.kind,
          csvCell(display),
          csvCell(answers.join(' | ')),
          csvCell(item.reviewReason),
        ].join(','),
      );
    });
  }
}

md.push('## Notes for owner review');
md.push('');
md.push('- Statuses are a **starting triage**, not a deletion order.');
md.push('- Inspect every NEW row. KEEP on NEW is a shortlist, not a sign-off.');
md.push('- ORIGINAL KEEP does not mean “untouchable”; it means no new defect was found beyond the previous curation.');
md.push('- Do not treat 40-per-category as a goal. Cutting weak NEW items is expected.');
md.push('- FIX means the current wording/aliases are wrong or leaky; do not auto-edit in this pass.');
md.push('');

writeFileSync(join(REVIEW, 'CONTENT_QA.md'), md.join('\n'), 'utf8');
writeFileSync(join(REVIEW, 'CONTENT_QA.csv'), `${csv.join('\n')}\n`, 'utf8');

console.log(`original keys: ${originalKeys.size}`);
console.log(`items: ${allItems.length}`);
console.log(originCounts);
console.log(statusCounts);
console.log('wrote CONTENT_QA.md and CONTENT_QA.csv');
