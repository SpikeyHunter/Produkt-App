<script lang="ts">
  let status = "";
  let query = "";

  // ✅ Your Google Apps Script endpoint
  const scriptURL =
    "https://script.google.com/macros/s/AKfycbzV4nNB_28ln5pCXSpjrw_kbqCww2DwiVEMJM9NFAg_zVCmRIIeqE6S8yKqMtqggo5HJg/exec";

  let arubaSuccessURL: string | null = null;

  if (typeof window !== "undefined") {
    // Grab full query string for debug
    query = window.location.search;

    const urlParams = new URLSearchParams(query);
    const loginHost =
      urlParams.get("switchip") || urlParams.get("apip") || urlParams.get("loginurl") || window.location.hostname;

    arubaSuccessURL =
      "http://" + loginHost + "/cgi-bin/login" + window.location.search;
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

  <!-- ✅ Debug section -->
  <div style="margin-top:2rem; font-size:0.9rem; color:#555;">
    <strong>Debug Query String:</strong>
    <pre>{query}</pre>
  </div>
</main>
