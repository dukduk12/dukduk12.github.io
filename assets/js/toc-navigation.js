(function () {
  "use strict";

  function findTarget(link) {
    const hash = new URL(link.href, window.location.href).hash;
    if (!hash) return null;

    try {
      return document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch (_error) {
      return document.getElementById(hash.slice(1));
    }
  }

  document.addEventListener("click", function (event) {
    const link = event.target.closest(".toc__menu a[href^='#']");
    if (!link) return;

    const target = findTarget(link);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.pushState(null, "", link.getAttribute("href"));

    document.querySelectorAll(".toc__menu a[aria-current='location']").forEach(function (item) {
      item.removeAttribute("aria-current");
    });
    link.setAttribute("aria-current", "location");
  });
})();
