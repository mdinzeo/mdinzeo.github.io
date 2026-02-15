/**
 * Client-side search functionality using lunr.js
 */

(function() {
  'use strict';

  let searchIndex;
  let articles;
  let searchInput;
  let articleGrid;
  let emptyState;
  let resultsCount;

  // Initialize search
  async function initSearch() {
    try {
      // Load search index
      const response = await fetch('/assets/js/search-index.json');
      const data = await response.json();

      // Load lunr index
      searchIndex = lunr.Index.load(data.index);
      articles = data.articles;

      // Get DOM elements
      searchInput = document.getElementById('search-input');
      articleGrid = document.getElementById('article-grid');
      emptyState = document.getElementById('empty-state');
      resultsCount = document.getElementById('results-count');

      // Attach event listener
      if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
      }

      console.log('Search initialized');
    } catch (error) {
      console.error('Error initializing search:', error);
    }
  }

  // Perform search
  function performSearch(query) {
    if (!query || query.trim().length === 0) {
      return null;
    }

    try {
      // Search with lunr
      const results = searchIndex.search(query);

      // Map results to article data
      return results.map(result => {
        const article = articles[result.ref];
        return {
          ...article,
          score: result.score
        };
      });
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  // Handle search input
  function handleSearch(event) {
    const query = event.target.value.trim();

    // If query is empty, show all articles (let filter.js handle it)
    if (query.length === 0) {
      showAllArticles();
      return;
    }

    // Minimum query length
    if (query.length < 2) {
      return;
    }

    // Perform search
    const results = performSearch(query);

    if (!results) {
      showAllArticles();
      return;
    }

    // Display results
    displayResults(results);
  }

  // Display search results
  function displayResults(results) {
    if (!articleGrid || !emptyState || !resultsCount) return;

    // Get all article cards
    const cards = articleGrid.querySelectorAll('.article-card');

    if (results.length === 0) {
      // Hide all cards, show empty state
      cards.forEach(card => card.style.display = 'none');
      emptyState.style.display = 'block';
      articleGrid.style.display = 'none';
      resultsCount.textContent = 'No articles found';
      return;
    }

    // Get result IDs
    const resultIds = new Set(results.map(r => r.id));

    // Show/hide cards based on results
    let visibleCount = 0;
    cards.forEach(card => {
      // Get article ID from the card's link
      const link = card.querySelector('.article-title a');
      if (!link) return;

      const href = link.getAttribute('href');
      const articleId = href.split('/').filter(Boolean)[1]; // Extract ID from /articles/{id}/

      if (resultIds.has(articleId)) {
        card.style.display = 'flex';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    // Update display
    articleGrid.style.display = visibleCount > 0 ? 'grid' : 'none';
    emptyState.style.display = visibleCount > 0 ? 'none' : 'block';
    resultsCount.textContent = `Showing ${visibleCount} ${visibleCount === 1 ? 'article' : 'articles'}`;
  }

  // Show all articles (clear search)
  function showAllArticles() {
    if (!articleGrid || !emptyState || !resultsCount) return;

    const cards = articleGrid.querySelectorAll('.article-card');
    let visibleCount = 0;

    // Get current filter values
    const publicationFilter = document.getElementById('publication-filter');
    const yearFilter = document.getElementById('year-filter');

    const selectedPublication = publicationFilter ? publicationFilter.value : 'all';
    const selectedYear = yearFilter ? yearFilter.value : 'all';

    // Show all cards that match filters
    cards.forEach(card => {
      const publication = card.dataset.publication;
      const year = card.dataset.year;

      const matchesPublication = selectedPublication === 'all' || publication === selectedPublication;
      const matchesYear = selectedYear === 'all' || year === selectedYear;

      if (matchesPublication && matchesYear) {
        card.style.display = 'flex';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    articleGrid.style.display = visibleCount > 0 ? 'grid' : 'none';
    emptyState.style.display = visibleCount > 0 ? 'none' : 'block';
    resultsCount.textContent = `Showing ${visibleCount} ${visibleCount === 1 ? 'article' : 'articles'}`;
  }

  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearch);
  } else {
    initSearch();
  }

  // Expose for filter.js to use
  window.mdinzeo = window.mdinzeo || {};
  window.mdinzeo.clearSearch = function() {
    if (searchInput) {
      searchInput.value = '';
      showAllArticles();
    }
  };
})();
