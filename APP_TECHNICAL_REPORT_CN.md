# Production Dashboard 技术报告

## 1. 项目定位

Production Dashboard 是一个面向生产现场的移动端看板 App，用来把 Google Sheets 中的生产任务转成可视化、可点击的进度面板。用户可以按 Project、Lot、Stock Code 查看 Busway 任务，点击任务切换 `Completed` / `To run` 状态，并把结果写回 Google Sheets。

这个项目的重点不是单纯展示数据，而是把原本依赖表格人工筛选、人工查找行号、人工更新备注的流程，封装成适合现场使用的移动端操作界面。

## 2. 技术栈

前端使用 Expo + React Native + TypeScript：

- Expo Router：文件路由和页面栈管理，入口是 `expo-router/entry`。
- React Native：跨平台移动端 UI。
- TypeScript：定义 API 数据结构、Dashboard item、pending queue 等类型。
- AsyncStorage：持久化登录状态、数据缓存、离线 pending 队列。
- NetInfo：检测网络状态，支持离线模式提示。
- React Native SVG：绘制完成率圆环。
- EAS Build：配置 Android APK / AAB 构建。

后端使用 Google Apps Script Web App：

- Google Drive API 能力：扫描指定 Drive Folder 下的 Google Sheets。
- SpreadsheetApp：读取每个 Spreadsheet / Sheet 的表头和数据行。
- ContentService：返回 JSON API 响应。
- POST 接口：把前端点击产生的状态写回 `REMARKS` 列。

## 3. 总体架构

```text
User
  |
  v
Expo React Native App
  |
  | GET list / appConfig
  | POST setRemarks / setRemarksBatchRows
  v
Google Apps Script Web App
  |
  v
Google Drive Folder
  |
  v
Multiple Google Spreadsheets / Sheets
```

前端负责用户体验、筛选、统计、缓存、离线队列和状态反馈。后端负责把 Google Sheets 包装成一个简单 JSON API，并处理写回。

## 4. 前端模块拆解

### 4.1 路由与登录保护

根布局在 `app/_layout.tsx` 中完成三件事：

- 使用 `AuthProvider` 包住整个 App。
- 根据登录状态控制 `/login` 和 `/(tabs)` 之间的跳转。
- 启动时调用 `DashboardAPI.fetchAppConfig()` 检查是否有 APK 更新。

登录逻辑在 `contexts/auth-context.tsx`。它使用 AsyncStorage 保存 token、用户数据和最后活跃时间，并设置 20 小时 session timeout。当前账号校验是本地固定账号模式，适合内部工具或原型，但如果面向更正式的生产环境，应该改为服务端认证。

### 4.2 Dashboard 主页面

主页面在 `app/(tabs)/index.tsx`，负责把原始 item 转成用户能理解的看板：

- 从 `useDashboardData()` 拿数据、刷新方法、点击更新方法、离线状态和 pending 数量。
- 通过 `useMemo` 提取 Project tabs、Lot tabs 和 Stock Code 分组。
- 用 `SectionList` 渲染任务分组。
- 每个任务使用 `BuswayButton` 展示完成状态、pending 状态和更新中状态。
- 完成率通过 `ProgressRing` 展示。
- Project 全部完成时显示 5 秒烟花动画。

页面的数据层和 UI 层有比较清楚的分离：主页面只组织展示逻辑，真正的数据加载、缓存和写回都在 hook 里。

### 4.3 数据加载、缓存与离线队列

核心数据 hook 是 `hooks/use-dashboard-data.ts`。

它维护这些状态：

- `cacheItems`：当前本地可展示的数据。
- `offlineQueue`：离线或同步失败时保存的用户意图。
- `busyMap`：每个按钮是否正在写回，避免重复点击。
- `isOffline`：由 NetInfo 判断。
- `pendingByKey`：从 offlineQueue 派生出来的 Map，方便 UI 判断某个 item 是否 pending。

加载流程：

```text
App mount
  -> 从 AsyncStorage 恢复 cacheItems 和 offlineQueue
  -> 调用 DashboardAPI.fetchItems()
  -> 校验 item 结构
  -> 更新 cacheItems
  -> debounce 写入 AsyncStorage
```

点击普通 item 的流程：

