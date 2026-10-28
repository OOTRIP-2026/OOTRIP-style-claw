\# OOTRIP · 穿搭出行规划



OOTRIP 是面向移动端的穿搭出行演示项目，包含出行问卷、数字衣橱、穿搭组合、实时 AI 试衣与穿搭手账。



\## 功能



| 模块 | 功能 |

| --- | --- |

| 出行规划 | 填写年龄、风格、目的地与出行日期 |

| 数字衣橱 | 分类浏览、添加衣物、悬停查看衣物正面 |

| 穿搭组合 | 选择衣物、调整搭配画布、保存穿搭 |

| 穿搭聊天 | 穿搭对话演示及行程搭配联动 |

| 实时试衣 | 摄像头预览、选择衣物、AI 实时试穿 |

| 穿搭手账 | 上传照片、记录日期与心情、生成拼贴、保存记录 |

| 我的 | 穿搭档案、偏好设置及原手账记录 |



实时 AI 试衣和 AI 手账需要本地后端与服务端密钥。

未配置密钥时，可使用本机手账及摄像头预览等非 AI 功能。



\## 环境要求



\- Node.js 24.x

\- npm 11.x

\- 支持摄像头和 IndexedDB 的现代浏览器



\## 快速启动



\### Windows 一键启动



双击项目根目录中的：



```text

启动OOTRIP.cmd

```



首次启动会安装模块依赖，请保持网络畅通。

启动后保持服务窗口打开，在浏览器访问：



```text

http://127.0.0.1:3100/app/index.html

```



启动脚本会优先使用本机配置的 OOTRIP-tools Node 工具目录。



\### 命令行启动



在项目根目录依次执行：



```bash

npm ci --prefix integrations/fitting-journal --ignore-scripts --no-audit --no-fund

npm ci --prefix integrations/fitting-journal/tools/lucy-realtime --ignore-scripts --no-audit --no-fund

npm run build

npm start

```



\## 功能入口



\- 实时试衣：衣橱 → 试衣间

\- 照片手账：我的 → 穿搭手账

\- 原手账记录：我的 → 使用说明 → 查看原手账记录



\## AI 配置



根据根目录 `.env.example`，自行创建 `.env`：



\- `DECART\_API\_KEY`：实时试衣服务。

\- `DASHSCOPE\_API\_KEY`：百炼北京地域服务。

\- 免费额度确认及有效期：按服务商控制台实际情况填写。



配置后需要重启本地服务。



密钥只放在本机 `.env` 中，不要上传到 GitHub，也不要填写到前端代码中。

打开页面不会自动发起真实试衣或手账生成请求。



\## 目录结构



```text

.

├── src/                         # 网页源代码与素材

├── dist/                        # 构建输出与静态展示文件

├── integrations/

│   └── fitting-journal/         # 试衣、手账、后端与测试

├── docs/

│   └── 接入说明.md              # 模块接入及验证说明

├── .openai/                     # 原有静态托管配置

├── .env.example                 # 环境配置示例

├── .gitignore                   # Git 忽略规则

├── build.mjs                    # 将 src 同步到 dist

├── package.json                 # 项目命令

├── start-ootrip.ps1              # Windows 启动脚本

├── 启动OOTRIP.cmd               # Windows 双击启动入口

└── README.md

```



\## 开发与检查



修改页面时优先编辑 `src/`，完成后执行：



```bash

npm run build

```



类型检查及测试：



```bash

npm run check:modules

npm run test:modules

npm run test:realtime

```



自动测试不代表真实摄像头或 AI 效果已经验收，相关效果需要在浏览器中验证。



\## 数据保存



衣橱、手账和个人偏好保存在本机浏览器中，没有跨设备云同步。



建议固定使用 `http://127.0.0.1:3100`。

不同浏览器、端口或访问地址可能使用不同的数据空间。



\## GitHub Pages 与本地服务



GitHub Pages 用于静态界面展示，无法运行 Node 后端。

体验完整的试衣与手账功能，请下载项目并启动本地服务。



\## 团队协作



1\. 开始修改前先拉取最新代码。

2\. 建议在功能分支开发，通过 Pull Request 合入主分支。

3\. 修改源代码后同步构建 `dist/`。

4\. 提交相关源代码、测试与必要文档。

5\. 不提交 `.env`、`node\_modules`、运行缓存或个人照片。



详细说明见 \[试衣与手账接入说明](docs/接入说明.md)。

本次模块合并范围见 [2026-10-28 合并说明](docs/合并说明-2026-10-28.md)，穿搭助手更新、GitHub 推送及 Pages 部署步骤见 [2026-10-28 更新说明](docs/更新说明-2026-10-28.md)。

