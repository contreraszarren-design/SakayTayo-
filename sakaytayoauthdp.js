document.addEventListener("DOMContentLoaded", () => {
  const NEXT_PAGES = {
    driver: "driververification.html",
    passenger: "passengeraccount.html",
  };

  const form = document.getElementById("signup-form");
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

    // Repeated single character like "aaaa" or "zzzz"
    if (/(.)\1{3,}/.test(cleaned)) return true;

    // Common keyboard mash patterns
    const mashPatterns = ["asdf", "qwerty", "zxcv", "hjkl", "fdsa", "ytrewq", "abcd"];
    if (mashPatterns.some((pat) => cleaned.includes(pat))) return true;

    // Long string with no vowels (e.g., "xkcdvr", "bcdfghj")
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
    if (looksLikeSpamText(localPart) || looksLikeSpamText(domainPart)) return false;

    return true;
  }

  function isValidPHMobile(contact) {
    const digitsOnly = contact.replace(/\D/g, "");
    if (!/^09\d{9,}$/.test(digitsOnly)) return false;

    const rest = digitsOnly.slice(2);
    if (/^(\d)\1+$/.test(rest)) return false;

    return true;
  }

  function isValidPassword(password) {
    if (password.length < 8) return false;
    const lower = password.toLowerCase();
    const blockedPasswords = ["password", "password123", "12345678", "qwertyui", "qwerty123", "abcdefgh"];
    if (blockedPasswords.includes(lower)) return false;
    if (/^(.)\1{7,}$/.test(password)) return false;
    return true;
  }

  function navigateToNextPage(targetUrl) {
    document.body.style.transition = "opacity 0.25s ease";
    document.body.style.opacity = "0.65";

    setTimeout(() => {
      window.location.href = targetUrl;
    }, 350);
  }

  if (form) {
    const inputs = form.querySelectorAll("input");
    inputs.forEach((input) => {
      input.required = true;
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const role = form.dataset.role === "driver" ? "driver" : "passenger";
      const fullNameInput = document.getElementById("fullName");
      const emailInput = document.getElementById("email");
      const contactInput = document.getElementById("contactNumber");
      const passwordInput = document.getElementById("password");

      const fullName = fullNameInput.value.trim();
      const email = emailInput.value.trim();
      const contactNumber = contactInput.value.trim();
      const password = passwordInput.value;

      if (!isValidRealName(fullName)) {
        showToast("Please enter your real full name (first and last name).");
        fullNameInput.focus();
        return;
      }

      if (!isValidDotComEmail(email)) {
        showToast("Please enter a valid email address ending in .com (e.g. name@gmail.com).");
        emailInput.focus();
        return;
      }

      if (!isValidPHMobile(contactNumber)) {
        showToast("Contact number must start with 09 and have at least 11 digits.");
        contactInput.focus();
        return;
      }

      if (!isValidPassword(password)) {
        showToast("Password must be at least 8 characters and not a common/spam password.");
        passwordInput.focus();
        return;
      }

      const normalizedPhone = contactNumber.replace(/\D/g, "");
      const userData = {
        role,
        fullName,
        email: email.toLowerCase(),
        contactNumber: normalizedPhone,
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem("sakaytayo_user", JSON.stringify(userData));
      localStorage.setItem("sakaytayo_role", role);

      const destination = NEXT_PAGES[role];
      const roleLabel = role === "driver" ? "Driver" : "Passenger";

      showToast(`${roleLabel} account created! Proceeding to verification...`);
      navigateToNextPage(destination);
    });
  }
});