```text
用户点击 BuswayButton
  -> 判断当前状态 Completed / To run
  -> 如果离线：只写入 offlineQueue，UI 显示橙色 pending
  -> 如果在线：先乐观更新本地 cacheItems
  -> POST setRemarks 到 Apps Script
  -> 成功：保持本地状态
  -> 失败：把意图加入 offlineQueue，提示 Pending Sync
```

pending item 的流程：

```text
离线时再点 pending item
  -> 切换 pending target，或者如果回到原状态就移除 pending

在线时点击 pending item
  -> 发送 pending target 到后端
  -> 成功后更新本地状态并移除 queue
  -> 失败则继续保留 pending
```

这个设计适合生产现场网络不稳定的场景：离线时不会假装已经同步成功，而是用橙色状态明确告诉用户“这是待同步意图”。

### 4.4 数据清洗与展示模型

`utils/dashboard.ts` 把后端数据转换成 UI 友好的 `ItemView`：

- `keyOf()`：用 `spreadsheetId|sheetName|rowNumber` 生成唯一 key，避免多个 Spreadsheet / Sheet 行号冲突。
- `normalizeProjectName()`：项目名空值归为 `Default`。
- `normalizeLot()`：Lot 标准化，例如数字型 lot 自动补 `Lot` 前缀。
- `cleanStockCode()`：清理连续 dash 和尾部 dash。
- `transformItemsToView()`：生成 `projectNorm`、`lotNorm`、`buswayTrim`、`stockCodeNorm` 等字段。
- 对 busway 为空但有 quantity 的特殊行做聚合，把多行数量合并成一个 `${totalQuantity} pcs` 的 summary item。

这里是面试可以重点讲的地方：前端没有直接依赖 Google Sheet 的原始脏数据，而是用转换层把数据统一成稳定的 View Model。

### 4.5 UI 组件

Dashboard 组件拆分比较直接：

- `BuswayButton`：任务按钮，支持 completed、pending、busy、long press 详情和 accessibility label。
- `ProgressRing`：用 SVG Circle 画完成率圆环。
- `SummaryCard`：展示 done / total 和每个 lot 的完成数量。
- `Tab`：Project / Lot 切换。

响应式布局由 `hooks/use-responsive-layout.ts` 控制：

- 手机默认 4 列。
- 平板竖屏 4 列。
- 平板横屏 6 列。

## 5. API 封装

`services/api.ts` 封装了所有前端到后端的请求：

- `fetchItems()` -> `action=list`
- `updateRemarks()` -> `action=setRemarks`
- `updateBatchRemarks()` -> `action=setRemarksBatchRows`
- `fetchAppConfig()` -> `action=appConfig`

请求统一经过：

- URLSearchParams 构建 query。
- token / apiKey 参数注入。
- 30 秒超时。
- `redirect: "follow"` 处理 Google Apps Script 常见 302 跳转。
- JSON parse 错误处理。
- `withRetry()` 指数退避重试。

写操作最多重试 2 次，读操作按配置重试 3 次。这是一个合理取舍：读请求可以更积极重试，写请求要避免重复写造成副作用。

## 6. Google Apps Script 后端设计

当前主要后端文件是 `backend-fixed-no-lock.gs`。

### 6.1 入口与认证

Apps Script 提供 `doGet(e)` 和 `doPost(e)`，统一进入 `handle_(e)`。

接口通过 query parameter 中的 token 做简单认证。token 不匹配时返回：

```json
{ "ok": false, "error": "Unauthorized" }
```

### 6.2 list 数据读取

`action=list` 的流程：

```text
DriveApp.getFolderById(CONFIG.FOLDER_ID)
  -> files.getFilesByType(MimeType.GOOGLE_SHEETS)
  -> 每个 Spreadsheet openById
  -> 每个 Sheet 扫描 header block
  -> 找到 REMARKS / Busway No / Lot / Description
  -> 过滤 To run / Completed 行
  -> 返回 item 数组
```

每个 item 会带上：

- `spreadsheetId`
- `spreadsheetName`
- `projectName`
- `sheetName`
- `rowNumber`
- `buswayNo`
- `lot`
- `description`
- `stockCode`
- `remarks`
- `quantity` 可选

