// Admin page: login, requests inbox, notices and events.
(function () {
  const { db, esc, fmt, dayKey } = window.LC;
  const $ = (id) => document.getElementById(id);
  const show = (el, on) => { el.hidden = !on; };

  function setStatus(el, text, ok) {
    el.textContent = text;
    el.className = "form-status " + (text ? (ok ? "ok" : "error") : "");
  }

  if (!db) {
    document.querySelector(".admin-main").innerHTML =
      `<p class="card notice-box">Couldn't connect to the database. Check your internet connection and js/config.js.</p>`;
    return;
  }

  /* ---------- Auth ---------- */
  async function route() {
    const { data: { session } } = await db.auth.getSession();
    show($("logout"), !!session);
    if (!session) {
      show($("login-view"), true); show($("dash-view"), false); show($("not-admin"), false);
      return;
    }
    const { data: isAdmin } = await db.rpc("is_admin");
    show($("login-view"), false);
    show($("dash-view"), !!isAdmin);
    show($("not-admin"), !isAdmin);
    if (isAdmin) {
      $("who").textContent = `Logged in as ${session.user.email}`;
      loadRequests(); loadNotices(); loadEvents();
    }
  }

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    const { error } = await db.auth.signInWithPassword({ email: fd.get("email"), password: fd.get("password") });
    btn.disabled = false;
    if (error) return setStatus($("login-status"), "Login failed – check your email and password.", false);
    setStatus($("login-status"), "", true);
    e.target.reset();
    route();
  });

  $("logout").addEventListener("click", async (e) => {
    e.preventDefault();
    await db.auth.signOut();
    route();
  });

  /* ---------- Tabs ---------- */
  document.querySelector(".tabs").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (!tab) return;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".panel").forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
  });

  /* ---------- Requests ---------- */
  async function loadRequests() {
    const filter = $("req-filter").value;
    let q = db.from("requests").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    const box = $("req-list");
    if (error) { box.innerHTML = `<p class="muted">Couldn't load requests.</p>`; return; }

    const { count } = await db.from("requests").select("id", { count: "exact", head: true }).eq("status", "new");
    $("new-count").textContent = count || "";
    show($("new-count"), !!count);

    box.innerHTML = data.length ? data.map((r) => `
      <article class="item ${r.status === "done" ? "done" : ""}">
        <div class="item-head">
          <div>
            <h3><span class="tag ${r.kind}">${r.kind === "prayer" ? "Prayer" : "Question"}</span>${esc(r.name || "Anonymous")}</h3>
            <p class="meta">${fmt.dateTime(new Date(r.created_at))}${r.contact ? ` · Contact: ${esc(r.contact)}` : " · No contact details"}</p>
          </div>
          <div class="actions">
            <button class="btn small secondary" data-act="toggle" data-id="${r.id}" data-status="${r.status}">
              ${r.status === "done" ? "Mark as new" : (r.kind === "prayer" ? "Prayed ✓" : "Answered ✓")}
            </button>
            <button class="btn small danger" data-act="delete" data-id="${r.id}">Delete</button>
          </div>
        </div>
        <p class="msg">${esc(r.message)}</p>
      </article>`).join("")
      : `<p class="muted">Nothing here. 🙌</p>`;
  }

  $("req-filter").onchange = loadRequests;
  $("req-refresh").onclick = loadRequests;
  $("req-list").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    if (b.dataset.act === "toggle") {
      await db.from("requests").update({ status: b.dataset.status === "done" ? "new" : "done" }).eq("id", b.dataset.id);
    } else if (confirm("Delete this request permanently?")) {
      await db.from("requests").delete().eq("id", b.dataset.id);
    }
    loadRequests();
  });

  /* ---------- Notices ---------- */
  let notices = [];
  let editingNotice = null;
  const nForm = $("notice-form");

  async function loadNotices() {
    const { data, error } = await db.from("notices").select("*")
      .order("pinned", { ascending: false }).order("created_at", { ascending: false });
    const box = $("notice-admin-list");
    if (error) { box.innerHTML = `<p class="muted">Couldn't load notices.</p>`; return; }
    notices = data;
    const today = dayKey(new Date());
    box.innerHTML = data.length ? data.map((n) => `
      <article class="item">
        <div class="item-head">
          <div>
            <h3>${n.pinned ? `<span class="tag pin">Pinned</span>` : ""}${n.expires_on && n.expires_on < today ? `<span class="tag expired">Hidden</span>` : ""}${esc(n.title)}</h3>
            <p class="meta">Posted ${fmt.short(new Date(n.created_at))}${n.expires_on ? ` · hides after ${fmt.short(new Date(n.expires_on + "T00:00"))}` : ""}</p>
          </div>
          <div class="actions">
            <button class="btn small secondary" data-act="edit" data-id="${n.id}">Edit</button>
            <button class="btn small danger" data-act="delete" data-id="${n.id}">Delete</button>
          </div>
        </div>
        ${n.body ? `<p class="msg">${esc(n.body)}</p>` : ""}
      </article>`).join("")
      : `<p class="muted">No notices yet.</p>`;
  }

  function resetNoticeForm() {
    editingNotice = null;
    nForm.reset();
    $("notice-form-title").textContent = "New notice";
    show($("notice-cancel"), false);
  }

  nForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(nForm);
    const row = {
      title: String(fd.get("title")).trim(),
      body: String(fd.get("body") || "").trim(),
      pinned: fd.get("pinned") === "on",
      expires_on: fd.get("expires_on") || null
    };
    if (!row.title) return setStatus($("notice-status"), "Please add a title.", false);
    const { error } = editingNotice
      ? await db.from("notices").update(row).eq("id", editingNotice)
      : await db.from("notices").insert(row);
    if (error) return setStatus($("notice-status"), "Couldn't save: " + error.message, false);
    setStatus($("notice-status"), "Saved ✓", true);
    resetNoticeForm();
    loadNotices();
  });
  $("notice-cancel").onclick = resetNoticeForm;

  $("notice-admin-list").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const n = notices.find((x) => x.id === b.dataset.id);
    if (b.dataset.act === "edit" && n) {
      editingNotice = n.id;
      nForm.elements.title.value = n.title;
      nForm.elements.body.value = n.body;
      nForm.elements.pinned.checked = n.pinned;
      nForm.elements.expires_on.value = n.expires_on || "";
      $("notice-form-title").textContent = "Edit notice";
      show($("notice-cancel"), true);
      setStatus($("notice-status"), "", true);
      nForm.scrollIntoView({ behavior: "smooth" });
    } else if (b.dataset.act === "delete" && confirm("Delete this notice?")) {
      await db.from("notices").delete().eq("id", b.dataset.id);
      loadNotices();
    }
  });

  /* ---------- Events ---------- */
  let events = [];
  let editingEvent = null;
  const eForm = $("event-form");
  const hhmm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  async function loadEvents() {
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const { data, error } = await db.from("events").select("*")
      .gte("starts_at", since.toISOString()).order("starts_at");
    const box = $("event-admin-list");
    if (error) { box.innerHTML = `<p class="muted">Couldn't load events.</p>`; return; }
    events = data;
    box.innerHTML = data.length ? data.map((ev) => {
      const s = new Date(ev.starts_at), en = ev.ends_at ? new Date(ev.ends_at) : null;
      return `
      <article class="item">
        <div class="item-head">
          <div>
            <h3>${esc(ev.title)}</h3>
            <p class="meta">${fmt.day(s)} ${s.getFullYear()} · ${fmt.time(s)}${en ? "–" + fmt.time(en) : ""}${ev.location ? " · " + esc(ev.location) : ""}</p>
          </div>
          <div class="actions">
            <button class="btn small secondary" data-act="edit" data-id="${ev.id}">Edit</button>
            <button class="btn small danger" data-act="delete" data-id="${ev.id}">Delete</button>
          </div>
        </div>
        ${ev.description ? `<p class="msg">${esc(ev.description)}</p>` : ""}
      </article>`;
    }).join("") : `<p class="muted">No upcoming special events.</p>`;
  }

  function resetEventForm() {
    editingEvent = null;
    eForm.reset();
    $("event-form-title").textContent = "New event";
    show($("event-cancel"), false);
  }

  eForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(eForm);
    const date = fd.get("date"), start = fd.get("start"), end = fd.get("end");
    if (!fd.get("title").trim() || !date || !start)
      return setStatus($("event-status"), "Please fill in title, date and start time.", false);
    const startsAt = new Date(`${date}T${start}`);
    const endsAt = end ? new Date(`${date}T${end}`) : null;
    if (endsAt && endsAt < startsAt) return setStatus($("event-status"), "End time is before start time.", false);

    const row = {
      title: fd.get("title").trim(),
      location: String(fd.get("location") || "").trim(),
      description: String(fd.get("description") || "").trim(),
      starts_at: startsAt.toISOString(),
      ends_at: endsAt ? endsAt.toISOString() : null
    };
    const { error } = editingEvent
      ? await db.from("events").update(row).eq("id", editingEvent)
      : await db.from("events").insert(row);
    if (error) return setStatus($("event-status"), "Couldn't save: " + error.message, false);
    setStatus($("event-status"), "Saved ✓", true);
    resetEventForm();
    loadEvents();
  });
  $("event-cancel").onclick = resetEventForm;

  $("event-admin-list").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const ev = events.find((x) => x.id === b.dataset.id);
    if (b.dataset.act === "edit" && ev) {
      const s = new Date(ev.starts_at);
      editingEvent = ev.id;
      eForm.elements.title.value = ev.title;
      eForm.elements.date.value = dayKey(s);
      eForm.elements.start.value = hhmm(s);
      eForm.elements.end.value = ev.ends_at ? hhmm(new Date(ev.ends_at)) : "";
      eForm.elements.location.value = ev.location;
      eForm.elements.description.value = ev.description;
      $("event-form-title").textContent = "Edit event";
      show($("event-cancel"), true);
      setStatus($("event-status"), "", true);
      eForm.scrollIntoView({ behavior: "smooth" });
    } else if (b.dataset.act === "delete" && confirm("Delete this event?")) {
      await db.from("events").delete().eq("id", b.dataset.id);
      loadEvents();
    }
  });

  route();
})();
