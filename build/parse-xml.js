/**
 * Parse MariaDinzeo.xml and generate articles.json
 */

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const {
  slugify,
  getPublicationName,
  extractPreview,
  createExcerpt,
  writeJSON
} = require('./utils');

const XML_PATH = path.join(__dirname, '..', 'MariaDinzeo.xml');
const OUTPUT_PATH = path.join(__dirname, '..', 'docs', 'data', 'articles.json');

async function parseXML() {
  console.log('📖 Reading XML file...');

  // Read XML file
  const xmlContent = fs.readFileSync(XML_PATH, 'utf8');

  console.log('⚙️  Parsing XML...');

  // Parse XML
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xmlContent);

  const articles = result.articles.article;
  console.log(`✅ Found ${articles.length} articles`);

  console.log('🔄 Processing articles...');

  // Transform articles
  const processedArticles = articles.map((article, index) => {
    // Extract data from XML structure
    const url = article.$.url || '';
    const id = article.$.uuid || article.$.slug || `article-${index}`;
    const authoryId = article.$.authory_id || article.$.slug || '';
    const dateStr = article.$.date || '';
    let title = article.title?.[0] || 'Untitled';
    const description = article.description?.[0] || '';
    const text = article.text?.[0] || '';
    const html = article.html?.[0] || '';

    // Parse date
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const dateFormatted = date.toISOString().split('T')[0]; // YYYY-MM-DD

    // Get publication from URL
    const publication = getPublicationName(url);
    const publicationSlug = slugify(publication);

    // Clean up title based on publication
    if (publication === 'MLex') {
      // For MLex: remove everything after first pipe (including the pipe)
      const pipeIndex = title.indexOf('|');
      if (pipeIndex !== -1) {
        title = title.substring(0, pipeIndex).trim();
      }
    } else if (publication === 'Courthouse News Service') {
      // For CNS: remove pipes but keep all text
      title = title.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Create URL-friendly slug from title (limit length)
    const titleSlug = slugify(title).substring(0, 100);

    // Extract preview (first 2 paragraphs from HTML)
    const preview = extractPreview(html, 2);

    // Create excerpt (first 200 chars) for search results
    const excerpt = createExcerpt(description || text, 200);

    // Combine text for search indexing
    const searchText = `${title} ${description} ${text}`.substring(0, 5000);

    return {
      id,
      authoryId,
      slug: titleSlug,
      title,
      date: dateFormatted,
      year,
      publication,
      publicationSlug,
      url,
      description,
      preview,
      excerpt,
      searchText,
      readMoreUrl: `/articles/${titleSlug}/`
    };
  });

  // Sort by date (newest first)
  processedArticles.sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  });

  console.log('💾 Writing articles.json...');

  // Write to file
  const success = writeJSON(OUTPUT_PATH, processedArticles);

  if (success) {
    console.log(`✅ Successfully wrote ${processedArticles.length} articles to ${OUTPUT_PATH}`);

    // Print stats
    const publications = [...new Set(processedArticles.map(a => a.publication))];
    const years = [...new Set(processedArticles.map(a => a.year))].sort();

    console.log('\n📊 Stats:');
    console.log(`   Publications: ${publications.length}`);
    publications.forEach(pub => {
      const count = processedArticles.filter(a => a.publication === pub).length;
      console.log(`     - ${pub}: ${count} articles`);
    });
    console.log(`   Years: ${years[0]} - ${years[years.length - 1]}`);
  } else {
    console.error('❌ Failed to write articles.json');
    process.exit(1);
  }
}

// Run parser
parseXML().catch(error => {
  console.error('❌ Error parsing XML:', error);
  process.exit(1);
});