`spreadsheetId + sheetName + rowNumber` 是写回定位的核心。这个设计解决了多 Spreadsheet 扫描后“同名 sheet 或相同行号无法唯一定位”的问题。

### 6.3 表头检测与脏数据兼容

后端不是假设表头固定在第一行，而是在前 25 行内寻找包含 `REMARKS` 的两行 header block。定位列时会在 header 附近和扫描范围内查找 `Busway No`、`Lot`、`Description`。

这说明项目在适配真实生产表格时考虑了格式不完全稳定的问题。

### 6.4 Stock Code 与特殊数量行

普通行的 stock code 来自 C、F、H、L 列组合。

特殊场景：如果 `Busway No` 为空，但状态是 To run / Completed，后端会：

- 从 C 列提取 stock code prefix。
- 从 M 列读取 description。
- 只保留描述包含 mounting、plug-in box、bolt-on box 的行。
- 从 N 列读取 quantity。

前端再把这些 quantity 行按 project、lot、stockCode、description 聚合成 summary item。

### 6.5 写回接口

单行写回：

```text
POST action=setRemarks
body: spreadsheetId, sheetName, row, remarks
```

批量行写回：

```text
POST action=setRemarksBatchRows
body: spreadsheetId, sheetName, rowNumbers, remarks
```

后端会重新定位 `REMARKS` 列，然后写入 `Completed` 或 `To run`。批量接口使用 `RangeList` 一次性更新多个单元格，适合前端 quantity summary item 的批量完成/撤销。

## 7. 构建与发布

`app.json` 中配置了：

- app name / slug / icon / splash。
- Android package：`com.productiondashboard.app`。
- version：`1.0.1`。
- Android versionCode。
- Expo Router、Splash Screen 插件。
- typedRoutes 和 reactCompiler 实验配置。
- EAS projectId。

`eas.json` 中配置了：

- development：内部 debug build。
- preview：Android APK，适合内部测试分发。
- production：Android App Bundle，适合正式发布。

App 启动时会访问后端 `appConfig`，根据 `latestVersion`、`latestVersionCode`、`minSupportedVersionCode`、`forceUpdate`、`apkUrl` 来弹出普通更新或强制更新提示。

## 8. 可用于面试讲解的核心亮点

### 亮点 1：把 Google Sheets 变成轻量生产系统后端

可以这样讲：

> 这个项目没有一开始就引入完整数据库和后台管理系统，而是基于现有 Google Sheets 工作流，用 Google Apps Script 封装出 JSON API。这样保留了业务人员熟悉的表格维护方式，同时给生产现场提供移动端操作体验。

### 亮点 2：前端使用 View Model 隔离表格脏数据

可以这样讲：

> Google Sheet 的数据格式并不完全像数据库那样干净，所以我在前端做了一层 `transformItemsToView`，统一处理 project、lot、stock code、busway no 和 quantity 聚合。UI 不直接依赖原始 row，而是依赖稳定的 ItemView。

### 亮点 3：离线 pending queue 设计

可以这样讲：

> 生产现场网络可能不稳定，所以我没有让离线点击直接变成绿色完成，而是设计成橙色 pending intent。用户离线操作会存入 AsyncStorage，恢复网络后再手动点击 pending item 同步。这样避免了“UI 显示完成但后端其实没写入”的假成功。

### 亮点 4：写回定位用复合 key

可以这样讲：

> 因为后端扫描的是一个 Drive Folder 下多个 Spreadsheet、多个 Sheet，单靠 rowNumber 或 sheetName 不能唯一定位。所以 item 带上 spreadsheetId，前端 key 和写回 payload 都用 spreadsheetId + sheetName + rowNumber，避免跨表冲突。

### 亮点 5：面向现场设备的响应式看板

可以这样讲：

> UI 不是普通列表，而是按 Project、Lot、Stock Code 分组，并根据设备宽高切换列数。手机和平板都能保持密集但可点击的生产看板体验。

## 9. 一分钟面试介绍稿

这是一个用 Expo 和 React Native 做的生产进度看板 App，后端是 Google Apps Script。业务上，它把 Google Drive 文件夹里的多个 Google Sheets 扫描出来，读取每个 sheet 里的 Busway 任务、Lot、Stock Code 和 REMARKS 状态，然后在移动端按 Project、Lot、Stock Code 做分组展示。

