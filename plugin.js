;(() => {
  "use strict";

  const PLUGIN_ID = "roche-memory-core-install-test";
  const APP_ID = "roche-memory-core-install-test-home";
  const VERSION = "0.1.1";

  const DEFAULT_SETTINGS = {
    testMemory: "[私] [来源=MemoryCore测试] Ranni今天设定的测试暗号是 BLUE-CAT-778。"
  };

  function escapeHtml(text) {
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function getSettings(roche) {
    return (await roche.storage.get("settings")) || DEFAULT_SETTINGS;
  }

  async function setSettings(roche, settings) {
    await roche.storage.set("settings", { ...DEFAULT_SETTINGS, ...(settings || {}) });
  }

  async function render(container, roche) {
    const settings = await getSettings(roche);
    container.innerHTML = `
      <style>
        .rmc-test-root { height:100%; overflow:auto; padding:16px; box-sizing:border-box; font-family:inherit; color:inherit; }
        .rmc-test-card { border:1px solid rgba(127,127,127,.25); border-radius:14px; padding:12px; margin:12px 0; background:rgba(127,127,127,.08); }
        .rmc-test-row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:8px 0; }
        .rmc-test-root button, .rmc-test-root textarea { font:inherit; color:inherit; border-radius:10px; border:1px solid rgba(127,127,127,.3); background:rgba(127,127,127,.10); padding:8px; }
        .rmc-test-root textarea { width:100%; min-height:110px; box-sizing:border-box; line-height:1.5; }
        .rmc-test-muted { opacity:.72; font-size:12px; line-height:1.45; }
        .rmc-test-title { font-size:18px; font-weight:700; margin-bottom:6px; }
      </style>
      <div class="rmc-test-root">
        <div class="rmc-test-row">
          <div class="rmc-test-title">Memory Core 安装测试</div>
          <button data-action="close">返回</button>
        </div>
        <div class="rmc-test-muted">v${escapeHtml(VERSION)}。这个版本不拦截 Roche input，只用公开 API，专门确认插件安装与 roche.storage / roche.ai.chat 是否可用。</div>
        <div class="rmc-test-card">
          <b>测试记忆文本</b>
          <textarea id="rmc-test-memory">${escapeHtml(settings.testMemory)}</textarea>
          <div class="rmc-test-row">
            <button data-action="save">保存到插件私有 storage</button>
            <button data-action="chat-test">调用 roche.ai.chat 测试</button>
            <button data-action="copy">复制测试提问</button>
          </div>
          <div class="rmc-test-muted">测试提问：我今天的测试暗号是什么？</div>
        </div>
        <div class="rmc-test-card">
          <b>输出</b>
          <pre id="rmc-test-output" class="rmc-test-muted" style="white-space:pre-wrap;word-break:break-word;"></pre>
        </div>
      </div>
    `;

    const output = container.querySelector("#rmc-test-output");
    const writeOutput = (text) => { output.textContent = text || ""; };

    container.onclick = async (event) => {
      const action = event.target?.dataset?.action;
      if (!action) return;
      try {
        if (action === "close") {
          roche.ui.closeApp();
          return;
        }
        if (action === "save") {
          const text = container.querySelector("#rmc-test-memory").value.trim();
          await setSettings(roche, { testMemory: text });
          roche.ui.toast("已保存。插件 storage 正常。");
          writeOutput("已保存到 roche.storage：\n" + text);
          return;
        }
        if (action === "copy") {
          await navigator.clipboard.writeText("我今天的测试暗号是什么？");
          roche.ui.toast("已复制。");
          return;
        }
        if (action === "chat-test") {
          const text = container.querySelector("#rmc-test-memory").value.trim();
          writeOutput("正在调用 roche.ai.chat...");
          const result = await roche.ai.chat({
            messages: [
              { role: "system", content: "以下是插件提供的测试记忆：\n" + text },
              { role: "user", content: "我今天的测试暗号是什么？" }
            ],
            temperature: 0.2
          });
          writeOutput(result?.text || JSON.stringify(result, null, 2));
          return;
        }
      } catch (err) {
        writeOutput("操作失败：" + (err?.message || String(err)));
      }
    };
  }

  if (!window.RochePlugin || !window.RochePlugin.register) {
    console.error("[Memory Core Install Test] window.RochePlugin.register not found");
    return;
  }

  window.RochePlugin.register({
    id: PLUGIN_ID,
    name: "Memory Core 安装测试",
    version: VERSION,
    apps: [
      {
        id: APP_ID,
        name: "Memory Core 安装测试",
        icon: "extension",
        iconImage: "",
        async mount(container, roche) {
          await render(container, roche);
        },
        async unmount(container) {
          container.replaceChildren();
        }
      }
    ]
  });
})();
