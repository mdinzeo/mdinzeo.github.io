# Maria Dinzeo - Journalism Portfolio

A static site portfolio showcasing Maria Dinzeo's journalism work, hosted on GitHub Pages.

**Live site:** [mdinzeo.github.io](https://mdinzeo.github.io)

## Features

- 2,637+ articles spanning 2008-2024
- Client-side search powered by lunr.js
- Filter by publication and year
- Manually curated featured articles
- Mobile-responsive design
- Clean, professional interface

## Tech Stack

- **Static HTML/CSS/JS** - No framework overhead
- **Node.js build scripts** - Parse XML and generate site
- **lunr.js** - Client-side search
- **GitHub Pages** - Free hosting

## Project Structure

```
MariaDinzeo/
├── src/              # Source files (templates, styles, scripts, content)
├── build/            # Build scripts (parse XML, generate HTML, create search index)
├── docs/             # Generated site (served by GitHub Pages)
└── MariaDinzeo.xml   # Source data from Authory export
```

## Development

### Initial Setup

```bash
npm install
```

### Build Site

```bash
npm run build
```

This runs:
1. Parse XML → JSON
2. Generate HTML pages
3. Create search index

### Local Development

```bash
npm run dev
```

Opens site at `http://localhost:8000`

### Deploy to GitHub Pages

```bash
npm run deploy
```

Or manually:
```bash
npm run build
git add docs
git commit -m "Update site"
git push origin main
```

## Updating Content

### Add New Articles

1. Update `MariaDinzeo.xml` with new article data
2. Run `npm run build`
3. Deploy changes

### Update Featured Articles

Edit `src/data/featured.json`:
```json
{
  "featured": [
    {"id": "article-slug", "note": "Optional description"}
  ],
  "latest_count": 5
}
```

### Update Bio or Contact Info

- Bio: Edit `src/content/bio.md`
- Contact: Edit `src/content/contact.md`

Then rebuild and deploy.

## Design

**Color Scheme:**
- Background: Pure white (#FFFFFF)
- Text: Near black (#1a1a1a)
- Accents: Sage green (#8a9a8f)
- Links/Buttons: Deep forest (#3d5a45)

**Typography:**
- Sans-serif: System font stack (San Francisco, Segoe UI, Roboto)
- Serif: Georgia/Cambria (for article content)

## Future Enhancements

- Hierarchical tagging system (privacy → location privacy, health privacy, etc.)
- AI-assisted tagging with manual review
- RSS feed
- Analytics (privacy-friendly)

## License

MIT - © Maria Dinzeo

---

**Replacing Authory** - Saving ~$150/year with better control and customization.
