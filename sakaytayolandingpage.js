document.addEventListener("DOMContentLoaded", () => {
  const ROUTES = {
    home: "sakaytayolandingpage.html",
    findRide: "sakaytayorides.html",
    driverDash: "sakaytayodriverdash.html",
  };

  const driverBtn = document.getElementById("btn-driver");
  const passengerBtn = document.getElementById("btn-passenger");
  const navLinks = document.querySelectorAll(".nav-item");
  const toastEl = document.getElementById("route-toast");

  const overlay = document.getElementById("login-overlay");
  const loginForm = document.getElementById("login-form");
  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const loginError = document.getElementById("login-error");
  const loginSubtitle = document.getElementById("login-subtitle");
  const loginSubmit = document.getElementById("login-submit");
  const noAccountLink = document.getElementById("no-account-link");

  let toastTimeout;

  // Who is logged in? (the same check every page makes before deciding what to show)
  const account = SakayAuth.current();
  const signedIn = !!account;
  const driverMode = signedIn && SakayAuth.activeRole() === "driver" && account.driverStatus === "verified";
  const navFind = document.getElementById("nav-find");
  const navMy = document.getElementById("nav-my");
  const navSign = document.getElementById("nav-signup");

  if (driverMode) {
    navFind.textContent = "Requests";
    navFind.setAttribute("href", ROUTES.driverDash);
    navMy.textContent = "Manage Seats";
    navMy.setAttribute("href", ROUTES.driverDash + "#manage");
  }
  if (signedIn) {
    // A logged-in user never sees the sign-up option again.
    navSign.textContent = "Log out";
    navSign.setAttribute("href", "#logout");
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  function navigateToPage(url) {
    document.body.style.transition = "opacity 0.25s ease";
    document.body.style.opacity = "0.65";
    setTimeout(() => { window.location.href = url; }, 250);
  }

  // ---------- Log In form (one form for both roles) ----------
  // The button that was clicked only decides where the visitor goes next.
  let loginRole = "passenger";

  const SUBTITLES = {
    driver: "Log in to continue as a driver.",
    passenger: "Log in to find a ride.",
  };
  const SIGNUP_PAGES = {
    driver: SakayAuth.PAGES.driverSignup,
    passenger: SakayAuth.PAGES.passengerSignup,
  };

  function setLoginError(message) {
    loginError.textContent = message || "";
    loginError.hidden = !message;
  }

  function openLogin(role, email) {
    loginRole = role;
    loginSubtitle.textContent = SUBTITLES[role];
    noAccountLink.setAttribute("href", SIGNUP_PAGES[role]);
    setLoginError("");
    loginPassword.value = "";
    if (email) loginEmail.value = email;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    (email ? loginPassword : loginEmail).focus();
  }

  function closeLogin() {
    overlay.hidden = true;
    document.body.style.overflow = "";
  }

  document.getElementById("login-cancel").addEventListener("click", closeLogin);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeLogin(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) closeLogin(); });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setLoginError("");

    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    if (!email || !password) {
      setLoginError(`Please fill in the required fields: ${[!email && "email", !password && "password"].filter(Boolean).join(", ")}.`);
      (email ? loginPassword : loginEmail).focus();
      return;
    }

    loginSubmit.disabled = true;
    try {
      const result = await SakayAuth.login(email, password);
      if (!result.ok) {
        setLoginError(
          result.code === "WRONG_PASSWORD"
            ? "Wrong password. Please try again."
            : "We couldn't find an account with that email. Tap “I don't have an account yet” below to sign up."
        );
        (result.code === "WRONG_PASSWORD" ? loginPassword : loginEmail).focus();
        return;
      }
      continueAs(loginRole, result.account);
    } catch (err) {
      setLoginError(
        err.message === "SECURE_CONTEXT_REQUIRED"
          ? "Logging in needs a secure page. Open the site from https:// or http://localhost."
          : "Something went wrong while logging in. Please try again."
      );
    } finally {
      loginSubmit.disabled = false;
    }
  });

  // Start the session for the chosen role, then send the person where that role needs to be.
  function continueAs(role, acct) {
    SakayAuth.startSession(acct, role);
    const target = SakayAuth.routeFor(role, acct);
    showToast(
      role === "driver"
        ? acct.driverStatus === "verified"
          ? "Welcome back! Opening your driver dashboard..."
          : "Welcome back! Continuing your driver verification..."
        : "Welcome back! Opening Find a Ride..."
    );
    closeLogin();
    navigateToPage(target);
  }

  function onRoleClick(role) {
    // Already logged in: no need to ask again.
    if (signedIn) {
      continueAs(role, SakayAuth.current());
      return;
    }
    openLogin(role);
  }

  if (driverBtn) driverBtn.addEventListener("click", () => onRoleClick("driver"));
  if (passengerBtn) passengerBtn.addEventListener("click", () => onRoleClick("passenger"));

  // Links like sakaytayolandingpage.html?login=driver&email=... open the form straight away.
  const params = new URLSearchParams(window.location.search);
  const wanted = params.get("login");
  if (!signedIn && (wanted === "driver" || wanted === "passenger")) {
    openLogin(wanted, params.get("email") || "");
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const targetUrl = link.getAttribute("href");
      e.preventDefault();

      if (targetUrl === ROUTES.home) {
        navLinks.forEach((item) => item.classList.remove("active"));
        link.classList.add("active");
        return;
      }

      if (targetUrl === "#signup") {
        const group = document.getElementById("signup");
        showToast("Choose how you want to join SakayTayo!");
        group.scrollIntoView({ behavior: "smooth", block: "center" });
        group.classList.add("attention");
        setTimeout(() => group.classList.remove("attention"), 1800);
        return;
      }

      if (targetUrl === "#logout") {
        SakayAuth.logout();
        showToast("You have been logged out.");
        setTimeout(() => window.location.reload(), 700);
        return;
      }

      if (!signedIn) {
        showToast("Please log in first to use this page.");
        openLogin("passenger");
        return;
      }

      // Find a Ride / My Rides are passenger pages, even for a verified driver (same account).
      if (!targetUrl.startsWith(ROUTES.driverDash)) SakayAuth.switchRole("passenger");
      navigateToPage(targetUrl);
    });
  });
});
