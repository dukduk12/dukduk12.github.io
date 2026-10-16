(function () {
  "use strict";
  function initializePlayground() {
  const root = document.querySelector("[data-web-playground]");
  if (!root || root.dataset.playgroundReady === "true") return;
  root.dataset.playgroundReady = "true";

  const html = root.querySelector("[data-playground-html]");
  const css = root.querySelector("[data-playground-css]");
  const js = root.querySelector("[data-playground-js]");
  const frame = root.querySelector("[data-playground-preview]");
  const status = root.querySelector("[data-playground-status]");
  const initial = { html: html.value, css: css.value, js: js.value };

  function safeScript(source) {
    return source.replace(/<\/script/gi, "<\\/script");
  }

  function run() {
    frame.srcdoc = [
      "<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\">",
      "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
      "<style>", css.value, "</style></head><body>", html.value,
      "<script>",
      "window.addEventListener('error',function(e){var p=document.createElement('pre');p.style.cssText='padding:12px;color:#991b1b;background:#fee2e2;white-space:pre-wrap';p.textContent='JavaScript 오류: '+e.message;document.body.appendChild(p)});",
      safeScript(js.value),
      "<\\/script></body></html>"
    ].join("\n");
    status.textContent = "실행 완료";
    status.classList.add("is-success");
  }

  root.querySelector("[data-playground-run]").addEventListener("click", run);
  root.querySelector("[data-playground-reset]").addEventListener("click", function () {
    html.value = initial.html;
    css.value = initial.css;
    js.value = initial.js;
    run();
  });

  [html, css, js].forEach(function (editor) {
    editor.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") run();
    });
    editor.addEventListener("input", function () {
      status.textContent = "변경됨 · 실행 필요";
      status.classList.remove("is-success");
    });
  });
  run();
  }

  initializePlayground();
  document.addEventListener("post-lock:unlocked", initializePlayground);
})();
