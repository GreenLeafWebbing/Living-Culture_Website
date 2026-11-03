// Public site: next gathering, notice board, calendar and request form.
(function () {
  const { db, esc, richText, fmt, sameDay, dayKey, gatheringOn, nextGathering } = window.LC;
  const $ = (id) => document.getElementById(id);

  $("year").textContent = new Date().getFullYear();

  /* ---------- Next gathering ---------- */
  function renderNext() {
    const g = nextGathering();
    if (!g) return;
    const now = new Date();
    $("next-day").textContent = sameDay(g.start, now) ? "Tonight" : fmt.day(g.start);
    $("next-time").textContent = fmt.time(g.start);
    $("next-place").textContent = g.location ? ` · ${g.location}` : "";

    let text;
    if (now >= g.start) text = "Happening right now – come join us!";
    else {
      const mins = Math.round((g.start - now) / 60000);
      const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
      text = "Starts in " + (d ? `${d} day${d > 1 ? "s" : ""} ` : "") + (d || h ? `${h} h ` : "") + (d ? "" : `${m} min`);
    }
    $("next-countdown").textContent = text.trim();
  }
  renderNext();
  setInterval(renderNext, 30000);

  /* ---------- Notice board ---------- */
  async function loadNotices() {
    const box = $("notice-list");
    if (!db) { box.innerHTML = `<p class="muted">Notices are unavailable right now.</p>`; return; }

    const { data, error } = await db
      .from("notices")
      .select("id,title,body,pinned,created_at")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) { box.innerHTML = `<p class="muted">Couldn't load notices. Please try again later.</p>`; return; }
    if (!data.length) { box.innerHTML = `<p class="muted">No notices at the moment – check back soon.</p>`; return; }

    box.innerHTML = data.map((n) => `
      <article class="notice ${n.pinned ? "pinned" : ""}">
        ${n.pinned ? `<span class="badge">Pinned</span>` : ""}
        <h3>${esc(n.title)}</h3>
        ${n.body ? `<p>${richText(n.body)}</p>` : ""}
        <time datetime="${esc(n.created_at)}">${fmt.short(new Date(n.created_at))}</time>
      </article>`).join("");
  }
  loadNotices();

  /* ---------- Calendar ---------- */
  const today = new Date();
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth();
  let selected = null;           // Date or null (null = show upcoming)
  let events = [];               // special events from the database

  async function loadEvents() {
    if (!db) return;
    const from = new Date(today.getFullYear(), today.getMonth() - 3, 1).toISOString();
    const { data, error } = await db
      .from("events")
      .select("id,title,description,location,starts_at,ends_at")
      .gte("starts_at", from)
      .order("starts_at")
      .limit(500);
    if (!error) {
      events = data.map((e) => ({
        ...e,
        start: new Date(e.starts_at),
        end: e.ends_at ? new Date(e.ends_at) : null
      }));
    }
  }

  function itemsOn(day) {
    const list = events.filter((e) => sameDay(e.start, day));
    const g = gatheringOn(day);
    if (g) list.push(g);
    return list.sort((a, b) => a.start - b.start);
  }

  function renderCalendar() {
    const first = new Date(viewYear, viewMonth, 1);
    $("cal-title").textContent = fmt.month(first);

    const offset = (first.getDay() + 6) % 7;            // Monday-first grid
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    let html = "";
    for (let i = 0; i < offset; i++) html += `<span class="cal-day empty"></span>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(viewYear, viewMonth, d);
      const items = itemsOn(day);
      const cls = ["cal-day"];
      if (sameDay(day, today)) cls.push("today");
      if (selected && sameDay(day, selected)) cls.push("selected");
      if (day < new Date(today.getFullYear(), today.getMonth(), today.getDate())) cls.push("past");
      const dots = items.map((it) => `<i class="dot ${it.weekly ? "dot-weekly" : "dot-event"}"></i>`).join("");
      const label = `${fmt.day(day)}${items.length ? `, ${items.length} item${items.length > 1 ? "s" : ""}` : ""}`;
      html += `<button type="button" class="${cls.join(" ")}" data-day="${dayKey(day)}" aria-label="${esc(label)}">
                 <span class="num">${d}</span><span class="dots">${dots}</span>
               </button>`;
    }
    $("cal-days").innerHTML = html;
  }

  function eventCard(it) {
    const time = fmt.time(it.start) + (it.end ? `–${fmt.time(it.end)}` : "");
    return `
      <article class="event ${it.weekly ? "weekly" : "special"}">
        <div class="event-date">
          <span class="m">${it.start.toLocaleDateString("en-GB", { month: "short" })}</span>
          <span class="d">${it.start.getDate()}</span>
        </div>
        <div class="event-body">
          <h4>${esc(it.title)}</h4>
          <p class="event-meta">${fmt.day(it.start)} · ${time}${it.location ? ` · ${esc(it.location)}` : ""}</p>
          ${it.description ? `<p>${richText(it.description)}</p>` : ""}
        </div>
      </article>`;
  }

  function renderSide() {
    const box = $("day-events");
    if (selected) {
      $("day-title").textContent = fmt.day(selected);
      const items = itemsOn(selected);
      box.innerHTML = items.length
        ? items.map(eventCard).join("")
        : `<p class="muted">Nothing planned on this day.</p>`;
      box.insertAdjacentHTML("beforeend", `<button type="button" class="link-btn" id="show-upcoming">← Show upcoming</button>`);
      $("show-upcoming").onclick = () => { selected = null; renderCalendar(); renderSide(); };
      return;
    }

    $("day-title").textContent = "Upcoming";
    const now = new Date();
    const upcoming = events.filter((e) => (e.end || e.start) >= now).slice(0, 4);
    const g = nextGathering(now);
    if (g) upcoming.push(g);
    upcoming.sort((a, b) => a.start - b.start);
    box.innerHTML = upcoming.map(eventCard).join("") || `<p class="muted">Nothing planned yet.</p>`;
  }

  $("cal-days").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-day]");
    if (!btn) return;
    const [y, m, d] = btn.dataset.day.split("-").map(Number);
    selected = new Date(y, m - 1, d);
    renderCalendar();
    renderSide();
  });
  $("cal-prev").onclick = () => { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } renderCalendar(); };
  $("cal-next").onclick = () => { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } renderCalendar(); };

  renderCalendar();
  renderSide();
  loadEvents().then(() => { renderCalendar(); renderSide(); });

  /* ---------- Request form ---------- */
  const form = $("request-form");
  const status = $("form-status");

  form.addEventListener("change", (e) => {
    if (e.target.name !== "kind") return;
    const prayer = e.target.value === "prayer";
    $("msg-label").textContent = prayer ? "Your prayer request" : "Your question about faith or life";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const message = String(fd.get("message") || "").trim();

    status.className = "form-status";
    if (fd.get("website")) return;                    // bot
    if (message.length < 3) {
      status.textContent = "Please write a little more before sending.";
      status.classList.add("error");
      return;
    }
    if (!db) {
      status.textContent = "Sorry, sending isn't available right now.";
      status.classList.add("error");
      return;
    }

    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Sending…";

    const { error } = await db.from("requests").insert({
      kind: fd.get("kind"),
      message,
      name: String(fd.get("name") || "").trim() || null,
      contact: String(fd.get("contact") || "").trim() || null
    });

    btn.disabled = false;
    btn.textContent = "Send";

    if (error) {
      status.textContent = error.message.includes("Too many")
        ? error.message
        : "Something went wrong. Please try again in a moment.";
      status.classList.add("error");
      return;
    }

    const kind = fd.get("kind");
    form.reset();
    $("msg-label").textContent = "Your prayer request";
    status.textContent = kind === "prayer"
      ? "Thank you – we'll be praying for you. 🙏"
      : "Thanks for asking – one of our leaders will get back to you if you left contact details.";
    status.classList.add("ok");
  });
})();
