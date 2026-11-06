/* ToolSprint — shared site script (Batch 1).
   SITE_NAME is defined ONCE here and used for the header, footer,
   titles and copy across every page. Also owns: header/footer
   injection, live search helpers, tool-card rendering and the
   "Related tools" row used by tool pages. Design is strict
   black-and-white; there is no dark mode.
   Plain vanilla JS, no router, no build step. */
var SITE_NAME = "ToolSprint";

/* Pages live in two places: the site root (index.html, every tool
   page, all-tools, about, privacy, terms, contact) and guides/
   (the 10 guide pages). BASE works out the relative prefix from
   this script's own URL so every link stays a normal relative link. */
var BASE = (function () {
  var s = document.currentScript;
  var src = s ? s.getAttribute("src") : "";
  if (src.indexOf("../assets/js/site.js") === 0) return "../";     /* guides/ page */
  if (src.indexOf("assets/js/site.js") === 0) return "";           /* root page */
  return "";
})();

var NAV_PAGES = [
  { label: "Home",     href: "index.html" },
  { label: "All Tools", href: "all-tools.html" },
  { label: "About",    href: "about.html" },
  { label: "Contact",  href: "contact.html" }
];

function pageHref(href) {
  /* href is a root-relative filename ("about.html"); guide pages
     (one level down) prefix it with "../". The Home link uses the
     DIRECTORY form ("./", "../") rather than the "index.html"
     filename, so it always resolves to the site homepage. */
  if (href === "index.html") {
    return BASE === "../" ? "../" : "./";
  }
  if (BASE === "../") {
    return "../" + href;
  }
  return href;
}
function assetHref(path) { return BASE + path; }
/* Guide pages live in guides/ (one level down); tool pages live at
   the site root, so from a guide a tool is "../<slug>.html" and from
   anywhere else it is "<slug>.html". */
var IN_GUIDES = /\/guides\//.test(location.pathname);
function toolHref(slug) {
  if (IN_GUIDES) return "../" + slug + ".html";
  return slug + ".html";
}
function guideHref(gslug) {
  if (IN_GUIDES) return gslug + ".html";
  return "guides/" + gslug + ".html";
}

/* ---------- Recently used + favourites (this browser only) -------
   Stored in localStorage on the visitor's own device — no account,
   nothing sent anywhere. If storage is unavailable (private mode,
   blocked cookies), an in-memory fallback keeps the features working
   for the session instead of throwing. */
var tsStore = (function () {
  try {
    var k = "__ts_probe";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return localStorage;
  } catch (e) {
    var mem = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; }
    };
  }
})();
function tsReadList(key) {
  try {
    var v = JSON.parse(tsStore.getItem(key) || "[]");
    return Object.prototype.toString.call(v) === "[object Array]" ? v : [];
  } catch (e) { return []; }
}
function tsWriteList(key, list) {
  try { tsStore.setItem(key, JSON.stringify(list)); } catch (e) { /* storage full/blocked — feature just won't persist */ }
}
function tsToolBySlug(slug) {
  for (var i = 0; i < TOOLS.length; i++) if (TOOLS[i].slug === slug) return TOOLS[i];
  return null;
}
function getRecentSlugs() { return tsReadList("ts_recent"); }
function getFavSlugs() { return tsReadList("ts_favs"); }
function isFav(slug) { return getFavSlugs().indexOf(slug) !== -1; }
function trackRecent(slug) {
  if (!tsToolBySlug(slug)) return;
  var list = getRecentSlugs().filter(function (s) { return s !== slug; });
  list.unshift(slug);
  tsWriteList("ts_recent", list.slice(0, 12));
}
function toggleFav(slug) {
  var list = getFavSlugs();
  var i = list.indexOf(slug);
  if (i === -1) list.unshift(slug); else list.splice(i, 1);
  tsWriteList("ts_favs", list);
  refreshFavButtons();
  return i === -1;
}
function recentTools() {
  return getRecentSlugs().map(tsToolBySlug).filter(Boolean).slice(0, 6);
}
function favTools() {
  return getFavSlugs().map(tsToolBySlug).filter(Boolean);
}
/* Star buttons live inside tool cards (and one toggle button on each
   tool page). One delegated listener handles every star on the page,
   including cards rendered later by search/filter. */
