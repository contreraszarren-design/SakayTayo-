document.addEventListener("DOMContentLoaded", () => {
  const FROM = "San Jose Town Proper / Poblacion";
  const TO = "Batangas State University - Alangilan Campus";
  const now = new Date().toISOString();

  // Both accounts use values that pass the sign-up validation rules.
  const DRIVER = {
    role: "driver", fullName: "Diego Ramirez", email: "diego.driver@gmail.com", contactNumber: "09171234567", password: "TestDriver123",
    carType: "Sedan", availableSeats: 3, licenseNumber: "N01-23-456789", startLocation: FROM, destinationLocation: TO, route: `${FROM} → ${TO}`,
    schedule: { days: "Mon - Fri", startTime: "06:30", endTime: "07:30" }, vehicleModel: "Toyota Vios", plateNumber: "TDR 123",
    licenseExpiry: "2029-12-31", emergencyContact: { name: "Rosa Ramirez", phone: "09175550101" },
    verificationStatus: "Pending Admin Approval", submittedAt: now, createdAt: now,
  };
  const RIDER = {
    role: "passenger", fullName: "Bianca Santos", email: "bianca.rider@gmail.com", contactNumber: "09181234567", password: "TestRider123",
    seatsNeeded: 1, pickupPoint: FROM, destinationPoint: TO, route: `${FROM} → ${TO}`, schedule: { days: "Mon - Fri", preferredTime: "06:30" },
    emergencyContact: { name: "Elena Santos", phone: "09185550102" }, accountStatus: "ACTIVE", createdAt: now,
  };
  const ACCOUNTS = [
    { u: DRIVER, label: "Driver", go: "sakaytayodriverdash.html", open: "Open driver dashboard" },
    { u: RIDER, label: "Rider", go: "sakaytayorides.html", open: "Open rider page" },
  ];

  const $ = (id) => document.getElementById(id);
  const toast = (m) => { const t = $("toast"); t.textContent = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2800); };

  function seedLinkedData() {
    const ride = { id: "reg-" + DRIVER.email, driver: DRIVER.fullName, car: DRIVER.vehicleModel, plate: DRIVER.plateNumber, from: FROM, to: TO, off: 1,
      time: DRIVER.schedule.startTime, seats: DRIVER.availableSeats, booked: [], closed: false };
    localStorage.setItem(RIDES_KEY, JSON.stringify([...SEED_RIDES, ride]));
    // Past rides for the rider's history, plus one pending request on the test driver's ride.
    localStorage.setItem(RESV_KEY, JSON.stringify([...SEED_RESV.slice(0, 2).map((x) => ({ ...x, passenger: RIDER.email, name: RIDER.fullName })),
      { id: "t1", rideId: "reg-" + DRIVER.email, passenger: RIDER.email, name: RIDER.fullName, status: "Pending" }]));
  }

  // Test accounts are stored like real ones: the password is hashed, never kept as plain text.
  async function signInAs(account) {
    const { role, fullName, email, contactNumber, password, createdAt, verificationStatus, accountStatus, ...profile } = account.u;
    const isDriver = role === "driver";
    const saved = await SakayAuth.seed({
      email, fullName, contactNumber, password,
      account: {
        roles: [role],
        driverStatus: isDriver ? "verified" : "not_started",
        driverProfile: isDriver ? profile : null,
        passengerProfile: isDriver ? null : profile,
      },
    });
    SakayAuth.startSession(saved, role);
  }

  $("accounts").innerHTML = ACCOUNTS.map((a, i) => `<article class="ride-card">
    <div><p class="who">${a.label}: ${a.u.fullName}</p>
    <p class="ride-meta">Email: ${a.u.email}<br>Contact: ${a.u.contactNumber}<br>Password: ${a.u.password}</p>
    <p class="ride-meta">${a.u.route}<br>${a.u.schedule.days}, ${a.u.schedule.startTime || a.u.schedule.preferredTime}</p></div>
    <div class="ride-actions"><span class="badge ${a.u.role === "driver" ? "" : "gray"}">${a.label}</span>
    <button class="pill-btn small primary-btn" data-i="${i}">${a.open}</button></div></article>`).join("");

  $("accounts").addEventListener("click", async (e) => {
    const i = e.target.dataset.i; if (i === undefined) return;
    if (!localStorage.getItem(RIDES_KEY) || !RIDES.some((r) => r.id === "reg-" + DRIVER.email)) seedLinkedData();
    await signInAs(ACCOUNTS[i]);
    location.href = ACCOUNTS[i].go;
  });

  $("reset").addEventListener("click", () => {
    seedLinkedData();
    toast("Test data reset. The rider has a pending request on the driver's ride.");
    renderStatus();
  });

  function renderStatus() {
    const u = JSON.parse(localStorage.getItem("sakaytayo_user") || "{}");
    $("status").textContent = u.fullName ? `Currently signed in as ${u.fullName} (${u.role}).` : "Not signed in yet.";
  }
  renderStatus();
});
