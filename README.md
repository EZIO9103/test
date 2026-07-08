# Memory Core MVP

这是 Roche 插件格式，不是浏览器扩展。

## 安装

1. 把 `manifest.json` 和 `plugin.js` 上传到 GitHub 仓库根目录。
2. 修改 `manifest.json` 里的 `entry`，改成你自己的 `plugin.js` Raw 链接。
3. 在 Roche 插件安装处填写 `manifest.json` 的 Raw 链接。

示例：

```txt
https://raw.githubusercontent.com/你的用户名/你的仓库/main/manifest.json
```

## 测试

默认注入测试记忆：

```txt
Ranni今天设定的测试暗号是 BLUE-CAT-778。
```

安装后打开插件面板，确认“注入：开 / 测试记忆：开”。
然后找一个测试角色发：

```txt
我今天的测试暗号是什么？
```

再用中转站抓 Roche input，搜索：

```txt
ROCHE_MEMORY_CORE_MVP_INJECTED
插件自建记忆
BLUE-CAT-778
```

如果模型答不出暗号，在插件面板把注入方式从 `system：插在最后一个 system 后` 改成 `user：拼到最新 user 消息前` 再测试。

## 说明

这个版本只测试：插件自建记忆能否通过前端请求拦截注入 Roche input。
暂时不做自动总结、线下、向量、tag、时间适配。
