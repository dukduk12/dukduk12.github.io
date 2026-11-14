(function () {
  "use strict";

  function initPostPagination() {
    var browser = document.querySelector("[data-post-browser]");
    if (!browser) return;

    var items = Array.prototype.slice.call(browser.querySelectorAll("[data-post-item]"));
    var pagination = browser.querySelector("[data-post-pagination]");
    var searchInput = browser.querySelector("[data-post-search]");
    var clearButton = browser.querySelector("[data-post-search-clear]");
    var searchStatus = browser.querySelector("[data-post-search-status]");
    var pageSize = Number(browser.getAttribute("data-page-size")) || 5;
    var query = "";

    if (!pagination) return;

    function pageFromHash() {
      var match = window.location.hash.match(/^#page-(\d+)$/);
      return match ? Number(match[1]) : 1;
    }

    function makeButton(label, targetPage, currentPage, disabled) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.className = "post-browser__page";
      button.disabled = disabled;
      button.setAttribute("aria-label", label === String(targetPage) ? "Page " + targetPage : label + " page");

      if (targetPage === currentPage && label === String(targetPage)) {
        button.classList.add("is-active");
        button.setAttribute("aria-current", "page");
      }

      button.addEventListener("click", function () {
        window.location.hash = "page-" + targetPage;
      });
      return button;
    }

    function render(requestedPage, shouldScroll) {
      var filteredItems = items.filter(function (item) {
        return !query || (item.getAttribute("data-search") || "").indexOf(query) !== -1;
      });
      var pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
      var currentPage = Math.min(Math.max(requestedPage, 1), pageCount);
      var firstVisible = (currentPage - 1) * pageSize;
      var lastVisible = currentPage * pageSize;

      items.forEach(function (item) {
        item.hidden = true;
      });
      filteredItems.forEach(function (item, index) {
        item.hidden = index < firstVisible || index >= lastVisible;
      });

      pagination.replaceChildren();
      pagination.hidden = pageCount <= 1;
      if (pageCount > 1) {
        pagination.appendChild(makeButton("Previous", currentPage - 1, currentPage, currentPage === 1));

        for (var page = 1; page <= pageCount; page += 1) {
          pagination.appendChild(makeButton(String(page), page, currentPage, false));
        }

        pagination.appendChild(makeButton("Next", currentPage + 1, currentPage, currentPage === pageCount));
      }

      if (searchStatus) {
        searchStatus.textContent = query
          ? filteredItems.length + " post" + (filteredItems.length === 1 ? "" : "s") + " found"
          : items.length + " posts";
      }
      if (clearButton) clearButton.hidden = !query;

      if (shouldScroll) browser.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function normalize(value) {
      return value.toLocaleLowerCase().trim().replace(/\s+/g, " ");
    }

    if (searchInput) {
      searchInput.addEventListener("input", function () {
        query = normalize(searchInput.value);
        if (window.location.hash) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
        render(1, false);
      });
    }

    if (clearButton) {
      clearButton.addEventListener("click", function () {
        searchInput.value = "";
        query = "";
        searchInput.focus();
        render(1, false);
      });
    }

    window.addEventListener("hashchange", function () {
      render(pageFromHash(), true);
    });
    render(pageFromHash(), false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPostPagination);
  } else {
    initPostPagination();
  }
})();
