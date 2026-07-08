;(() => {
  "use strict";

  const PLUGIN_ID = "roche-memory-core-online-mvp";
  const APP_ID = "roche-memory-core-online-mvp-home";
  const VERSION = "0.1.0";
  const MARKER = "ROCHE_MEMORY_CORE_MVP_INJECTED";

  const SETTINGS_KEY = `${PLUGIN_ID}:settings`;
  const STORE_KEY = `${PLUGIN_ID}:store`;
  const STATS_KEY = `${PLUGIN_ID}:stats`;

  const DEFAULT_SETTINGS = {
    enabled: true,
    injectTestMemory: true,
    injectionMode: "system_after_last_system", // system_after_last_system | user_prefix
    factLimit: 5,
    coreLimit: 2,
    testMemory: "[私] [来源=MemoryCore测试] Ranni今天设定的测试暗号是 BLUE-CAT-778。",
    title: "插件自建记忆"
  };

  const DEFAULT_STORE = {
    facts: [],
    core: []
  };

  const DEFAULT_STATS = {
    interceptCount: 0,
    injectCount: 0,
    lastUrl: "",
    lastMode: "",
    lastAt: "",
    lastError: "",
    lastBlock: ""
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function safeJsonParse(text, fallback = null) {
    try { return JSON.parse(text); } catch (_) { return fallback; }
  }

  function loadLocal(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return structuredCloneSafe(fallback);
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return { ...structuredCloneSafe(fallback), ...parsed };
      return structuredCloneSafe(fallback);
    } catch (_) {
      return structuredCloneSafe(fallback);
    }
  }

  function saveLocal(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function structuredCloneSafe(value) {
    try { return structuredClone(value); } catch (_) { return JSON.parse(JSON.stringify(value)); }
  }

  function loadSettings() {
    return loadLocal(SETTINGS_KEY, DEFAULT_SETTINGS);
  }

  function saveSettings(settings) {
    saveLocal(SETTINGS_KEY, { ...DEFAULT_SETTINGS, ...(settings || {}) });
  }

  function loadStore() {
    const store = loadLocal(STORE_KEY, DEFAULT_STORE);
    return {
      facts: Array.isArray(store.facts) ? store.facts : [],
      core: Array.isArray(store.core) ? store.core : []
    };
  }

  function saveStore(store) {
    saveLocal(STORE_KEY, {
      facts: Array.isArray(store?.facts) ? store.facts : [],
      core: Array.isArray(store?.core) ? store.core : []
    });
  }

  function loadStats() {
    return loadLocal(STATS_KEY, DEFAULT_STATS);
  }

  function saveStats(stats) {
    saveLocal(STATS_KEY, { ...DEFAULT_STATS, ...(stats || {}) });
  }

  function updateStats(patch) {
    const stats = loadStats();
    saveStats({ ...stats, ...(patch || {}) });
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function uniqueId(prefix = "mem") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeText(text, max = 3000) {
    return String(text || "").replace(/\r/g, "").trim().slice(0, max);
  }

  function sortByCreatedDesc(items) {
    return [...(items || [])].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }

  function renderMemoryBlock() {
    const settings = loadSettings();
    if (!settings.enabled) return "";

    const store = loadStore();
    const lines = [];

    const title = normalizeText(settings.title || "插件自建记忆", 40) || "插件自建记忆";
    lines.push(`【${title}】`);
    lines.push(`[系统标记=${MARKER}]`);

    if (settings.injectTestMemory) {
      const test = normalizeText(settings.testMemory, 1000);
      if (test) lines.push(test);
    }

    const coreItems = sortByCreatedDesc(store.core).slice(0, Math.max(0, Number(settings.coreLimit) || 0));
    if (coreItems.length) {
      lines.push("【核心记忆】");
      for (const item of coreItems) {
        const text = normalizeText(item.text, 1000);
        if (!text) continue;
        const source = normalizeText(item.source || "MemoryCore", 80);
        lines.push(`[私] [来源=${source}] ${text}`);
      }
    }

    const factItems = sortByCreatedDesc(store.facts).slice(0, Math.max(0, Number(settings.factLimit) || 0));
    if (factItems.length) {
      lines.push("【最新事实记忆】");
      for (const item of factItems) {
        const text = normalizeText(item.text, 1000);
        if (!text) continue;
        const source = normalizeText(item.source || "MemoryCore", 80);
        const time = normalizeText(item.time || item.createdAt || "", 80);
        const timePart = time ? `时间=${time} | ` : "";
        lines.push(`[私] [${timePart}来源=${source}] ${text}`);
      }
    }

    const block = lines.join("\n").trim();
    // 如果只有标题和 marker，但没有测试/核心/事实，就不注入。
    if (!settings.injectTestMemory && !coreItems.length && !factItems.length) return "";
    return block;
  }

  function messageContentToText(content) {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map(part => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      }).filter(Boolean).join("\n");
    }
    return String(content || "");
  }

  function messagesAlreadyInjected(messages) {
    return (messages || []).some(m => messageContentToText(m?.content).includes(MARKER));
  }

  function prefixContent(content, prefix) {
    if (typeof content === "string") return `${prefix}\n\n【当前用户消息】\n${content}`;
    if (Array.isArray(content)) {
      const next = [...content];
      const firstTextIndex = next.findIndex(part => part && typeof part === "object" && typeof part.text === "string");
      if (firstTextIndex >= 0) {
        next[firstTextIndex] = { ...next[firstTextIndex], text: `${prefix}\n\n【当前用户消息】\n${next[firstTextIndex].text}` };
      } else {
        next.unshift({ type: "text", text: prefix });
      }
      return next;
    }
    return `${prefix}\n\n【当前用户消息】\n${String(content || "")}`;
  }

  function injectIntoMessages(messages, block, mode) {
    if (!Array.isArray(messages) || !block) return { changed: false, messages };
    if (messagesAlreadyInjected(messages)) return { changed: false, messages };

    const next = messages.map(m => ({ ...m }));

    if (mode === "user_prefix") {
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i]?.role === "user") {
          next[i] = { ...next[i], content: prefixContent(next[i].content, block) };
          return { changed: true, messages: next };
        }
      }
      next.push({ role: "user", content: block });
      return { changed: true, messages: next };
    }

    // 默认：插到最后一个 system 后面。如果没有 system，就插在最前面。
    let lastSystemIndex = -1;
    for (let i = 0; i < next.length; i++) {
      if (next[i]?.role === "system") lastSystemIndex = i;
    }
    const memoryMsg = { role: "system", content: block };
    next.splice(lastSystemIndex + 1, 0, memoryMsg);
    return { changed: true, messages: next };
  }

  function looksLikeChatRequest(url, json) {
    if (!json || typeof json !== "object") return false;
    if (!Array.isArray(json.messages)) return false;
    const u = String(url || "").toLowerCase();
    if (/chat\/completions|\/responses|completion|generate/.test(u)) return true;
    // Roche/中转站路径不稳定，兜底：只要是 OpenAI messages 结构就尝试注入。
    return json.messages.some(m => m && (m.role === "system" || m.role === "user" || m.role === "assistant"));
  }

  function shouldBypass(headers, json) {
    try {
      if (json?.metadata?.rocheMemoryCoreBypass) return true;
      if (json?.rocheMemoryCoreBypass) return true;
      if (!headers) return false;
      if (typeof headers.get === "function") {
        return String(headers.get("x-roche-memory-core-bypass") || "").toLowerCase() === "true";
      }
      if (Array.isArray(headers)) {
        return headers.some(([k, v]) => String(k).toLowerCase() === "x-roche-memory-core-bypass" && String(v).toLowerCase() === "true");
      }
      if (typeof headers === "object") {
        return Object.entries(headers).some(([k, v]) => String(k).toLowerCase() === "x-roche-memory-core-bypass" && String(v).toLowerCase() === "true");
      }
    } catch (_) {}
    return false;
  }

  function mutateBodyText(bodyText, url, headers, transport) {
    const settings = loadSettings();
    if (!settings.enabled) return { changed: false, bodyText };
    if (typeof bodyText !== "string") return { changed: false, bodyText };
    const trimmed = bodyText.trim();
    if (!trimmed || !trimmed.startsWith("{")) return { changed: false, bodyText };

    const json = safeJsonParse(trimmed, null);
    if (!looksLikeChatRequest(url, json)) return { changed: false, bodyText };
    if (shouldBypass(headers, json)) return { changed: false, bodyText };

    const block = renderMemoryBlock();
    if (!block) return { changed: false, bodyText };

    const injected = injectIntoMessages(json.messages, block, settings.injectionMode);
    if (!injected.changed) return { changed: false, bodyText };

    json.messages = injected.messages;

    const stats = loadStats();
    saveStats({
      ...stats,
      interceptCount: Number(stats.interceptCount || 0) + 1,
      injectCount: Number(stats.injectCount || 0) + 1,
      lastUrl: String(url || ""),
      lastMode: settings.injectionMode,
      lastAt: nowIso(),
      lastError: "",
      lastBlock: block.slice(0, 4000),
      lastTransport: transport || "unknown"
    });

    return { changed: true, bodyText: JSON.stringify(json) };
  }

  function patchFetchOnce() {
    if (window.__ROCHE_MEMORY_CORE_MVP_FETCH_PATCHED__) return;
    window.__ROCHE_MEMORY_CORE_MVP_FETCH_PATCHED__ = true;

    const originalFetch = window.fetch;
    if (typeof originalFetch !== "function") return;

    window.fetch = async function patchedFetch(input, init) {
      try {
        const url = typeof input === "string" ? input : (input && input.url) || "";
        const headers = init?.headers || (input && input.headers) || null;

        if (init && typeof init.body === "string") {
          const changed = mutateBodyText(init.body, url, headers, "fetch:init");
          if (changed.changed) {
            return originalFetch.call(this, input, { ...init, body: changed.bodyText });
          }
        } else if (input instanceof Request && !init?.body) {
          const method = String(input.method || "GET").toUpperCase();
          if (method !== "GET" && method !== "HEAD") {
            const clone = input.clone();
            const text = await clone.text();
            const changed = mutateBodyText(text, url, headers, "fetch:request");
            if (changed.changed) {
              const newRequest = new Request(input, { body: changed.bodyText });
              return originalFetch.call(this, newRequest, init);
            }
          }
        }
      } catch (err) {
        const stats = loadStats();
        saveStats({ ...stats, lastError: String(err?.message || err), lastAt: nowIso() });
      }
      return originalFetch.apply(this, arguments);
    };
  }

  function patchXhrOnce() {
    if (window.__ROCHE_MEMORY_CORE_MVP_XHR_PATCHED__) return;
    window.__ROCHE_MEMORY_CORE_MVP_XHR_PATCHED__ = true;

    const proto = XMLHttpRequest?.prototype;
    if (!proto) return;

    const originalOpen = proto.open;
    const originalSend = proto.send;
    const originalSetHeader = proto.setRequestHeader;

    proto.open = function patchedOpen(method, url) {
      this.__rmc_mvp_method = method;
      this.__rmc_mvp_url = url;
      this.__rmc_mvp_headers = {};
      return originalOpen.apply(this, arguments);
    };

    proto.setRequestHeader = function patchedSetRequestHeader(name, value) {
      try {
        this.__rmc_mvp_headers = this.__rmc_mvp_headers || {};
        this.__rmc_mvp_headers[String(name || "").toLowerCase()] = String(value || "");
      } catch (_) {}
      return originalSetHeader.apply(this, arguments);
    };

    proto.send = function patchedSend(body) {
      try {
        if (typeof body === "string") {
          const changed = mutateBodyText(body, this.__rmc_mvp_url || "", this.__rmc_mvp_headers || null, "xhr");
          if (changed.changed) return originalSend.call(this, changed.bodyText);
        }
      } catch (err) {
        const stats = loadStats();
        saveStats({ ...stats, lastError: String(err?.message || err), lastAt: nowIso() });
      }
      return originalSend.apply(this, arguments);
    };
  }

  function installInterceptor() {
    patchFetchOnce();
    patchXhrOnce();
    window.__RocheMemoryCoreMVP = {
      version: VERSION,
      marker: MARKER,
      renderMemoryBlock,
      loadSettings,
      saveSettings,
      loadStore,
      saveStore,
      loadStats,
      clear() {
        localStorage.removeItem(STORE_KEY);
        localStorage.removeItem(STATS_KEY);
      }
    };
  }

  installInterceptor();

  function createStyle() {
    const style = document.createElement("style");
    style.dataset.rochePlugin = PLUGIN_ID;
    style.textContent = `
      .rmc-mvp-root { height:100%; overflow:auto; padding:14px; font-family:inherit; color:inherit; background:var(--background, transparent); }
      .rmc-mvp-top { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
      .rmc-mvp-title { font-size:18px; font-weight:700; flex:1; }
      .rmc-mvp-card { border:1px solid rgba(127,127,127,.22); border-radius:14px; padding:12px; margin:10px 0; background:rgba(127,127,127,.08); }
      .rmc-mvp-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin:8px 0; }
      .rmc-mvp-root button, .rmc-mvp-root select, .rmc-mvp-root input, .rmc-mvp-root textarea { font:inherit; border-radius:10px; border:1px solid rgba(127,127,127,.3); padding:8px; background:rgba(127,127,127,.10); color:inherit; }
      .rmc-mvp-root button { cursor:pointer; }
      .rmc-mvp-root textarea { width:100%; min-height:110px; resize:vertical; line-height:1.5; }
      .rmc-mvp-root input[type=number] { width:90px; }
      .rmc-mvp-muted { opacity:.72; font-size:12px; line-height:1.45; }
      .rmc-mvp-log { white-space:pre-wrap; word-break:break-word; max-height:180px; overflow:auto; font-size:12px; padding:9px; border-radius:10px; background:rgba(0,0,0,.10); }
      .rmc-mvp-pill { display:inline-flex; align-items:center; border-radius:999px; padding:3px 8px; font-size:12px; background:rgba(127,127,127,.14); border:1px solid rgba(127,127,127,.22); }
      .rmc-mvp-danger { background:rgba(255,80,80,.12) !important; }
      .rmc-mvp-primary { background:rgba(80,160,255,.16) !important; }
      .rmc-mvp-bottom { height:80px; }
    `;
    return style;
  }

  function readTextarea(root, selector) {
    return normalizeText(root.querySelector(selector)?.value || "", 20000);
  }

  function renderApp(root, roche) {
    const settings = loadSettings();
    const store = loadStore();
    const stats = loadStats();
    const enabledText = settings.enabled ? "开" : "关";
    const testText = settings.injectTestMemory ? "开" : "关";

    root.innerHTML = `
      <div class="rmc-mvp-top">
        <div class="rmc-mvp-title">Memory Core MVP</div>
        <span class="rmc-mvp-pill">v${escapeHtml(VERSION)}</span>
        <button type="button" data-action="back">返回</button>
      </div>

      <div class="rmc-mvp-card">
        <b>状态</b>
        <div class="rmc-mvp-row">
          <span class="rmc-mvp-pill">注入：${escapeHtml(enabledText)}</span>
          <span class="rmc-mvp-pill">测试记忆：${escapeHtml(testText)}</span>
          <span class="rmc-mvp-pill">事实 ${store.facts.length}</span>
          <span class="rmc-mvp-pill">核心 ${store.core.length}</span>
          <span class="rmc-mvp-pill">已注入 ${Number(stats.injectCount || 0)} 次</span>
        </div>
        <div class="rmc-mvp-muted">这个版本只做线上请求拦截注入测试。先确认 Roche input 里能看到插件记忆，再接自动总结。</div>
      </div>

      <div class="rmc-mvp-card">
        <b>注入设置</b>
        <div class="rmc-mvp-row">
          <button type="button" data-action="toggle-enabled">注入：${escapeHtml(enabledText)}</button>
          <button type="button" data-action="toggle-test">测试记忆：${escapeHtml(testText)}</button>
        </div>
        <label class="rmc-mvp-muted">注入方式</label>
        <select id="rmc-mode">
          <option value="system_after_last_system" ${settings.injectionMode === "system_after_last_system" ? "selected" : ""}>system：插在最后一个 system 后</option>
          <option value="user_prefix" ${settings.injectionMode === "user_prefix" ? "selected" : ""}>user：拼到最新 user 消息前</option>
        </select>
        <div class="rmc-mvp-row">
          <label>事实上限 <input id="rmc-fact-limit" type="number" min="0" max="50" value="${Number(settings.factLimit || 0)}"></label>
          <label>核心上限 <input id="rmc-core-limit" type="number" min="0" max="20" value="${Number(settings.coreLimit || 0)}"></label>
        </div>
        <label class="rmc-mvp-muted">记忆块标题</label>
        <input id="rmc-title" style="width:100%" value="${escapeHtml(settings.title || "插件自建记忆")}">
        <label class="rmc-mvp-muted">测试记忆</label>
        <textarea id="rmc-test-memory">${escapeHtml(settings.testMemory || "")}</textarea>
        <div class="rmc-mvp-row">
          <button type="button" class="rmc-mvp-primary" data-action="save-settings">保存设置</button>
          <button type="button" data-action="preview-block">预览注入块</button>
        </div>
      </div>

      <div class="rmc-mvp-card">
        <b>手动添加一条测试事实</b>
        <div class="rmc-mvp-muted">用于不用总结 API 的情况下，测试自建库 → Roche input 注入。</div>
        <textarea id="rmc-new-fact" placeholder="例如：Ranni告诉Sebastian，她把备用钥匙放在门口黑色鞋柜第二层。"></textarea>
        <div class="rmc-mvp-row">
          <button type="button" data-action="add-fact">添加到事实记忆</button>
          <button type="button" data-action="add-core">添加到核心记忆</button>
        </div>
      </div>

      <div class="rmc-mvp-card">
        <b>最近一次注入</b>
        <div class="rmc-mvp-log">${escapeHtml([
          `lastAt: ${stats.lastAt || "-"}`,
          `lastMode: ${stats.lastMode || "-"}`,
          `lastTransport: ${stats.lastTransport || "-"}`,
          `lastUrl: ${stats.lastUrl || "-"}`,
          stats.lastError ? `lastError: ${stats.lastError}` : "",
          "",
          stats.lastBlock || "暂无注入记录。"
        ].filter(Boolean).join("\n"))}</div>
        <div class="rmc-mvp-row">
          <button type="button" data-action="refresh">刷新状态</button>
          <button type="button" data-action="copy-question">复制测试提问</button>
        </div>
      </div>

      <div class="rmc-mvp-card">
        <b>维护</b>
        <div class="rmc-mvp-row">
          <button type="button" data-action="export-store">导出插件记忆库</button>
          <button type="button" class="rmc-mvp-danger" data-action="clear-store">清空插件记忆库</button>
          <button type="button" class="rmc-mvp-danger" data-action="clear-stats">清空注入记录</button>
        </div>
      </div>

      <div class="rmc-mvp-bottom"></div>
    `;

    root.onclick = async (ev) => {
      const btn = ev.target.closest("button[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      const settings = loadSettings();
      const store = loadStore();

      try {
        if (action === "back") return roche?.ui?.closeApp ? roche.ui.closeApp() : undefined;

        if (action === "toggle-enabled") {
          saveSettings({ ...settings, enabled: !settings.enabled });
          renderApp(root, roche);
          return;
        }

        if (action === "toggle-test") {
          saveSettings({ ...settings, injectTestMemory: !settings.injectTestMemory });
          renderApp(root, roche);
          return;
        }

        if (action === "save-settings") {
          const next = {
            ...settings,
            injectionMode: root.querySelector("#rmc-mode")?.value || "system_after_last_system",
            factLimit: Math.max(0, Number(root.querySelector("#rmc-fact-limit")?.value || 0)),
            coreLimit: Math.max(0, Number(root.querySelector("#rmc-core-limit")?.value || 0)),
            title: normalizeText(root.querySelector("#rmc-title")?.value || "插件自建记忆", 80),
            testMemory: readTextarea(root, "#rmc-test-memory")
          };
          saveSettings(next);
          roche?.ui?.toast?.("已保存设置。");
          renderApp(root, roche);
          return;
        }

        if (action === "preview-block") {
          const next = {
            ...settings,
            injectionMode: root.querySelector("#rmc-mode")?.value || settings.injectionMode,
            factLimit: Math.max(0, Number(root.querySelector("#rmc-fact-limit")?.value || settings.factLimit)),
            coreLimit: Math.max(0, Number(root.querySelector("#rmc-core-limit")?.value || settings.coreLimit)),
            title: normalizeText(root.querySelector("#rmc-title")?.value || settings.title, 80),
            testMemory: readTextarea(root, "#rmc-test-memory")
          };
          saveSettings(next);
          const block = renderMemoryBlock();
          await navigator.clipboard?.writeText?.(block);
          roche?.ui?.toast?.("已复制当前注入块预览。");
          renderApp(root, roche);
          return;
        }

        if (action === "add-fact" || action === "add-core") {
          const text = readTextarea(root, "#rmc-new-fact");
          if (!text) return roche?.ui?.toast?.("先写一条记忆。");
          const item = {
            id: uniqueId(action === "add-core" ? "core" : "fact"),
            text,
            source: "MemoryCore手动测试",
            time: nowIso().replace("T", " ").slice(0, 16) + " UTC",
            createdAt: nowIso()
          };
          if (action === "add-core") store.core.unshift(item);
          else store.facts.unshift(item);
          saveStore(store);
          roche?.ui?.toast?.("已添加。发一条消息后检查 input 是否被注入。");
          renderApp(root, roche);
          return;
        }

        if (action === "refresh") {
          renderApp(root, roche);
          return;
        }

        if (action === "copy-question") {
          await navigator.clipboard?.writeText?.("我今天的测试暗号是什么？");
          roche?.ui?.toast?.("已复制测试提问。");
          return;
        }

        if (action === "export-store") {
          const payload = JSON.stringify({ settings: loadSettings(), store: loadStore(), stats: loadStats() }, null, 2);
          await navigator.clipboard?.writeText?.(payload);
          roche?.ui?.toast?.("已复制到剪贴板。");
          return;
        }

        if (action === "clear-store") {
          const ok = roche?.ui?.confirm ? await roche.ui.confirm({ title: "清空插件记忆库？", content: "只清空本插件 localStorage，不影响 Roche 原生记忆。" }) : confirm("清空插件记忆库？");
          if (!ok) return;
          saveStore(DEFAULT_STORE);
          roche?.ui?.toast?.("已清空插件记忆库。");
          renderApp(root, roche);
          return;
        }

        if (action === "clear-stats") {
          saveStats(DEFAULT_STATS);
          roche?.ui?.toast?.("已清空注入记录。");
          renderApp(root, roche);
          return;
        }
      } catch (err) {
        roche?.ui?.toast?.("操作失败：" + (err?.message || err));
      }
    };
  }

  if (window.RochePlugin?.register) {
    window.RochePlugin.register({
      id: PLUGIN_ID,
      name: "Memory Core MVP",
      version: VERSION,
      apps: [{
        id: APP_ID,
        name: "Memory Core MVP",
        icon: "brain",
        async mount(container, roche) {
          installInterceptor();
          const style = createStyle();
          document.head.appendChild(style);

          const previous = {
            overflow: container.style.overflow,
            height: container.style.height,
            minHeight: container.style.minHeight,
            position: container.style.position
          };
          container.style.position = "relative";
          container.style.overflow = "hidden";
          container.style.height = "100dvh";
          container.style.minHeight = "0";

          const root = document.createElement("div");
          root.className = "rmc-mvp-root";
          container.replaceChildren(root);
          renderApp(root, roche);

          container.__rmcMvpUnmount = () => {
            try { style.remove(); } catch (_) {}
            container.style.overflow = previous.overflow;
            container.style.height = previous.height;
            container.style.minHeight = previous.minHeight;
            container.style.position = previous.position;
          };
        },
        async unmount(container) {
          try { container.__rmcMvpUnmount?.(); } catch (_) {}
        }
      }]
    });
  } else {
    console.warn("[MemoryCoreMVP] window.RochePlugin.register not found, interceptor still installed.");
  }
})();
