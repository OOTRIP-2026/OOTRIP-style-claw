# 原生Lucy媒体桥接：候选与离线预检

日期：2026-10-25。用户授权尝试开发，尚未授权本入口真实调用；默认关闭。助手未安装依赖、未运行检查/测试/构建、未启动Python或调用供应商。

## 架构与证据

已确认原生camera回显90×160、2fps，手机与电脑平均RTT74ms。已有电脑浏览器Lucy试穿成功12credits。两者均不等于本桥接成功。

现以官方Python SDK的LiveKit自定义VideoSource与RemoteVideoTrack接口实现媒体子进程。Node仍是唯一HTTP服务，Python只走受控stdin/stdout，不增加第二个HTTP后端。手机无网页容器。摄像头帧按原已验方式长边160、最多2fps发送，Python保持比例补边到模型尺寸，按模型fps重复最新输入帧；低清晰度/低更新率不冒充自然实时效果。输出从Lucy远端轨道缩小后返回Canvas，只显示AI输出，不把原图兜底为AI结果。

官方依据：[Python SDK示例](https://github.com/DecartAI/decart-python/blob/main/examples/realtime_synthetic.py)、[SDK](https://github.com/DecartAI/decart-python)、[实时试衣](https://docs.platform.decart.ai/models/realtime/virtual-try-on)。固定SDK decart[realtime]==0.2.3；其传递依赖未生成全量平台锁，不能声称跨平台完全复现。

## 当前先执行，不消耗credits

1. 在项目根目录按顺序运行`npm.cmd run check`、`npm.cmd run build`。报错先反馈，不继续启动真实试穿。新增测试只检验纯帧解析、默认关闭及授权边界，不启动真实媒体或外部网络。
2. 准备专用Python环境，避免修改已有抠图/FASHN环境：

   ```powershell
   py -3.13 -m venv .local-tools/lucy-bridge
   ```

   如果没有py或3.13，先反馈现有Python版本，不更换已有环境。
3. 只安装SDK，不发起模型调用：

   ```powershell
   .\.local-tools\lucy-bridge\Scripts\python.exe -m pip install -r server/tools/lucy-bridge/requirements.txt
   ```

4. 离线预检，只导入依赖，不加载.env、不创建会话、不发网络请求：

   ```powershell
   .\.local-tools\lucy-bridge\Scripts\python.exe server/tools/lucy-bridge/worker.py --preflight
   ```

   预期一行`{"type":"ready"}`。若`BRIDGE_FAILED`说明导入未完成，先反馈安装输出，不进行付费测试。当前没有自动包下载或自动安装。
5. 继续用已授权的同Wi-Fi后端启动参数HOST=0.0.0.0、OOTRIP_CAMERA_PROBE=1。**不要设置OOTRIP_NATIVE_LUCY_ALLOW_CALL。**新页面为`pages/native-lucy/index`，也可从原camera-probe顶部按钮进入。填电脑IP和开发令牌，点“检查后端桥接状态”，不调用AI；应显示真实调用默认关闭。不要发送永久密钥、开发令牌或私人截图到仓库。

## 真实测试须在上述通过后单独确认

当前首个原生桥接预约固定`server/data/lucy-native/attempt-01.json`，不删除或自动重置。未授权前环境开关关闭，/start立即拒绝，不申请凭证。授权后才启用对应开关；本说明不作为现已授权运行的凭据。

启用后永久Key仍只在Node环境，Python只经私有stdin接收短期凭证。供应商请求限制模型lucy-vton-3.6及maxSessionDuration30，TTL60；Python非浏览器，无浏览器Origin限制。Node在拨号前开始30秒硬上限，收到第一帧后另限10秒，两者先到杀进程；手机停止、隐藏或网络异常请求终止，4秒未送帧同样杀进程。手机显示时间可能比后端短，不能保证看满10秒。Python SDK可能包含内部恢复逻辑，Node的30秒总硬截止仍覆盖整个子进程，不依赖前端关闭。

单进程单会话；原子排他文件在供应商调用前预约一次，失败、不确定响应、刷新与重启不重发。stdout只使用固定阶段、受限帧及终态，stderr不转发到日志。衣物及摄像头不落盘、不新建本机业务记录；仅保留用户主动选择的原本机图片和最近一帧内存，视频不录制。退出不保证撤销已经发送给供应商的数据。

## 尚未验证

Python/LiveKit Windows依赖实际安装、SDK连接、竖屏补边效果、原生返回首帧、供应商扣费、低帧率衣物稳定性、微信预览/发布HTTPS与域名条件、进程异常清理均须实际验证。已通过探针仅是开发真机路径，不代表正式发布资格；如画面质量不足，后续另做压缩和更高分辨率传输，不扩大本轮范围。


## 2026-10-26 测试批次覆盖

用户要求多开放测试机会并免除逐次聊天确认，本轮落实为新增10次原生Lucy测试批次ui-10-v1。由server/src/index.ts选择testBatch，保留OOTRIP_NATIVE_LUCY_ALLOW_CALL=1显式服务开关；每次仍须用户页面选衣、勾选本次同意、点击开始。每次30秒总连接/首帧后10秒，保留失活和离开关闭。失败预约也占一次，不自动退款、重拨或新增批次；不保证固定积分数，不授权额度外付费、自动执行或发布。历史attempt-01.json保留，新批次用独立编号文件排他预约，跨实例/重启共享10次总上限。服务和页面显示剩余次数，已用完才重新协调批次；这10次内不逐次要求聊天许可。助手只跑替身检查/构建，不代发真实调用。

在已有HOST=0.0.0.0、OOTRIP_CAMERA_PROBE=1的后端终端，设置OOTRIP_NATIVE_LUCY_ALLOW_CALL=1并重启dev:server。小程序重新编译、查询连接后应显示10次新批次剩余机会。不要删除任何历史预约文件。每次结束后重新开启相机、确认衣物并勾选处理同意，即可自行继续，不需要聊天批准。达到0后不能继续。


## 2026-10-26 流畅度修订

原2fps探针已改为目标8fps（长边160保持），避免每帧重建Canvas及逐像素临时视图，已显示的输出版本不重复传输。重新构建并重启后端，再重新进入真机调试；Python脚本只在下一次试穿启动时读取。使用ui-10-v1现有剩余次数，不新开批次。

真机一次试穿后记录画面下方“实际显示fps”和“最近往返ms”，以及主观是否仍卡。fps是客户端实际绘制速率；往返仅指手机/电脑HTTP，不包含完整AI延迟。建议初次只用一件上衣，保持同一Wi-Fi便于与上一版比较。本轮不宣称手机8fps或多件效果已通过。
