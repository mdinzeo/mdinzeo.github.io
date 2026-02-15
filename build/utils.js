/**
 * Utility functions for site generation
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate URL-friendly slug from text
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/--+/g, '-')     // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ''); // Trim hyphens from start/end
}

/**
 * Format date as "Month DD, YYYY"
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Format date as "Month YYYY" (no day)
 */
function formatDateShort(dateString) {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'long' };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Extract domain from URL
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch (e) {
    return '';
  }
}

/**
 * Map domains to clean publication names
 */
function getPublicationName(url) {
  const domain = extractDomain(url);

  const publicationMap = {
    'law.com': 'Law.com',
    'courthousenews.com': 'Courthouse News Service',
    'mlex.com': 'MLex',
    '48hills.org': 'SF Bay Guardian',
    'sfbg': 'SF Bay Guardian'
  };

  // Check for exact match
  for (const [key, value] of Object.entries(publicationMap)) {
    if (domain.includes(key)) {
      return value;
    }
  }

  // Default: capitalize domain
  return domain
    .split('.')[0]
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extract first N paragraphs from HTML
 */
function extractPreview(html, numParagraphs = 2) {
  if (!html) return '';

  // Match opening and closing p tags with content
  const paragraphRegex = /<p[^>]*>(.*?)<\/p>/gs;
  const matches = html.match(paragraphRegex);

  if (!matches || matches.length === 0) {
    // No paragraphs found, return first 500 chars as fallback
    const text = html.replace(/<[^>]+>/g, '');
    return text.substring(0, 500) + '...';
  }

  return matches.slice(0, numParagraphs).join('\n');
}

/**
 * Create excerpt from text (first N characters)
 */
function createExcerpt(text, maxLength = 200) {
  if (!text) return '';

  // Strip HTML tags
  const plainText = text.replace(/<[^>]+>/g, '');

  if (plainText.length <= maxLength) {
    return plainText;
  }

  // Cut at word boundary
  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  return truncated.substring(0, lastSpace) + '...';
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return '';

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Ensure directory exists, create if not
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Read file with error handling
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Write file with error handling
 */
function writeFile(filePath, content) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Write JSON file with pretty formatting
 */
function writeJSON(filePath, data) {
  return writeFile(filePath, JSON.stringify(data, null, 2));
}

/**
 * Read JSON file
 */
function readJSON(filePath) {
  const content = readFile(filePath);
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error parsing JSON from ${filePath}:`, error.message);
    return null;
  }
}

module.exports = {
  slugify,
  formatDate,
  formatDateShort,
  extractDomain,
  getPublicationName,
  extractPreview,
  createExcerpt,
  escapeHtml,
  ensureDir,
  readFile,
  writeFile,
  writeJSON,
  readJSON
};
