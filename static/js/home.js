// Homepage: instant search and category filtering over the rendered cards.
(() => {
  const search = document.getElementById("app-search");
  const pills = [...document.querySelectorAll(".filter-pill")];
  const sections = [...document.querySelectorAll("[data-section]")];
  const noResults = document.getElementById("no-results");
  let category = "all";

  function applyFilter() {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    for (const section of sections) {
      let inSection = 0;
      for (const card of section.querySelectorAll("[data-search]")) {
        const match = (category === "all" || section.dataset.section === category)
          && card.dataset.search.includes(query);
        card.hidden = !match;
        if (match) inSection += 1;
      }
      section.hidden = inSection === 0;
      visible += inSection;
    }
    noResults.hidden = visible > 0;
  }

  search.addEventListener("input", applyFilter);
  for (const pill of pills) {
    pill.addEventListener("click", () => {
      category = pill.dataset.category;
      pills.forEach((p) => p.setAttribute("aria-pressed", String(p === pill)));
      applyFilter();
    });
  }
  document.getElementById("clear-filters").addEventListener("click", () => {
    search.value = "";
    pills[0].click();
    search.focus();
  });
  // "/" jumps to search, unless the visitor is already typing somewhere.
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      event.preventDefault();
      search.focus();
    }
  });
})();
