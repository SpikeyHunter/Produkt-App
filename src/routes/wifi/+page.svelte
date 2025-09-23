<script lang="ts">
  let status = "";

  // ✅ Your Google Apps Script endpoint
  const scriptURL =
    "https://script.google.com/macros/s/AKfycbzV4nNB_28ln5pCXSpjrw_kbqCww2DwiVEMJM9NFAg_zVCmRIIeqE6S8yKqMtqggo5HJg/exec";

  let arubaSuccessURL: string | null = null;

  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);

    // ✅ Aruba provides the login host in switchip param
    const loginHost = urlParams.get("switchip");

    if (loginHost) {
      // Rebuild Aruba login URL with all params
      arubaSuccessURL =
        "http://" + loginHost + "/cgi-bin/login" + window.location.search;
    }
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

    if (arubaSuccessURL) {
      // ✅ Hidden iframe trick: call Aruba login without leaving page
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = arubaSuccessURL;
      document.body.appendChild(iframe);

      status = "✅ Connected! You may now close this window.";
    } else {
      status = "❌ Error: Aruba login host not found.";
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
