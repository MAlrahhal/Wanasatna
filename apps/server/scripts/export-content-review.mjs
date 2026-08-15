/**
 * Generate complete owner-review catalogs from production content JSON.
 * Usage (from repo or apps/server): node apps/server/scripts/export-content-review.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

function resolveContentRoot() {
  let dir = process.cwd();

  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(dir, 'content');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  const fromScript = join(SCRIPT_DIR, '../../../content');
  if (existsSync(fromScript)) {
    return fromScript;
  }

  throw new Error('Could not locate the repository content directory.');
}

const GAMES = [
  { id: 'bara-al-salafa', name: 'برا السالفة', kind: 'word' },
  { id: 'draw-guess', name: 'ارسم وخمّن', kind: 'word' },
  { id: 'imposter-draw', name: 'الإمبوستر بالرسم', kind: 'word' },
  { id: 'fast-answer', name: 'أسرع إجابة', kind: 'question' },
  { id: 'who-wrote-it', name: 'من كتبها؟', kind: 'prompt' },
  { id: 'judge', name: 'قاضي', kind: 'prompt' },
  { id: 'guessing-challenge', name: 'تحدي التخمين', kind: 'identity' },
];

const ACTION_LINE = '[ ] KEEP  [ ] EDIT  [ ] REMOVE';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function joinAliases(answers) {
  return (answers ?? []).filter((item) => String(item).trim()).join(' | ');
}

function joinAliasesArabic(answers) {
  return (answers ?? []).filter((item) => String(item).trim()).join('، ');
}

function collectItems(contentRoot) {
  const items = [];

  for (const game of GAMES) {
    const gameDir = join(contentRoot, game.id);
    const categories = readJson(join(gameDir, 'categories.json'));
    const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

    if (game.kind === 'question' || game.kind === 'identity') {
      const questions = readJson(join(gameDir, 'questions.json'));
      for (const question of questions) {
        const answers = question.acceptedAnswers ?? [];
        const canonicalAnswer = answers[0] ?? '';
        items.push({
          game_id: game.id,
          game_name: game.name,
          category_id: question.categoryId,
          category_name: categoryNameById.get(question.categoryId) ?? question.categoryId,
          item_id: question.id,
          item_type: game.kind,
          canonical_text: game.kind === 'identity' ? question.question : canonicalAnswer,
          question: game.kind === 'question' ? question.question : '',
          canonical_answer: game.kind === 'identity' ? question.question : canonicalAnswer,
          accepted_aliases: joinAliases(answers),
          answers,
          display_question: question.question,
        });
      }
      continue;
    }

    const words = readJson(join(gameDir, 'words.json'));
    for (const word of words) {
      items.push({
        game_id: game.id,
        game_name: game.name,
        category_id: word.categoryId,
        category_name: categoryNameById.get(word.categoryId) ?? word.categoryId,
        item_id: word.id,
        item_type: game.kind,
        canonical_text: word.text,
        question: '',
        canonical_answer: '',
        accepted_aliases: '',
        answers: [],
        display_question: '',
      });
    }
  }

  return items;
}

function renderMarkdown(items) {
  const lines = [
    '# مراجعة المالك — كتالوج المحتوى الكامل',
    '',
    'ملف مراجعة مشتق من JSON الإنتاج. ليس مصدر الحقيقة.',
    '',
    'لكل عنصر: أبقِ / عدّل / احذف. لا اختيار مسبق.',
    '',
  ];

  let currentGame = '';
  let currentCategory = '';

  for (const item of items) {
    if (item.game_id !== currentGame) {
      currentGame = item.game_id;
      currentCategory = '';
      lines.push(`# ${item.game_name}`);
      lines.push('');
    }

    if (item.category_id !== currentCategory) {
      currentCategory = item.category_id;
      lines.push(`## ${item.category_name}`);
      lines.push('');
    }

    if (item.item_type === 'question') {
      lines.push(`### ${item.item_id}`);
      lines.push(`- السؤال: ${item.question}`);
      lines.push(`- الجواب: ${item.canonical_answer}`);
      lines.push(`- الأجوبة المقبولة: ${joinAliasesArabic(item.answers)}`);
      lines.push(ACTION_LINE);
      lines.push('');
      continue;
    }

    if (item.item_type === 'identity') {
      lines.push(`### ${item.item_id}`);
      lines.push(`- العرض: ${item.canonical_text}`);
      lines.push(`- الأجوبة المقبولة: ${joinAliasesArabic(item.answers)}`);
      lines.push(ACTION_LINE);
      lines.push('');
      continue;
    }

    lines.push(`\`${item.item_id} — ${item.canonical_text}\``);
    lines.push(ACTION_LINE);
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function renderCsv(items) {
  const header = [
    'game_id',
    'game_name',
    'category_id',
    'category_name',
    'item_id',
    'item_type',
    'canonical_text',
    'question',
    'canonical_answer',
    'accepted_aliases',
    'owner_action',
    'owner_notes',
  ];

  const rows = [header.join(',')];
  for (const item of items) {
    rows.push(
      [
        item.game_id,
        item.game_name,
        item.category_id,
        item.category_name,
        item.item_id,
        item.item_type,
        item.canonical_text,
        item.question,
        item.canonical_answer,
        item.accepted_aliases,
        '',
        '',
      ]
        .map(csvCell)
        .join(','),
    );
  }

  return `${rows.join('\n')}\n`;
}

function countCsvDataRows(csvText) {
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/);
  let rows = 0;
  let inQuotes = false;

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === '' && !inQuotes && i === lines.length - 1) {
      continue;
    }
    if (line === '' && !inQuotes) {
      continue;
    }

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      }
    }

    if (!inQuotes) {
      rows += 1;
    }
  }

  return rows;
}

const contentRoot = resolveContentRoot();
const items = collectItems(contentRoot);
const reviewDir = join(contentRoot, 'review');
mkdirSync(reviewDir, { recursive: true });

const markdown = renderMarkdown(items);
const csv = renderCsv(items);

writeFileSync(join(reviewDir, 'OWNER_REVIEW.md'), markdown, 'utf8');
writeFileSync(join(reviewDir, 'OWNER_REVIEW.csv'), csv, 'utf8');

const csvRows = countCsvDataRows(csv);
if (csvRows !== items.length) {
  throw new Error(`CSV row count ${csvRows} !== production items ${items.length}`);
}

console.log(
  JSON.stringify({
    productionItems: items.length,
    reviewRows: csvRows,
    markdownPath: 'content/review/OWNER_REVIEW.md',
    csvPath: 'content/review/OWNER_REVIEW.csv',
  }),
);