前端核心是 `useDashboardData`，它负责拉取数据、缓存到 AsyncStorage、检测网络状态、维护离线 pending queue，并处理点击任务后的写回逻辑。用户点击任务时，在线会调用 Apps Script 的 `setRemarks` 更新 Google Sheet；离线或失败时会保存成 pending intent，用橙色 UI 提示，避免假成功。对于数量类 summary item，则通过批量接口一次更新多个 row。

这个项目的技术重点是：用轻量 Google Apps Script API 复用现有表格系统；用 TypeScript View Model 隔离表格脏数据；用复合 key 解决多表写回定位；以及通过缓存、重试、离线队列提升现场使用可靠性。

## 10. 可以继续改进的地方

### 安全性

当前认证和 API token 都偏内部工具模式。正式生产可以改进为：

- 服务端账号认证，不在客户端硬编码账号。
- token 不放在客户端 bundle 中。
- Apps Script 端增加更强的权限控制或后端代理。

### 测试

项目有 Jest 配置和 `__tests__/utils.test.ts`，但 `package.json` 没有 test script，且部分测试期望值和当前 `utils/dashboard.ts` 的实现已经不一致。建议补齐：

- 更多覆盖离线 queue、API 错误、quantity aggregate 的测试。
- 给 `useDashboardData` 增加离线 queue 行为测试。

### 代码清理

可清理的点：

- `services/api.ts` 中 `APP_VERSION` 当前未使用。
- `hooks/use-dashboard-data.ts` 中 `isNetworkLikeFailure` 和 `rollbackMap` 当前未实际发挥作用。
- README 仍是 Expo 模板，建议改成项目真实介绍和运行指南。

### 自动同步

当前 pending queue 是手动同步：恢复网络后用户点击橙色 item 才提交。这个设计更保守。如果业务需要更自动化，可以增加后台自动同步，但仍保留手动重试入口。

## 11. 面试官可能追问与回答方向

### Q: 为什么不用数据库？

因为这个项目服务的是已有 Google Sheets 工作流。业务人员已经在维护表格，引入数据库会增加迁移和后台管理成本。Apps Script 让我们用很低成本把表格变成 API，先解决现场操作效率问题。

### Q: 多个表格如何保证写回正确？

后端返回每条 item 时带上 `spreadsheetId`、`sheetName`、`rowNumber`。前端 key 和 POST payload 都包含这些字段，写回时后端按 spreadsheetId 打开对应文件，再按 sheetName 和 rowNumber 定位 `REMARKS` 单元格。

### Q: 离线时怎么处理？

离线点击不会直接改成 completed，而是保存用户意图到 AsyncStorage 的 offlineQueue，并在 UI 上显示 pending。这样用户知道该操作还没同步成功。在线后再点击 pending item 才真正写回。

### Q: 如何处理 Google Sheet 格式不固定？

后端会扫描前 25 行查找包含 `REMARKS` 的 header block，而不是假设表头一定在第一行。前端也会 normalize project、lot、stock code，并过滤无效 item。

### Q: 最大技术风险是什么？

主要是 Google Apps Script 和 Google Sheets 的性能、权限和并发限制。当前设计适合内部低到中等规模使用。如果数据量、并发用户、权限复杂度继续上升，下一步可以把 Apps Script 替换成正式后端和数据库，同时保留前端交互模型。

## 12. 本次代码核对结果

本报告基于当前源码核对了这些文件：

- `package.json`
- `app/_layout.tsx`
- `app/login.tsx`
- `app/(tabs)/index.tsx`
- `contexts/auth-context.tsx`
- `hooks/use-dashboard-data.ts`
- `hooks/use-dashboard-stats.ts`
- `hooks/use-responsive-layout.ts`
- `services/api.ts`
- `utils/dashboard.ts`
- `constants/dashboard.ts`
- `types/dashboard.ts`
- `components/dashboard/*`
- `backend-fixed-no-lock.gs`
- `app.json`
- `eas.json`

验证命令：

```bash
npm test -- --runInBand
npx tsc --noEmit
npm run lint
```

结果：当前基础验证已通过。测试覆盖仍偏向 utils 层，后续可以继续补 `useDashboardData`、API 封装和组件交互测试。
