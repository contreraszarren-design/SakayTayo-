document.addEventListener("DOMContentLoaded", () => {
  const NEXT_DRIVER_PAGE = "sakaytayodriverdash.html";

  // Session check: a verified driver never sees this page again.
  let account = SakayAuth.current();
  if (account && account.driverStatus === "verified") {
    SakayAuth.switchRole("driver", account);
    window.location.replace(NEXT_DRIVER_PAGE);
    return;
  }
  if (account) SakayAuth.switchRole("driver", account);

  // Batangas locations & stops (including San Jose suggestions)
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

  const step1Panel = document.getElementById("step-1");
  const step2Panel = document.getElementById("step-2");
  const step1Form = document.getElementById("step1-form");
  const step2Form = document.getElementById("step2-form");
  const backToStep1Btn = document.getElementById("back-to-step1");

  const startInput = document.getElementById("startLocation");
  const destinationInput = document.getElementById("destinationLocation");
  const startList = document.getElementById("startSuggestions");
  const destinationList = document.getElementById("destinationSuggestions");

  const plateInput = document.getElementById("plateNumber");
  const licenseDropBox = document.getElementById("licenseDropBox");
  const licenseDropInput = document.getElementById("licenseDropInput");
  const licensePreviewImg = document.getElementById("licensePreviewImg");
  const licensePreviewName = document.getElementById("licensePreviewName");
  const removeLicenseBtn = document.getElementById("removeLicenseBtn");

  const studentIdInput = document.getElementById("studentIdUpload");
  const studentIdName = document.getElementById("studentIdName");
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

  function showStep(stepNumber) {
    step1Panel.classList.toggle("active", stepNumber === 1);
    step2Panel.classList.toggle("active", stepNumber === 2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Batangas Autocomplete setup
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

  setupAutocomplete(startInput, startList);
  setupAutocomplete(destinationInput, destinationList);

  // Plate number formatter & validator: 3 letters + 3 digits (e.g. ABC 123)
  function isValidPlate3x3(rawPlate) {
    const compact = rawPlate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return /^[A-Z]{3}\d{3}$/.test(compact);
  }

  function formatPlate3x3(rawPlate) {
    const compact = rawPlate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (/^[A-Z]{3}\d{3}$/.test(compact)) {
      return `${compact.slice(0, 3)} ${compact.slice(3, 6)}`;
    }
    return rawPlate.trim().toUpperCase();
  }

  if (plateInput) {
    plateInput.addEventListener("input", () => {
      const cleaned = plateInput.value.replace(/[^A-Za-z0-9\s]/g, "").toUpperCase();
      plateInput.value = cleaned;
    });
  }

  // Driver's License Image Drop Box handling
  let selectedLicenseFile = null;
  let savedLicenseImage = ""; // compressed copy kept with the account so it survives leaving the page
  let savedLicenseName = "";
  let savedStudentIdName = "";

  function applyLicenseFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please upload a valid image file (PNG, JPG, WEBP) for your license.");
      return;
    }

    selectedLicenseFile = file;
    savedLicenseName = file.name;
    SakayAuth.compressImage(file).then((dataUrl) => {
      savedLicenseImage = dataUrl;
      scheduleSave();
    });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    licenseDropInput.files = dataTransfer.files;

    licensePreviewName.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (ev) => {
      licensePreviewImg.src = ev.target.result;
      licenseDropBox.classList.add("has-file");
    };
    reader.readAsDataURL(file);
  }

  if (licenseDropBox && licenseDropInput) {
    licenseDropBox.addEventListener("click", (e) => {
      if (e.target === removeLicenseBtn) return;
      licenseDropInput.click();
    });

    licenseDropBox.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        licenseDropInput.click();
      }
    });

    licenseDropInput.addEventListener("change", () => {
      if (licenseDropInput.files && licenseDropInput.files[0]) {
        applyLicenseFile(licenseDropInput.files[0]);
      }
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      licenseDropBox.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        licenseDropBox.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      licenseDropBox.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        licenseDropBox.classList.remove("dragover");
      });
    });

    licenseDropBox.addEventListener("drop", (e) => {
      const droppedFile = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (droppedFile) {
        applyLicenseFile(droppedFile);
      }
    });
  }

  if (removeLicenseBtn) {
    removeLicenseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedLicenseFile = null;
      savedLicenseImage = "";
      savedLicenseName = "";
      scheduleSave();
      licenseDropInput.value = "";
      licensePreviewImg.src = "";
      licensePreviewName.textContent = "";
      licenseDropBox.classList.remove("has-file");
    });
  }

  if (studentIdInput) {
    studentIdInput.addEventListener("change", () => {
      savedStudentIdName = studentIdInput.files[0] ? studentIdInput.files[0].name : "";
      studentIdName.textContent = savedStudentIdName || "No file selected";
      scheduleSave();
    });
  }

  // ---------- account fields ----------
  const accountFields = {
    fullName: document.getElementById("fullName"),
    email: document.getElementById("email"),
    contactNumber: document.getElementById("contactNumber"),
    password: document.getElementById("password"),
  };
  const passwordGroup = document.getElementById("passwordGroup");
  const errorEls = { 1: document.getElementById("form-error-1"), 2: document.getElementById("form-error-2") };

  function setError(step, message, html) {
    const el = errorEls[step];
    if (html) el.innerHTML = message; else el.textContent = message;
    el.hidden = !message;
  }

  function fail(step, message, html) {
    setError(step, message, html);
    if (!html) showToast(message);
  }

  // ---------- autosave: progress is kept with the account (or in this browser before one exists) ----------
  const SAVED_FIELDS = [
    "fullName", "email", "contactNumber", "carType", "availableSeats", "licenseNumber", "startLocation",
    "destinationLocation", "scheduleDays", "startTime", "endTime", "vehicleModel", "plateNumber", "licenseExpiry",
    "emergencyName", "emergencyPhone",
  ]; // the password is never saved
  const byId = (id) => document.getElementById(id);
  let furthestStep = 1;
  let saveTimer;

  function collectFields() {
    const fields = {};
    SAVED_FIELDS.forEach((id) => { fields[id] = byId(id).value; });
    fields.safetyAgreement = byId("safetyAgreement").checked;
    return fields;
  }

  function saveDraft() {
    const draft = {
      step: furthestStep,
      fields: collectFields(),
      licenseImage: savedLicenseImage,
      licenseImageName: savedLicenseName,
      studentIdFileName: savedStudentIdName,
    };
    try {
      if (account) {
        account.driverDraft = draft;
        SakayAuth.save(account);
      } else {
        SakayAuth.anonDraft.set("driver", draft);
      }
    } catch (err) {
      // Storage full (usually the license picture): keep the typed details, drop the picture.
      draft.licenseImage = "";
      try {
        if (account) { account.driverDraft = draft; SakayAuth.save(account); } else SakayAuth.anonDraft.set("driver", draft);
      } catch (e2) { /* nothing more we can do */ }
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 400);
  }

  function restoreDraft(draft) {
    if (!draft) return;
    Object.entries(draft.fields || {}).forEach(([id, value]) => {
      const el = byId(id);
      if (!el) return;
      if (el.type === "checkbox") el.checked = !!value; else if (value !== "") el.value = value;
    });
    savedLicenseImage = draft.licenseImage || "";
    savedLicenseName = draft.licenseImageName || "";
    savedStudentIdName = draft.studentIdFileName || "";
    if (savedLicenseName) {
      licensePreviewName.textContent = savedLicenseName;
      if (savedLicenseImage) licensePreviewImg.src = savedLicenseImage;
      licenseDropBox.classList.add("has-file");
    }
    if (savedStudentIdName) studentIdName.textContent = savedStudentIdName;
    furthestStep = draft.step === 2 ? 2 : 1;
  }

  // Logged in: prefill what we already know and skip the account details.
  if (account) {
    accountFields.fullName.value = account.fullName;
    accountFields.email.value = account.email;
    accountFields.email.readOnly = true;
    accountFields.contactNumber.value = account.contactNumber;
    passwordGroup.hidden = true;
    document.getElementById("step1-subtitle").textContent =
      "Your account details are filled in. Just register your vehicle and schedule.";
    restoreDraft(account.driverDraft);
    // The account's own name / email / number always win over anything saved in the draft.
    accountFields.fullName.value = account.fullName;
    accountFields.email.value = account.email;
    accountFields.contactNumber.value = account.contactNumber;
  } else {
    restoreDraft(SakayAuth.anonDraft.get("driver"));
    furthestStep = 1; // no account yet, so nothing has been completed
  }
  if (furthestStep === 2) {
    step1Panel.classList.remove("active");
    step2Panel.classList.add("active");
  }

  [step1Form, step2Form].forEach((f) => {
    f.addEventListener("input", scheduleSave);
    f.addEventListener("change", scheduleSave);
  });

  // ---------- step 1: account (if new) + vehicle, route, schedule ----------
  function readStep1() {
    const startLocation = startInput.value.trim();
    const destinationLocation = destinationInput.value.trim();
    return {
      carType: byId("carType").value,
      availableSeats: Number(byId("availableSeats").value),
      licenseNumber: byId("licenseNumber").value.trim(),
      startLocation,
      destinationLocation,
      route: `${startLocation} → ${destinationLocation}`,
      schedule: { days: byId("scheduleDays").value, startTime: byId("startTime").value, endTime: byId("endTime").value },
    };
  }

  step1Form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError(1, "");

    const acct = {
      fullName: accountFields.fullName.value,
      email: accountFields.email.value,
      contactNumber: accountFields.contactNumber.value,
      password: accountFields.password.value,
    };
    const accountProblem = SakayAuth.checkAccountFields(acct, { needPassword: !account });
    const s1 = readStep1();
    const missingDriver = [];
    if (!s1.carType) missingDriver.push("car type");
    if (!byId("availableSeats").value) missingDriver.push("available seats");
    if (!s1.licenseNumber) missingDriver.push("license number");
    if (!s1.startLocation) missingDriver.push("start location");
    if (!s1.destinationLocation) missingDriver.push("destination");
    if (!s1.schedule.days || !s1.schedule.startTime || !s1.schedule.endTime) missingDriver.push("schedule");

    if (accountProblem) return fail(1, accountProblem);
    if (missingDriver.length) return fail(1, `Please fill in the required fields: ${missingDriver.join(", ")}.`);
    if (s1.startLocation.toLowerCase() === s1.destinationLocation.toLowerCase()) {
      destinationInput.focus();
      return fail(1, "Start location and destination should be different.");
    }

    const submitBtn = step1Form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      if (!account) {
        // One flow: this creates the account, logs it in and starts the verification together.
        const result = await SakayAuth.register(acct, "driver");
        if (!result.ok) {
          return fail(
            1,
            `That email is already registered. <a href="${SakayAuth.loginUrl("driver", acct.email.trim())}">Log in instead</a> and we'll pick up your verification.`,
            true
          );
        }
        account = result.account;
        SakayAuth.anonDraft.clear("driver");
        accountFields.email.readOnly = true;
        passwordGroup.hidden = true;
        accountFields.password.value = "";
      } else {
        account.fullName = acct.fullName.trim();
        account.contactNumber = acct.contactNumber.replace(/\D/g, "");
      }

      furthestStep = 2;
      account.driverStatus = "in_progress";
      SakayAuth.save(account);
      saveDraft();
      showStep(2);
    } catch (err) {
      fail(1, err.message === "SECURE_CONTEXT_REQUIRED"
        ? "Creating an account needs a secure page. Open the site from https:// or http://localhost."
        : "Something went wrong while saving. Please try again.");
    } finally {
      submitBtn.disabled = false;
    }
  });

  if (backToStep1Btn) backToStep1Btn.addEventListener("click", () => showStep(1));

  // ---------- step 2: documents, then the driver is verified ----------
  step2Form.addEventListener("submit", (e) => {
    e.preventDefault();
    setError(2, "");

    if (!account) {
      // Safety net: step 2 is only reachable once step 1 created the account.
      showStep(1);
      return fail(1, "Please complete the account and driver details first.");
    }

    const vehicleModel = byId("vehicleModel").value.trim();
    const plateRaw = plateInput.value.trim();
    const licenseExpiry = byId("licenseExpiry").value;
    const emergencyName = byId("emergencyName").value.trim();
    const emergencyPhone = byId("emergencyPhone").value.trim();
    const hasLicense = !!(selectedLicenseFile || (licenseDropInput.files && licenseDropInput.files.length) || savedLicenseName);
    const hasStudentId = !!(studentIdInput.files.length || savedStudentIdName);

    const missing = [];
    if (!vehicleModel) missing.push("vehicle model");
    if (!plateRaw) missing.push("plate number");
    if (!hasLicense) missing.push("driver's license image");
    if (!licenseExpiry) missing.push("license expiration date");
    if (!hasStudentId) missing.push("Student ID / COR");
    if (!emergencyName) missing.push("emergency contact name");
    if (!emergencyPhone) missing.push("emergency contact phone");
    if (missing.length) return fail(2, `Please fill in the required fields: ${missing.join(", ")}.`);

    if (!isValidPlate3x3(plateRaw)) {
      plateInput.focus();
      return fail(2, "Plate number must have 3 letters and 3 digits (e.g. ABC 123).");
    }
    if (!byId("safetyAgreement").checked) {
      return fail(2, "Please agree to the campus safety regulations and carpool policies.");
    }

    const formattedPlate = formatPlate3x3(plateRaw);
    plateInput.value = formattedPlate;

    account.driverProfile = {
      ...readStep1(),
      vehicleModel,
      plateNumber: formattedPlate,
      licenseImageName: (selectedLicenseFile && selectedLicenseFile.name) || savedLicenseName,
      licenseImage: savedLicenseImage,
      studentIdFileName: (studentIdInput.files[0] && studentIdInput.files[0].name) || savedStudentIdName,
      licenseExpiry,
      emergencyContact: { name: emergencyName, phone: emergencyPhone },
      submittedAt: new Date().toISOString(),
    };
    account.driverStatus = "verified";
    account.driverDraft = null;
    if (!account.roles.includes("driver")) account.roles.push("driver");

    try {
      SakayAuth.save(account);
    } catch (err) {
      account.driverProfile.licenseImage = ""; // storage full: keep everything except the picture
      SakayAuth.save(account);
    }
    SakayAuth.switchRole("driver", account);
    showToast("Driver verification submitted! Redirecting...");

    document.body.style.transition = "opacity 0.25s ease";
    document.body.style.opacity = "0.65";
    setTimeout(() => { window.location.href = NEXT_DRIVER_PAGE; }, 400);
  });
});
