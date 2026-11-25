document.addEventListener("DOMContentLoaded", () => {
  const NEXT_PASSENGER_PAGE = "sakaytayorides.html";

  // Already logged in? Nobody with an account sees the sign-up page again.
  const existing = SakayAuth.current();
  if (existing) {
    SakayAuth.switchRole("passenger", existing);
    window.location.replace(NEXT_PASSENGER_PAGE);
    return;
  }

  const BATANGAS_LOCATIONS = [
    { name: "San Jose Town Proper / Poblacion", area: "San Jose, Batangas" },
    { name: "San Jose Public Market", area: "San Jose, Batangas" },
    { name: "San Jose Municipal Hall", area: "San Jose, Batangas" },
    { name: "San Jose Batangas Highway / JP Laurel", area: "San Jose, Batangas" },
    { name: "Banaybanay, San Jose", area: "San Jose, Batangas" },
    { name: "Taysan, San Jose", area: "San Jose, Batangas" },
    { name: "Galamay-Amo, San Jose", area: "San Jose, Batangas" },
    { name: "Lumil, San Jose", area: "San Jose, Batangas" },
    { name: "Lipa City Proper / SM City Lipa", area: "Lipa, Batangas" },
    { name: "Robinsons Place Lipa", area: "Lipa, Batangas" },
    { name: "Batangas State University - Alangilan Campus", area: "Batangas City" },
    { name: "Batangas State University - Pablo Borbon Campus", area: "Batangas City" },
    { name: "SM City Batangas", area: "Batangas City" },
    { name: "Batangas Grand Terminal", area: "Batangas City" },
    { name: "San Pascual Town Proper / Bayan", area: "San Pascual, Batangas" },
    { name: "Bauan Town Proper", area: "Bauan, Batangas" },
    { name: "Tanauan City Proper / Waltermart", area: "Tanauan, Batangas" },
    { name: "Santo Tomas Town Proper", area: "Santo Tomas, Batangas" },
    { name: "Ibaan Town Proper", area: "Ibaan, Batangas" },
    { name: "Rosario Town Proper", area: "Rosario, Batangas" },
  ];

  const form = document.getElementById("passenger-account-form");
  const nameInput = document.getElementById("passengerName");
  const emailInput = document.getElementById("passengerEmail");
  const phoneInput = document.getElementById("passengerPhone");
  const passwordInput = document.getElementById("passengerPassword");
  const pickupInput = document.getElementById("pickupPoint");
  const destinationInput = document.getElementById("destinationPoint");
  const pickupList = document.getElementById("pickupSuggestions");
  const destinationList = document.getElementById("destinationSuggestions");
  const toastEl = document.getElementById("auth-toast");
  let toastTimeout;

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastEl.classList.remove("show");
    }, 3200);
  }

  function looksLikeSpamText(value) {
    const cleaned = value.toLowerCase().replace(/[^a-z]/g, "");
    if (cleaned.length < 2) return true;
    if (/(.)\1{3,}/.test(cleaned)) return true;
    const mashPatterns = ["asdf", "qwerty", "zxcv", "hjkl", "fdsa", "ytrewq", "abcd"];
    if (mashPatterns.some((pat) => cleaned.includes(pat))) return true;
    if (cleaned.length >= 6 && !/[aeiou]/.test(cleaned)) return true;
    return false;
  }

  function isValidRealName(name) {
    const trimmed = name.trim();
    const parts = trimmed.split(/\s+/);
    if (trimmed.length < 3 || parts.length < 2) return false;
    if (!/^[A-Za-zÀ-ÿ\s.'-]+$/.test(trimmed)) return false;
    return parts.every((part) => part.replace(/[^A-Za-z]/g, "").length >= 2 && !looksLikeSpamText(part));
  }

  function isValidDotComEmail(email) {
    const trimmed = email.trim().toLowerCase();
    const match = /^([a-z0-9._+-]+)@([a-z0-9-]+(?:\.[a-z0-9-]+)*)\.com$/i.exec(trimmed);
    if (!match) return false;
    const localPart = match[1];
    const domainPart = match[2];
    if (localPart.length < 2 || domainPart.length < 2) return false;
    return !looksLikeSpamText(localPart) && !looksLikeSpamText(domainPart);
  }

  function isValidPHMobile(contact) {
    const digitsOnly = contact.replace(/\D/g, "");
    if (!/^09\d{9,}$/.test(digitsOnly)) return false;
    const rest = digitsOnly.slice(2);
    return !/^(\d)\1+$/.test(rest);
  }

  function isValidPassword(password) {
    if (password.length < 8) return false;
    const lower = password.toLowerCase();
    const blocked = ["password", "password123", "12345678", "qwertyui", "qwerty123", "abcdefgh"];
    if (blocked.includes(lower)) return false;
    return !/^(.)\1{7,}$/.test(password);
  }

  function setupAutocomplete(inputEl, listEl) {
    if (!inputEl || !listEl) return;

    function renderSuggestions(query) {
      const q = query.trim().toLowerCase();
      const matches = q
        ? BATANGAS_LOCATIONS.filter(
            (item) =>
              item.name.toLowerCase().startsWith(q) ||
              item.name.toLowerCase().includes(q) ||
              item.area.toLowerCase().startsWith(q)
          )
        : BATANGAS_LOCATIONS.slice(0, 6);

      matches.sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        return aStarts - bStarts;
      });

      listEl.innerHTML = "";

      if (!matches.length) {
        listEl.classList.remove("open");
        return;
      }

      matches.slice(0, 6).forEach((item) => {
        const li = document.createElement("li");
        li.className = "suggestion-item";
        li.setAttribute("role", "option");
        li.innerHTML = `<span>${item.name}</span><span class="suggestion-sub">${item.area}</span>`;
        li.addEventListener("mousedown", (e) => {
          e.preventDefault();
          inputEl.value = item.name;
          listEl.classList.remove("open");
        });
        listEl.appendChild(li);
      });

      listEl.classList.add("open");
    }

    inputEl.addEventListener("input", () => renderSuggestions(inputEl.value));
    inputEl.addEventListener("focus", () => renderSuggestions(inputEl.value));
    inputEl.addEventListener("blur", () => {
      setTimeout(() => listEl.classList.remove("open"), 150);
    });
  }

  setupAutocomplete(pickupInput, pickupList);
  setupAutocomplete(destinationInput, destinationList);

  if (form) {
    const errorEl = document.getElementById("form-error");
    function setError(message, html) {
      if (html) errorEl.innerHTML = message; else errorEl.textContent = message;
      errorEl.hidden = !message;
    }
    function fail(message, html) {
      setError(message, html);
      if (!html) showToast(message);
    }

    // ---------- autosave: what has been typed stays in this browser until the account exists ----------
    const SAVED_FIELDS = [
      "passengerName", "passengerEmail", "passengerPhone", "pickupPoint", "destinationPoint", "seatsNeeded",
      "scheduleDays", "preferredTime", "emergencyName", "emergencyPhone",
    ]; // the password is never saved
    const draft = SakayAuth.anonDraft.get("passenger");
    if (draft) {
      Object.entries(draft).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === "checkbox") el.checked = !!value; else if (value !== "") el.value = value;
      });
    }
    let saveTimer;
    function saveDraft() {
      const data = {};
      SAVED_FIELDS.forEach((id) => { data[id] = document.getElementById(id).value; });
      data.passengerAgreement = document.getElementById("passengerAgreement").checked;
      SakayAuth.anonDraft.set("passenger", data);
    }
    const queueSave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 400); };
    form.addEventListener("input", queueSave);
    form.addEventListener("change", queueSave);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setError("");

      const fullName = nameInput.value.trim();
      const email = emailInput.value.trim();
      const contactNumber = phoneInput.value.trim();
      const password = passwordInput.value;
      const pickupPoint = pickupInput.value.trim();
      const destinationPoint = destinationInput.value.trim();
      const seatsNeeded = document.getElementById("seatsNeeded").value;
      const scheduleDays = document.getElementById("scheduleDays").value;
      const preferredTime = document.getElementById("preferredTime").value;
      const emergencyName = document.getElementById("emergencyName").value.trim();
      const emergencyPhone = document.getElementById("emergencyPhone").value.trim();
      const agreed = document.getElementById("passengerAgreement").checked;

      // Missing required fields: say exactly which ones.
      const missing = [];
      if (!fullName) missing.push("full name");
      if (!email) missing.push("email");
      if (!contactNumber) missing.push("contact number");
      if (!password) missing.push("password");
      if (!pickupPoint) missing.push("pick-up point");
      if (!destinationPoint) missing.push("destination");
      if (!seatsNeeded) missing.push("seats needed");
      if (!scheduleDays || !preferredTime) missing.push("preferred schedule");
      if (!emergencyName) missing.push("emergency contact name");
      if (!emergencyPhone) missing.push("emergency contact phone");
      if (missing.length) return fail(`Please fill in the required fields: ${missing.join(", ")}.`);

      if (!isValidRealName(fullName)) { nameInput.focus(); return fail("Please enter your real full name (first and last name)."); }
      if (!isValidDotComEmail(email)) { emailInput.focus(); return fail("Please enter a valid email address ending in .com."); }
      if (!isValidPHMobile(contactNumber)) { phoneInput.focus(); return fail("Contact number must start with 09 and have at least 11 digits."); }
      if (!isValidPassword(password)) { passwordInput.focus(); return fail("Password must be at least 8 characters and not a spam/common password."); }
      if (pickupPoint.toLowerCase() === destinationPoint.toLowerCase()) { destinationInput.focus(); return fail("Pick-up point and destination should be different."); }
      if (!isValidPHMobile(emergencyPhone)) { document.getElementById("emergencyPhone").focus(); return fail("Emergency contact number must start with 09 and have at least 11 digits."); }
      if (!agreed) return fail("Please agree to the passenger carpool rules and safety policy.");

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        // Creates the account (password is hashed), logs it in, and starts the passenger session.
        const result = await SakayAuth.register({ fullName, email, contactNumber, password }, "passenger");
        if (!result.ok) {
          return fail(
            `That email is already registered. <a href="${SakayAuth.loginUrl("passenger", email)}">Log in instead</a> to find a ride.`,
            true
          );
        }

        const account = result.account;
        account.passengerProfile = {
          seatsNeeded: Number(seatsNeeded),
          pickupPoint,
          destinationPoint,
          route: `${pickupPoint} → ${destinationPoint}`,
          schedule: { days: scheduleDays, preferredTime },
          emergencyContact: { name: emergencyName, phone: emergencyPhone.replace(/\D/g, "") },
        };
        SakayAuth.save(account);
        SakayAuth.anonDraft.clear("passenger");
        SakayAuth.switchRole("passenger", account);

        showToast("Passenger account created! Redirecting...");
        document.body.style.transition = "opacity 0.25s ease";
        document.body.style.opacity = "0.65";
        setTimeout(() => { window.location.href = NEXT_PASSENGER_PAGE; }, 400);
      } catch (err) {
        fail(err.message === "SECURE_CONTEXT_REQUIRED"
          ? "Creating an account needs a secure page. Open the site from https:// or http://localhost."
          : "Something went wrong while creating your account. Please try again.");
      } finally {
        submitBtn.disabled = false;
      }
    });
  }
});
