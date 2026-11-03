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

  // Breaks & cancellations: [{ kind: "break" | "cancelled", starts_on, ends_on, reason }]
  //  - "break":     the weekly gatherings in that range are removed from the calendar
  //  - "cancelled": the gathering stays on the calendar, marked as cancelled
  let breaks = [];
  function setBreaks(list) { breaks = list || []; }
  function breakOn(day) {
    const k = dayKey(day);
    const hits = breaks.filter((b) => b.starts_on <= k && k <= b.ends_on);
    return hits.find((b) => b.kind === "break") || hits[0] || null;
  }

  // The weekly gathering on a day, ignoring breaks (or null if it isn't a gathering day).
  function scheduledOn(day) {
    const g = cfg.gathering;
    if (day.getDay() !== g.weekday) return null;
    const [h, m] = g.time.split(":").map(Number);
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
    return { start, end: new Date(start.getTime() + g.durationMinutes * 60000) };
  }

  // The weekly gathering as shown on the calendar: null on break days, flagged when cancelled.
  function gatheringOn(day) {
    const s = scheduledOn(day);
    if (!s) return null;
    const br = breakOn(day);
    if (br && br.kind === "break") return null;
    const g = cfg.gathering;
    return {
      ...s,
      weekly: true,
      cancelled: !!br,
      title: g.title,
      location: g.place,
      description: br
        ? (br.reason ? `Cancelled – ${br.reason}` : "Cancelled – no gathering this week.")
        : "Our weekly gathering – everyone welcome!"
    };
  }

  // Next weekly gathering that hasn't finished yet and is actually happening.
  function nextGathering(now = new Date()) {
    for (let i = 0; i < 400; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const g = gatheringOn(d);
      if (g && !g.cancelled && g.end > now) return g;
    }
    return null;
  }

  // If this week's gathering is off (break or cancelled), the entry responsible; else null.
  function upcomingBreak(now = new Date()) {
    for (let i = 0; i < 8; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const s = scheduledOn(d);
      if (s && s.end > now) return breakOn(d);
    }
    return null;
  }

  async function loadBreaks() {
    if (!db) return;
    const { data, error } = await db.from("breaks").select("id,kind,starts_on,ends_on,reason").order("starts_on");
    if (!error) setBreaks(data);
    return data || [];
  }

  window.LC = { cfg, db, esc, richText, fmt, sameDay, dayKey, scheduledOn, gatheringOn, nextGathering, upcomingBreak, loadBreaks, setBreaks };
})();
