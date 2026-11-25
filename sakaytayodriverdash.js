document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const user = JSON.parse(localStorage.getItem("sakaytayo_user") || "{}");

  // Only registered drivers get here (see the gate in the HTML head), so show just their own rides.
  const me = user.fullName;

  let tt;
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 3000); }

  const mine = () => RIDES.filter((r) => r.driver === me && r.off >= 0).sort((a, b) => a.off - b.off);
  const route = (r) => `${r.from} → ${r.to}`;
  const when = (r) => `${nice(dateOf(r.off))} · ${clock(r.time)}`;
  const dots = (r) => `<div class="seat-row">${Array.from({ length: r.seats }, (_, i) => `<span class="dot ${i < taken(r) ? "taken" : ""}"></span>`).join("")}<span>${Math.max(openSeats(r), 0)} of ${r.seats} seats open${r.closed ? " · closed" : ""}</span></div>`;

  function renderStats(rides, pending) {
    const open = rides.reduce((n, r) => n + (r.closed ? 0 : Math.max(openSeats(r), 0)), 0);
    $("stats").innerHTML = [[pending.length, "Waiting for approval"], [open, "Open seats"], [rides.length, "Upcoming rides"]]
      .map(([n, l]) => `<div class="stat"><strong>${n}</strong><span>${l}</span></div>`).join("");
    $("req-count").textContent = pending.length;
  }

  // Approve / decline reservation requests
  function renderRequests(rides) {
    const ids = rides.map((r) => r.id);
    const pending = resv.filter((x) => x.status === "Pending" && ids.includes(x.rideId));
    $("request-list").innerHTML = pending.length ? pending.map((x) => {
      const r = rideById(x.rideId), full = openSeats(r) <= 0 || r.closed;
      return `<article class="ride-card"><div><p class="who">${x.name || (x.passenger === "You" ? "A passenger" : x.passenger)}</p>
        <p class="ride-route">${route(r)}</p><p class="ride-meta">${when(r)}</p>${dots(r)}</div>
        <div class="ride-actions"><div class="btn-row">
          <button class="pill-btn small primary-btn" data-approve="${x.id}" ${full ? "disabled" : ""}>${r.closed ? "Ride closed" : full ? "No seats left" : "Approve"}</button>
          <button class="pill-btn small danger-btn" data-decline="${x.id}">Decline</button></div></div></article>`;
    }).join("") : `<p class="empty glass-card">No requests right now. New seat requests from students will show up here.</p>`;
    return pending;
  }

  // Seat management per ride
  function renderManage(rides) {
    $("manage-list").innerHTML = rides.length ? rides.map((r) => {
      const chips = [...r.booked.map((n, i) => ({ n, k: `b:${r.id}:${i}` })), ...approvedFor(r).map((x) => ({ n: x.name || (x.passenger === "You" ? "Passenger" : x.passenger), k: `a:${x.id}` }))];
      return `<article class="ride-card"><div><p class="ride-route">${route(r)}</p><p class="ride-meta">${when(r)} · ${r.car} (${r.plate})</p></div>
        <span class="badge ${r.closed ? "red" : ""}">${r.closed ? "Closed" : "Accepting requests"}</span>
        <div class="bar"><span style="width:${Math.min(taken(r) / r.seats, 1) * 100}%"></span></div>
        ${dots(r)}
        <div class="manage-tools">
          <div class="stepper" aria-label="Seat capacity"><button data-cap="-1:${r.id}" ${r.seats <= Math.max(taken(r), 1) ? "disabled" : ""} aria-label="Remove a seat">−</button><span>${r.seats} seats</span><button data-cap="1:${r.id}" ${r.seats >= 8 ? "disabled" : ""} aria-label="Add a seat">+</button></div>
          <button class="pill-btn small ${r.closed ? "primary-btn" : "secondary-btn"}" data-toggle="${r.id}">${r.closed ? "Reopen ride" : "Close ride"}</button>
        </div>
        <div class="pax">${chips.length ? chips.map((c) => `<span class="pax-chip">${c.n}<button data-remove="${c.k}" aria-label="Remove ${c.n}">×</button></span>`).join("") : `<span class="ride-meta">No passengers yet</span>`}</div></article>`;
    }).join("") : `<p class="empty glass-card">You have no upcoming rides.</p>`;
  }

  function render() {
    $("driver-name").textContent = me.split(" ")[0];
    const rides = mine(); const pending = renderRequests(rides);
    renderManage(rides); renderStats(rides, pending);
  }

  $("request-list").addEventListener("click", (e) => {
    const a = e.target.dataset.approve, d = e.target.dataset.decline;
    const x = resv.find((v) => v.id === (a || d)); if (!x) return;
    if (a) {
      const r = rideById(x.rideId);
      if (r.closed || openSeats(r) <= 0) return toast("No seats left. Add a seat in Manage Seats first.");
      x.status = "Approved"; toast("Approved. Seat count updated.");
    } else { x.status = "Declined"; toast("Request declined."); }
    save(); render();
  });

  $("manage-list").addEventListener("click", (e) => {
    const t = e.target.dataset;
    if (t.cap) { const [d, id] = t.cap.split(":"); const r = rideById(id); r.seats = Math.min(8, Math.max(taken(r), r.seats + Number(d))); saveRides(); }
    else if (t.toggle) { const r = rideById(t.toggle); r.closed = !r.closed; saveRides(); toast(r.closed ? "Ride closed to new requests." : "Ride reopened."); }
    else if (t.remove) {
      if (!confirm("Remove this passenger? Their seat will open up.")) return;
      const [kind, a, b] = t.remove.split(":");
      if (kind === "b") rideById(a).booked.splice(Number(b), 1); else resv.find((v) => v.id === a).status = "Cancelled";
      saveRides(); save(); toast("Passenger removed. Seat released.");
    } else return;
    render();
  });

  document.querySelectorAll(".tab-btn").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((n) => n.classList.toggle("active", n === b));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + b.dataset.tab));
  }));

  // ---------- Post a ride ----------
  const PLACES = ["San Jose Town Proper / Poblacion", "San Jose Public Market", "San Jose Municipal Hall", "Lipa City Proper / SM City Lipa",
    "Robinsons Place Lipa", "Batangas State University - Alangilan Campus", "Batangas State University - Pablo Borbon Campus",
    "SM City Batangas", "Batangas Grand Terminal", "Ibaan Town Proper", "Rosario Town Proper", "Tanauan City Proper / Waltermart"];
  $("post-places").innerHTML = PLACES.map((p) => `<option value="${p}">`).join("");
  $("postSeats").innerHTML += Array.from({ length: 8 }, (_, i) => `<option value="${i + 1}">${i + 1} seat${i ? "s" : ""}</option>`).join("");

  const car = user.vehicleModel || user.carType || "My car", plate = user.plateNumber || "";
  $("post-vehicle").textContent = plate ? `${car} (${plate})` : car;
  const todayIso = iso(new Date());
  $("postDate").min = todayIso;
  $("postDate").max = iso(dateOf(60));
  // Start from the route and seat count saved during verification.
  $("postFrom").value = user.startLocation || "";
  $("postTo").value = user.destinationLocation || "";
  $("postTime").value = (user.schedule && user.schedule.startTime) || "";
  if (user.availableSeats) $("postSeats").value = String(Math.min(8, user.availableSeats));

  const postErr = (m) => { $("post-error").textContent = m; $("post-error").hidden = !m; };

  $("post-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const from = $("postFrom").value.trim(), to = $("postTo").value.trim(), date = $("postDate").value, time = $("postTime").value, seats = Number($("postSeats").value);
    const missing = [!from && "departure location", !to && "destination", !date && "date", !time && "time", !seats && "available seats"].filter(Boolean);
    if (missing.length) return postErr(`Please fill in the required fields: ${missing.join(", ")}.`);
    if (from.toLowerCase() === to.toLowerCase()) return postErr("Departure location and destination should be different.");
    if (date < todayIso) return postErr("Please pick today or a future date.");
    const [h, m] = time.split(":").map(Number);
    const dep = new Date(); const off = offFromDate(date); dep.setDate(dep.getDate() + off); dep.setHours(h, m, 0, 0);
    if (dep <= new Date()) return postErr("That departure time has already passed. Choose a later time.");
    if (RIDES.some((r) => r.driver === me && r.date === date && r.time === time && !r.cancelled)) return postErr("You already posted a ride at that date and time.");
    postErr("");
    RIDES.push({ id: "p" + Date.now(), driver: me, car, plate, from, to, date, off, time, seats, booked: [], closed: false });
    saveRides();
    toast("Ride posted! Passengers can now request a seat.");
    render();
    document.querySelector('.tab-btn[data-tab="manage"]').click();
  });

  $("logout").addEventListener("click", signOut);
  render();

  // Open the tab named in the link, e.g. sakaytayodriverdash.html#manage
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${location.hash.slice(1)}"]`);
  if (tabBtn) tabBtn.click();
});
