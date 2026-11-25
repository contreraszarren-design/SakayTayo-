/*
 * SakayTayo! shared account + session layer.
 *
 * One email = one account. An account holds roles (passenger, driver) and a driver_status
 * (not_started | in_progress | verified). Passwords are never stored as plain text: they are
 * salted and hashed with PBKDF2-SHA256.
 *
 * This project ships as static HTML with no server, so the "database" below is localStorage.
 * Every function here is async and returns plain {ok, code, account} results, so each one maps
 * 1:1 onto a servlet endpoint (see SERVER-NOTES.md) and the pages never need to change when
 * the storage moves server-side.
 */
(function () {
  const ACCOUNTS_KEY = "sakaytayo_accounts"; // { [email]: account }
  const SESSION_KEY = "sakaytayo_session"; // email of the logged-in account
  const USER_KEY = "sakaytayo_user"; // legacy view of the session read by rides / dashboard pages
  const ROLE_KEY = "sakaytayo_role";
  const ANON_DRAFT_KEY = "sakaytayo_draft_";
  const ITERATIONS = 120000;

  const PAGES = {
    home: "sakaytayolandingpage.html",
    driverSignup: "driververification.html",
    passengerSignup: "passengeraccount.html",
    driverDash: "sakaytayodriverdash.html",
    findRide: "sakaytayorides.html",
  };

  // ---------- storage ("database") ----------
  const readAll = () => {
    try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}") || {}; } catch (e) { return {}; }
  };
  const writeAll = (all) => localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(all));
  const normEmail = (email) => String(email || "").trim().toLowerCase();

  // ---------- password hashing ----------
  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  async function hashPassword(password, saltB64, iterations) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("SECURE_CONTEXT_REQUIRED");
    }
    const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iterations || ITERATIONS }, key, 256);
    return { hash: toB64(bits), salt: toB64(salt), iterations: iterations || ITERATIONS };
  }

  // ---------- validation (same rules the sign-up pages already used) ----------
  function looksLikeSpamText(value) {
    const cleaned = value.toLowerCase().replace(/[^a-z]/g, "");
    if (cleaned.length < 2) return true;
    if (/(.)\1{3,}/.test(cleaned)) return true;
    if (["asdf", "qwerty", "zxcv", "hjkl", "fdsa", "ytrewq", "abcd"].some((p) => cleaned.includes(p))) return true;
    if (cleaned.length >= 6 && !/[aeiou]/.test(cleaned)) return true;
    return false;
  }
  const validate = {
    name(name) {
      const t = name.trim();
      const parts = t.split(/\s+/);
      if (t.length < 3 || parts.length < 2) return false;
      if (!/^[A-Za-zÀ-ÿ\s.'-]+$/.test(t)) return false;
      return parts.every((p) => p.replace(/[^A-Za-z]/g, "").length >= 2 && !looksLikeSpamText(p));
    },
    email(email) {
      const m = /^([a-z0-9._+-]+)@([a-z0-9-]+(?:\.[a-z0-9-]+)*)\.com$/i.exec(email.trim().toLowerCase());
      if (!m) return false;
      if (m[1].length < 2 || m[2].length < 2) return false;
      return !looksLikeSpamText(m[1]) && !looksLikeSpamText(m[2]);
    },
    phone(contact) {
      const d = contact.replace(/\D/g, "");
      if (!/^09\d{9,}$/.test(d)) return false;
      return !/^(\d)\1+$/.test(d.slice(2));
    },
    password(pw) {
      if (pw.length < 8) return false;
      if (["password", "password123", "12345678", "qwertyui", "qwerty123", "abcdefgh"].includes(pw.toLowerCase())) return false;
      return !/^(.)\1{7,}$/.test(pw);
    },
  };

  /** Checks the four account fields. Returns an error message, or "" when everything is fine. */
  function checkAccountFields({ fullName, email, contactNumber, password }, { needPassword = true } = {}) {
    const missing = [];
    if (!fullName.trim()) missing.push("full name");
    if (!email.trim()) missing.push("email");
    if (!contactNumber.trim()) missing.push("contact number");
    if (needPassword && !password) missing.push("password");
    if (missing.length) return `Please fill in the required fields: ${missing.join(", ")}.`;
    if (!validate.name(fullName)) return "Please enter your real full name (first and last name).";
    if (!validate.email(email)) return "Please enter a valid email address ending in .com (e.g. name@gmail.com).";
    if (!validate.phone(contactNumber)) return "Contact number must start with 09 and have at least 11 digits.";
    if (needPassword && !validate.password(password)) return "Password must be at least 8 characters and not a common/spam password.";
    return "";
  }

  // ---------- session ----------
  /** Legacy single-object view of the session. The rides + dashboard pages read this key. */
  function legacyUser(account, role) {
    const base = { role, fullName: account.fullName, email: account.email, contactNumber: account.contactNumber, createdAt: account.createdAt };
    if (role === "driver") {
      const { licenseImage, ...profile } = account.driverProfile || {};
      Object.assign(base, profile);
      if (account.driverStatus === "verified") base.verificationStatus = "Verified";
    } else {
      Object.assign(base, account.passengerProfile || {});
      base.accountStatus = "ACTIVE";
    }
    return base;
  }

  function syncLegacy(account, role) {
    localStorage.setItem(USER_KEY, JSON.stringify(legacyUser(account, role)));
    localStorage.setItem(ROLE_KEY, role);
  }

  function activeRole() {
    return localStorage.getItem(ROLE_KEY) === "driver" ? "driver" : "passenger";
  }

  /** The server-side session check: who is logged in right now? null when nobody. */
  function current() {
    const email = localStorage.getItem(SESSION_KEY);
    const account = email ? readAll()[email] : null;
    if (!account) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(ROLE_KEY);
      return null;
    }
    return account;
  }

  function persist(account) {
    const all = readAll();
    all[account.email] = account;
    writeAll(all);
    if (localStorage.getItem(SESSION_KEY) === account.email) syncLegacy(account, activeRole());
    return account;
  }

  function startSession(account, role) {
    localStorage.setItem(SESSION_KEY, account.email);
    switchRole(role, account);
  }

  /** Log in as passenger or driver. A passenger role is granted automatically: any account can reserve seats. */
  function switchRole(role, account) {
    const acct = account || current();
    if (!acct) return null;
    if (role === "passenger" && !acct.roles.includes("passenger")) {
      acct.roles.push("passenger");
      const all = readAll();
      all[acct.email] = acct;
      writeAll(all);
    }
    syncLegacy(acct, role);
    return acct;
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLE_KEY);
  }

  /** Where should this person go after logging in with the given button? */
  function routeFor(role, account) {
    if (role === "driver") return account.driverStatus === "verified" ? PAGES.driverDash : PAGES.driverSignup;
    return PAGES.findRide;
  }

  // ---------- accounts ----------
  async function register({ fullName, email, contactNumber, password }, role) {
    const key = normEmail(email);
    const all = readAll();
    if (all[key]) return { ok: false, code: "EMAIL_TAKEN" };
    const pw = await hashPassword(password);
    const account = {
      email: key,
      fullName: fullName.trim(),
      contactNumber: contactNumber.replace(/\D/g, ""),
      passwordHash: pw.hash,
      salt: pw.salt,
      iterations: pw.iterations,
      roles: [role],
      driverStatus: "not_started", // not_started | in_progress | verified
      driverDraft: null,
      driverProfile: null,
      passengerProfile: null,
      createdAt: new Date().toISOString(),
    };
    all[key] = account;
    writeAll(all);
    startSession(account, role);
    return { ok: true, account };
  }

  async function login(email, password) {
    if (!email.trim() || !password) return { ok: false, code: "MISSING" };
    const account = readAll()[normEmail(email)];
    if (!account) return { ok: false, code: "NO_ACCOUNT" };
    const pw = await hashPassword(password, account.salt, account.iterations);
    if (pw.hash !== account.passwordHash) return { ok: false, code: "WRONG_PASSWORD" };
    return { ok: true, account };
  }

  /** Test helper: create (or replace) an account with known values, already hashed. */
  async function seed(spec) {
    const pw = await hashPassword(spec.password);
    const account = {
      driverStatus: "not_started", driverDraft: null, driverProfile: null, passengerProfile: null, roles: [],
      ...spec.account, email: normEmail(spec.email), fullName: spec.fullName, contactNumber: spec.contactNumber,
      passwordHash: pw.hash, salt: pw.salt, iterations: pw.iterations, createdAt: new Date().toISOString(),
    };
    const all = readAll();
    all[account.email] = account;
    writeAll(all);
    return account;
  }

  // ---------- progress saved before an account exists ----------
  const anonDraft = {
    get(role) { try { return JSON.parse(localStorage.getItem(ANON_DRAFT_KEY + role) || "null"); } catch (e) { return null; } },
    set(role, data) { localStorage.setItem(ANON_DRAFT_KEY + role, JSON.stringify(data)); },
    clear(role) { localStorage.removeItem(ANON_DRAFT_KEY + role); },
  };

  /** Shrinks a picture so it fits comfortably in browser storage. Resolves to a data URL. */
  function compressImage(file, maxSide = 900) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => resolve("");
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => resolve("");
        img.onload = () => {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  window.SakayAuth = {
    PAGES, validate, checkAccountFields, register, login, seed, current, activeRole, startSession, switchRole,
    logout, routeFor, save: persist, anonDraft, compressImage, normEmail,
    loginUrl: (role, email) => `${PAGES.home}?login=${role}${email ? "&email=" + encodeURIComponent(email) : ""}`,
  };
})();
