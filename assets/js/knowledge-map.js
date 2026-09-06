(function () {
  "use strict";

  function initializeKnowledgeMap() {
  const container = document.querySelector("[data-knowledge-map]");
  const dataElement = document.getElementById("knowledge-map-data");
  if (!container || !dataElement || container.dataset.knowledgeMapReady === "true") return;
  container.dataset.knowledgeMapReady = "true";

  const svg = container.querySelector("[data-knowledge-canvas]");
  const ambientCanvas = container.querySelector("[data-knowledge-ambient]");
  const stage = container.querySelector(".knowledge-map__stage");
  const inspector = container.querySelector("[data-knowledge-inspector]");
  const resetButton = container.querySelector("[data-knowledge-reset]");
  const emptyState = container.querySelector("[data-knowledge-empty]");
  const namespace = "http://www.w3.org/2000/svg";
  const sectionCache = new Map();
  const clickTimers = new Map();

  let categories;
  try {
    categories = JSON.parse(dataElement.textContent);
  } catch (error) {
    container.classList.add("knowledge-map--error");
    inspector.innerHTML = "<strong>Knowledge map unavailable</strong><p>The category data could not be parsed. Use the complete list below.</p>";
    return;
  }

  const state = {
    groupId: null,
    categoryId: null,
    seriesId: null,
    articleId: null,
    loadingArticleId: null,
    sections: []
  };

  const groupDefinitions = [
    { id: "ai", label: "AI", parent: null },
    { id: "drug-discovery-field", label: "Drug Discovery", parent: null },
    { id: "development", label: "Development", parent: null },
    { id: "database-tools", label: "Database", parent: "development" },
    { id: "language", label: "Language", parent: null },
    { id: "etc", label: "ETC", parent: null }
  ];

  function groupDefinition(groupId) {
    return groupDefinitions.find((group) => group.id === groupId) || null;
  }

  function categoryPath(category) {
    const labels = [category.displayName || category.name];
    let group = groupDefinition(category.parentGroup);
    while (group) {
      labels.unshift(group.label);
      group = groupDefinition(group.parent);
    }
    return labels.join(" / ");
  }

  function initAmbientCanvas() {
    if (!ambientCanvas || !stage) return;
    const context = ambientCanvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const palette = ["70, 107, 124", "113, 128, 138", "154, 116, 84"];
    const particles = Array.from({ length: 22 }, (_, index) => ({
      x: variation("ambient-" + index, "x"),
      y: variation("ambient-" + index, "y"),
      vx: (variation("ambient-" + index, "vx") - 0.5) * 0.000055,
      vy: (variation("ambient-" + index, "vy") - 0.5) * 0.000045,
      radius: 0.8 + variation("ambient-" + index, "radius") * 1.5,
      color: palette[index % palette.length]
    }));
    let width = 0;
    let height = 0;
    let animationFrame = null;
    let previousTime = performance.now();

    function resizeCanvas() {
      const bounds = stage.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      ambientCanvas.width = Math.round(width * ratio);
      ambientCanvas.height = Math.round(height * ratio);
      ambientCanvas.style.width = width + "px";
      ambientCanvas.style.height = height + "px";
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function draw(timestamp) {
      const elapsed = Math.min(40, timestamp - previousTime);
      previousTime = timestamp;
      context.clearRect(0, 0, width, height);

      particles.forEach((particle) => {
        if (!reducedMotion) {
          particle.x += particle.vx * elapsed;
          particle.y += particle.vy * elapsed;
          if (particle.x < 0 || particle.x > 1) particle.vx *= -1;
          if (particle.y < 0 || particle.y > 1) particle.vy *= -1;
          particle.x = Math.max(0, Math.min(1, particle.x));
          particle.y = Math.max(0, Math.min(1, particle.y));
        }
      });

      const phase = reducedMotion ? 0.8 : timestamp * 0.00012;
      context.save();
      context.lineCap = "round";

      for (let band = 0; band < 3; band += 1) {
        const baseY = height * (0.27 + band * 0.23);
        const drift = Math.sin(phase * (0.82 + band * 0.06) + band) * height * 0.018;
        context.beginPath();
        context.moveTo(-30, baseY + drift);
        context.bezierCurveTo(
          width * 0.24,
          baseY - height * (0.08 - band * 0.006),
          width * 0.55,
          baseY + height * (0.09 + band * 0.008),
          width + 30,
          baseY - drift
        );
        context.setLineDash([2, 8]);
        context.lineDashOffset = reducedMotion ? band * 3 : -timestamp * 0.0035;
        context.strokeStyle = "rgba(" + palette[0] + ", 0.085)";
        context.lineWidth = 0.8;
        context.stroke();
      }

      for (let orbit = 0; orbit < 3; orbit += 1) {
        context.beginPath();
        context.ellipse(
          width * (0.5 + Math.sin(phase + orbit) * 0.025),
          height * (0.48 + Math.cos(phase * 0.7 + orbit) * 0.018),
          width * (0.13 + orbit * 0.085),
          height * (0.08 + orbit * 0.055),
          -0.2 + orbit * 0.13,
          0,
          Math.PI * 2
        );
        context.setLineDash([2, 8]);
        context.lineDashOffset = reducedMotion ? orbit * 4 : timestamp * 0.003;
        context.strokeStyle = "rgba(" + palette[0] + ", 0.13)";
        context.lineWidth = 0.8;
        context.stroke();
      }

      // Short moving arcs make the field feel like a measured astronomical
      // instrument rather than a generic particle animation.
      for (let arc = 0; arc < 3; arc += 1) {
        const arcPhase = reducedMotion ? arc * 1.6 : phase * (2.1 + arc * 0.35) + arc * 1.8;
        context.beginPath();
        context.ellipse(
          width * 0.5,
          height * 0.48,
          width * (0.13 + arc * 0.085),
          height * (0.08 + arc * 0.055),
          -0.2 + arc * 0.13,
          arcPhase,
          arcPhase + 0.42 + arc * 0.08
        );
        context.setLineDash([]);
        context.strokeStyle = "rgba(" + palette[arc === 1 ? 2 : 0] + ", 0.32)";
        context.lineWidth = 1.35;
        context.stroke();

        const markerX = width * 0.5 + Math.cos(arcPhase) * width * (0.13 + arc * 0.085);
        const markerY = height * 0.48 + Math.sin(arcPhase) * height * (0.08 + arc * 0.055);
        context.beginPath();
        context.arc(markerX, markerY, 1.8, 0, Math.PI * 2);
        context.fillStyle = "rgba(" + palette[arc === 1 ? 2 : 0] + ", 0.48)";
        context.fill();
      }
      context.restore();

      particles.forEach((particle) => {
        const x = particle.x * width;
        const y = particle.y * height;
        const size = particle.radius * 1.7;
        context.beginPath();
        context.moveTo(x, y - size);
        context.lineTo(x + size * 0.55, y);
        context.lineTo(x, y + size);
        context.lineTo(x - size * 0.55, y);
        context.closePath();
        context.fillStyle = "rgba(" + particle.color + ", 0.28)";
        context.fill();
      });

      if (!reducedMotion && !document.hidden) animationFrame = window.requestAnimationFrame(draw);
    }

    function start() {
      if (animationFrame || reducedMotion || document.hidden) return;
      previousTime = performance.now();
      animationFrame = window.requestAnimationFrame(draw);
    }

    function stop() {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    resizeCanvas();
    draw(performance.now());
    if (!reducedMotion) start();

    if ("ResizeObserver" in window) {
      new ResizeObserver(() => {
        resizeCanvas();
        if (reducedMotion) draw(performance.now());
      }).observe(stage);
    } else {
      window.addEventListener("resize", resizeCanvas);
    }
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  }

  function svgElement(name, attributes) {
    const element = document.createElementNS(namespace, name);
    Object.entries(attributes || {}).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  function truncate(value, maximum) {
    if (!value || value.length <= maximum) return value || "";
    return value.slice(0, maximum - 1).trimEnd() + "…";
  }

  function variation(value, salt) {
    const text = String(value || "") + ":" + String(salt || "");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000) / 999;
  }

  function selectedCategory() {
    return categories.find((category) => category.id === state.categoryId) || null;
  }

  function selectedArticle() {
    const category = selectedCategory();
    return category && category.posts.find((post) => post.id === state.articleId) || null;
  }

  function virtualSeries(category) {
    const grouped = new Map();
    category.posts.forEach((post) => {
      if (!post.series) return;
      if (!grouped.has(post.series)) grouped.set(post.series, []);
      grouped.get(post.series).push(post);
    });
    return Array.from(grouped, ([id, posts]) => ({
      id,
      label: posts.find((post) => post.seriesTitle)?.seriesTitle || id,
      posts: posts.slice().sort((a, b) => (a.seriesOrder || 999) - (b.seriesOrder || 999))
    })).filter((series) => series.posts.some((post) => post.seriesGroup) && !series.posts.some((post) => post.seriesHub));
  }

  function buildGraph() {
    const nodes = [];
    const edges = [];

    const category = selectedCategory();
    const article = selectedArticle();

    if (!category) {
      const visibleGroups = groupDefinitions.filter((group) => group.parent === (state.groupId || null));
      if (state.groupId) {
        const currentGroup = groupDefinition(state.groupId);
        nodes.push({
          id: "group:" + state.groupId,
          sourceId: state.groupId,
          type: "group",
          label: currentGroup ? currentGroup.label : state.groupId,
          count: categories.filter((item) => item.parentGroup === state.groupId).length + visibleGroups.length,
          depth: 1
        });
      }

      visibleGroups.forEach((group) => {
        nodes.push({
          id: "group:" + group.id,
          sourceId: group.id,
          type: "group",
          label: group.label,
          count: categories.filter((item) => item.parentGroup === group.id).length + groupDefinitions.filter((item) => item.parent === group.id).length,
          depth: state.groupId ? 2 : 1
        });
        if (state.groupId) edges.push({ source: "group:" + state.groupId, target: "group:" + group.id });
      });

      categories.filter((item) => item.parentGroup === state.groupId).forEach((item) => {
        nodes.push({
          id: "category:" + item.id,
          sourceId: item.id,
          type: "category",
          label: item.displayName || item.name,
          count: item.posts.length,
          depth: state.groupId ? 2 : 1
        });
        if (state.groupId) edges.push({ source: "group:" + state.groupId, target: "category:" + item.id });
      });
      return { nodes, edges };
    }

    nodes.push({
      id: "category:" + category.id,
      sourceId: category.id,
      type: "category",
      label: categoryPath(category),
      count: category.posts.length,
      depth: article ? 0 : 1
    });

    if (!article) {
      const seriesGroups = virtualSeries(category);
      const groupedPostIds = new Set(seriesGroups.flatMap((series) => series.posts.map((post) => post.id)));
      const activeSeries = seriesGroups.find((series) => series.id === state.seriesId) || null;

      seriesGroups.forEach((series) => {
        nodes.push({
          id: "series:" + series.id,
          sourceId: series.id,
          type: "series",
          label: series.label,
          count: series.posts.length,
          series,
          depth: 2
        });
        edges.push({ source: "category:" + category.id, target: "series:" + series.id, series: true });
      });

      const visiblePosts = activeSeries ? activeSeries.posts : category.posts.filter((post) => !groupedPostIds.has(post.id));
      visiblePosts.forEach((post) => {
        nodes.push({
          id: "article:" + post.id,
          sourceId: post.id,
          type: "article",
          label: post.title,
          post,
          isSeriesHub: Boolean(post.seriesHub),
          isSeriesChild: Boolean(post.parentPost),
          isStandalone: !post.seriesHub && !post.parentPost,
          depth: activeSeries ? 3 : 2
        });
      });

      if (activeSeries) {
        activeSeries.posts.forEach((post) => {
          edges.push({ source: "series:" + activeSeries.id, target: "article:" + post.id, series: true });
        });
        return { nodes, edges };
      }

      // Series metadata can turn a flat category into a small learning path.
      // A hub article receives the category edge; child articles branch from it.
      // Posts without a valid parent keep the original category relationship.
      const postsBySlug = new Map(category.posts.map((post) => [post.slug, post]));
      category.posts.filter((post) => !groupedPostIds.has(post.id)).forEach((post) => {
        const parent = post.parentPost && postsBySlug.get(post.parentPost);
        edges.push({
          source: parent ? "article:" + parent.id : "category:" + category.id,
          target: "article:" + post.id,
          series: Boolean(parent)
        });
      });
      return { nodes, edges };
    }

    nodes.push({
      id: "article:" + article.id,
      sourceId: article.id,
      type: "article",
      label: article.title,
      post: article,
      isSeriesHub: Boolean(article.seriesHub),
      isSeriesChild: Boolean(article.parentPost),
      isStandalone: !article.seriesHub && !article.parentPost,
      depth: 2
    });
    edges.push({ source: "category:" + category.id, target: "article:" + article.id });

    if (state.sections.length) {
      state.sections.forEach((section, index) => {
        const id = "section:" + article.id + ":" + index;
        nodes.push({
          id,
          sourceId: section.id,
          type: "section",
          label: section.title,
          url: article.url + "#" + encodeURIComponent(section.id),
          depth: 3
        });
        edges.push({
          source: index === 0 ? "article:" + article.id : "section:" + article.id + ":" + (index - 1),
          target: id
        });
      });
    }

    return { nodes, edges };
  }

  function initialPosition(node, index, nodes, width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    if (state.articleId) {
      const compact = width < 820;
      if (node.type === "category") {
        return compact ? { x: centerX - 18, y: 52 } : { x: width * 0.13, y: centerY - 24 };
      }
      if (node.type === "article") {
        return compact ? { x: centerX + 16, y: 132 } : { x: width * 0.36, y: centerY + 19 };
      }
      if (node.type === "section") {
        const sections = nodes.filter((candidate) => candidate.type === "section");
        const sectionIndex = sections.findIndex((candidate) => candidate.id === node.id);
        const startY = compact ? 215 : 62;
        const endY = height - 52;
        const y = sections.length === 1
          ? (startY + endY) / 2
          : startY + sectionIndex * ((endY - startY) / (sections.length - 1));
        const sideOffset = (sectionIndex % 2 === 0 ? -1 : 1) * (10 + variation(node.id, "section-x") * 15);
        const verticalOffset = (variation(node.id, "section-y") - 0.5) * 8;
        return compact
          ? { x: centerX + sideOffset, y: y + verticalOffset }
          : { x: width * 0.72 + sideOffset, y: y + verticalOffset };
      }
    }
    if (state.categoryId && !state.articleId && node.type === "category") return { x: centerX, y: centerY };
    if (state.groupId && !state.categoryId && node.type === "group") return { x: centerX, y: centerY };

    const peers = nodes.filter((candidate) => candidate.depth === node.depth);
    const peerIndex = peers.findIndex((candidate) => candidate.id === node.id);
    const angleJitter = (variation(node.id, "angle") - 0.5) * 0.19;
    const angle = (Math.PI * 2 * peerIndex / Math.max(peers.length, 1)) - Math.PI / 2 + angleJitter;
    const radiusByDepth = {
      1: Math.min(width, height) * 0.34,
      2: Math.min(width, height) * 0.36,
      3: Math.min(width, height) * 0.37
    };
    const radius = (radiusByDepth[node.depth] || 100) * (0.9 + variation(node.id, "radius") * 0.18);
    return {
      x: centerX + Math.cos(angle) * radius + (variation(node.id, "x") - 0.5) * 22,
      y: centerY + Math.sin(angle) * radius + (variation(node.id, "y") - 0.5) * 18
    };
  }

  function simulate(nodes, edges, width, height) {
    const map = new Map(nodes.map((node) => [node.id, node]));
    nodes.forEach((node, index) => {
      const position = initialPosition(node, index, nodes, width, height);
      node.x = position.x;
      node.y = position.y;
      node.vx = 0;
      node.vy = 0;
    });

    const iterations = nodes.length > 45 ? 90 : 140;
    for (let tick = 0; tick < iterations; tick += 1) {
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          const distanceSquared = Math.max(dx * dx + dy * dy, 100);
          const distance = Math.sqrt(distanceSquared);
          const force = Math.min(11, 5200 / distanceSquared);
          dx /= distance;
          dy /= distance;
          a.vx -= dx * force;
          a.vy -= dy * force;
          b.vx += dx * force;
          b.vy += dy * force;
        }
      }

      edges.forEach((edge) => {
        const source = map.get(edge.source);
        const target = map.get(edge.target);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const desired = target.type === "category" ? 145 : target.type === "article" ? 120 : 105;
        const force = (distance - desired) * 0.018;
        source.vx += (dx / distance) * force;
        source.vy += (dy / distance) * force;
        target.vx -= (dx / distance) * force;
        target.vy -= (dy / distance) * force;
      });

      nodes.forEach((node) => {
        if (state.articleId) {
          node.vx = 0;
          node.vy = 0;
          return;
        }
        const isFocus = (state.articleId && node.type === "article") ||
          (state.categoryId && !state.articleId && node.type === "category");
        const centerStrength = isFocus ? 0.18 : 0.004;
        node.vx += (width / 2 - node.x) * centerStrength;
        node.vy += (height / 2 - node.y) * centerStrength;
        node.vx *= 0.78;
        node.vy *= 0.78;
        node.x += node.vx;
        node.y += node.vy;
        const padding = node.type === "section" ? 38 : 48;
        node.x = Math.max(padding, Math.min(width - padding, node.x));
        node.y = Math.max(padding, Math.min(height - padding, node.y));
      });
    }
  }

  function updateInspector(node) {
    if (!node) {
      inspector.innerHTML = "<span class=\"knowledge-map__inspector-label\">Knowledge map</span><strong>Choose a field</strong><p>Click once to expand a node. Double-click an article or section to open it.</p>";
      return;
    }

    if (node.type === "category") {
      const category = categories.find((item) => item.id === node.sourceId);
      inspector.innerHTML = "<span class=\"knowledge-map__inspector-label\">Category path</span><strong>" + categoryPath(category) + "</strong><p>" + category.posts.length + " article" + (category.posts.length === 1 ? "" : "s") + ". Select an article node to inspect its major sections.</p>";
      return;
    }

    if (node.type === "group") {
      const members = categories.filter((item) => item.parentGroup === node.sourceId).map((item) => item.displayName || item.name);
      const childGroups = groupDefinitions.filter((item) => item.parent === node.sourceId).map((item) => item.label);
      inspector.innerHTML = "<span class=\"knowledge-map__inspector-label\">Category group</span><strong>" + node.label + "</strong><p>" + childGroups.concat(members).join(" · ") + ". Select the next node to continue.</p>";
      return;
    }

    if (node.type === "series") {
      inspector.innerHTML = "<span class=\"knowledge-map__inspector-label\">Article group</span><strong>" + node.label + "</strong><p>" + node.count + " articles. Select this group to reveal its articles.</p>";
      return;
    }

    if (node.type === "article") {
      const tags = (node.post.tags || []).slice(0, 5).map((tag) => "<span>" + tag + "</span>").join("");
      inspector.innerHTML = "<span class=\"knowledge-map__inspector-label\">Article · " + node.post.date + "</span><strong>" + node.post.title + "</strong><p>" + truncate(node.post.excerpt, 210) + "</p><div class=\"knowledge-map__inspector-tags\">" + tags + "</div><a class=\"knowledge-map__open\" href=\"" + node.post.url + "\">Open article</a>";
      return;
    }

    const article = selectedArticle();
    inspector.innerHTML = "<span class=\"knowledge-map__inspector-label\">Major section</span><strong>" + node.label + "</strong><p>Open this heading directly inside “" + article.title + "”.</p><a class=\"knowledge-map__open\" href=\"" + node.url + "\">Open section</a>";
  }

  async function loadSections(post) {
    if (sectionCache.has(post.url)) return sectionCache.get(post.url);
    const sections = (post.outline || []).filter((section) => section.id && section.title);
    sectionCache.set(post.url, sections);
    return sections;
  }

  async function activate(node) {
    if (node.type === "group") {
      const group = groupDefinition(node.sourceId);
      state.groupId = state.groupId === node.sourceId ? (group && group.parent) : node.sourceId;
      state.categoryId = null;
      state.seriesId = null;
      state.articleId = null;
      state.sections = [];
      render();
      updateInspector(state.groupId ? node : null);
      return;
    }

    if (node.type === "category") {
      state.categoryId = state.categoryId === node.sourceId ? null : node.sourceId;
      state.articleId = null;
      state.seriesId = null;
      state.sections = [];
      render();
      updateInspector(state.categoryId ? node : null);
      return;
    }

    if (node.type === "series") {
      state.seriesId = state.seriesId === node.sourceId ? null : node.sourceId;
      state.articleId = null;
      state.sections = [];
      render();
      updateInspector(state.seriesId ? node : null);
      return;
    }

    if (node.type === "article") {
      if (state.articleId === node.sourceId) {
        state.articleId = null;
        state.sections = [];
        render();
        updateInspector(node);
        return;
      }
      state.articleId = node.sourceId;
      state.sections = [];
      render();
      const sections = await loadSections(node.post);
      if (state.articleId !== node.sourceId) return;
      state.sections = sections;
      render();
      updateInspector(node);
      return;
    }

    updateInspector(node);
  }

  function openNode(node) {
    if (node.type === "article") {
      window.location.href = node.post.url;
    } else if (node.type === "section") {
      window.location.href = node.url;
    }
  }

  function scheduleActivation(node) {
    window.clearTimeout(clickTimers.get(node.id));
    const timer = window.setTimeout(() => {
      clickTimers.delete(node.id);
      activate(node);
    }, 230);
    clickTimers.set(node.id, timer);
  }

  function handleDoubleClick(node) {
    window.clearTimeout(clickTimers.get(node.id));
    clickTimers.delete(node.id);
    if (node.type === "article" || node.type === "section") {
      openNode(node);
    } else {
      activate(node);
    }
  }

  function reset() {
    state.groupId = null;
    state.categoryId = null;
    state.seriesId = null;
    state.articleId = null;
    state.loadingArticleId = null;
    state.sections = [];
    render();
    updateInspector(null);
  }

  function render() {
    const width = Math.max(720, Math.round(svg.getBoundingClientRect().width || 960));
    const graph = buildGraph();
    const sectionCount = graph.nodes.filter((node) => node.type === "section").length;
    const height = state.articleId
      ? Math.max(width < 820 ? 540 : 600, sectionCount * 52 + (width < 820 ? 245 : 110))
      : width < 820 ? 560 : 640;
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.style.height = height + "px";
    svg.replaceChildren();

    simulate(graph.nodes, graph.edges, width, height);
    emptyState.hidden = graph.nodes.length > 0;
    resetButton.disabled = !state.groupId && !state.categoryId && !state.seriesId;

    const map = new Map(graph.nodes.map((node) => [node.id, node]));
    const edgeLayer = svgElement("g", { class: "knowledge-map__edges" });
    graph.edges.forEach((edge) => {
      const source = map.get(edge.source);
      const target = map.get(edge.target);
      edgeLayer.appendChild(svgElement("line", {
        x1: source.x,
        y1: source.y,
        x2: target.x,
        y2: target.y,
        class: "knowledge-map__edge knowledge-map__edge--" + target.type + (edge.series ? " knowledge-map__edge--series" : "") + (target.isStandalone ? " knowledge-map__edge--standalone" : "")
      }));
    });
    svg.appendChild(edgeLayer);

    const nodeLayer = svgElement("g", { class: "knowledge-map__nodes" });
    graph.nodes.forEach((node) => {
      const selected = (node.type === "group" && node.sourceId === state.groupId) ||
        (node.type === "category" && node.sourceId === state.categoryId) ||
        (node.type === "series" && node.sourceId === state.seriesId) ||
        (node.type === "article" && node.sourceId === state.articleId);
      const group = svgElement("g", {
        class: "knowledge-map__node knowledge-map__node--" + node.type + (node.isSeriesHub ? " knowledge-map__node--series-hub" : "") + (node.isSeriesChild ? " knowledge-map__node--series-child" : "") + (node.isStandalone ? " knowledge-map__node--standalone" : "") + (selected ? " is-selected" : "") + (state.loadingArticleId === node.sourceId ? " is-loading" : ""),
        transform: "translate(" + node.x + " " + node.y + ")",
        tabindex: "0",
        role: node.type === "section" ? "link" : "treeitem",
        "aria-label": node.label + (node.count ? ", " + node.count + " articles" : "")
      });

      // Keep compact canvas labels, but expose the unabridged title on hover
      // through the native SVG tooltip. The inspector also shows this value.
      const tooltip = svgElement("title");
      tooltip.textContent = node.label;
      group.appendChild(tooltip);

      const baseRadius = node.type === "root" ? 25 : node.type === "group" ? 25 : node.type === "category" ? 18 + Math.min(node.count || 0, 6) : node.type === "series" ? 19 : node.type === "article" ? (node.isStandalone ? 17 : 15) : 8;
      const radius = baseRadius * (0.88 + variation(node.id, "size") * 0.26);
      if (node.type === "group" || node.type === "category" || node.type === "series" || node.isSeriesHub || node.isStandalone) {
        group.appendChild(svgElement("circle", { r: radius + 5, class: "knowledge-map__node-orbit" }));
      }
      group.appendChild(svgElement("circle", { r: radius, class: "knowledge-map__node-core" }));

      const label = svgElement("text", {
        x: 0,
        y: radius + 16,
        "text-anchor": "middle",
        class: "knowledge-map__label"
      });
      label.textContent = truncate(node.label, node.type === "article" ? 34 : node.type === "section" ? 28 : 24);
      group.appendChild(label);

      if (node.count) {
        const count = svgElement("text", { x: 0, y: 4, "text-anchor": "middle", class: "knowledge-map__count" });
        count.textContent = node.count;
        group.appendChild(count);
      }

      group.addEventListener("click", () => scheduleActivation(node));
      group.addEventListener("dblclick", () => handleDoubleClick(node));
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate(node);
        }
      });
      group.addEventListener("mouseenter", () => updateInspector(node));
      group.addEventListener("focus", () => updateInspector(node));
      nodeLayer.appendChild(group);
    });
    svg.appendChild(nodeLayer);
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(render, 120);
  });
  resetButton.addEventListener("click", reset);
  initAmbientCanvas();
  render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeKnowledgeMap, { once: true });
  } else {
    initializeKnowledgeMap();
  }
  document.addEventListener("post-lock:unlocked", initializeKnowledgeMap);
})();
