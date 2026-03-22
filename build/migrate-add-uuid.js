/**
 * One-time migration: rename slug → authory_id, add uuid to every article.
 *
 * Run once: node build/migrate-add-uuid.js
 * Creates MariaDinzeo.xml.bak before modifying.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const XML_PATH = path.join(__dirname, '..', 'MariaDinzeo.xml');
const BAK_PATH = XML_PATH + '.bak';

console.log('Reading XML...');
const content = fs.readFileSync(XML_PATH, 'utf8');

// Backup first
fs.writeFileSync(BAK_PATH, content);
console.log(`Backup saved: MariaDinzeo.xml.bak`);

// Replace slug="X" with authory_id="X"\n        uuid="NEW"
// The whitespace indent matches the existing XML formatting
let count = 0;
const updated = content.replace(/\bslug="([^"]*)"/g, (match, authoryId) => {
  count++;
  return `authory_id="${authoryId}"\n        uuid="${crypto.randomUUID()}"`;
});

fs.writeFileSync(XML_PATH, updated, 'utf8');
console.log(`Done: ${count} articles updated (slug → authory_id + uuid added)`);
console.log(`\nNext steps:`);
console.log(`  npm run build   — rebuild site with new IDs`);
console.log(`  Delete MariaDinzeo.xml.bak once you've verified the build`);
