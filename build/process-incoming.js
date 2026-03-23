/**
 * process-incoming.js
 *
 * Processes PDFs dropped into incoming/, extracts metadata via Claude,
 * appends new article entries to MariaDinzeo.xml, then archives the PDF.
 *
 * Run: node build/process-incoming.js
 * Called automatically by GitHub Actions on push to incoming/*.pdf
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pdfParse = require('pdf-parse');
const Anthropic = require('@anthropic-ai/sdk');

const INCOMING_DIR  = path.join(__dirname, '..', 'incoming');
const ARCHIVE_DIR   = path.join(__dirname, '..', 'archive');
const XML_PATH      = path.join(__dirname, '..', 'MariaDinzeo.xml');
const TAXONOMY_PATH = path.join(__dirname, '..', 'src', 'data', 'suggested-tags.json');
const TAGS_PATH     = path.join(__dirname, '..', 'src', 'data', 'article-tags.json');

const client = new Anthropic();

// ── PDF extraction ─────────────────────────────────────────────────────────────

async function extractPdfText(pdfPath) {
  const buffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(buffer);
  return data.text;
}

// ── Claude metadata extraction ─────────────────────────────────────────────────

async function extractArticleMetadata(pdfText) {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Extract metadata from this journalism article PDF for a portfolio website.

Return ONLY valid JSON (no other text):
{
  "title": "exact article headline",
  "date": "YYYY-MM-DD",
  "publication": "outlet name (e.g. Law.com, MLex, Courthouse News Service)",
  "url": "article URL if visible in the text, else empty string",
  "description": "2-3 sentence neutral summary of what the article covers",
  "preview_html": "<p>First paragraph.</p><p>Second paragraph.</p>"
}

Rules for preview_html:
- Use only <p> tags
- Include first 2-3 paragraphs only — this is a teaser, not a reprint
- Do not reproduce the full article (respects paywalls)
- Plain text content inside the <p> tags, no nested HTML

Article text:
${pdfText.substring(0, 8000)}`
    }]
  });

  const text = message.content[0].text.trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    throw new Error('Could not parse Claude response as JSON:\n' + text.substring(0, 200));
  }
}

// ── XML helpers ────────────────────────────────────────────────────────────────

function escapeXml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function encodeHtmlAsEntities(html) {
  // The XML stores HTML as entity-encoded content (not CDATA)
  return (html || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildXmlEntry(metadata) {
  const uuid = crypto.randomUUID();
  const date = `${metadata.date}T00:00:00+00:00`;
  const plainText = (metadata.preview_html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  return `    <article
        url="${escapeXml(metadata.url)}"
        authory_id=""
        uuid="${uuid}"
        date="${date}"
        source=""
    >
        <title>${escapeXml(metadata.title)}</title>
        <description>${escapeXml(metadata.description)}</description>
        <text>${escapeXml(plainText)}</text>
        <html>${encodeHtmlAsEntities(metadata.preview_html)}</html>
    </article>`;
}

function insertArticleIntoXml(xmlContent, articleEntry) {
  // Insert after the closing > of the <articles ...> opening tag
  const articlesStart = xmlContent.indexOf('<articles');
  const openTagEnd = xmlContent.indexOf('>\n', articlesStart) + 2;
  return xmlContent.slice(0, openTagEnd) + articleEntry + '\n' + xmlContent.slice(openTagEnd);
}

// ── Tagging ────────────────────────────────────────────────────────────────────

async function tagArticle(uuid, metadata) {
  if (!fs.existsSync(TAXONOMY_PATH)) return [];

  const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY_PATH, 'utf8'));
  const vocabularyString = taxonomy.categories.map(cat => {
    const note = cat.required ? ' (REQUIRED — assign exactly one)' : '';
    return `${cat.name}${note}:\n${cat.tags.map(t => `  - ${t}`).join('\n')}`;
  }).join('\n\n');

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Tag this article using ONLY tags from the vocabulary below. Return ONLY a JSON array of tag strings, no other text.

Rules:
- Publication tag is REQUIRED — use the exact publication name
- Assign 2-6 tags total including publication
- Only assign tags that clearly apply

Vocabulary:
${vocabularyString}

Article:
title: ${metadata.title}
description: ${metadata.description}
publication: ${metadata.publication}`
    }]
  });

  const text = message.content[0].text.trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    return match ? JSON.parse(match[1]) : [];
  }
}

function saveArticleTag(uuid, tags) {
  const existing = fs.existsSync(TAGS_PATH)
    ? JSON.parse(fs.readFileSync(TAGS_PATH, 'utf8'))
    : {};
  existing[uuid] = tags;
  fs.writeFileSync(TAGS_PATH, JSON.stringify(existing, null, 2));
}

// ── Archive ────────────────────────────────────────────────────────────────────

function archivePdf(pdfPath) {
  const now = new Date();
  const monthDir = path.join(
    ARCHIVE_DIR,
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  fs.mkdirSync(monthDir, { recursive: true });
  const dest = path.join(monthDir, path.basename(pdfPath));
  fs.renameSync(pdfPath, dest);
  console.log(`  Archived → archive/${path.relative(ARCHIVE_DIR, dest)}`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function run() {
  const pdfs = fs.readdirSync(INCOMING_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));

  if (pdfs.length === 0) {
    console.log('No PDFs found in incoming/ — nothing to do.');
    return;
  }

  console.log(`Found ${pdfs.length} PDF(s) to process\n`);

  let xmlContent = fs.readFileSync(XML_PATH, 'utf8');
  let processed = 0;
  let failed = 0;

  for (const filename of pdfs) {
    const pdfPath = path.join(INCOMING_DIR, filename);
    console.log(`Processing: ${filename}`);

    try {
      const text = await extractPdfText(pdfPath);
      console.log(`  Extracted ${text.length} chars from PDF`);

      const metadata = await extractArticleMetadata(text);
      console.log(`  Title:       ${metadata.title}`);
      console.log(`  Date:        ${metadata.date}`);
      console.log(`  Publication: ${metadata.publication}`);
      console.log(`  URL:         ${metadata.url || '(not found)'}`);

      const entry = buildXmlEntry(metadata);
      const uuid = entry.match(/uuid="([^"]+)"/)[1];
      xmlContent = insertArticleIntoXml(xmlContent, entry);

      const tags = await tagArticle(uuid, metadata);
      if (tags.length > 0) {
        saveArticleTag(uuid, tags);
        console.log(`  Tags:        ${tags.join(', ')}`);
      }

      archivePdf(pdfPath);
      processed++;
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      console.error(`  Leaving ${filename} in incoming/ for retry`);
      failed++;
    }
  }

  if (processed > 0) {
    fs.writeFileSync(XML_PATH, xmlContent, 'utf8');
    console.log(`\nXML updated with ${processed} new article(s).`);
  }

  if (failed > 0) {
    console.error(`\n${failed} PDF(s) failed — check errors above.`);
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
