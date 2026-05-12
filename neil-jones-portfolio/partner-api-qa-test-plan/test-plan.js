(function () {
  function requestFs(el) {
    if (el.requestFullscreen) return el.requestFullscreen();
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    return Promise.reject(new Error("Fullscreen not supported"));
  }

  function exitFs() {
    var d = document;
    if (d.exitFullscreen) return d.exitFullscreen();
    if (d.webkitExitFullscreen) return d.webkitExitFullscreen();
  }

  function activeFullscreenEl() {
    return document.fullscreenElement || document.webkitFullscreenElement;
  }

  document.querySelectorAll(".tp-zoom-img").forEach(function (img) {
    var baseAlt = img.getAttribute("alt") || "Screenshot";
    img.setAttribute("tabindex", "0");
    img.setAttribute("role", "button");
    img.setAttribute(
      "aria-label",
      baseAlt + " — activate for fullscreen; Escape to exit"
    );

    function toggle() {
      if (activeFullscreenEl() === img) {
        exitFs();
        return;
      }
      if (activeFullscreenEl()) {
        exitFs();
      }
      requestFs(img).catch(function () {});
    }

    img.addEventListener("click", function (e) {
      e.preventDefault();
      toggle();
    });

    img.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });

  function syncCursor() {
    var active = activeFullscreenEl();
    document.querySelectorAll(".tp-zoom-img").forEach(function (img) {
      img.style.cursor = active === img ? "zoom-out" : "zoom-in";
    });
  }

  document.addEventListener("fullscreenchange", syncCursor);
  document.addEventListener("webkitfullscreenchange", syncCursor);
  syncCursor();
})();
