import { PLAYABLE_GAME_IDS, isPlayableGameId, type PlayableGameId } from '@wanasatna/shared';

export const HOW_TO_PLAY_BUTTON_LABEL = 'شرح اللعبة';

export type HowToPlaySectionId = 'idea' | 'howToPlay' | 'roles' | 'cards' | 'scoring';

export type HowToPlaySection = {
  id: HowToPlaySectionId;
  title: string;
  lines: readonly string[];
};

export type HowToPlayGuide = {
  gameId: PlayableGameId;
  title: string;
  sections: readonly HowToPlaySection[];
};

const SECTION_TITLES: Record<HowToPlaySectionId, string> = {
  idea: '🎯 فكرة اللعبة',
  howToPlay: '🎮 طريقة اللعب',
  roles: '👥 الأدوار',
  cards: '🃏 الكروت / القدرات',
  scoring: '🏆 النقاط',
};

function section(id: HowToPlaySectionId, lines: readonly string[]): HowToPlaySection {
  return { id, title: SECTION_TITLES[id], lines };
}

const GUIDES: Record<PlayableGameId, HowToPlayGuide> = {
  'bara-al-salafa': {
    gameId: 'bara-al-salafa',
    title: 'برا السالفة',
    sections: [
      section('idea', [
        'واحد منكم ما يعرف الكلمة، والباقين يعرفونها. حاولوا تكتشفون مين هو بدون ما تكشفون الكلمة.',
      ]),
      section('howToPlay', [
        'تشوف دورك أول: إما داخل السالفة وتعرف الكلمة، أو براها وما تعرفها.',
        'بعدين بالدور واحد يسأل ثاني سؤال يساعدكم تعرفون مين برا السالفة.',
        'بعد الأسئلة هذي، كل واحد يختار لاعب يسأله سؤال حر.',
        'تصوّتون على اللي تظنونه برا السالفة.',
        'اللي برا يحاول يخمن الكلمة من الخيارات.',
      ]),
      section('roles', [
        'داخل السالفة: تعرف الكلمة. اسأل وتجاوب بحذر، وما تفضحها.',
        'برا السالفة: ما تعرف الكلمة. اندمج مع الكلام، وآخر الجولة حاول تخمنها.',
      ]),
      section('scoring', [
        'إذا صوّت على اللي برا السالفة: تأخذ 100.',
        'اللي برا السالفة: يأخذ 100 إذا خمّن الكلمة صح.',
      ]),
    ],
  },
  'draw-guess': {
    gameId: 'draw-guess',
    title: 'ارسم وخمن',
    sections: [
      section('idea', ['واحد يرسم الكلمة، والباقين يخمنون وش هي قبل ما يفوز أحد.']),
      section('howToPlay', [
        'واحد منكم يصير الرسّام ويشوف الكلمة ويرسمها.',
        'الباقين يكتبون تخميناتهم من الرسمة.',
        'أول واحد يخمن صح يفوز بالجولة.',
      ]),
      section('roles', [
        'الرسّام: يرسم الكلمة، وما يقدر يخمن.',
        'الباقين: يشوفون الرسمة ويخمنون.',
      ]),
      section('scoring', [
        'اللي خمّن صح يأخذ 100، والرسّام بعد يأخذ 100.',
        'إذا ما أحد خمّن صح، ما فيه نقاط هالجولة.',
      ]),
    ],
  },
  'imposter-draw': {
    gameId: 'imposter-draw',
    title: 'الإمبوستر بالرسم',
    sections: [
      section('idea', [
        'كلكم ترسمون نفس الصورة… إلا واحد ما شافها. حاولوا تكتشفونه من طريقة رسمه.',
      ]),
      section('howToPlay', [
        'تشوف دورك: يا إنك شفت الصورة، يا إنك الإمبوستر وما شفتها.',
        'بالدور كل واحد يضيف على نفس اللوحة.',
        'بعد الرسم تصوّتون مين الإمبوستر.',
        'الإمبوستر يحاول يخمن وش كانت الصورة.',
      ]),
      section('roles', [
        'جزء من الرسمة: شفت الصورة. ارسم منها وحاول تمسك الإمبوستر.',
        'الإمبوستر: ما شفت الصورة. ارسم كأنك تعرف، وبعد التصويت حاول تخمنها.',
      ]),
      section('scoring', [
        'إذا صوّت على الإمبوستر: تأخذ 100.',
        'الإمبوستر: 100 إذا ما انكشف بالتصويت، و100 ثانية إذا خمّن الصورة صح.',
      ]),
    ],
  },
  'timing-challenge': {
    gameId: 'timing-challenge',
    title: 'تحدي التوقيت',
    sections: [
      section('idea', ['اللعبة على إحساسك بالوقت: كم صار، أو متى توقف المؤقت.']),
      section('howToPlay', [
        'فيها وضعين، والمضيف يختار واحد منهم:',
        'تخمين الوقت: المؤقت يشتغل وأنت ما تشوفه، وبعدين تخمّن كم كان.',
        'إيقاف المؤقت: تشوف الوقت المطلوب، وتشغّل مؤقتك وتوقفه أقرب ما تقدر له.',
        'الأقرب للوقت المطلوب يترتب أعلى.',
      ]),
      section('scoring', [
        'الأول 100، الثاني 75، الثالث 50، والباقي 25.',
        'إذا تعادلوا بنفس الدقة، يأخذون نفس النقاط.',
        'اللي ما يرسل تخمين أو ما يوقف المؤقت ما يأخذ شيء.',
      ]),
    ],
  },
  'fast-answer': {
    gameId: 'fast-answer',
    title: 'أسرع إجابة',
    sections: [
      section('idea', ['سؤال يطلع للكل، وأول واحد يجيب صح يفوز بالجولة.']),
      section('howToPlay', [
        'يطلع السؤال قدام الجميع.',
        'اكتب إجابتك بأسرع ما تقدر.',
        'إذا غلطت، تقدر تحاول مرة ثانية لين أحد يصيب.',
      ]),
      section('scoring', ['أول إجابة صحيحة تأخذ 100. الباقين ما يأخذون شيء هالجولة.']),
    ],
  },
  'who-wrote-it': {
    gameId: 'who-wrote-it',
    title: 'من كتبها؟',
    sections: [
      section('idea', ['كلكم تجاوبون على نفس السؤال، وبعدين تخمنون مين كتب كل إجابة.']),
      section('howToPlay', [
        'يطلع سؤال، وكل واحد يكتب إجابته.',
        'بعدين تظهر الإجابات بدون أسماء.',
        'خمّن مين كتب كل إجابة، ما عدا إجابتك أنت.',
      ]),
      section('scoring', ['كل تخمين صح يعطيك 100.']),
    ],
  },
  judge: {
    gameId: 'judge',
    title: 'القاضي',
    sections: [
      section('idea', ['فيه سؤال مضحك أو غريب، والقاضي يختار أحلى إجابة.']),
      section('howToPlay', [
        'كل جولة واحد منكم يصير القاضي، والباقين يكتبون إجاباتهم.',
        'القاضي ما يكتب، ينتظر الإجابات.',
        'بعدين يشوف الإجابات بدون أسماء ويختار الأفضل.',
      ]),
      section('roles', [
        'القاضي: ما يجاوب. هو اللي يختار الفائز.',
        'الباقين: اكتبوا أطرف أو أذكى إجابة عشان القاضي يختاركم.',
      ]),
      section('scoring', ['صاحب الإجابة اللي اختارها القاضي يأخذ 100.']),
    ],
  },
  'guessing-challenge': {
    gameId: 'guessing-challenge',
    title: 'تحدي التخمين',
    sections: [
      section('idea', [
        'هويتك ظاهرة عند الخصم وأنت ما تشوفها. اسأله أسئلة نعم أو لا لين تعرف مين أنت.',
      ]),
      section('howToPlay', [
        'تقدر تلعب 1 ضد 1، أو فريقين 2 ضد 2.',
        'دور واحد يسأل سؤال إجابته نعم أو لا.',
        'الثاني يجاوب، وبعدين يتبدل الدور.',
        'لما تحس إنك عرفت، خمّن هويتك (أو هوية فريقكم في 2 ضد 2).',
        'أول تخمين صح يفوز بالجولة.',
      ]),
      section('roles', [
        '1 ضد 1: كل واحد يحاول يعرف شخصيته.',
        '2 ضد 2: أنت وشريكك نفس الهوية، وتسألون الفريق الثاني عشان تعرفونها.',
      ]),
      section('cards', [
        'لكل فريق بطاقة صفراء وبطاقة حمراء مرة واحدة بالمباراة.',
        'الصفراء: تعطي فريقك 3 أسئلة ورا بعض.',
        'الحمراء: تغيّر هوية الخصم إلى هوية جديدة من نفس الفئة.',
        'في 2 ضد 2 لازم شريكك يوافق قبل ما تُستخدم البطاقة.',
      ]),
      section('scoring', ['الفريق اللي يخمن صح يأخذ 100.']),
    ],
  },
};

export function getHowToPlayGuide(gameId: string | null | undefined): HowToPlayGuide | null {
  if (!gameId || !isPlayableGameId(gameId)) {
    return null;
  }

  return GUIDES[gameId];
}

export function flattenHowToPlayText(guide: HowToPlayGuide): string {
  return [guide.title, ...guide.sections.flatMap((entry) => [entry.title, ...entry.lines])].join('\n');
}

export function listHowToPlayGameIds(): readonly PlayableGameId[] {
  return PLAYABLE_GAME_IDS;
}
