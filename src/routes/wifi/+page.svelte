<script lang="ts">
  // ✅ Your updated Google Apps Script endpoint
  const SCRIPT_EXEC =
    "https://script.google.com/macros/s/AKfycbzGUnpmPC2t8PgjtoH8ctpKAbJlYSq7__Pykvq7MCFY9IXulcqrVZ9ZsIpVG6JVZmArWw/exec";

  async function handleSubmit(e: Event) {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);

    const firstName = (fd.get("firstName") || "").toString();
    const lastName = (fd.get("lastName") || "").toString();
    const email = (fd.get("email") || "").toString();

    // Read current query params from Aruba
    const current = new URL(window.location.href);
    const qp = new URLSearchParams(current.search);

    // Aruba gives us switchip=... (your debug showed login.serviceswifi.com)
    const loginHost =
      qp.get("switchip") || qp.get("apip") || "login.serviceswifi.com";

    // Build the logging URL to your GAS Web App
    const logUrl = new URL(SCRIPT_EXEC);
    logUrl.searchParams.set("fn", "log");
    ["mac", "ip", "essid", "apname", "apmac", "vcname"].forEach((k) => {
      const v = qp.get(k);
      if (v) logUrl.searchParams.set(k, v);
    });
    if (firstName) logUrl.searchParams.set("firstName", firstName);
    if (lastName) logUrl.searchParams.set("lastName", lastName);
    if (email) logUrl.searchParams.set("email", email);

    // ✅ URL-encode the GAS URL before giving it to Aruba
    qp.set("url", encodeURIComponent(logUrl.toString()));

    // Build final Aruba login URL
    const finalLogin = `http://${loginHost}/cgi-bin/login?${qp.toString()}`;

    // Navigate there (top-level, avoids mixed-content blocking)
    window.location.replace(finalLogin);
  }
</script>

<main>
  <h2>Guest Wi-Fi</h2>
  <p>Enter your details to connect</p>

  <form on:submit={handleSubmit}>
    <input name="firstName" placeholder="First Name" required />
    <input name="lastName" placeholder="Last Name" />
    <input name="email" type="email" placeholder="Email" required />
    <button type="submit">Connect</button>
  </form>
</main>

<style>
  main {
    font-family: Arial, sans-serif;
    padding: 24px;
    text-align: center;
  }
  form {
    margin: 16px auto;
    display: grid;
    gap: 10px;
    width: 100%;
    max-width: 320px;
  }
  input,
  button {
    padding: 10px;
    font-size: 16px;
    border-radius: 6px;
    border: 1px solid #ccc;
  }
  button {
    background: #2f2f2f;
    color: #fff;
    cursor: pointer;
  }
  button:hover {
    background: #444;
  }
</style>
