# 模块到功能区域的映射

|整体功能区域|交付文件|作用|接入方式|
|---|---|---|---|
|试衣间 → 实时试衣|tools/lucy-demo/web/index.html、client.ts、style.css|摄像头、试衣结果、选衣栏、收起展开、同意与开始结束|挂入已有试衣间实时页；保持DOM节点ID或同步修改控制器|
|实时视频会话|tools/lucy-demo/web/session.ts、portrait.ts、session-policy.ts|Lucy SDK、竖屏比例、30秒/15秒时限、人物保真提示|保留独立同源iframe销毁机制和SDK Worker路由|
|我的 → 穿衣手账|tools/lucy-demo/web/journal.html、journal.ts、journal.css|列表、记录、照片/日期/天气/心情、AI生成、预览、编辑、保存下载、手动补单品|挂入整体手账入口|
|手账规则和数据|web/journal-model.ts、journal-storage.ts（均在tools/lucy-demo下）|Entry/Draft类型、最多4单品、日期校验、版本化IndexedDB|可替换存储适配，须迁移旧数据，保留原图/底图/草稿|
|手账绘图与导出|tools/lucy-demo/web/journal-renderer.ts|本机纸艺、AI整图合成、画内文字便签、PNG|复用同一预览/导出函数，保持等比与版本兼容|
|共享衣橱接线|tools/lucy-demo/web/store.ts|minimal Garment DTO、IndexedDB读写、图片归一化、参考图组合|对接组员衣橱；此处应作为适配层，不重做组员模块|
|选衣规则| miniprogram/wardrobe/realtime.ts|分类别名、同类单选、套装与上衣/裤子/内搭互斥|复用目标项目已有版本；本包只让类型依赖可独立运行|
|实时试衣后端|tools/lucy-realtime/server.mjs、server/src/native-lucy-budget.ts|短期凭证、同源保护、10次文件预算、Worker、静态入口|合入整体后端时保留保护并显式适配Origin/路径|
|手账后端|tools/lucy-demo/journal-server.ts、journal-artwork.ts|可选衣物区域识别、固定AI剪贴提示、生成与状态路由|挂到整体Fastify，并接入其认证/请求来源保护|
|供应商适配|server/src/ai/qwen-garment.ts、qwen-avatar.ts|百炼配置/结构校验/图像下载白名单|与整体已有适配器比较后复用，不用本包覆盖其他用途提示|
|演示手机壳|tools/lucy-demo/web/phone.html、phone.js、phone.css、mobile.css|桌面展示手机页面，两Tab|整体页面已有承载时可移除外壳，保留功能页|
|启动装配|tools/lucy-demo/start.mjs|浏览器内存打包、后端注册、固定资源路由|先独立跑通，再合入整体服务入口|

## HTTP映射

GET /、/journal：手机壳；GET /fitting-screen、/journal-screen：实际功能页。
GET /experiment/status：Lucy配置与次数；POST /experiment/token：{consent:true,seconds:30}。
GET /journal/status：可选识别配置；POST /journal/recognize：{image:DataURI,consent:true}。
GET /journal/artwork/status：图像配置；POST /journal/artwork：{image:DataURI,consent:true,requestId:UUID}。
POST必须有同源Origin和x-lucy-experiment（页面meta lucy-experiment动态注入）；路由合并时必须一起适配。

## 关键数据

Garment：id/name/category/image/purchased；当前image为PNG/JPEG/WebP DataURI。原始库ootrip-html-demo-v1/garments。
Journal：Entry/JournalDraft以journal-model.ts为准；库ootrip-journal-v1版本2，entries和drafts。无跨设备同步。
草稿与记录保留sourceImage/sourceOriginal、recognition、artwork/artworkModel/artworkVersion、manualPieces、date或time、weather/mood/note。
新版artworkVersion=4，画内便签；旧字段缺省3，旧页脚兼容。生成画面里的单品不是可编辑图层，也不自动成为真实衣橱单品。
