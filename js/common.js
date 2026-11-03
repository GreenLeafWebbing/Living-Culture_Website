// Shared helpers for the public site and the admin page.
(function () {
  const cfg = window.LC_CONFIG;

  const db =
    window.supabase && cfg.supabaseUrl && cfg.supabaseKey
      ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey)
      : null;

  const LOCALE = "en-GB";

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  // Escape, then turn line breaks into <br> and bare URLs into links.
  function richText(s) {
    return esc(s)
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, "<br>");
  }

  const fmt = {
    day: (d) => d.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" }),
    short: (d) => d.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" }),
    time: (d) => d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" }),
    month: (d) => d.toLocaleDateString(LOCALE, { month: "long", year: "numeric" }),
    dateTime: (d) => d.toLocaleString(LOCALE, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  };

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function dayKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // Breaks / cancelled Thursdays: [{ starts_on: "YYYY-MM-DD", ends_on: "YYYY-MM-DD", reason }]
  let breaks = [];
  function setBreaks(list) { breaks = list || []; }
  function breakOn(day) {
    const k = dayKey(day);
    return breaks.find((b) => b.starts_on <= k && k <= b.ends_on) || null;
  }

  // Weekly gathering on a given calendar day (or null). Cancelled ones carry `cancelled`.
  function gatheringOn(day) {
    const g = cfg.gathering;
    if (day.getDay() !== g.weekday) return null;
    const [h, m] = g.time.split(":").map(Number);
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
    const br = breakOn(day);
    return {
      weekly: true,
      cancelled: !!br,
      cancelReason: br ? br.reason : "",
      title: g.title,
      location: g.place,
      description: br
        ? (br.reason ? `Cancelled – ${br.reason}` : "Cancelled – no gathering this week.")
        : "Our weekly gathering – everyone welcome!",
      start,
      end: new Date(start.getTime() + g.durationMinutes * 60000)
    };
  }

  // Next weekly gathering that hasn't finished yet and isn't cancelled.
  function nextGathering(now = new Date()) {
    for (let i = 0; i < 400; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const g = gatheringOn(d);
      if (g && !g.cancelled && g.end > now) return g;
    }
    return null;
  }

  // The break covering the coming week's gathering (if it is cancelled), else null.
  function upcomingBreak(now = new Date()) {
    for (let i = 0; i < 8; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const g = gatheringOn(d);
      if (g && g.end > now) return g.cancelled ? breakOn(d) : null;
    }
    return null;
  }

  async function loadBreaks() {
    if (!db) return;
    const { data, error } = await db.from("breaks").select("id,starts_on,ends_on,reason").order("starts_on");
    if (!error) setBreaks(data);
    return data || [];
  }

  window.LC = { cfg, db, esc, richText, fmt, sameDay, dayKey, gatheringOn, nextGathering, upcomingBreak, loadBreaks, setBreaks };
})();
