(function () {
  const tools = window.PORTFOLIO_TOOLS || [];
  const contact = window.PORTFOLIO_CONTACT || {};

  const grid = document.getElementById("tool-grid");
  const gridFeed = document.getElementById("tool-grid-feed");
  const toolGridWrap = document.getElementById("tool-grid-wrap");
  const toolGridStrip = document.getElementById("tool-grid-strip");
  const filterBar = document.querySelector(".filter-bar");
  const yearEl = document.getElementById("year");
  const contactList = document.getElementById("contact-links");

  /** Only one card pauses hover-shake; choosing another card removes pause elsewhere so those shake again */
  function setOnlyShakePaused(activeLi) {
    if (!toolGridStrip) return;
    toolGridStrip.querySelectorAll(".tool-card.flip-card").forEach((node) => {
      node.classList.remove("flip-mark-steady");
    });
    if (activeLi instanceof HTMLElement && activeLi.classList.contains("flip-card")) {
      activeLi.classList.add("flip-mark-steady");
    }
  }

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  const ICONS = {
    email: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/><path fill="#FBBC04" d="M0 5.457v2.234l8.005 5.572L0 18.835V5.457z"/><path fill="#34A853" d="M24 5.457v13.378l-8.005-5.572L24 7.691V5.457z"/><path fill="#4285F4" d="M24 5.457v2.234L12 15.263 0 7.691V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.548l8.073-4.055C21.69 2.28 24 3.434 24 5.457z"/></svg>`,
    linkedin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
    github: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="#e6edf3" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>`,
  };

  if (contactList && contact && typeof contact === "object") {
    const order = ["email", "linkedin", "github"];
    order.forEach((key) => {
      const entry = contact[key];
      if (!entry || !entry.href) return;
      const li = document.createElement("li");
      li.className = "contact-item";
      const a = document.createElement("a");
      a.className = "contact-btn";
      a.href = entry.href;
      if (key !== "email") {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      const label = entry.label || entry.href;
      a.setAttribute("aria-label", key === "email" ? `Email: ${label}` : `${label} (opens in new tab)`);
      const icon = ICONS[key] || "";
      a.innerHTML = `<span class="contact-icon">${icon}</span><span class="contact-label">${escapeHtml(
        label
      )}</span>`;
      li.appendChild(a);
      contactList.appendChild(li);
    });
    contactList.dataset.contactRendered = "1";
  }

  const allTags = [...new Set(tools.flatMap((t) => t.tags || []))].sort(
    (a, b) => a.localeCompare(b)
  );

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  function videoMimeType(path) {
    const p = String(path).toLowerCase();
    if (p.endsWith(".mp4") || p.endsWith(".m4v")) return "video/mp4";
    if (p.endsWith(".webm")) return "video/webm";
    if (p.endsWith(".mov")) return "video/quicktime";
    return "video/mp4";
  }

  /** Flip mark button — toggles “NJ” ↔ “QA”; crossfade matches card flip timing */
  function flipLogoMarkup(_variant, _markerIndex) {
    const font =
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    return `<button type="button" class="flip-logo" aria-label="Switch mark between NJ and QA" aria-pressed="false">
<svg class="flip-logo-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" fill="none" role="img" aria-hidden="true">
  <rect class="flip-logo-panel" x="3.5" y="3.5" width="49" height="49" rx="13" fill="rgba(124, 231, 198, 0.14)" stroke="rgba(124, 231, 198, 0.48)" stroke-width="1.25"/>
  <g class="flip-logo-layer flip-logo-layer--nj">
    <g class="flip-logo-letters">
      <text class="flip-logo-mark-txt" text-anchor="middle" x="28" y="36.5" font-size="23" font-weight="700" fill="#7ce7c6" font-family="${font}">NJ</text>
    </g>
  </g>
  <g class="flip-logo-layer flip-logo-layer--qa">
    <g class="flip-logo-letters">
      <text class="flip-logo-mark-txt" text-anchor="middle" x="28" y="36.5" font-size="21" font-weight="700" fill="#7ce7c6" font-family="${font}">QA</text>
    </g>
  </g>
</svg></button>`;
  }

  function buildToolFrontHtml(tool, markerIndex) {
    const tags = (tool.tags || [])
      .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
      .join("");
    const linkBlock = tool.repoUrl
      ? `<a class="tool-link" href="${escapeAttr(
          tool.repoUrl
        )}" target="_blank" rel="noopener noreferrer">View repository</a>`
      : `<span class="tool-link tool-link-muted">Repository on request</span>`;
    const demoSrc = tool.demoVideo ? escapeAttr(tool.demoVideo) : "";
    const demoType = tool.demoVideo ? escapeAttr(videoMimeType(tool.demoVideo)) : "";
    const videoBlock = tool.demoVideo
      ? `<div class="tool-video-wrap" data-demo-src="${demoSrc}" data-demo-type="${demoType}">
            <p class="tool-video-label">Demo</p>
            <div class="tool-video-shell">
              <video class="tool-video tool-video--card" controls playsinline preload="metadata" disablePictureInPicture disableremoteplayback title="${escapeAttr(
                `${tool.title} demo`
              )}">
                <source src="${demoSrc}" type="${demoType}" />
              </video>
              <button type="button" class="tool-video-expand" aria-label="Open demo in full screen" hidden>
                <span class="tool-video-expand-text">Full screen</span>
              </button>
            </div>
          </div>`
      : "";
    return `
        <h3 class="tool-title">${escapeHtml(tool.title)}</h3>
        <p class="tool-summary">${escapeHtml(tool.summary)}</p>
        ${videoBlock}
        <div class="tool-tags">${tags}</div>
        ${linkBlock}
        <div class="flip-card-flip-row">
          ${flipLogoMarkup("front", markerIndex)}
        </div>
      `;
  }

  /** One flip card (no listeners — #tool-grid-wrap handles click / keydown) */
  function createToolCard(tool, markerIndex, tabbable) {
    const li = document.createElement("li");
    li.className = "tool-card flip-card";
    li.setAttribute("tabindex", tabbable ? "0" : "-1");
    li.setAttribute("aria-expanded", "false");
    li.setAttribute(
      "aria-label",
      `${tool.title} — click the card to flip for more details. Use the NJ / QA button to switch the mark.`
    );

    const inner = document.createElement("div");
    inner.className = "flip-card-inner";

    const front = document.createElement("div");
    front.className = "flip-card-face flip-card-front";
    front.innerHTML = buildToolFrontHtml(tool, markerIndex);

    const back = document.createElement("div");
    back.className = "flip-card-face flip-card-back";
    back.innerHTML = `
        <p class="flip-card-placeholder">Details coming soon.</p>
        <div class="flip-card-flip-row flip-card-flip-row--back">
          ${flipLogoMarkup("back", markerIndex)}
        </div>
      `;

    inner.appendChild(front);
    inner.appendChild(back);

    const shake = document.createElement("div");
    shake.className = "flip-card-shake";
    shake.appendChild(inner);
    li.appendChild(shake);
    return li;
  }

  const demoMobileMq = window.matchMedia("(max-width: 720px)");

  function syncToolVideoChrome() {
    document.querySelectorAll(".tool-video-wrap").forEach((wrap) => {
      const v = wrap.querySelector(".tool-video--card");
      const shell = wrap.querySelector(".tool-video-shell");
      const btn = wrap.querySelector(".tool-video-expand");
      if (!v || !shell) return;
      const mobile = demoMobileMq.matches;
      shell.classList.toggle("tool-video-shell--expandable", mobile);
      if (mobile) {
        v.removeAttribute("controls");
        if (btn) btn.hidden = false;
      } else {
        v.setAttribute("controls", "");
        if (btn) btn.hidden = true;
      }
    });
  }

  let demoOverlayEl = null;
  let demoOverlayBound = false;

  function ensureDemoOverlay() {
    if (demoOverlayEl) return demoOverlayEl;
    demoOverlayEl = document.createElement("div");
    demoOverlayEl.id = "tool-demo-overlay";
    demoOverlayEl.className = "tool-demo-overlay";
    demoOverlayEl.setAttribute("hidden", "");
    demoOverlayEl.innerHTML = `
      <button type="button" class="tool-demo-backdrop" aria-label="Close demo"></button>
      <div class="tool-demo-panel" role="dialog" aria-modal="true" aria-label="Demo video">
        <button type="button" class="tool-demo-close" aria-label="Close">&times;</button>
        <video class="tool-demo-full-video" controls playsinline preload="metadata" disablePictureInPicture disableremoteplayback></video>
      </div>
    `;
    document.body.appendChild(demoOverlayEl);
    return demoOverlayEl;
  }

  function closeDemoLightbox() {
    if (!demoOverlayEl || demoOverlayEl.hasAttribute("hidden")) return;
    const fullV = demoOverlayEl.querySelector(".tool-demo-full-video");
    if (fullV) {
      fullV.pause();
      fullV.removeAttribute("src");
      fullV.innerHTML = "";
    }
    demoOverlayEl.setAttribute("hidden", "");
    document.body.classList.remove("tool-demo-open");
  }

  /** Prefer native fullscreen on the card video; lightbox only if the API is unavailable or rejected */
  function openDemoVideoPresentation(wrap) {
    if (!(wrap instanceof HTMLElement)) return;
    const v = wrap.querySelector(".tool-video--card");
    if (!v) return;

    if (typeof v.webkitEnterFullscreen === "function") {
      try {
        v.webkitEnterFullscreen();
        v.play().catch(() => {});
        return;
      } catch (_) {
        /* continue */
      }
    }

    const req =
      v.requestFullscreen ||
      v.webkitRequestFullscreen ||
      v.mozRequestFullScreen ||
      v.msRequestFullscreen;
    if (typeof req === "function") {
      Promise.resolve(req.call(v))
        .then(() => {
          v.play().catch(() => {});
        })
        .catch(() => {
          openDemoLightbox(wrap);
        });
      return;
    }

    openDemoLightbox(wrap);
  }

  function openDemoLightbox(wrap) {
    if (!(wrap instanceof HTMLElement)) return;
    const src = wrap.getAttribute("data-demo-src");
    const type = wrap.getAttribute("data-demo-type") || "video/mp4";
    if (!src) return;

    const overlay = ensureDemoOverlay();
    const fullV = overlay.querySelector(".tool-demo-full-video");
    const cardV = wrap.querySelector(".tool-video--card");
    if (cardV) cardV.pause();

    if (fullV) {
      fullV.pause();
      fullV.innerHTML = "";
      const source = document.createElement("source");
      source.src = src;
      source.type = type;
      fullV.appendChild(source);
      fullV.load();
    }

    overlay.removeAttribute("hidden");
    document.body.classList.add("tool-demo-open");
    window.requestAnimationFrame(() => {
      if (fullV && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        fullV.play().catch(() => {});
      }
    });
  }

  function bindToolDemoLightboxOnce() {
    if (demoOverlayBound) return;
    demoOverlayBound = true;

    ensureDemoOverlay();

    const onMqChange = () => {
      syncToolVideoChrome();
      if (!demoMobileMq.matches) closeDemoLightbox();
    };
    if (demoMobileMq.addEventListener) {
      demoMobileMq.addEventListener("change", onMqChange);
    } else if (demoMobileMq.addListener) {
      demoMobileMq.addListener(onMqChange);
    }

    let resizeT = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeT);
      resizeT = window.setTimeout(onMqChange, 120);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && demoOverlayEl && !demoOverlayEl.hasAttribute("hidden")) {
        e.preventDefault();
        closeDemoLightbox();
      }
    });

    demoOverlayEl.addEventListener("click", (e) => {
      if (e.target.closest(".tool-demo-close") || e.target.classList.contains("tool-demo-backdrop")) {
        closeDemoLightbox();
      }
    });

    if (toolGridWrap) {
      toolGridWrap.addEventListener(
        "click",
        (e) => {
          if (!demoMobileMq.matches) return;
          const shell = e.target.closest(".tool-video-shell.tool-video-shell--expandable");
          if (!shell || !toolGridWrap.contains(shell)) return;
          if (e.target.closest("a")) return;
          e.stopPropagation();
          const wrap = shell.closest(".tool-video-wrap");
          openDemoVideoPresentation(wrap);
        },
        true
      );
    }

    if (toolGridWrap && toolGridWrap.dataset.toolDemoFsClick !== "1") {
      toolGridWrap.dataset.toolDemoFsClick = "1";
      toolGridWrap.addEventListener("click", (e) => {
        if (demoMobileMq.matches) return;
        const v = e.target;
        if (!(v instanceof HTMLVideoElement) || !v.classList.contains("tool-video--card")) return;
        const wrap = v.closest(".tool-video-wrap");
        if (!wrap || !toolGridWrap.contains(wrap)) return;
        openDemoVideoPresentation(wrap);
      });
    }
  }

  function getPrinterSegmentWidth() {
    if (!grid || !toolGridStrip) return 0;
    const w = grid.offsetWidth;
    const gap = parseFloat(getComputedStyle(toolGridStrip).gap) || 16;
    return w + gap;
  }

  function normalizePrinterScroll() {
    if (!toolGridWrap || !gridFeed || gridFeed.children.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const seg = getPrinterSegmentWidth();
    if (seg <= 0) return;
    let sl = toolGridWrap.scrollLeft;
    while (sl >= seg - 0.5) {
      sl -= seg;
    }
    toolGridWrap.scrollLeft = sl;
  }

  let printerScrollRaf = 0;
  function onPrinterScroll() {
    if (printerScrollRaf) cancelAnimationFrame(printerScrollRaf);
    printerScrollRaf = requestAnimationFrame(() => {
      printerScrollRaf = 0;
      normalizePrinterScroll();
    });
  }

  function bindToolPrinterFeedOnce() {
    if (!toolGridWrap || toolGridWrap.dataset.printerBound === "1") return;
    toolGridWrap.dataset.printerBound = "1";

    toolGridWrap.addEventListener("scroll", onPrinterScroll, { passive: true });

    /** Touch drags on cards synthesize click — would toggle flip and fight horizontal scroll */
    let flipTouchSuppressClick = false;
    let lastMouseoverFlipLi = null;

    toolGridWrap.addEventListener("mouseover", (e) => {
      const li = e.target.closest(".tool-card.flip-card");
      if (!li || !toolGridWrap.contains(li)) return;
      if (lastMouseoverFlipLi === li) return;
      if (lastMouseoverFlipLi !== null && toolGridStrip) {
        toolGridStrip.querySelectorAll(".tool-card.flip-card").forEach((node) => {
          node.classList.remove("flip-mark-steady");
        });
      }
      lastMouseoverFlipLi = li;
    });

    toolGridWrap.addEventListener("mouseleave", (e) => {
      const rt = e.relatedTarget;
      if (rt instanceof Node && toolGridWrap.contains(rt)) return;
      lastMouseoverFlipLi = null;
      if (!toolGridStrip) return;
      toolGridStrip.querySelectorAll(".tool-card.flip-card").forEach((node) => {
        node.classList.remove("flip-mark-steady");
      });
    });

    toolGridWrap.addEventListener(
      "pointerdown",
      (e) => {
        const li = e.target.closest(".tool-card.flip-card");
        if (!li || !toolGridWrap.contains(li)) return;

        /* Press on this card (not link / full-screen pill): pause shake only here; other cards shake again on hover */
        if (!e.target.closest("a") && !e.target.closest(".tool-video-expand")) {
          setOnlyShakePaused(li);
        }

        flipTouchSuppressClick = false;
        if (e.pointerType !== "touch" && e.pointerType !== "pen") return;

        const id = e.pointerId;
        const x0 = e.clientX;
        const y0 = e.clientY;
        const thr = 14;

        const onMove = (ev) => {
          if (ev.pointerId !== id) return;
          const dx = ev.clientX - x0;
          const dy = ev.clientY - y0;
          if (dx * dx + dy * dy > thr * thr) flipTouchSuppressClick = true;
        };

        const onEnd = (ev) => {
          if (ev.pointerId !== id) return;
          toolGridWrap.removeEventListener("pointermove", onMove);
          toolGridWrap.removeEventListener("pointerup", onEnd);
          toolGridWrap.removeEventListener("pointercancel", onEnd);
        };

        toolGridWrap.addEventListener("pointermove", onMove, { passive: true });
        toolGridWrap.addEventListener("pointerup", onEnd, { passive: true });
        toolGridWrap.addEventListener("pointercancel", onEnd, { passive: true });
      },
      { passive: true }
    );

    toolGridWrap.addEventListener("click", (e) => {
      if (flipTouchSuppressClick) {
        flipTouchSuppressClick = false;
        return;
      }
      const markBtn = e.target.closest("button.flip-logo");
      if (markBtn && toolGridWrap.contains(markBtn)) {
        e.stopPropagation();
        const li = markBtn.closest(".tool-card.flip-card");
        if (li) {
          setOnlyShakePaused(li);
          li.classList.toggle("flip-mark-qa");
          const qa = li.classList.contains("flip-mark-qa");
          li.querySelectorAll("button.flip-logo").forEach((b) => {
            b.setAttribute("aria-pressed", qa ? "true" : "false");
          });
        }
        return;
      }
      if (demoMobileMq.matches && e.target.closest(".tool-video-shell.tool-video-shell--expandable")) return;
      if (e.target.closest("a") || e.target.closest("video") || e.target.closest("button")) return;
      const li = e.target.closest(".tool-card.flip-card");
      if (!li || !toolGridWrap.contains(li)) return;
      setOnlyShakePaused(li);
      const on = li.classList.toggle("is-flipped");
      li.setAttribute("aria-expanded", on ? "true" : "false");
    });

    toolGridWrap.addEventListener("keydown", (e) => {
      const li = e.target.closest(".tool-card.flip-card");
      if (!li || !toolGridWrap.contains(li)) return;
      if (e.target.closest("a") || e.target.closest("video") || e.target.closest("button")) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOnlyShakePaused(li);
        const on = li.classList.toggle("is-flipped");
        li.setAttribute("aria-expanded", on ? "true" : "false");
      }
    });

    if (typeof ResizeObserver !== "undefined" && grid) {
      const ro = new ResizeObserver(() => normalizePrinterScroll());
      ro.observe(grid);
      if (gridFeed) ro.observe(gridFeed);
    }

    if (toolGridWrap.dataset.flipBfBound !== "1") {
      toolGridWrap.dataset.flipBfBound = "1";
      window.addEventListener("pageshow", (e) => {
        if (!e.persisted) return;
        toolGridWrap.querySelectorAll(".tool-card.flip-card").forEach((li) => {
          li.classList.remove("is-flipped", "flip-mark-qa", "flip-mark-steady");
          li.setAttribute("aria-expanded", "false");
          li.querySelectorAll("button.flip-logo").forEach((b) => b.setAttribute("aria-pressed", "false"));
        });
      });
    }
  }

  let toolFlipLeaveIo = null;

  /** When a card leaves the horizontal tools strip, show the front again next time it’s in view */
  function bindFlipResetWhenScrollAway() {
    if (!toolGridWrap || !toolGridStrip || typeof IntersectionObserver === "undefined") return;

    if (toolFlipLeaveIo) {
      toolFlipLeaveIo.disconnect();
      toolFlipLeaveIo = null;
    }

    toolFlipLeaveIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) continue;
          const li = entry.target;
          if (!(li instanceof HTMLElement)) continue;
          if (li.classList.contains("is-flipped")) {
            li.classList.remove("is-flipped");
            li.setAttribute("aria-expanded", "false");
          }
          if (li.classList.contains("flip-mark-qa")) {
            li.classList.remove("flip-mark-qa");
            li.querySelectorAll("button.flip-logo").forEach((b) => b.setAttribute("aria-pressed", "false"));
          }
          li.classList.remove("flip-mark-steady");
        }
      },
      { root: toolGridWrap, threshold: 0 }
    );

    toolGridStrip.querySelectorAll(".tool-card.flip-card").forEach((li) => {
      toolFlipLeaveIo.observe(li);
    });
  }

  function renderTools(filterTag) {
    if (!grid) return;
    if (toolGridWrap) toolGridWrap.scrollLeft = 0;
    grid.innerHTML = "";
    if (gridFeed) gridFeed.innerHTML = "";

    const list = filterTag
      ? tools.filter((t) => (t.tags || []).includes(filterTag))
      : tools;

    const showPrinterFeed = !filterTag && list.length > 0;

    list.forEach((tool, i) => {
      grid.appendChild(createToolCard(tool, i, true));
    });

    if (showPrinterFeed && gridFeed) {
      list.forEach((tool, i) => {
        const markerIndex = i + list.length;
        gridFeed.appendChild(createToolCard(tool, markerIndex, false));
      });
      gridFeed.setAttribute("aria-hidden", "true");
    }

    bindToolPrinterFeedOnce();
    bindToolDemoLightboxOnce();
    bindFlipResetWhenScrollAway();
    syncToolVideoChrome();
    requestAnimationFrame(() => normalizePrinterScroll());
  }

  if (filterBar) {
    allTags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.dataset.filter = tag;
      btn.textContent = tag;
      filterBar.appendChild(btn);
    });

    filterBar.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-filter]");
      if (!btn) return;
      const value = btn.dataset.filter;
      filterBar.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderTools(value === "all" ? null : value);
    });
  }

  renderTools(null);
})();
