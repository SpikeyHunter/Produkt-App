<script lang="ts">
  // No configuration needed, we will use the correct public hostname.
  const SCRIPT_EXEC =
    "https://script.google.com/macros/s/AKfycbxc6mTG8Qha3xx2OFg4g3oqf0c4ZM1qxljufYo0sZMU1VOSVva1t6zW9CeJzeC_qOEcQg/exec";

  let isSubmitting = false;

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;

    const submitBtn = document.querySelector('.connect-btn') as HTMLButtonElement;
    if (submitBtn) {
      submitBtn.textContent = 'Connecting...';
      submitBtn.disabled = true;
    }

    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const firstName = (fd.get("firstName") || "").toString();
    const lastName = (fd.get("lastName") || "").toString();
    const email = (fd.get("email") || "").toString();
    
    const current = new URL(window.location.href);
    const qp = new URLSearchParams(current.search);

    // Log to Google Sheets (this works because it's HTTPS)
    if (SCRIPT_EXEC) {
      try {
        const logUrl = new URL(SCRIPT_EXEC);
        logUrl.searchParams.set("fn", "log");
        ["mac", "ip", "essid", "apname", "apmac", "vcname"].forEach((k) => {
          const v = qp.get(k);
          if (v) logUrl.searchParams.set(k, v);
        });
        if (firstName) logUrl.searchParams.set("firstName", firstName);
        if (lastName) logUrl.searchParams.set("lastName", lastName);
        if (email) logUrl.searchParams.set("email", email);
        fetch(logUrl.toString(), { method: 'GET', mode: 'no-cors' }).catch(() => {});
      } catch (e) { /* Ignore logging errors */ }
    }

    // The login host is the public one. We will try to redirect using HTTPS.
    const loginHost = qp.get("switchip") || qp.get("apip") || "login.serviceswifi.com";
    
    const mac = qp.get("mac");
    const ip = qp.get("ip");
    const essid = qp.get("essid");

    // Approach 1: Try the most common path with HTTPS
    setTimeout(() => {
      try {
        const params = new URLSearchParams();
        if (mac) params.set("mac", mac);
        if (ip) params.set("ip", ip);
        if (essid) params.set("essid", essid);
        
        // --- THE FIX IS HERE ---
        const url1 = `https://${loginHost}/cgi-bin/login?${params.toString()}`;
        window.location.href = url1;
      } catch (e) {
        setTimeout(() => tryApproach2(loginHost, mac, ip, essid), 1500);
      }
    }, 500);
  }

  function tryApproach2(loginHost: string, mac: string | null, ip: string | null, essid: string | null) {
    try {
      const params = new URLSearchParams();
      if (mac) params.set("mac", mac);
      if (ip) params.set("ip", ip);
      if (essid) params.set("essid", essid);
      
      // --- THE FIX IS HERE ---
      const url2 = `https://${loginHost}/login?${params.toString()}`;
      window.location.href = url2;
    } catch (e) {
      setTimeout(showManualInstructions, 1500);
    }
  }

  function showManualInstructions() {
    const container = document.querySelector('.container');
    const current = new URL(window.location.href);
    const qp = new URLSearchParams(current.search);
    let essid = qp.get("essid") || "the Guest Wi-Fi";
    if (essid.includes('_')) {
        essid = essid.split('_').pop() || essid;
    }
    if (container) {
      container.innerHTML = `
        <div class="error-message">
          <h2>Connection Issue</h2>
          <p>We're having trouble automatically connecting you.</p>
          <h3>Manual Connection Steps:</h3>
          <ol>
            <li>Open your device's Wi-Fi settings.</li>
            <li>Ensure you are connected to: <strong>${essid}</strong></li>
            <li>Open a new tab and try visiting any http website (like http://example.com).</li>
          </ol>
          <button onclick="location.reload()" class="retry-btn">Try Again</button>
        </div>
      `;
    }
  }
</script>

<main>
  <div class="container">
    <div class="header">
      <h1>New City Gas</h1>
      <h2>Guest Wi-Fi Access</h2>
      <p>Please provide your details to connect to our complimentary Wi-Fi</p>
    </div>
    <form on:submit={handleSubmit} class="wifi-form">
      <div class="form-group">
        <label for="firstName">First Name *</label>
        <input id="firstName" name="firstName" type="text" placeholder="Enter your first name" required />
      </div>
      <div class="form-group">
        <label for="lastName">Last Name</label>
        <input id="lastName" name="lastName" type="text" placeholder="Enter your last name" />
      </div>
      <div class="form-group">
        <label for="email">Email Address *</label>
        <input id="email" name="email" type="email" placeholder="Enter your email address" required />
      </div>
      <button type="submit" class="connect-btn">
        Connect to Wi-Fi
      </button>
    </form>
    <div class="footer">
      <p><small>By connecting, you agree to our terms of service. Connection is complimentary for guests.</small></p>
    </div>
  </div>
</main>

<style>
  /* All your existing styles go here */
  * { margin: 0; padding: 0; box-sizing: border-box; }
  main { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .container { background: white; border-radius: 16px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1); padding: 40px; width: 100%; max-width: 420px; text-align: center; }
  .header h1 { color: #2d3748; font-size: 28px; font-weight: 700; margin-bottom: 8px; }
  .header h2 { color: #4a5568; font-size: 20px; font-weight: 600; margin-bottom: 12px; }
  .header p { color: #718096; font-size: 14px; line-height: 1.5; margin-bottom: 32px; }
  .wifi-form { display: flex; flex-direction: column; gap: 20px; }
  .form-group { text-align: left; }
  .form-group label { display: block; color: #2d3748; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
  .form-group input { width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 16px; transition: all 0.2s ease; background: #f7fafc; }
  .form-group input:focus { outline: none; border-color: #667eea; background: white; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); }
  .connect-btn, .retry-btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 16px 24px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; margin-top: 8px; }
  .connect-btn:hover, .retry-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3); }
  .connect-btn:active, .retry-btn:active { transform: translateY(0); }
  .connect-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; box-shadow: none; }
  .footer { margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
  .footer p { color: #a0aec0; font-size: 12px; line-height: 1.4; }
  .error-message { padding: 20px; text-align: left; }
  .error-message h2 { margin-bottom: 12px; }
  .error-message p { margin-bottom: 16px; }
  .error-message ol { margin-left: 20px; margin-bottom: 20px; }
  .error-message li { margin-bottom: 8px; }
  @media (max-width: 480px) {
    .container { padding: 24px; margin: 10px; }
    .header h1 { font-size: 24px; }
    .header h2 { font-size: 18px; }
  }
</style>