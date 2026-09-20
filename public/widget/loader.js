/**
 * ReplyPilot embeddable widget loader.
 *
 *   <script src="https://app.replypilot.example/widget/loader.js"
 *           data-agent="agt_publicId_xxx" async></script>
 *
 * Only the public agent id is embedded — no secrets. Visitor identity
 * is a signed token minted by the server (see
 * /api/public/visitor/init and src/lib/widget/visitor-token.ts), not a
 * client-chosen value, so one visitor cannot impersonate another's
 * conversation by guessing/forging an id.
 */
(function () {
  var currentScript = document.currentScript;
  var agentPublicId = currentScript && currentScript.getAttribute("data-agent");
  if (!agentPublicId) {
    console.error("[ReplyPilot] Missing data-agent attribute on widget script tag");
    return;
  }

  // Default to the script tag's own origin (where ReplyPilot is
  // deployed) rather than a hardcoded placeholder domain — the install
  // snippet then works unmodified on any deployment, and data-api-base
  // is only needed for the unusual case of serving the loader script
  // from a different origin than the API.
  var scriptUrl = currentScript.src ? new URL(currentScript.src, window.location.href) : null;
  var API_BASE = (
    currentScript.getAttribute("data-api-base") ||
    (scriptUrl ? scriptUrl.origin : window.location.origin)
  ).replace(/\/$/, "");
  var TOKEN_STORAGE_KEY = "replypilot_visitor_token_" + agentPublicId;

  var config = null;
  var visitorToken = null;
  var isOpen = false;
  var root, panel, messagesEl, inputEl, toggleBtn, statusRegion;

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    // Fallback for older browsers — not cryptographically strong, but
    // this is only a de-duplication key, not a security token.
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getStoredToken() {
    try {
      return window.localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function storeToken(token) {
    try {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch (e) {
      // localStorage unavailable (privacy mode, etc.) — widget still
      // works for this page view, just re-inits as a new visitor next
      // time.
    }
  }

  function ensureVisitorToken() {
    var existing = getStoredToken();
    if (existing) {
      visitorToken = existing;
      return Promise.resolve(existing);
    }
    return fetch(API_BASE + "/api/public/visitor/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentPublicId: agentPublicId }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("visitor init failed");
        return res.json();
      })
      .then(function (data) {
        visitorToken = data.token;
        storeToken(data.token);
        return data.token;
      });
  }

  function el(tag, props, children) {
    var e = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      if (k === "style") Object.assign(e.style, props[k]);
      else e.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (c) { e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }

  function injectStyles() {
    var style = document.createElement("style");
    style.textContent = [
      ".rp-widget-root{position:fixed;z-index:2147483000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}",
      ".rp-widget-root.bottom-right{right:20px;bottom:20px;}",
      ".rp-widget-root.bottom-left{left:20px;bottom:20px;}",
      ".rp-toggle-btn{border:none;border-radius:999px;padding:12px 18px;font-size:14px;font-weight:600;color:#fff;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.18);}",
      ".rp-toggle-btn:focus-visible{outline:2px solid #fff;outline-offset:2px;}",
      ".rp-panel{width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 100px);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.2);display:flex;flex-direction:column;overflow:hidden;position:absolute;bottom:64px;background:#fff;}",
      ".rp-panel.bottom-right{right:0;} .rp-panel.bottom-left{left:0;}",
      ".rp-panel.dark{background:#111827;color:#f3f4f6;}",
      ".rp-header{padding:14px 16px;color:#fff;display:flex;align-items:center;gap:8px;font-weight:600;}",
      ".rp-messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;}",
      ".rp-msg{max-width:80%;padding:8px 12px;border-radius:12px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-break:break-word;}",
      ".rp-msg.customer{align-self:flex-end;background:#6366F1;color:#fff;border-bottom-right-radius:2px;}",
      ".rp-msg.ai,.rp-msg.human,.rp-msg.system{align-self:flex-start;background:#f3f4f6;color:#111827;border-bottom-left-radius:2px;}",
      ".rp-panel.dark .rp-msg.ai,.rp-panel.dark .rp-msg.human,.rp-panel.dark .rp-msg.system{background:#1f2937;color:#f3f4f6;}",
      ".rp-typing{align-self:flex-start;font-size:12px;color:#9ca3af;padding:0 8px;}",
      ".rp-input-row{display:flex;gap:8px;padding:10px;border-top:1px solid #e5e7eb;}",
      ".rp-panel.dark .rp-input-row{border-top-color:#374151;}",
      ".rp-input{flex:1;border:1px solid #e5e7eb;border-radius:10px;padding:8px 10px;font-size:14px;outline:none;}",
      ".rp-input:focus-visible{outline:2px solid #6366F1;}",
      ".rp-send{border:none;border-radius:10px;padding:8px 12px;color:#fff;font-weight:600;cursor:pointer;}",
      ".rp-send:disabled{opacity:.5;cursor:not-allowed;}",
      ".rp-hidden{display:none !important;}",
      ".rp-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);}",
    ].join("\n");
    document.head.appendChild(style);
  }

  // Renders message text as plain text only (textContent, not innerHTML)
  // — AI output is never trusted as HTML, so this can't be an XSS
  // vector even if a prompt-injection attempt got a model to emit
  // markup. If markdown rendering is added later, it must go through a
  // sanitizer (e.g. DOMPurify) rather than raw innerHTML.
  function addMessage(role, text) {
    var msg = el("div", { class: "rp-msg " + role, role: "listitem" }, [text]);
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (statusRegion) statusRegion.textContent = (role === "customer" ? "You: " : "Support: ") + text;
  }

  function setTyping(on) {
    var existing = panel.querySelector(".rp-typing");
    if (on && !existing) {
      var t = el("div", { class: "rp-typing", "aria-hidden": "true" }, ["Typing…"]);
      messagesEl.appendChild(t);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } else if (!on && existing) {
      existing.remove();
    }
  }

  function fetchWithRetry(url, opts, retries) {
    return fetch(url, opts).catch(function (err) {
      if (retries > 0) {
        return new Promise(function (resolve) { setTimeout(resolve, 800); })
          .then(function () { return fetchWithRetry(url, opts, retries - 1); });
      }
      throw err;
    });
  }

  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text || !visitorToken) return;
    inputEl.value = "";
    inputEl.disabled = true;

    var clientMessageId = uuid(); // same id reused across retries below -> idempotent on the server
    addMessage("customer", text);
    setTyping(true);

    function attempt() {
      return fetchWithRetry(
        API_BASE + "/api/public/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentPublicId: agentPublicId,
            visitorToken: visitorToken,
            message: text,
            clientMessageId: clientMessageId,
          }),
        },
        2,
      );
    }

    attempt()
      .then(function (res) {
        if (res.status === 401) {
          // Token expired/invalid — re-init once and retry the send with
          // the SAME clientMessageId, so this can't double-post.
          return ensureVisitorToken().then(attempt);
        }
        return res;
      })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        setTyping(false);
        inputEl.disabled = false;
        inputEl.focus();
        if (data.reply) {
          addMessage("ai", data.reply);
        } else if (data.status === "HUMAN" || data.status === "WAITING_FOR_HUMAN") {
          addMessage("system", (config && config.humanHandoffMessage) || "Connecting you with a team member...");
        }
      })
      .catch(function () {
        setTyping(false);
        inputEl.disabled = false;
        addMessage("system", "Sorry, something went wrong. Please try again in a moment.");
      });
  }

  function render() {
    var position = (config && config.position) || "bottom-right";
    var color = (config && config.primaryColor) || "#6366F1";
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = (config && config.theme) || "auto";
    var isDark = theme === "dark" || (theme === "auto" && prefersDark);

    root = el("div", { class: "rp-widget-root " + position });

    toggleBtn = el(
      "button",
      { class: "rp-toggle-btn", style: { background: color }, "aria-expanded": "false", "aria-controls": "rp-panel" },
      [(config && config.chatButtonText) || "Chat with us"],
    );
    toggleBtn.addEventListener("click", function () {
      isOpen = !isOpen;
      panel.classList.toggle("rp-hidden", !isOpen);
      toggleBtn.setAttribute("aria-expanded", String(isOpen));
      if (isOpen) inputEl.focus();
    });

    panel = el("div", {
      id: "rp-panel",
      class: "rp-panel rp-hidden " + position + (isDark ? " dark" : ""),
      role: "dialog",
      "aria-label": ((config && config.agentName) || "Support") + " chat",
    });
    var header = el("div", { class: "rp-header", style: { background: color } }, [
      (config && config.agentName) || "Support",
    ]);
    messagesEl = el("div", { class: "rp-messages", role: "list", "aria-label": "Conversation" });
    statusRegion = el("div", { class: "rp-sr-only", role: "status", "aria-live": "polite" });

    if (config && config.welcomeMessage) addMessage("ai", config.welcomeMessage);

    inputEl = el("input", {
      class: "rp-input",
      type: "text",
      placeholder: "Type a message…",
      "aria-label": "Message",
    });
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") sendMessage();
      if (e.key === "Escape") toggleBtn.click();
    });
    var sendBtn = el("button", { class: "rp-send", style: { background: color }, type: "button" }, ["Send"]);
    sendBtn.addEventListener("click", sendMessage);
    var inputRow = el("div", { class: "rp-input-row" }, [inputEl, sendBtn]);

    panel.appendChild(header);
    panel.appendChild(messagesEl);
    panel.appendChild(statusRegion);
    panel.appendChild(inputRow);
    root.appendChild(panel);
    root.appendChild(toggleBtn);
    document.body.appendChild(root);
  }

  function init() {
    injectStyles();
    Promise.all([
      ensureVisitorToken(),
      fetch(API_BASE + "/api/public/widget/" + encodeURIComponent(agentPublicId)).then(function (res) {
        if (!res.ok) throw new Error("widget config fetch failed");
        return res.json();
      }),
    ])
      .then(function (results) {
        config = results[1];
        render();
      })
      .catch(function () {
        console.error("[ReplyPilot] Failed to initialize widget");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
