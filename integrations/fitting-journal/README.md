# OOTRIP 两模块交接包

请先阅读 [交接说明](HANDOFF.md)。接手AI必须先阅读 [AGENTS.md](AGENTS.md) 和 [模块映射](MODULE-MAP.md)。

这是可独立启动的HTML手机页面模块源代码包，包含必要后端与测试源码。不是整个小程序，也不是双击HTML即可运行的纯静态网页。

Node 24.x、npm 11.x，在本文件目录打开PowerShell，逐行执行：

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd ci --prefix tools/lucy-realtime --ignore-scripts --no-audit --no-fund
Copy-Item .env.example .env
notepad .env
npm.cmd run demo:html
```

打开 http://127.0.0.1:3100 和 http://127.0.0.1:3100/journal 。已有.env时不要覆盖。无密钥可查看界面、预览摄像头、制作本机手账；真实AI需要各自服务端密钥和有效额度。打开页面不自动调用。

本包保留当前批次已用7/10次的脱敏占位记录，不带任何用户图片、密钥或浏览器数据。
