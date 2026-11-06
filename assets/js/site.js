/* ToolSprint — shared site script (Batch 1).
   SITE_NAME is defined ONCE here and used for the header, footer,
   titles and copy across every page. Also owns: header/footer
   injection, live search helpers, tool-card rendering and the
   "Related tools" row used by tool pages. Design is strict
   black-and-white; there is no dark mode.
   Plain vanilla JS, no router, no build step. */
var SITE_NAME = "ToolSprint";

/* Pages live in two places: the site root (index.html) and assets/
   (all-tools, about, privacy, terms, contact). Tool pages will sit in
   assets/tools/ from Batch 2. BASE works out the relative prefix from
   this script's own URL so every link stays a normal relative link. */
var BASE = (function () {
  var s = document.currentScript;
  var src = s ? s.getAttribute("src") : "";
  if (src.indexOf("assets/js/site.js") === 0) return "";          /* root page */
  if (src.indexOf("js/site.js") === 0) return "../";              /* assets/ page */
  if (src.indexOf("../js/site.js") === 0) return "../../";        /* assets/tools/ page */
  return "";
})();

var NAV_PAGES = [
  { label: "Home",     href: "index.html" },
  { label: "All Tools", href: "all-tools.html" },
  { label: "About",    href: "about.html" },
  { label: "Contact",  href: "contact.html" }
];

function pageHref(href) {
  /* href is written root-relative ("about.html"); adjust for
     pages that live inside assets/ or assets/tools/.
     The Home link deliberately uses the DIRECTORY form ("./", "../",
     "../../") rather than the "index.html" filename: the artifact
     preview client blocks top-level navigations that name the entry
     document file (ERR_BLOCKED_BY_CLIENT), while the directory URL —
     the same URL the preview itself loads — navigates normally. On a
     normal static host both forms serve the same homepage. */
  if (href === "index.html") {
    if (BASE === "../") return "../";
    if (BASE === "../../") return "../../";
    return "./";
  }
  if (BASE === "../") {
    return href.replace(/^assets\//, "");
  }
  if (BASE === "../../") {
    return "../" + href.replace(/^assets\//, "");
  }
  return href;
}
function assetHref(path) { return BASE + path; }
function toolHref(slug) {
  if (BASE === "../../") return slug + ".html";
  if (BASE === "../") return "tools/" + slug + ".html";
  return slug + ".html";
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
var CAT_ICONS = { Image: "▦", PDF: "▤", Text: "¶", Developer: "{ }", Generator: "⚡", Calculator: "▦", Timer: "◷" };
function toolCard(t) {
  return '<a class="card" href="' + toolHref(t.slug) + '">' +
    '<span class="ic" aria-hidden="true">' + (CAT_ICONS[t.category] || "•") + "</span>" +
    '<span><span class="card-t">' + t.name + '</span>' +
    '<span class="card-d">' + t.description + "</span>" +
    '<span class="meta"><span class="tag">' + t.category + "</span>" +
    (t.popular ? '<span class="tag pop">Popular</span>' : "") +
    "</span></span></a>";
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
}
/* Related tools for a tool page: same category first, then popular. */
function renderRelated(slug, container) {
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
