<script lang="ts">
  // No status UI; keep it dead simple in CNA
  let arubaLoginURL:string|undefined;

  // Your Google Apps Script endpoint (we will hit it via GET after login)
  const SCRIPT_EXEC = "https://script.google.com/macros/s/AKfycbzp2bh9GUuBfQtT4q2eaKEopGW3tD7sA9lT1JXFo-rakV04p8LGB-nKXSO5viqT6JecqQ/exec";

  if (typeof window !== "undefined") {
    // 1) Read Aruba params from query
    const original = new URL(window.location.href);
    const qp = new URLSearchParams(original.search);

    // 2) Determine Aruba login host (you showed: switchip=login.serviceswifi.com)
    const loginHost =
      qp.get("switchip") || qp.get("apip") || "login.serviceswifi.com";

    // 3) Build an AFTER-LOGIN logging URL (GET) to your Apps Script
    //    We pass user fields later via the form; for now just wire base params.
    //    GAS will accept these via doGet (see step 2 below).
    const logUrl = new URL(SCRIPT_EXEC);
    logUrl.searchParams.set("fn","log");
    // pass Aruba context so the sheet has device/session data
    ["mac","ip","essid","apname","apmac","vcname"].forEach(k=>{
      const v = qp.get(k);
      if (v) logUrl.searchParams.set(k, v);
    });

    // 4) IMPORTANT: override Aruba's "url" param so that AFTER login,
    //    Aruba redirects the browser to your GAS logging URL.
    qp.set("url", logUrl.toString());

    // 5) Build the Aruba login URL (TOP-LEVEL NAVIGATION — no iframe, no mixed content)
    arubaLoginURL = `http://${loginHost}/cgi-bin/login?${qp.toString()}`;
  }

  // On submit: we *don’t* talk to GAS here. We just tell Aruba to let them online.
  async function handleSubmit(e:Event) {
    e.preventDefault();

    // Collect user inputs to append to the AFTER-LOGIN logging URL
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const firstName = (fd.get("firstName") || "").toString();
    const lastName  = (fd.get("lastName")  || "").toString();
    const email     = (fd.get("email")     || "").toString();

    // Rebuild with user fields added to the log URL inside the "url" param
    const current = new URL(window.location.href);
    const qp = new URLSearchParams(current.search);

    const loginHost =
      qp.get("switchip") || qp.get("apip") || "login.serviceswifi.com";

    const logUrl = new URL(SCRIPT_EXEC);
    logUrl.searchParams.set("fn","log");
    ["mac","ip","essid","apname","apmac","vcname"].forEach(k=>{
      const v = qp.get(k);
      if (v) logUrl.searchParams.set(k, v);
    });
    if (firstName) logUrl.searchParams.set("firstName", firstName);
    if (lastName)  logUrl.searchParams.set("lastName",  lastName);
    if (email)     logUrl.searchParams.set("email",     email);

    qp.set("url", logUrl.toString());

    const finalLogin = `http://${loginHost}/cgi-bin/login?${qp.toString()}`;

    // TOP-LEVEL NAV so the browser doesn’t block HTTP (mixed content)
    window.location.replace(finalLogin);
  }
</script>

<main>
  <h2>Guest Wi-Fi</h2>
  <p>Enter your details to connect</p>

  <form on:submit={handleSubmit}>
    <input name="firstName" placeholder="First Name" required />
    <input name="lastName"  placeholder="Last Name" />
    <input name="email"     type="email" placeholder="Email" required />
    <button type="submit">Connect</button>
  </form>
</main>

<style>
  main { font-family: Arial, sans-serif; padding: 24px; text-align: center; }
  form { margin: 16px auto; display: grid; gap: 10px; width: 100%; max-width: 320px; }
  input,button { padding: 10px; font-size: 16px; border-radius: 6px; border: 1px solid #ccc; }
  button { background:#2f2f2f; color:#fff; cursor:pointer; }
  button:hover { background:#444; }
</style>