function refreshFavButtons() {
  var btns = document.querySelectorAll("[data-fav]");
  for (var i = 0; i < btns.length; i++) {
    var b = btns[i], slug = b.getAttribute("data-fav"), on = isFav(slug);
    var t = tsToolBySlug(slug);
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.classList.toggle("on", on);
    if (b.classList.contains("fav-toggle")) {
      b.textContent = on ? "★ Favourited" : "☆ Save to favourites";
    } else {
      b.textContent = on ? "★" : "☆";
      b.setAttribute("aria-label", (on ? "Remove " : "Save ") + (t ? t.name : slug) + (on ? " from" : " to") + " favourites");
      b.title = on ? "Remove from favourites" : "Save to favourites";
    }
  }
}
document.addEventListener("click", function (e) {
  var b = e.target && e.target.closest ? e.target.closest("[data-fav]") : null;
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  toggleFav(b.getAttribute("data-fav"));
  /* If the homepage is showing its Favourites section, re-render it
     so an un-starred tool disappears straight away. */
  if (typeof renderHome === "function") renderHome();
  if (typeof renderList === "function") renderList();
});
/* Load a heavy library only when a tool actually needs it (used by
   the PDF Compressor for its Strong-mode renderer). */
var tsLoadedScripts = {};
function loadScriptOnce(src) {
  return new Promise(function (resolve, reject) {
    if (tsLoadedScripts[src]) { resolve(); return; }
    var s = document.createElement("script");
    s.src = src;
    s.onload = function () { tsLoadedScripts[src] = true; resolve(); };
    s.onerror = function () { reject(new Error("Could not load " + src)); };
    document.head.appendChild(s);
  });
}

/* ---------- Header + footer ---------- */
function buildHeader(active) {
  var el = document.getElementById("site-header");
  if (!el) return;
  var nav = NAV_PAGES.map(function (p) {
    var cur = p.label === active ? ' aria-current="page"' : "";
    return '<a href="' + pageHref(p.href) + '"' + cur + ">" + p.label + "</a>";
  }).join("");
  el.innerHTML =
    '<div class="wrap header-in">' +
      '<a class="logo" href="' + pageHref("index.html") + '" aria-label="' + SITE_NAME + ' home">' +
        '<img src="' + assetHref("assets/logo-mark.svg") + '" alt=""/>' +
        '<span class="word">Tool<b>Sprint</b></span></a>' +
      '<nav class="main" aria-label="Main">' + nav + "</nav>" +
    "</div>";
}
function buildFooter() {
  var el = document.getElementById("site-footer");
  if (!el) return;
  var popular = TOOLS.filter(function (t) { return t.popular; }).slice(0, 5);
  var popLinks = popular.map(function (t) {
    return '<a href="' + toolHref(t.slug) + '">' + t.name + "</a>";
  }).join("");
  el.innerHTML =
    '<div class="wrap"><div class="footer-in">' +
      "<div>" +
        '<a class="logo" href="' + pageHref("index.html") + '"><img src="' + assetHref("assets/logo-mark.svg") + '" alt=""/>' +
        '<span class="word">Tool<b>Sprint</b></span></a>' +
        "<p>Free browser tools for PDF, images, text and everyday tasks. Everything runs on your device — " + SITE_NAME + " never receives your files.</p>" +
      "</div>" +
      "<div><strong>Popular tools</strong><nav style=\"margin-top:10px\" aria-label=\"Popular tools\">" + popLinks + "</nav></div>" +
      "<div><strong>Site</strong><nav style=\"margin-top:10px\" aria-label=\"Site\">" +
        '<a href="' + pageHref("all-tools.html") + '">All Tools</a>' +
        '<a href="' + pageHref("index.html") + '#guides">Guides</a>' +
        '<a href="' + pageHref("about.html") + '">About</a>' +
        '<a href="' + pageHref("privacy.html") + '">Privacy Policy</a>' +
        '<a href="' + pageHref("terms.html") + '">Terms</a>' +
        '<a href="' + pageHref("contact.html") + '">Contact</a>' +
      "</nav></div>" +
    "</div>" +
    '<div class="copy"><span>© 2026 ' + SITE_NAME + " — free tools, no sign-up, no watermark.</span>" +
    "<span>" + TOOLS.length + " tools · files never leave your device</span></div></div>";
}

