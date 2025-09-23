<script lang="ts">
  const SCRIPT_EXEC =
    "https://script.google.com/macros/s/AKfycbxc6mTG8Qha3xx2OFg4g3oqf0c4ZM1qxljufYo0sZMU1VOSVva1t6zW9CeJzeC_qOEcQg/exec";

  let debugInfo = "";
  let showDebug = false;

  function addDebug(message: string) {
    debugInfo += message + "\n";
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    debugInfo = "";
    showDebug = true;

    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);

    const firstName = (fd.get("firstName") || "").toString();
    const lastName = (fd.get("lastName") || "").toString();
    const email = (fd.get("email") || "").toString();

    const current = new URL(window.location.href);
    const qp = new URLSearchParams(current.search);

    addDebug("=== DEBUG INFO ===");
    addDebug("Current URL: " + window.location.href);
    addDebug("\nOriginal Query Params:");
    for (const [key, value] of qp.entries()) {
      addDebug(`  ${key}: ${value}`);
    }

    const loginHost = qp.get("switchip") || qp.get("apip") || "login.serviceswifi.com";
    addDebug("\nLogin Host: " + loginHost);

    // Create clean parameters for Aruba
    const arubaParams = new URLSearchParams();
    
    const requiredParams = ["mac", "ip", "essid", "apname", "apmac", "vcname", "switchip", "apip"];
    requiredParams.forEach(param => {
      const value = qp.get(param);
      if (value) {
        arubaParams.set(param, value);
      }
    });

    // Add other params but exclude our custom ones
    for (const [key, value] of qp.entries()) {
      if (!requiredParams.includes(key) && !["fn", "firstName", "lastName", "email"].includes(key)) {
        arubaParams.set(key, value);
      }
    }

    addDebug("\nAruba Parameters being sent:");
    for (const [key, value] of arubaParams.entries()) {
      addDebug(`  ${key}: ${value}`);
    }

    try {
      // Log to Google Sheets
      if (SCRIPT_EXEC) {
        const logUrl = new URL(SCRIPT_EXEC);
        logUrl.searchParams.set("fn", "log");
        
        ["mac", "ip", "essid", "apname", "apmac", "vcname"].forEach((k) => {
          const v = qp.get(k);
          if (v) logUrl.searchParams.set(k, v);
        });
        
        if (firstName) logUrl.searchParams.set("firstName", firstName);
        if (lastName) logUrl.searchParams.set("lastName", lastName);
        if (email) logUrl.searchParams.set("email", email);

        fetch(logUrl.toString(), { 
          method: 'GET',
          mode: 'no-cors'
        }).catch((err: Error) => {
          addDebug("\nLogging failed (but continuing): " + err.message);
        });
      }

      const finalLogin = `http://${loginHost}/cgi-bin/login?${arubaParams.toString()}`;
      
      addDebug("\nFinal Login URL: " + finalLogin);
      addDebug("=== END DEBUG ===");
      
      // Force update the display
      showDebug = true;
      
      // Redirect after showing debug info
      setTimeout(() => {
        window.location.replace(finalLogin);
      }, 5000); // 5 second delay

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addDebug("\nError: " + errorMessage);
    }
  }

  function showCurrentParams() {
    debugInfo = "";
    const current = new URL(window.location.href);
    const qp = new URLSearchParams(current.search);
    
    addDebug("=== CURRENT PARAMS DEBUG ===");
    addDebug("Full URL: " + window.location.href);
    for (const [key, value] of qp.entries()) {
      addDebug(`${key}: ${value}`);
    }
    addDebug("=== END CURRENT PARAMS ===");
    showDebug = true;
  }
</script>

<main>
  <h2>Guest Wi-Fi (Debug Mode)</h2>
  <p>Enter your details to connect</p>

  <button type="button" on:click={showCurrentParams}>
    Show Current URL Parameters
  </button>

  <form on:submit={handleSubmit}>
    <input name="firstName" placeholder="First Name" required />
    <input name="lastName" placeholder="Last Name" />
    <input name="email" type="email" placeholder="Email" required />
    <button type="submit">Connect (with 5s delay)</button>
  </form>

  {#if showDebug}
    <div class="debug-output">
      <h3>Debug Information:</h3>
      <pre>{debugInfo}</pre>
      <button on:click={() => showDebug = false}>Hide Debug</button>
    </div>
  {/if}

  <div class="debug-info">
    <h3>Expected Aruba Parameters:</h3>
    <ul>
      <li><strong>mac</strong> - Device MAC address</li>
      <li><strong>ip</strong> - Client IP address</li>
      <li><strong>essid</strong> - WiFi network name</li>
      <li><strong>switchip</strong> - Controller IP</li>
      <li><strong>url</strong> - Success redirect URL (optional)</li>
    </ul>
    
    <h3>Troubleshooting:</h3>
    <p>If you see "Unavailable GET method for current opcode" it means:</p>
    <ul>
      <li>Missing required parameters (mac, ip, essid)</li>
      <li>Wrong login endpoint</li>
      <li>Parameters are corrupted</li>
    </ul>
  </div>
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
  .debug-info {
    margin-top: 20px;
    padding: 15px;
    background: #f5f5f5;
    border-radius: 6px;
    text-align: left;
  }
  .debug-info h3 {
    margin-top: 0;
  }
  .debug-info ul {
    margin: 10px 0;
    padding-left: 20px;
  }
  .debug-output {
    margin-top: 20px;
    padding: 15px;
    background: #e8f4fd;
    border: 1px solid #b3d9ff;
    border-radius: 6px;
    text-align: left;
  }
  .debug-output pre {
    background: white;
    padding: 10px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 12px;
    white-space: pre-wrap;
  }
  .debug-output h3 {
    margin-top: 0;
    color: #0066cc;
  }
</style>