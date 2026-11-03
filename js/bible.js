// Bible reader powered by the YouVersion Platform API (https://developers.youversion.com).
(function () {
  const cfg = window.LC_CONFIG.youversion || {};
  const API = "https://api.youversion.com/v1";
  const $ = (id) => document.getElementById(id);
  const STORE = "lc-bible";

  $("year").textContent = new Date().getFullYear();

  if (!cfg.appKey) {
    showMessage("The Bible reader is almost ready – a leader still needs to add the YouVersion app key in js/config.js.");
    return;
  }

  // YouVersion's Bible fonts (authenticated by the app key in the URL).
  const font = document.createElement("link");
  font.rel = "stylesheet";
  font.href = `${API}/fonts/1/stylesheet?app_key=${encodeURIComponent(cfg.appKey)}`;
  document.head.appendChild(font);

  /* ---------- helpers ---------- */
  function showMessage(text) {
    const el = $("bible-setup");
    el.textContent = text;
    el.hidden = false;
  }

  async function yv(path) {
    const res = await fetch(API + path, {
      headers: { "X-YVP-App-Key": cfg.appKey, Accept: "application/json" }
    });
    if (!res.ok) throw new Error(`YouVersion API ${res.status}`);
    return res.json();
  }

  // Keep only safe markup from the API's HTML.
  function clean(html) {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    doc.querySelectorAll("script,style,iframe,object,embed,link,meta,form").forEach((n) => n.remove());
    doc.querySelectorAll("*").forEach((el) => {
      [...el.attributes].forEach((a) => {
        if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
      });
    });
    return doc.body.firstChild.innerHTML;
  }

  function attribution(bible) {
    return (bible.copyright || "").trim() || (bible.promotional_content || "").trim();
  }

  function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } }
  function save(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* ignore */ } }

  function dayOfYear(d = new Date()) {
    return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 864e5);
  }

  /* ---------- state ---------- */
  const saved = load();
  const hash = new URLSearchParams(location.hash.slice(1));
  let bibleId = Number(hash.get("v") || saved.v || cfg.defaultBibleId || 3034);
  let current = (hash.get("p") || saved.p || "JHN.1").toUpperCase();
  let bible = null;           // version metadata
  let books = [];             // [{ id, title, chapters: [passage_id] }]
  const bookCache = {};

  /* ---------- versions ---------- */
  async function loadVersions() {
    const lang = encodeURIComponent(cfg.language || "en");
    const q = `/bibles?language_ranges[]=${lang}&fields[]=id&fields[]=abbreviation&fields[]=localized_title&page_size=*`;
    let all = [];
    try { all = await listAll(q); } catch { /* fall back to default only */ }

    // Only offer the versions we chose (in that order) that are licensed for our key.
    const wanted = (cfg.versions || []).map((a) => a.toUpperCase());
    let list = wanted
      .map((abbr) => all.find((b) => abbrOf(b).includes(abbr)))
      .filter(Boolean);
    if (!list.length) {
      const fallback = all.find((b) => b.id === cfg.defaultBibleId);
      list = [fallback || { id: cfg.defaultBibleId, abbreviation: "BSB", localized_title: "Berean Standard Bible" }];
    }
    if (!list.some((b) => b.id === bibleId)) bibleId = list[0].id;

    $("sel-version").innerHTML = list
      .map((b) => `<option value="${b.id}">${escapeHtml(b.abbreviation || "")}${b.localized_title ? " – " + escapeHtml(b.localized_title) : ""}</option>`)
      .join("");
    $("sel-version").value = String(bibleId);
  }

  // All pages of a paginated list.
  async function listAll(q) {
    let out = [], token = "";
    for (let i = 0; i < 20; i++) {
      const res = await yv(q + (token ? `&page_token=${encodeURIComponent(token)}` : ""));
      out = out.concat(res.data || []);
      token = res.next_page_token;
      if (!token) break;
    }
    return out;
  }

  const abbrOf = (b) => [b.abbreviation, b.localized_abbreviation].filter(Boolean).map((a) => a.toUpperCase());

  // bible.html#check – shows which versions this app key can use (for leaders).
  async function runCheck() {
    const el = $("bible-setup");
    el.hidden = false;
    el.innerHTML = "<strong>Checking YouVersion…</strong>";
    const lang = encodeURIComponent(cfg.language || "en");
    try {
      const [mine, every] = await Promise.all([
        listAll(`/bibles?language_ranges[]=${lang}&fields[]=id&fields[]=abbreviation&fields[]=localized_title&page_size=*`),
        listAll(`/bibles?language_ranges[]=${lang}&all_available=true&fields[]=id&fields[]=abbreviation&fields[]=localized_title&page_size=*`)
      ]);
      const row = (abbr) => {
        const have = mine.find((b) => abbrOf(b).includes(abbr));
        const exists = every.find((b) => abbrOf(b).includes(abbr));
        const state = have ? "✅ Licensed – shows on the site"
          : exists ? "🔒 Available on YouVersion, but NOT licensed for your app yet"
          : "❌ Not offered through the YouVersion Platform API";
        return `<li><strong>${escapeHtml(abbr)}</strong> – ${state}${(have || exists) ? ` <span class="muted">(id ${(have || exists).id})</span>` : ""}</li>`;
      };
      el.innerHTML = `<strong>Your versions</strong><ul class="check-list">${(cfg.versions || []).map((a) => row(a.toUpperCase())).join("")}</ul>
        <p class="muted">Your key can currently use ${mine.length} English version(s): ${mine.map((b) => escapeHtml(b.abbreviation || b.id)).join(", ") || "none"}.</p>`;
    } catch (e) {
      el.textContent = "Couldn't reach YouVersion: " + e.message;
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------- books & chapters ---------- */
  async function loadBooks() {
    const [meta, booksRes] = await Promise.all([yv(`/bibles/${bibleId}`), yv(`/bibles/${bibleId}/books`)]);
    bible = meta;
    books = (booksRes.data || []).map((b) => ({
      id: b.id,
      title: b.title || b.id,
      chapters: (b.chapters || [])
        .map((c) => (typeof c === "string" ? c : c.passage_id || `${b.id}.${c.id}`))
        .filter((p) => /\.\d+$/.test(p))
    }));
    $("sel-book").innerHTML = books.map((b) => `<option value="${b.id}">${escapeHtml(b.title)}</option>`).join("");
  }

  async function chaptersOf(bookId) {
    const book = books.find((b) => b.id === bookId);
    if (!book) return [];
    if (book.chapters.length) return book.chapters;
    if (!bookCache[bookId]) {
      const res = await yv(`/bibles/${bibleId}/books/${bookId}/chapters`);
      bookCache[bookId] = (res.data || [])
        .map((c) => (typeof c === "string" ? c : c.passage_id || `${bookId}.${c.id}`))
        .filter((p) => /\.\d+$/.test(p));
    }
    return bookCache[bookId];
  }

  async function fillChapters(bookId, selected) {
    const chs = await chaptersOf(bookId);
    $("sel-chapter").innerHTML = chs.map((p) => `<option value="${p}">${p.split(".").pop()}</option>`).join("");
    if (selected && chs.includes(selected)) $("sel-chapter").value = selected;
    return chs;
  }

  /* ---------- reading ---------- */
  async function read(passageId) {
    const [bookId] = passageId.split(".");
    if (!books.some((b) => b.id === bookId)) passageId = (books[0]?.id || "JHN") + ".1";
    const book = passageId.split(".")[0];
    $("sel-book").value = book;
    const chs = await fillChapters(book, passageId);
    if (!chs.includes(passageId)) passageId = chs[0];
    $("sel-chapter").value = passageId;

    $("reader").hidden = false;
    $("reader-text").innerHTML = `<p class="muted">Loading…</p>`;
    try {
      const passage = await yv(`/bibles/${bibleId}/passages/${passageId}?format=html&include_headings=true&include_notes=false`);
      current = passageId;
      $("reader-ref").textContent = `${passage.reference || passageId} (${bible.abbreviation || ""})`;
      $("reader-text").innerHTML = clean(passage.content || "");
      $("reader-copy").textContent = attribution(bible) || `${bible.title || ""}`;
      const i = chs.indexOf(passageId);
      const bi = books.findIndex((b) => b.id === book);
      $("prev-ch").disabled = i <= 0 && bi <= 0;
      $("next-ch").disabled = i >= chs.length - 1 && bi >= books.length - 1;
      history.replaceState(null, "", `#v=${bibleId}&p=${passageId}`);
      save({ v: bibleId, p: passageId });
    } catch {
      $("reader-text").innerHTML = `<p class="muted">Couldn't load this chapter. Please try again.</p>`;
    }
  }

  async function step(dir) {
    const book = current.split(".")[0];
    const chs = await chaptersOf(book);
    const i = chs.indexOf(current) + dir;
    if (i >= 0 && i < chs.length) return go(chs[i]);
    const bi = books.findIndex((b) => b.id === book) + dir;
    if (bi < 0 || bi >= books.length) return;
    const next = await chaptersOf(books[bi].id);
    go(dir > 0 ? next[0] : next[next.length - 1]);
  }

  async function go(passageId) {
    await read(passageId);
    $("reader").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- verse of the day ---------- */
  async function loadVotd() {
    try {
      const v = await yv(`/verse-of-the-days/${dayOfYear()}`);
      const p = await yv(`/bibles/${bibleId}/passages/${v.passage_id}?format=text`);
      $("votd-text").textContent = (p.content || "").trim();
      $("votd-ref").textContent = `${p.reference || v.passage_id} (${bible.abbreviation || ""})`;
      $("votd").hidden = false;
      $("votd-open").onclick = () => go(v.passage_id.split(".").slice(0, 2).join("."));
    } catch { /* optional */ }
  }

  /* ---------- events ---------- */
  $("sel-version").addEventListener("change", async (e) => {
    bibleId = Number(e.target.value);
    await loadBooks();
    await read(current);
    loadVotd();
  });
  $("sel-book").addEventListener("change", async (e) => {
    const chs = await chaptersOf(e.target.value);
    if (chs.length) read(chs[0]);
  });
  $("sel-chapter").addEventListener("change", (e) => read(e.target.value));
  $("prev-ch").onclick = () => step(-1);
  $("next-ch").onclick = () => step(1);

  /* ---------- start ---------- */
  (async () => {
    if (location.hash.includes("check")) runCheck();
    try {
      await loadVersions();
      await loadBooks();
      $("reader-bar").hidden = false;
      await read(current);
      loadVotd();
    } catch {
      showMessage("Sorry, the Bible couldn't be loaded right now. Please try again later.");
    }
  })();
})();
