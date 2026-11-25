document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const user = JSON.parse(localStorage.getItem("sakaytayo_user") || "{}");
  const ME = ME_ID;

  const PLACES = ["San Jose Town Proper / Poblacion", "San Jose Public Market", "Lipa City Proper / SM City Lipa",
    "Robinsons Place Lipa", "Batangas State University - Alangilan Campus", "Batangas State University - Pablo Borbon Campus",
    "SM City Batangas", "Batangas Grand Terminal", "Ibaan Town Proper", "Rosario Town Proper", "Tanauan City Proper / Waltermart"];
  $("places").innerHTML = PLACES.map((p) => `<option value="${p}">`).join("");

  let toastT;
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 3000);
  }

  // Feature 1: carpool matching score (route 85 + time 15)
  const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const loose = (a, b) => { const x = a.trim().toLowerCase(), y = b.trim().toLowerCase(); return x && (y.includes(x) || x.includes(y) || x.split(/[\s,/-]+/)[0] === y.split(/[\s,/-]+/)[0]); };
  function score(r, q) {
    let s = 0;
    if (!q.from || same(q.from, r.from)) s += 45; else if (loose(q.from, r.from)) s += 25;
    if (!q.to || same(q.to, r.to)) s += 40; else if (loose(q.to, r.to)) s += 20;
    if (!q.time) s += 15; else { const d = Math.abs(mins(q.time) - mins(r.time)); s += d <= 30 ? 15 : d <= 60 ? 8 : 0; }
    return s;
  }

  function seatDots(r) {
    const t = taken(r);
    return `<div class="seat-row">${Array.from({ length: r.seats }, (_, i) => `<span class="dot ${i < t ? "taken" : ""}"></span>`).join("")}<span>${seatsLeft(r)} of ${r.seats} seats open</span></div>`;
  }

  function renderMatches() {
    const q = { from: $("fromInput").value, to: $("toInput").value, date: $("dateInput").value, time: $("timeInput").value };
    const list = RIDES.filter((r) => r.off >= 0 && r.id !== "reg-" + ME && (!q.date || iso(dateOf(r.off)) === q.date))
      .map((r) => ({ r, s: score(r, q) })).filter((x) => x.s >= 40).sort((a, b) => b.s - a.s);
    $("match-list").innerHTML = list.length ? list.map(({ r, s }) => {
      const mine = mineFor(r.id), left = seatsLeft(r);
      return `<article class="ride-card">
        <div><p class="ride-route">${r.from} → ${r.to}</p>
        <p class="ride-meta">${nice(dateOf(r.off))} · ${clock(r.time)} · ${r.driver} · ${r.car} (${r.plate})</p>${seatDots(r)}</div>
        <div class="ride-actions"><span class="badge">${s}% match</span>
        <button class="pill-btn small primary-btn" data-reserve="${r.id}" ${mine || !left ? "disabled" : ""}>${mine ? (mine.status === "Pending" ? "Request sent" : "Reserved") : r.closed ? "Closed by driver" : left ? "Request a seat" : "Ride is full"}</button></div></article>`;
    }).join("") : `<p class="empty glass-card">No rides match yet. Try another date or a nearby pick-up point.</p>`;
  }

  // Feature 2: reserve
  $("match-list").addEventListener("click", (e) => {
    const id = e.target.dataset.reserve; if (!id) return;
    const r = rideById(id);
    if (!seatsLeft(r)) return toast("Sorry, that ride just filled up.");
    resv.push({ id: "s" + Date.now(), rideId: id, passenger: ME, name: user.fullName || "Passenger", status: "Pending" }); save();
    toast(`Request sent to ${r.driver}. You will see it under My Rides.`); refresh();
  });

  function renderSeats() {
    $("seat-list").innerHTML = RIDES.filter((r) => r.off >= 0).map((r) => {
      const t = taken(r), names = [...r.booked, ...approvedFor(r).map((x) => (x.passenger === ME_ID ? "You" : x.name || x.passenger))];
      return `<article class="ride-card"><div><p class="ride-route">${r.from} → ${r.to}</p>
        <p class="ride-meta">${nice(dateOf(r.off))} · ${clock(r.time)} · ${r.driver}</p></div>
        <span class="badge ${seatsLeft(r) ? "" : "red"}">${seatsLeft(r) ? seatsLeft(r) + " open" : "Full"}</span>
        <div class="bar"><span style="width:${(t / r.seats) * 100}%"></span></div>
        <p class="riders">${names.length ? "Passengers: " + names.join(", ") : "No passengers yet"}</p></article>`;
    }).join("");
  }

  // Feature 4: ride history
  let seg = "upcoming";
  function renderHistory() {
    const rows = resv.filter((x) => x.passenger === ME_ID).map((x) => ({ x, r: rideById(x.rideId) })).filter((o) => o.r);
    const up = (o) => (o.x.status === "Pending" || o.x.status === "Approved") && o.r.off >= 0;
    const list = rows.filter((o) => (seg === "upcoming" ? up(o) : !up(o))).sort((a, b) => seg === "upcoming" ? a.r.off - b.r.off : b.r.off - a.r.off);
    $("history-list").innerHTML = list.length ? list.map(({ x, r }) => {
      const label = x.status === "Pending" ? ["Waiting for driver", "gray"] : x.status === "Declined" ? ["Declined", "red"] : x.status === "Cancelled" ? ["Cancelled", "red"] : up({ x, r }) ? ["Approved", ""] : ["Completed", "gray"];
      return `<article class="ride-card"><div><p class="ride-route">${r.from} → ${r.to}</p>
        <p class="ride-meta">${nice(dateOf(r.off))} · ${clock(r.time)} · ${r.driver} · ${r.car} (${r.plate})</p></div>
        <div class="ride-actions"><span class="badge ${label[1]}">${label[0]}</span>
        ${up({ x, r }) ? `<button class="pill-btn small danger-btn" data-cancel="${x.id}">Cancel</button>` : ""}</div></article>`;
    }).join("") : `<p class="empty">${seg === "upcoming" ? "No upcoming rides. Find a ride to reserve your first seat." : "No past rides yet."}</p>`;
  }

  $("history-list").addEventListener("click", (e) => {
    const id = e.target.dataset.cancel; if (!id) return;
    if (!confirm("Cancel this request? Any seat you hold will open up for other students.")) return;
    resv.find((x) => x.id === id).status = "Cancelled"; save();
    toast("Cancelled. Seat released."); refresh();
  });

  document.querySelectorAll(".seg-btn").forEach((b) => b.addEventListener("click", () => {
    seg = b.dataset.seg;
    document.querySelectorAll(".seg-btn").forEach((s) => s.classList.toggle("active", s === b));
    renderHistory();
  }));

  document.querySelectorAll(".tab-btn").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((t) => t.classList.toggle("active", t === b));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + b.dataset.tab));
    refresh();
  }));

  $("search-form").addEventListener("submit", (e) => { e.preventDefault(); renderMatches(); });

  function refresh() { renderMatches(); renderSeats(); renderHistory(); }

  // Pre-fill from the passenger account
  $("fromInput").value = user.pickupPoint || "";
  $("toInput").value = user.destinationPoint || "";
  $("timeInput").value = (user.schedule && user.schedule.preferredTime) || "";
  $("logout").addEventListener("click", signOut);
  refresh();

  // Open the tab named in the link, e.g. sakaytayorides.html#history
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${location.hash.slice(1)}"]`);
  if (tabBtn) tabBtn.click();
});