/* ---------- Tool cards / search / related (all read TOOLS) ------- */
var CAT_ICONS = { Image: "▦", PDF: "▤", Text: "¶", Developer: "</>", Generator: "⚡", Calculator: "▦", Timer: "◷" };
function toolCard(t) {
  return '<div class="card-wrap">' +
    '<a class="card" href="' + toolHref(t.slug) + '">' +
    '<span class="ic" aria-hidden="true">' + (CAT_ICONS[t.category] || "•") + "</span>" +
    '<span><span class="card-t">' + t.name + '</span>' +
    '<span class="card-d">' + t.description + "</span>" +
    '<span class="meta"><span class="tag">' + t.category + "</span>" +
    (t.popular ? '<span class="tag pop">Popular</span>' : "") +
    "</span></span></a>" +
    '<button type="button" class="fav-btn" data-fav="' + t.slug + '" aria-pressed="false" aria-label="Save ' + t.name + ' to favourites" title="Save to favourites">☆</button>' +
    "</div>";
}
function toolMatches(t, q) {
  if (!q) return true;
  var hay = (t.name + " " + t.description + " " + t.category + " " + t.keywords).toLowerCase();
  return q.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
}
function renderCards(container, list) {
  if (!container) return;
  container.innerHTML = list.length
    ? list.map(toolCard).join("")
    : '<p class="empty-note">No tool matches that search. Try \u201CPDF\u201D, \u201Cimage\u201D or \u201Cconverter\u201D.</p>';
  refreshFavButtons();
}
/* Per-tool-page extras, run from renderRelated (every tool page calls
   it with its own slug): record the visit under Recently used, add a
   favourite toggle under the intro, and — for tools that have one —
   a banner linking to the tool's guide. */
function initToolPageExtras(slug) {
  trackRecent(slug);
  var prose = document.querySelector(".prose");
  if (prose && prose.parentNode && !document.querySelector(".fav-toggle")) {
    var fb = document.createElement("button");
    fb.type = "button";
    fb.className = "btn ghost fav-toggle";
    fb.setAttribute("data-fav", slug);
    fb.setAttribute("aria-pressed", "false");
    fb.textContent = "☆ Save to favourites";
    prose.parentNode.insertBefore(fb, prose.nextSibling);
  }
  var g = typeof guideFor === "function" ? guideFor(slug) : null;
  if (g) {
    var rel = document.getElementById("related");
    var anchor = rel && rel.previousElementSibling ? rel.previousElementSibling : rel;
    if (anchor && anchor.parentNode && !document.querySelector(".guide-banner")) {
      var banner = document.createElement("div");
      banner.className = "notice guide-banner";
      banner.innerHTML = "<strong>Guide:</strong> <a href=\"" + guideHref(g.guide) + "\">" + g.title + "</a> — " + g.blurb;
      anchor.parentNode.insertBefore(banner, anchor);
    }
  }
  refreshFavButtons();
}
/* Related tools for a tool page: same category first, then popular. */
function renderRelated(slug, container) {
  initToolPageExtras(slug);
  if (!container) return;
  var me = TOOLS.filter(function (t) { return t.slug === slug; })[0];
  var rel = TOOLS.filter(function (t) { return t.slug !== slug && me && t.category === me.category; });
  TOOLS.forEach(function (t) {
    if (rel.length < 4 && t.slug !== slug && rel.indexOf(t) === -1 && t.popular) rel.push(t);
  });
  TOOLS.forEach(function (t) {
    if (rel.length < 4 && t.slug !== slug && rel.indexOf(t) === -1) rel.push(t);
  });
  renderCards(container, rel.slice(0, 4));
}
/* Copy-button helper with "Copied!" feedback (used by text tools). */
function copyText(text, btn) {
  function done() {
    if (!btn) return;
    var old = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(function () { btn.textContent = old; }, 1600);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, function () { fallback(); });
  } else fallback();
  function fallback() {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { /* user can copy manually */ }
    document.body.removeChild(ta);
  }
}
/* Error / success message helpers — tools never fail silently. */
function showMsg(id, text, ok) {
  var m = document.getElementById(id);
  if (!m) return;
  m.textContent = text;
  m.className = "msg " + (ok ? "ok" : "err");
}
function clearMsg(id) {
  var m = document.getElementById(id);
  if (m) { m.textContent = ""; m.className = "msg"; }
}
