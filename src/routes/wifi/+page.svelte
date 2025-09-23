<script lang="ts">
  // ✅ Your Google Apps Script endpoint
  const SCRIPT_EXEC =
    "https://script.google.com/macros/s/AKfycbxc6mTG8Qha3xx2OFg4g3oqf0c4ZM1qxljufYo0sZMU1VOSVva1t6zW9CeJzeC_qOEcQg/exec";

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

    const loginHost =
      qp.get("switchip") || qp.get("apip") || "login.serviceswifi.com";

    try {
      // First, log to Google Sheets
      const logUrl = new URL(SCRIPT_EXEC);
      logUrl.searchParams.set("fn", "log");
      
      // Add all the parameters
      ["mac", "ip", "essid", "apname", "apmac", "vcname"].forEach((k) => {
        const v = qp.get(k);
        if (v) logUrl.searchParams.set(k, v);
      });
      
      if (firstName) logUrl.searchParams.set("firstName", firstName);
      if (lastName) logUrl.searchParams.set("lastName", lastName);
      if (email) logUrl.searchParams.set("email", email);

      // Make the logging request (but don't wait for response)
      fetch(logUrl.toString(), { 
        method: 'GET',
        mode: 'no-cors' // This prevents CORS issues
      }).catch(() => {
        // Ignore errors - we'll redirect anyway
      });

      // Small delay to allow logging, then redirect directly to Aruba
      setTimeout(() => {
        const finalLogin = `http://${loginHost}/cgi-bin/login?${qp.toString()}`;
        window.location.replace(finalLogin);
      }, 500);

    } catch (error) {
      console.error('Logging failed:', error);
      
      // Even if logging fails, still proceed with WiFi connection
      const finalLogin = `http://${loginHost}/cgi-bin/login?${qp.toString()}`;
      window.location.replace(finalLogin);
    }
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