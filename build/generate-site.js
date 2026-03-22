/**
 * Generate static HTML pages from articles data
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const {
  readFile,
  writeFile,
  readJSON,
  ensureDir,
  formatDate,
  escapeHtml
} = require('./utils');

// Paths
const ARTICLES_JSON = path.join(__dirname, '..', 'docs', 'data', 'articles.json');
const FEATURED_JSON = path.join(__dirname, '..', 'src', 'data', 'featured.json');
const TAGS_JSON = path.join(__dirname, '..', 'src', 'data', 'article-tags.json');
const TEMPLATES_DIR = path.join(__dirname, '..', 'src', 'templates');
const CONTENT_DIR = path.join(__dirname, '..', 'src', 'content');
const STYLES_DIR = path.join(__dirname, '..', 'src', 'styles');
const SCRIPTS_DIR = path.join(__dirname, '..', 'src', 'scripts');
const OUTPUT_DIR = path.join(__dirname, '..', 'docs');

// Load templates
function loadTemplate(name) {
  const filePath = path.join(TEMPLATES_DIR, `${name}.html`);
  return readFile(filePath);
}

// Combine CSS files
function combineCSS() {
  console.log('📦 Combining CSS files...');

  const cssFiles = ['reset.css', 'variables.css', 'layout.css', 'components.css', 'pages.css'];
  const combined = cssFiles
    .map(file => {
      const content = readFile(path.join(STYLES_DIR, file));
      return content ? `/* ${file} */\n${content}\n` : '';
    })
    .join('\n');

  const outputPath = path.join(OUTPUT_DIR, 'assets', 'css', 'styles.css');
  ensureDir(path.dirname(outputPath));
  writeFile(outputPath, combined);

  console.log('✅ CSS combined');
}

// Copy JS files
function copyScripts() {
  console.log('📦 Copying JavaScript files...');

  ensureDir(path.join(OUTPUT_DIR, 'assets', 'js'));

  // Copy our scripts
  const scripts = ['search.js', 'filter.js'];
  scripts.forEach(script => {
    const source = path.join(SCRIPTS_DIR, script);
    const dest = path.join(OUTPUT_DIR, 'assets', 'js', script);

    if (fs.existsSync(source)) {
      fs.copyFileSync(source, dest);
      console.log(`  ✓ Copied ${script}`);
    }
  });

  // Copy lunr.js from node_modules
  const lunrSource = path.join(__dirname, '..', 'node_modules', 'lunr', 'lunr.js');
  const lunrDest = path.join(OUTPUT_DIR, 'assets', 'js', 'lunr.js');
  if (fs.existsSync(lunrSource)) {
    fs.copyFileSync(lunrSource, lunrDest);
    console.log('  ✓ Copied lunr.js');
  }

  console.log('✅ Scripts copied');
}

// Copy images
function copyImages() {
  console.log('📦 Copying images...');

  const sourceDir = path.join(__dirname, '..', 'src', 'assets', 'images');
  const destDir = path.join(OUTPUT_DIR, 'assets', 'images');

  if (fs.existsSync(sourceDir)) {
    ensureDir(destDir);

    const files = fs.readdirSync(sourceDir);
    files.forEach(file => {
      const source = path.join(sourceDir, file);
      const dest = path.join(destDir, file);

      if (fs.statSync(source).isFile()) {
        fs.copyFileSync(source, dest);
        console.log(`  ✓ Copied ${file}`);
      }
    });

    console.log('✅ Images copied');
  } else {
    console.log('⚠️  No images directory found');
  }
}

// Get publication URL
function getPublicationUrl(publication) {
  const urlMap = {
    'Law.com': 'https://www.law.com/',
    'MLex': 'https://www.mlex.com/',
    'Courthouse News Service': 'https://www.courthousenews.com/',
    'SF Bay Guardian': 'https://en.wikipedia.org/wiki/San_Francisco_Bay_Guardian'
  };
  return urlMap[publication] || null;
}

// Render base template
function renderBase(content, title, description, activeNav = '', scripts = '') {
  const base = loadTemplate('base');
  const currentYear = new Date().getFullYear();

  return base
    .replace(/{{CONTENT}}/g, content)
    .replace(/{{TITLE}}/g, escapeHtml(title))
    .replace(/{{DESCRIPTION}}/g, escapeHtml(description))
    .replace(/{{URL}}/g, 'https://mdinzeo.github.io')
    .replace(/{{YEAR}}/g, currentYear.toString())
    .replace(/{{HOME_ACTIVE}}/g, activeNav === 'home' ? 'active' : '')
    .replace(/{{ABOUT_ACTIVE}}/g, activeNav === 'about' ? 'active' : '')
    .replace(/{{CONTACT_ACTIVE}}/g, activeNav === 'contact' ? 'active' : '')
    .replace(/{{SCRIPTS}}/g, scripts);
}

// Generate article card HTML
function generateArticleCard(article, isFeatured = false, tags = []) {
  const cardClass = isFeatured ? 'article-card featured-card' : 'article-card';
  const featuredBadge = isFeatured ? '<span class="featured-badge">Featured</span>' : '';

  const publicationUrl = getPublicationUrl(article.publication);
  const publicationHtml = publicationUrl
    ? `<a href="${publicationUrl}" target="_blank" rel="noopener" class="publication-link">${escapeHtml(article.publication)}</a>`
    : escapeHtml(article.publication);

  // Show topic tags (skip publication tag — already shown in header), max 4
  const topicTags = tags.filter(t => t !== article.publication).slice(0, 4);
  const tagsHtml = topicTags.length > 0
    ? `<div class="article-tags">${topicTags.map(t => `<span class="article-tag" data-tag="${escapeHtml(t)}" title="Filter by: ${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';

  const tagsAttr = tags.length > 0 ? ` data-tags="${escapeHtml(tags.join(','))}"` : '';

  return `
    <article class="${cardClass}" data-id="${article.id}"${tagsAttr} data-publication="${article.publicationSlug}" data-year="${article.year}">
      ${featuredBadge}
      <div class="article-meta">
        <span class="publication">${publicationHtml}</span>
        <span class="date">${formatDate(article.date)}</span>
      </div>
      <h2 class="article-title">
        <a href="${article.readMoreUrl}">${escapeHtml(article.title)}</a>
      </h2>
      <p class="article-description">${escapeHtml(article.description || article.excerpt)}</p>
      ${tagsHtml}
      <a href="${article.readMoreUrl}" class="read-more">Read preview</a>
    </article>
  `;
}

// Generate latest story item HTML
function generateLatestStoryItem(article) {
  const publicationUrl = getPublicationUrl(article.publication);
  const publicationHtml = publicationUrl
    ? `<a href="${publicationUrl}" target="_blank" rel="noopener" class="publication-link">${escapeHtml(article.publication)}</a>`
    : escapeHtml(article.publication);

  return `
    <li class="latest-story-item">
      <span class="latest-story-table">
        <span class="latest-story-title">
          <a href="${article.url}" target="_blank" rel="noopener" class="latest-story-title-link">
            ${escapeHtml(article.title)} <span class="external-icon">↗</span>
          </a>
        </span>
        <span class="latest-story-meta">
          <span class="latest-story-publication">${publicationHtml}</span>
          <span class="latest-story-date">${formatDate(article.date)}</span>
        </span>
      </span>
    </li>
  `;
}

// Generate homepage
function generateHomepage(articles, articleTags) {
  console.log('🏠 Generating homepage...');

  const template = loadTemplate('home');

  // Load featured config
  let featuredConfig = readJSON(FEATURED_JSON);
  if (!featuredConfig) {
    // Default config if file doesn't exist
    featuredConfig = { featured: [], latest_count: 5 };
  }

  // Get featured articles
  const featuredIds = featuredConfig.featured.map(f => f.id);
  const featuredArticles = articles
    .filter(a => featuredIds.includes(a.id))
    .slice(0, 5);

  // Get latest articles (for "Latest Stories" section - these link externally)
  const latestCount = featuredConfig.latest_count || 5;
  const latestArticles = articles.slice(0, latestCount);

  // Generate article grid (all articles except featured, to avoid duplication)
  const gridArticles = articles.filter(a => !featuredIds.includes(a.id));

  // Render components
  const featuredHTML = featuredArticles.length > 0
    ? featuredArticles.map(a => generateArticleCard(a, true, articleTags[a.id] || [])).join('\n')
    : '';

  const latestHTML = latestArticles.map(a => generateLatestStoryItem(a)).join('\n');
  const gridHTML = gridArticles.map(a => generateArticleCard(a, false, articleTags[a.id] || [])).join('\n');

  // Fill template
  let content = template
    .replace(/{{FEATURED_ARTICLES}}/g, featuredHTML)
    .replace(/{{FEATURED_DISPLAY}}/g, featuredHTML ? '' : 'display: none;')
    .replace(/{{LATEST_STORIES}}/g, latestHTML)
    .replace(/{{ARTICLE_GRID}}/g, gridHTML)
    .replace(/{{TOTAL_ARTICLES}}/g, gridArticles.length.toString());

  // Add scripts (lunr.js must load before search.js)
  const scripts = `
    <script src="/assets/js/lunr.js"></script>
    <script src="/assets/js/search.js"></script>
    <script src="/assets/js/filter.js"></script>
  `;

  // Render in base template
  const html = renderBase(
    content,
    'Maria Dinzeo - Journalism Portfolio',
    'Journalist covering cybersecurity, data privacy, and tech policy',
    'home',
    scripts
  );

  // Write file
  const outputPath = path.join(OUTPUT_DIR, 'index.html');
  writeFile(outputPath, html);

  console.log('✅ Homepage generated');
}

// Generate individual article pages
function generateArticlePages(articles, articleTags) {
  console.log('📄 Generating article pages...');

  const template = loadTemplate('article');

  articles.forEach((article, index) => {
    // Create article directory using title slug (matches readMoreUrl)
    const articleDir = path.join(OUTPUT_DIR, 'articles', article.slug);
    ensureDir(articleDir);

    // Render tag pills for article page (all topic tags, no limit)
    const tags = articleTags[article.id] || [];
    const topicTags = tags.filter(t => t !== article.publication);
    const tagsHtml = topicTags.length > 0
      ? `<div class="article-tags article-tags-detail">${topicTags.map(t => `<span class="article-tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('')}</div>`
      : '';

    // Fill template
    const content = template
      .replace(/{{TITLE}}/g, escapeHtml(article.title))
      .replace(/{{PUBLICATION}}/g, escapeHtml(article.publication))
      .replace(/{{DATE_ISO}}/g, article.date)
      .replace(/{{DATE_FORMATTED}}/g, formatDate(article.date))
      .replace(/{{TAGS}}/g, tagsHtml)
      .replace(/{{PREVIEW}}/g, article.preview)
      .replace(/{{ORIGINAL_URL}}/g, article.url);

    // Render in base template
    const html = renderBase(
      content,
      `${article.title} - Maria Dinzeo`,
      article.description || article.excerpt,
      ''
    );

    // Write file
    const outputPath = path.join(articleDir, 'index.html');
    writeFile(outputPath, html);

    // Progress indicator
    if ((index + 1) % 100 === 0) {
      console.log(`  ✓ Generated ${index + 1}/${articles.length} articles`);
    }
  });

  console.log(`✅ Generated ${articles.length} article pages`);
}

// Generate about page
function generateAboutPage() {
  console.log('ℹ️  Generating about page...');

  const template = loadTemplate('about');

  // Read bio markdown
  const bioPath = path.join(CONTENT_DIR, 'bio.md');
  let bioContent = readFile(bioPath);

  if (!bioContent) {
    // Default bio if file doesn't exist
    bioContent = `# About Maria Dinzeo\n\nJournalist covering cybersecurity, data privacy, and technology policy.`;
  }

  // Convert markdown to HTML
  const bioHTML = marked(bioContent);

  // Fill template
  const content = template.replace(/{{BIO_CONTENT}}/g, bioHTML);

  // Render in base template
  const html = renderBase(
    content,
    'About - Maria Dinzeo',
    'Learn more about Maria Dinzeo, investigative journalist',
    'about'
  );

  // Write file
  const aboutDir = path.join(OUTPUT_DIR, 'about');
  ensureDir(aboutDir);
  const outputPath = path.join(aboutDir, 'index.html');
  writeFile(outputPath, html);

  console.log('✅ About page generated');
}

// Generate contact page
function generateContactPage() {
  console.log('📧 Generating contact page...');

  const template = loadTemplate('contact');

  // Render in base template
  const html = renderBase(
    template,
    'Contact - Maria Dinzeo',
    'Get in touch with Maria Dinzeo',
    'contact'
  );

  // Write file
  const contactDir = path.join(OUTPUT_DIR, 'contact');
  ensureDir(contactDir);
  const outputPath = path.join(contactDir, 'index.html');
  writeFile(outputPath, html);

  console.log('✅ Contact page generated');
}

// Main generation function
async function generateSite() {
  console.log('🚀 Starting site generation...\n');

  // Load articles
  console.log('📖 Loading articles...');
  const articles = readJSON(ARTICLES_JSON);

  if (!articles || articles.length === 0) {
    console.error('❌ No articles found. Run `npm run parse` first.');
    process.exit(1);
  }

  console.log(`✅ Loaded ${articles.length} articles\n`);

  // Load article tags
  const articleTags = fs.existsSync(TAGS_JSON)
    ? JSON.parse(fs.readFileSync(TAGS_JSON, 'utf8'))
    : {};
  console.log(`🏷️  Loaded tags for ${Object.keys(articleTags).length} articles\n`);

  // Combine CSS
  combineCSS();
  console.log();

  // Copy scripts
  copyScripts();
  console.log();

  // Copy images
  copyImages();
  console.log();

  // Generate pages
  generateHomepage(articles, articleTags);
  generateArticlePages(articles, articleTags);
  generateAboutPage();
  generateContactPage();

  console.log('\n✅ Site generation complete!');
  console.log(`📂 Output: ${OUTPUT_DIR}`);
}

// Run generator
generateSite().catch(error => {
  console.error('❌ Error generating site:', error);
  process.exit(1);
});
