<script lang="ts">
  let status = "";

  // ✅ Your Google Apps Script Web App endpoint
  const scriptURL =
    "https://script.google.com/macros/s/AKfycbzV4nNB_28ln5pCXSpjrw_kbqCww2DwiVEMJM9NFAg_zVCmRIIeqE6S8yKqMtqggo5HJg/exec";

  // ✅ Build Aruba success URL dynamically
  // Aruba appends query params like ?cmd=login&mac=...&ip=...&essid=...
  const params = window.location.search;

  // Detect if Aruba gave us a "loginurl" param (some firmware versions do this)
  const urlParams = new URLSearchParams(window.location.search);
  let baseLoginURL = urlParams.get("loginurl");

  // If no explicit loginurl param, fall back to using the Aruba controller IP
  // Clients are usually redirected from something like http://192.168.200.1:8080/...
  if (!baseLoginURL) {
    // Use the host from the current request (the AP’s captive portal host)
    baseLoginURL = window.location.origin.replace(window.location.hostname, window.location.hostname);
    // Force plain HTTP since captive portals don’t usually use HTTPS internally
    if (baseLoginURL.startsWith("https://")) {
      baseLoginURL = baseLoginURL.replace("https://", "http://");
    }
  }

  // Final success URL to redirect back into Aruba captive portal
  const arubaSuccessURL = baseLoginURL + "/cgi-bin/login" + params;

  async function handleSubmit(event: Event) {
    event.preventDefault();

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    status = "Connecting…";

    try {
      await fetch(scriptURL, {
        method: "POST",
        mode: "no-cors", // avoids CORS preflight inside captive portal
        body: formData
      });
    } catch (err) {
      // ignore – CNA will block error details anyway
    }

    // ✅ Redirect back to Aruba’s login page (unlocks internet)
    window.location.href = arubaSuccessURL;
  }
</script>

<style>
  main {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 2rem;
    text-align: center;
    font-family: Arial, sans-serif;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 300px;
    width: 100%;
  }

  input,
  button {
    padding: 0.75rem;
    font-size: 1rem;
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

  p {
    margin-top: 1rem;
  }
</style>

<main>
  <h2>Welcome to Guest WiFi</h2>
  <p>Please enter your details to connect</p>

  <form on:submit={handleSubmit}>
    <input type="text" name="firstName" placeholder="First Name" required />
    <input type="text" name="lastName" placeholder="Last Name" />
    <input type="email" name="email" placeholder="Email" required />
    <button type="submit">Connect</button>
  </form>

  {#if status}
    <p>{status}</p>
  {/if}
</main>
