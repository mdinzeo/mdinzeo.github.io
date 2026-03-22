/**
 * Generate search index using lunr.js
 */

const fs = require('fs');
const path = require('path');
const lunr = require('lunr');
const { readJSON, writeJSON } = require('./utils');

const ARTICLES_JSON = path.join(__dirname, '..', 'docs', 'data', 'articles.json');
const TAGS_JSON = path.join(__dirname, '..', 'src', 'data', 'article-tags.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'docs', 'assets', 'js', 'search-index.json');

function generateSearchIndex() {
  console.log('🔍 Generating search index...');

  // Load articles
  const articles = readJSON(ARTICLES_JSON);

  if (!articles || articles.length === 0) {
    console.error('❌ No articles found. Run `npm run parse` first.');
    process.exit(1);
  }

  console.log(`📚 Indexing ${articles.length} articles...`);

  // Load article tags
  const articleTagsMap = fs.existsSync(TAGS_JSON)
    ? JSON.parse(fs.readFileSync(TAGS_JSON, 'utf8'))
    : {};

  // Build lunr index
  const index = lunr(function () {
    // Define fields
    this.ref('id');
    this.field('title', { boost: 2 });        // Title is most important
    this.field('description', { boost: 1.5 }); // Description is second
    this.field('tags', { boost: 1.5 });        // Tags boost topic matches
    this.field('searchText');                  // Full text search
    this.field('publication');
    this.field('year');

    // Add documents
    articles.forEach(article => {
      this.add({
        id: article.id,
        title: article.title,
        description: article.description,
        tags: (articleTagsMap[article.id] || []).join(' '),
        searchText: article.searchText,
        publication: article.publication,
        year: article.year.toString()
      });
    });
  });

  // Create lookup map for article data
  const articleLookup = {};
  articles.forEach(article => {
    articleLookup[article.id] = {
      id: article.id,
      title: article.title,
      date: article.date,
      year: article.year,
      publication: article.publication,
      publicationSlug: article.publicationSlug,
      excerpt: article.excerpt,
      readMoreUrl: article.readMoreUrl,
      url: article.url,
      tags: articleTagsMap[article.id] || []
    };
  });

  // Prepare output
  const searchData = {
    index: index.toJSON(),
    articles: articleLookup
  };

  // Write to file
  console.log('💾 Writing search index...');
  const success = writeJSON(OUTPUT_PATH, searchData);

  if (success) {
    const stats = fs.statSync(OUTPUT_PATH);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`✅ Search index generated: ${sizeKB} KB`);
  } else {
    console.error('❌ Failed to write search index');
    process.exit(1);
  }
}

// Run generator
generateSearchIndex();
