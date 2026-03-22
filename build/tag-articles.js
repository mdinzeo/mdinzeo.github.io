/**
 * tag-articles.js
 *
 * Backfill tagger: reads all articles from articles.json, assigns tags from the
 * controlled vocabulary in suggested-tags.json using Claude, and writes results
 * to src/data/article-tags.json.
 *
 * Resumable: already-tagged articles are skipped on re-run.
 * Run: node build/tag-articles.js
 *
 * Requires ANTHROPIC_API_KEY in environment or .env file.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const ARTICLES_PATH  = path.join(__dirname, '..', 'docs', 'data', 'articles.json');
const TAXONOMY_PATH  = path.join(__dirname, '..', 'src', 'data', 'suggested-tags.json');
const TAGS_OUT_PATH  = path.join(__dirname, '..', 'src', 'data', 'article-tags.json');

const BATCH_SIZE = 50;

const client = new Anthropic();

// ── Helpers ────────────────────────────────────────────────────────────────────

function loadTags() {
  if (fs.existsSync(TAGS_OUT_PATH)) {
    return JSON.parse(fs.readFileSync(TAGS_OUT_PATH, 'utf8'));
  }
  return {};
}

function saveTags(tags) {
  fs.writeFileSync(TAGS_OUT_PATH, JSON.stringify(tags, null, 2));
}

function buildVocabularyString(taxonomy) {
  return taxonomy.categories.map(cat => {
    const note = cat.required ? ' (REQUIRED — always assign exactly one)' : '';
    return `${cat.name}${note}:\n${cat.tags.map(t => `  - ${t}`).join('\n')}`;
  }).join('\n\n');
}

// ── Claude tagging ─────────────────────────────────────────────────────────────

async function tagBatch(batch, vocabularyString) {
  const articleList = batch.map((a, i) =>
    `[${i}] id:${a.id}\ntitle: ${a.title}\ndescription: ${(a.description || a.excerpt || '').substring(0, 200)}\npublication: ${a.publication}`
  ).join('\n\n');

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Tag these ${batch.length} journalism articles using ONLY the controlled vocabulary below.

Rules:
- Use only tags from the vocabulary — do not invent new tags
- Publication tag is REQUIRED for every article — use the exact publication name shown
- Assign 2-6 tags per article total (including publication)
- Only assign tags that clearly apply — do not guess or stretch
- For "Raymond Chow (Shrimp Boy)", also match on "Shrimp Boy" in the text
- Return ONLY a JSON object mapping article id to array of tags, no other text

Vocabulary:
${vocabularyString}

Articles:
${articleList}

Return format:
{
  "uuid-here": ["Tag1", "Tag2", "Publication Name"],
  ...
}`
    }]
  });

  const text = message.content[0].text.trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    throw new Error('Could not parse Claude response:\n' + text.substring(0, 500));
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function run() {
  const articles = JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf8'));
  const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY_PATH, 'utf8'));
  const existingTags = loadTags();

  const vocabularyString = buildVocabularyString(taxonomy);

  const untagged = articles.filter(a => !existingTags[a.id]);
  console.log(`${articles.length} total articles, ${Object.keys(existingTags).length} already tagged, ${untagged.length} to process`);

  if (untagged.length === 0) {
    console.log('All articles already tagged.');
    return;
  }

  const batches = [];
  for (let i = 0; i < untagged.length; i += BATCH_SIZE) {
    batches.push(untagged.slice(i, i + BATCH_SIZE));
  }

  console.log(`Processing ${batches.length} batch(es) of up to ${BATCH_SIZE}...\n`);

  let tagged = 0;
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const start = i * BATCH_SIZE + 1;
    const end = start + batch.length - 1;
    process.stdout.write(`  Batch ${i + 1}/${batches.length} (articles ${start}-${end})... `);

    try {
      const results = await tagBatch(batch, vocabularyString);
      Object.assign(existingTags, results);
      saveTags(existingTags);
      tagged += Object.keys(results).length;
      console.log(`✓ (${Object.keys(results).length} tagged)`);
    } catch (err) {
      console.log(`✗ ERROR: ${err.message}`);
      console.log('  Progress saved — re-run to retry failed batch');
    }

    // Brief pause between batches to be polite to the API
    if (i < batches.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\nDone. ${tagged} articles tagged. Results in src/data/article-tags.json`);
  console.log('Run npm run build to incorporate tags into the site.');
}

run().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
