<script lang="ts">
  import { page } from '$app/stores';

  let status = "";

  // ✅ Your Google Apps Script Web App endpoint
  const scriptURL =
    "https://script.google.com/macros/s/AKfycbzV4nNB_28ln5pCXSpjrw_kbqCww2DwiVEMJM9NFAg_zVCmRIIeqE6S8yKqMtqggo5HJg/exec";

  // ✅ Grab Aruba’s query params safely
  $: queryParams = $page.url.search || "";
  const urlParams = new URLSearchParams(queryParams);

  // ✅ Detect Aruba controller IP/host
  let loginHost: string | null = null;
  if (urlParams.get("switchip")) {
    // Some Aruba versions send switchip=<controller_ip>
    loginHost = urlParams.get("switchip");
  } else {
    // Fallback: use the host that redirected us (usually AP/VC)
    loginHost = typeof window !== "undefined" ? window.location.hostname : null;
  }

  // ✅ Build Aruba success URL (local AP/VC, not Vercel!)
  let arubaSuccessURL: string | null = null;
  if (loginHost) {
    arubaSuccessURL =
      "http://" + loginHost + "/cgi-bin/login?" + queryParams.substring(1);
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    status = "Connecting…";

    try {
      await fetch(scriptURL, {
        method: "POST",
        mode: "no-cors",
        body: formData
      });
    } catch (err) {
      // Ignore errors inside captive portal
    }

    // ✅ Always redirect back to Aruba’s controller to unlock internet
    if (arubaSuccessURL) {
      window.location.href = arubaSuccessURL;
    } else {
      status = "Error: Aruba login host not found.";
    }
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
