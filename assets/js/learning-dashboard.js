(function () {
  "use strict";

  const root = document.querySelector("[data-learning-dashboard]");
  const source = document.getElementById("learning-dashboard-data");
  if (!root || !source) return;

  let posts;
  try {
    posts = JSON.parse(source.textContent);
  } catch (error) {
    root.classList.add("is-unavailable");
    return;
  }

  const writingDates = new Set();
  posts.forEach((post) => {
    writingDates.add(post.date);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const latestDate = posts.reduce((latest, post) => post.date > latest ? post.date : latest, "");
  const latestGap = latestDate ? Math.max(0, Math.floor((today - new Date(latestDate + "T00:00:00")) / 86400000)) : 0;
  root.querySelector("[data-dashboard-days]").textContent = writingDates.size;
  root.querySelector("[data-dashboard-gap]").textContent = latestGap + "d";

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;"
    })[character]);
  }

  function renderGrowthChart() {
    const canvas = root.querySelector("[data-growth-chart]");
    const caption = root.querySelector("[data-growth-caption]");
    const context = canvas.getContext("2d");
    if (!context || !posts.length) return;

    const counts = new Map();
    posts.forEach((post) => counts.set(post.date, (counts.get(post.date) || 0) + 1));
    const dates = Array.from(counts.keys()).sort();
    const first = new Date(dates[0] + "T00:00:00");
    const last = new Date(dates[dates.length - 1] + "T00:00:00");
    const points = [];
    let total = 0;
    for (let cursor = new Date(first); cursor <= last; cursor.setDate(cursor.getDate() + 1)) {
      const key = cursor.getFullYear() + "-" + String(cursor.getMonth() + 1).padStart(2, "0") + "-" + String(cursor.getDate()).padStart(2, "0");
      total += counts.get(key) || 0;
      points.push({ date: key, value: total, published: counts.get(key) || 0 });
    }

    function draw() {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(280, bounds.width);
      const height = Math.max(190, bounds.height || 210);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const style = getComputedStyle(root);
      const blue = style.getPropertyValue("--dashboard-blue").trim() || "#466b7c";
      const brass = style.getPropertyValue("--dashboard-brass").trim() || "#b98435";
      const left = 30;
      const right = width - 12;
      const top = 16;
      const bottom = height - 28;
      const x = (index) => left + (right - left) * (points.length === 1 ? 0.5 : index / (points.length - 1));
      const y = (value) => bottom - (bottom - top) * (value / Math.max(1, total));

      context.font = "10px system-ui, sans-serif";
      context.textAlign = "right";
      context.textBaseline = "middle";
      for (let step = 0; step <= 3; step += 1) {
        const value = Math.round(total * step / 3);
        const lineY = y(value);
        context.beginPath();
        context.moveTo(left, lineY);
        context.lineTo(right, lineY);
        context.strokeStyle = "rgba(70, 107, 124, 0.12)";
        context.lineWidth = 1;
        context.stroke();
        context.fillStyle = "rgba(53, 76, 83, 0.62)";
        context.fillText(String(value), left - 7, lineY);
      }

      const fill = context.createLinearGradient(0, top, 0, bottom);
      fill.addColorStop(0, "rgba(70, 107, 124, 0.18)");
      fill.addColorStop(1, "rgba(70, 107, 124, 0.01)");
      context.beginPath();
      points.forEach((point, index) => index ? context.lineTo(x(index), y(point.value)) : context.moveTo(x(index), y(point.value)));
      context.lineTo(right, bottom);
      context.lineTo(left, bottom);
      context.closePath();
      context.fillStyle = fill;
      context.fill();

      context.beginPath();
      points.forEach((point, index) => index ? context.lineTo(x(index), y(point.value)) : context.moveTo(x(index), y(point.value)));
      context.strokeStyle = blue;
      context.lineWidth = 2;
      context.lineJoin = "round";
      context.stroke();

      points.forEach((point, index) => {
        if (!point.published) return;
        context.beginPath();
        context.arc(x(index), y(point.value), 3.2, 0, Math.PI * 2);
        context.fillStyle = brass;
        context.fill();
        context.strokeStyle = "#fbfcfa";
        context.lineWidth = 1.5;
        context.stroke();
      });

      context.fillStyle = "rgba(53, 76, 83, 0.62)";
      context.textBaseline = "alphabetic";
      context.textAlign = "left";
      context.fillText(points[0].date.slice(5), left, height - 8);
      context.textAlign = "right";
      context.fillText(points[points.length - 1].date.slice(5), right, height - 8);
    }

    caption.textContent = points.length + " days traced · dots mark publication days";
    draw();
    if ("ResizeObserver" in window) new ResizeObserver(draw).observe(canvas);
  }

  function initStudyCalendar() {
    const canvas = root.querySelector("[data-study-calendar]");
    const context = canvas.getContext("2d");
    const monthLabel = root.querySelector("[data-calendar-month]");
    const detail = root.querySelector("[data-calendar-detail]");
    const monthFields = root.querySelector("[data-dashboard-month-fields]");
    if (!context || !posts.length) return;

    const categoryColors = ["#466b7c", "#9a7454", "#788c78", "#806f91", "#a37d3e", "#607b89"];
    const categoryIndex = new Map();
    Array.from(new Set(posts.map((post) => post.category))).sort().forEach((category, index) => {
      categoryIndex.set(category, categoryColors[index % categoryColors.length]);
    });
    const latest = new Date(latestDate + "T00:00:00");
    let viewedYear = latest.getFullYear();
    let viewedMonth = latest.getMonth();
    let hitAreas = [];

    function monthKey() {
      return viewedYear + "-" + String(viewedMonth + 1).padStart(2, "0");
    }

    function monthPosts() {
      const prefix = monthKey();
      return posts.filter((post) => post.date.slice(0, 7) === prefix);
    }

    function draw() {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(280, bounds.width);
      const height = Math.max(260, bounds.height || 280);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const entries = monthPosts();
      const byDay = new Map();
      entries.forEach((post) => {
        const day = Number(post.date.slice(8, 10));
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day).push(post);
      });
      monthFields.textContent = new Set(entries.map((post) => post.category)).size;
      monthLabel.textContent = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" })
        .format(new Date(viewedYear, viewedMonth, 1));

      const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const gap = 6;
      const top = 26;
      const cellWidth = (width - gap * 6) / 7;
      const cellHeight = (height - top - gap * 5) / 6;
      context.font = "10px system-ui, sans-serif";
      context.textAlign = "center";
      context.fillStyle = "rgba(53, 76, 83, 0.58)";
      weekdays.forEach((weekday, index) => context.fillText(weekday, index * (cellWidth + gap) + cellWidth / 2, 12));

      const firstDay = new Date(viewedYear, viewedMonth, 1).getDay();
      const daysInMonth = new Date(viewedYear, viewedMonth + 1, 0).getDate();
      hitAreas = [];
      for (let day = 1; day <= daysInMonth; day += 1) {
        const slot = firstDay + day - 1;
        const column = slot % 7;
        const row = Math.floor(slot / 7);
        const x = column * (cellWidth + gap);
        const y = top + row * (cellHeight + gap);
        const dayPosts = byDay.get(day) || [];
        context.fillStyle = dayPosts.length ? "rgba(70, 107, 124, 0.055)" : "rgba(70, 107, 124, 0.018)";
        context.strokeStyle = dayPosts.length ? "rgba(70, 107, 124, 0.24)" : "rgba(70, 107, 124, 0.09)";
        context.lineWidth = 1;
        context.beginPath();
        context.roundRect(x + 0.5, y + 0.5, cellWidth - 1, cellHeight - 1, 4);
        context.fill();
        context.stroke();

        context.textAlign = "left";
        context.fillStyle = "rgba(53, 76, 83, 0.72)";
        context.fillText(String(day), x + 7, y + 14);
        const categories = Array.from(new Set(dayPosts.map((post) => post.category)));
        categories.slice(0, 4).forEach((category, index) => {
          context.fillStyle = categoryIndex.get(category);
          context.beginPath();
          context.arc(x + 8 + index * 9, y + cellHeight - 9, 2.7, 0, Math.PI * 2);
          context.fill();
        });
        hitAreas.push({ x, y, width: cellWidth, height: cellHeight, day, posts: dayPosts });
      }
    }

    function inspect(event) {
      const bounds = canvas.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const hit = hitAreas.find((area) => x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height);
      if (!hit || !hit.posts.length) {
        detail.textContent = "Move over a marked day to inspect the study record.";
        canvas.style.cursor = "default";
        return;
      }
      const categories = Array.from(new Set(hit.posts.map((post) => post.category))).join(", ");
      detail.textContent = monthKey() + "-" + String(hit.day).padStart(2, "0") + " · " + categories + " · " + hit.posts.length + " note" + (hit.posts.length === 1 ? "" : "s");
      canvas.style.cursor = hit.posts.length === 1 ? "pointer" : "default";
    }

    canvas.addEventListener("pointermove", inspect);
    canvas.addEventListener("pointerleave", () => {
      detail.textContent = "Move over a marked day to inspect the study record.";
      canvas.style.cursor = "default";
    });
    canvas.addEventListener("click", (event) => {
      const bounds = canvas.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const hit = hitAreas.find((area) => x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height);
      if (hit && hit.posts.length === 1) window.location.href = hit.posts[0].url;
    });
    root.querySelector("[data-calendar-prev]").addEventListener("click", () => {
      viewedMonth -= 1;
      if (viewedMonth < 0) { viewedMonth = 11; viewedYear -= 1; }
      draw();
    });
    root.querySelector("[data-calendar-next]").addEventListener("click", () => {
      viewedMonth += 1;
      if (viewedMonth > 11) { viewedMonth = 0; viewedYear += 1; }
      draw();
    });
    draw();
    if ("ResizeObserver" in window) new ResizeObserver(draw).observe(canvas);
  }

  function renderReview() {
    const target = root.querySelector("[data-review-list]");
    const cycles = [7, 21, 60, 120, 240, 365];
    const dueReviews = posts.map((post) => {
      const age = Math.max(0, Math.floor((today - new Date(post.date + "T00:00:00")) / 86400000));
      const dueCycles = cycles.filter((cycle) => cycle <= age);
      const cycle = dueCycles.length ? dueCycles[dueCycles.length - 1] : cycles[0];
      const distance = Math.abs(age - cycle);
      return { post, age, cycle, distance, isDue: age >= cycles[0] };
    }).filter((item) => item.isDue);
    const ranked = dueReviews.slice()
      .sort((a, b) => a.distance - b.distance || b.age - a.age)
      .slice(0, 3);

    root.querySelector("[data-dashboard-review-due]").textContent = dueReviews.length;

    target.innerHTML = ranked.map((item, index) => {
      const reason = "Published " + item.age + " days ago · " + item.cycle + "-day review cycle";
      return '<a class="learning-dashboard__review-item" href="' + escapeHtml(item.post.url) + '">' +
        '<span class="learning-dashboard__orbit-index">0' + (index + 1) + '</span>' +
        '<span><strong>' + escapeHtml(item.post.title) + '</strong><small>' + escapeHtml(item.post.category + " · " + reason) + '</small></span>' +
        '<span aria-hidden="true">↗</span>' +
      '</a>';
    }).join("");
  }

  renderGrowthChart();
  initStudyCalendar();
  renderReview();
}());
