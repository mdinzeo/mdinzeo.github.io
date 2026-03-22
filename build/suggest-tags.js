/**
 * suggest-tags.js
 *
 * Reads articles.json and asks Claude to suggest a controlled tag vocabulary
 * based on Maria's actual writing corpus. Publications are included as a
 * required tag category automatically.
 *
 * Run: node build/suggest-tags.js
 * Output: src/data/suggested-tags.json (for your review before using)
 *
 * Requires ANTHROPIC_API_KEY in environment or .env file
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const ARTICLES_PATH = path.join(__dirname, '..', 'docs', 'data', 'articles.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'suggested-tags.json');

const client = new Anthropic();

async function run() {
  console.log('Reading articles.json...');
  const articles = JSON.parse(fs.readFileSync(ARTICLES_PATH, 'utf8'));
  console.log(`Loaded ${articles.length} articles`);

  // Extract publications for the required tag category
  const publications = [...new Set(articles.map(a => a.publication).filter(Boolean))].sort();
  console.log(`Publications found: ${publications.join(', ')}`);

  // Build a compact corpus: title + short description per article
  // Capped to keep the prompt manageable
  const corpus = articles.map(a => {
    const desc = (a.description || a.excerpt || '').substring(0, 150).trim();
    return `${a.title}${desc ? ' | ' + desc : ''}`;
  }).join('\n');

  console.log(`\nSending corpus to Claude (${corpus.length} chars)...`);
  console.log('This may take a moment...\n');

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are analyzing the complete article corpus of Maria Dinzeo, a journalist who covers federal tech and privacy litigation, cybersecurity law, and related topics primarily at the Northern District of California.

Below is the full list of her ${articles.length} article titles and descriptions. Your job is to suggest a controlled tag vocabulary that could be applied to her articles for browsing and filtering.

Guidelines:
- Tags should reflect what actually appears in her writing, not what could theoretically appear
- Keep the vocabulary tight and useful — aim for 40-80 total tags across all categories
- Tags should be specific enough to be meaningful but broad enough to apply to multiple articles
- Named cases should only be included if they appear frequently enough to be worth a tag
- Named individuals should only be included if they are recurring subjects (not one-off mentions)
- Err on the side of fewer, better tags over many niche tags

Return ONLY valid JSON in this exact structure (no other text):
{
  "categories": [
    {
      "name": "Topic",
      "description": "Broad subject areas",
      "tags": ["Privacy", "Data Breach", "..."]
    },
    {
      "name": "Law & Regulation",
      "description": "Specific laws, regulations, and legal frameworks",
      "tags": ["CCPA", "CFAA", "..."]
    },
    {
      "name": "Notable Cases",
      "description": "Recurring named cases worth tagging",
      "tags": ["Case Name v. Defendant", "..."]
    },
    {
      "name": "Key Figures",
      "description": "Individuals who are recurring subjects of coverage",
      "tags": ["Name (Title)", "..."]
    }
  ],
  "notes": "Any observations about the corpus or tagging decisions worth flagging"
}

Do NOT include a Publication category — that will be added automatically from: ${publications.join(', ')}

Article corpus:
${corpus}`
    }]
  });

  const responseText = message.content[0].text.trim();

  // Parse and validate JSON
  let result;
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    // Claude sometimes wraps JSON in markdown — strip it
    const match = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      result = JSON.parse(match[1]);
    } else {
      throw new Error('Could not parse Claude response as JSON:\n' + responseText);
    }
  }

  // Inject the required Publication category
  result.categories.unshift({
    name: 'Publication',
    description: 'Required tag — every article gets exactly one publication tag',
    required: true,
    tags: publications
  });

  // Write output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));

  console.log('✅ Tag suggestions saved to src/data/suggested-tags.json\n');
  console.log('Summary:');
  result.categories.forEach(cat => {
    console.log(`  ${cat.name} (${cat.tags.length} tags): ${cat.tags.slice(0, 5).join(', ')}${cat.tags.length > 5 ? '...' : ''}`);
  });
  console.log('\nReview the file, edit as needed, then we can build the tagger.');
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
