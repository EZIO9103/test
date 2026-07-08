# 记忆低Token清理器 3.5.1 input 注入测试版

这是在原 Roche 记忆低 Token 清理器基础上加的实验版。

新增功能：

- 在“设置 → 实验：主聊天 input 注入测试”里开启实验注入。
- 插件会尝试拦截 Roche 主聊天发出的 OpenAI 风格 `messages` 请求。
- 向请求中插入一条测试记忆：`Ranni今天设定的测试暗号是 BLUE-CAT-778。`
- 注入内容带标记：`ROCHE_MEMORY_CORE_MVP_INJECTED`，方便用中转站抓 input 搜索。

## GitHub 结构

```txt
你的仓库/
  manifest.json
  plugin.js
```

## 安装

Roche 里填 manifest.json 的 Raw 链接，例如：

```txt
https://raw.githubusercontent.com/你的用户名/你的仓库/main/manifest.json
```

`manifest.json` 里的 `entry` 必须改成你仓库里的 `plugin.js` Raw 链接。

## 测试步骤

1. 安装插件。
2. 打开插件 App。
3. 进入“设置 → 实验：主聊天 input 注入测试”。
4. 开启“启用实验注入”。
5. 保持“注入测试记忆”开启。
6. 保存设置。
7. 回到测试角色聊天，问：`我今天的测试暗号是什么？`
8. 用中转站抓 input，搜索：
   - `ROCHE_MEMORY_CORE_MVP_INJECTED`
   - `插件自建记忆`
   - `BLUE-CAT-778`

如果 system 注入模式角色读不到，切换成：

```txt
user：拼到最新 user 前
```

再测试一次。

## 注意

这是实验版，会猴子补丁 `fetch` 和 `XMLHttpRequest`。它不是 Roche 官方公开 hook，只用于验证“插件自建库能否注入主聊天 input”。

插件自己的 AI 清理请求已做 suppress，正常不会被测试记忆污染。
