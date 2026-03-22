/**
 * Client-side filtering by publication and year
 */

(function() {
  'use strict';

  let publicationFilter;
  let yearFilter;
  let articleGrid;
  let emptyState;
  let resultsCount;
  let searchInput;
  let activeTagFilter = null;

  // Initialize filters
  function initFilters() {
    // Get DOM elements
    publicationFilter = document.getElementById('publication-filter');
    yearFilter = document.getElementById('year-filter');
    articleGrid = document.getElementById('article-grid');
    emptyState = document.getElementById('empty-state');
    resultsCount = document.getElementById('results-count');
    searchInput = document.getElementById('search-input');

    if (!articleGrid) return;

    // Populate filter options
    populateFilters();

    // Set default year filter to current year
    if (yearFilter) {
      const currentYear = new Date().getFullYear().toString();
      // Check if current year exists in options
      const hasCurrentYear = Array.from(yearFilter.options).some(opt => opt.value === currentYear);
      if (hasCurrentYear) {
        yearFilter.value = currentYear;
        // Apply the filter
        filterArticles('all', currentYear);
      }
    }

    // Attach event listeners
    if (publicationFilter) {
      publicationFilter.addEventListener('change', handleFilter);
    }

    if (yearFilter) {
      yearFilter.addEventListener('change', handleFilter);
    }

    // Tag pill click filtering (event delegation on the whole page)
    document.addEventListener('click', function(e) {
      const tag = e.target.closest('.article-tag');
      if (!tag) return;

      e.preventDefault();
      const clickedTag = tag.dataset.tag;
      if (!clickedTag) return;

      // Toggle: clicking active tag clears it
      if (activeTagFilter === clickedTag) {
        activeTagFilter = null;
        document.querySelectorAll('.article-tag.active').forEach(t => t.classList.remove('active'));
      } else {
        activeTagFilter = clickedTag;
        document.querySelectorAll('.article-tag.active').forEach(t => t.classList.remove('active'));
        document.querySelectorAll(`.article-tag[data-tag="${CSS.escape(clickedTag)}"]`).forEach(t => t.classList.add('active'));
      }

      // Clear any active search, then apply tag filter
      if (searchInput) searchInput.value = '';
      handleFilter();
    });

    console.log('Filters initialized');
  }

  // Populate filter dropdowns
  function populateFilters() {
    const cards = articleGrid.querySelectorAll('.article-card');

    // Collect unique publications and years
    const publications = new Set();
    const years = new Set();

    cards.forEach(card => {
      const publication = card.dataset.publication;
      const year = card.dataset.year;

      if (publication) publications.add(publication);
      if (year) years.add(year);
    });

    // Sort publications alphabetically
    const sortedPublications = Array.from(publications).sort();

    // Sort years descending
    const sortedYears = Array.from(years).sort((a, b) => b - a);

    // Populate publication filter
    if (publicationFilter && sortedPublications.length > 0) {
      sortedPublications.forEach(pub => {
        const option = document.createElement('option');
        option.value = pub;

        // Convert slug to readable name
        const name = getPublicationName(pub);
        option.textContent = name;

        publicationFilter.appendChild(option);
      });
    }

    // Populate year filter
    if (yearFilter && sortedYears.length > 0) {
      sortedYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
      });
    }
  }

  // Convert publication slug to readable name
  function getPublicationName(slug) {
    const nameMap = {
      'courthouse-news-service': 'Courthouse News Service',
      'lawcom': 'Law.com',
      'mlex': 'MLex',
      'sf-bay-guardian': 'SF Bay Guardian'
    };

    return nameMap[slug] || slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Handle filter change
  function handleFilter() {
    // Clear search when filtering
    if (searchInput && searchInput.value.trim().length > 0) {
      if (window.mdinzeo && window.mdinzeo.clearSearch) {
        window.mdinzeo.clearSearch();
        return; // clearSearch will handle the display
      }
    }

    const selectedPublication = publicationFilter ? publicationFilter.value : 'all';
    const selectedYear = yearFilter ? yearFilter.value : 'all';

    filterArticles(selectedPublication, selectedYear);
  }

  // Filter articles
  function filterArticles(publication, year) {
    if (!articleGrid || !resultsCount) return;

    const cards = articleGrid.querySelectorAll('.article-card');
    let visibleCount = 0;

    cards.forEach(card => {
      const cardPublication = card.dataset.publication;
      const cardYear = card.dataset.year;
      const cardTags = card.dataset.tags ? card.dataset.tags.split(',') : [];

      const matchesPublication = publication === 'all' || cardPublication === publication;
      const matchesYear = year === 'all' || cardYear === year;
      const matchesTag = !activeTagFilter || cardTags.includes(activeTagFilter);

      if (matchesPublication && matchesYear && matchesTag) {
        card.style.display = 'flex';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    // Update display
    if (articleGrid && emptyState) {
      articleGrid.style.display = visibleCount > 0 ? 'grid' : 'none';
      emptyState.style.display = visibleCount > 0 ? 'none' : 'block';
    }

    if (resultsCount) {
      resultsCount.textContent = `Showing ${visibleCount} ${visibleCount === 1 ? 'article' : 'articles'}`;
    }
  }

  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFilters);
  } else {
    initFilters();
  }
})();
