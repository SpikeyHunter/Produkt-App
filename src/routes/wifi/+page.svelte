<script lang="ts">
  import { page } from '$app/stores';

  let status = "";

  // ✅ Your Google Apps Script Web App endpoint
  const scriptURL =
    "https://script.google.com/macros/s/AKfycbzV4nNB_28ln5pCXSpjrw_kbqCww2DwiVEMJM9NFAg_zVCmRIIeqE6S8yKqMtqggo5HJg/exec";

  // ✅ Grab Aruba’s query params (safe, won’t crash if none exist)
  $: queryParams = $page.url.search || "";

  // ✅ Build Aruba success URL dynamically
  // Aruba will redirect users with ?cmd=login&mac=...&ip=... etc
  // We must send them back with the same params.
  let arubaSuccessURL: string;
  if (typeof window !== "undefined") {
    // Use the same host that redirected us (usually the AP/VC IP)
    const host = window.location.hostname;
    arubaSuccessURL = "http://" + host + "/cgi-bin/login" + queryParams;
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    status = "Connecting…";

    try {
      await fetch(scriptURL, {
        method: "POST",
        mode: "no-cors", // avoids CORS issues inside captive portal
        body: formData
      });
    } catch (err) {
      // ignore errors in captive portal
    }

    // ✅ Always redirect back to Aruba with its query params
    if (arubaSuccessURL) {
      window.location.href = arubaSuccessURL;
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
