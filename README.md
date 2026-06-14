# SwiftKey X1 - 键鼠驱动 Web 端项目

> 有线单模键盘/鼠标驱动的 Web 前端实现，基于 WebHID API，支持 1K+ 高轮询率设备。

## 📋 项目状态

- **当前版本**: V1.0.0 (单文件演示版)
- **目标版本**: V2.0.0 (模块化重构版)
- **当前进度**: 🚧 架构重构中

---

## 🎯 项目概览

本项目是一款基于 WebHID API 的键鼠设备驱动 Web 端应用，专为高轮询率（1K+ Hz）设备设计。

### 核心特性

- ✅ **灯光控制** - RGB 灯效、自定义按键颜色
- ✅ **按键映射与宏** - 完整按键重定义、宏录制
- ✅ **HID 测试** - 数据收发调试
- ✅ **数据收发测试** - 自动化测试 + 成功率统计
- 🚧 **固件升级** - OTA/DFU 支持（规划中）
- 🚧 **配置云同步** - 云端配置备份（接口预留）

### 产品支持

| 产品线 | 状态 | 备注 |
|--------|------|------|
| SwiftKey X1 键盘 | ✅ V1.0 已实现 | 15键 RGB 背光 |
| 鼠标 | 📋 V2.0 规划中 | DeviceDriver 接口已设计 |

---

## 🏗️ 架构设计

### 📐 技术栈

| 维度 | 选型 | 理由 |
|------|------|------|
| **技术栈** | 原生 HTML/CSS/JS | 零构建、零依赖、跨平台 |
| **项目结构** | 多文件 + ES Modules | 浏览器原生支持、模块化 |
| **设备连接** | WebHID API | 1K+ 设备、低延迟 |
| **多产品架构** | DeviceDriver 接口模式 | 键盘/鼠标解耦、可扩展 |
| **状态管理** | EventBus 事件总线 | 轻量、解耦 |
| **通讯层** | Protocol + Transport 分层 | 清晰、可测试 |
| **云同步** | 预留接口，不实现 | 快速上线、后期对接 |

### 📁 目标目录结构

```
keyboard/
├── index.html                      # 主入口
├── README.md                       # 项目说明
│
├── assets/                         # 静态资源
│   ├── css/
│   │   ├── base.css                # 基础样式 + 变量
│   │   ├── components.css          # 组件样式
│   │   └── animations.css          # 动画
│   └── images/
│
├── src/                            # 源代码
│   ├── core/                       # 核心层
│   │   ├── EventBus.js             # 事件总线
│   │   ├── Logger.js               # 日志系统
│   │   ├── Config.js               # 全局配置
│   │   └── DeviceManager.js        # 设备管理
│   │
│   ├── protocol/                   # 协议层
│   │   ├── Protocol.js             # 协议基类
│   │   ├── KeyboardProtocol.js     # 键盘协议
│   │   ├── MouseProtocol.js        # 鼠标协议
│   │   └── commands/               # 命令定义
│   │       ├── BaseCommands.js
│   │       ├── KeyboardCommands.js
│   │       └── MouseCommands.js
│   │
│   ├── transport/                  # 传输层
│   │   ├── Transport.js            # 传输基类
│   │   ├── WebHIDTransport.js      # WebHID 实现
│   │   └── MockTransport.js        # 模拟传输
│   │
│   ├── drivers/                    # 设备驱动
│   │   ├── DeviceDriver.js         # 驱动基类
│   │   ├── KeyboardDriver.js       # 键盘驱动
│   │   └── MouseDriver.js          # 鼠标驱动
│   │
│   ├── services/                   # 业务服务
│   │   ├── LightingService.js      # 灯光服务
│   │   ├── KeymapService.js        # 按键映射服务
│   │   ├── MacroService.js         # 宏服务
│   │   ├── PerformanceService.js   # 性能服务
│   │   ├── FirmwareService.js      # 固件升级服务
│   │   ├── SyncService.js          # 云同步服务 (接口预留)
│   │   └── TestService.js          # 数据测试服务
│   │
│   ├── ui/                         # UI 层
│   │   ├── UIManager.js            # UI 管理器
│   │   ├── components/             # UI 组件
│   │   │   ├── Modal.js
│   │   │   ├── Toast.js
│   │   │   ├── ColorPicker.js
│   │   │   ├── Slider.js
│   │   │   └── Tabs.js
│   │   └── panels/                 # 面板
│   │       ├── LightingPanel.js
│   │       ├── KeymapPanel.js
│   │       ├── MacroPanel.js
│   │       ├── PerformancePanel.js
│   │       ├── HidTestPanel.js
│   │       ├── DataTestPanel.js
│   │       └── FirmwarePanel.js
│   │
│   └── utils/                      # 工具
│       ├── ByteUtils.js            # 字节处理
│       ├── HexUtils.js             # 十六进制
│       ├── ColorUtils.js           # 颜色处理
│       └── Storage.js              # 本地存储
│
└── workers/                        # Web Workers (可选)
    └── macro-recorder.js           # 宏录制后台线程
```

### 🏛️ 分层架构图

```
┌─────────────────────────────────────────────────────┐
│                  UI Layer (UI 层)                    │
│  Panels │ Components │ 事件处理 │ DOM 更新           │
└──────────────────┬──────────────────────────────────┘
                   │ EventBus (事件总线)
┌──────────────────┴──────────────────────────────────┐
│              Services Layer (业务服务)                │
│  Lighting │ Keymap │ Macro │ Performance │ Test     │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────┐
│             Drivers Layer (设备驱动)                  │
│        DeviceDriver (基类)                          │
│        ├── KeyboardDriver                           │
│        └── MouseDriver                              │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────┐
│         Protocol + Transport (协议+传输)            │
│  Protocol: 指令集、响应解析                          │
│  Transport: WebHID / Mock                           │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────┐
│                  WebHID API                          │
└─────────────────────────────────────────────────────┘
```

---

## 🔄 核心设计模式

### 1️⃣ EventBus 事件总线 (解耦核心)

```javascript
// src/core/EventBus.js
class EventBus {
    constructor() {
        this.events = new Map();
    }

    on(event, handler) { /* 订阅 */ }
    off(event, handler) { /* 取消订阅 */ }
    emit(event, data) { /* 发布 */ }
    once(event, handler) { /* 一次性 */ }
}

export const bus = new EventBus();
```

**事件命名规范**: `domain:action`
- `device:connected`
- `device:disconnected`
- `lighting:changed`
- `keymap:updated`
- `test:progress`

### 2️⃣ Protocol + Transport 分层

```javascript
// Protocol 定义"做什么"
// Transport 定义"怎么做"

class Protocol {
    constructor(transport) {
        this.transport = transport;
        this.pendingCommands = new Map();
    }

    async send(command, data = {}) {
        const requestId = this.generateRequestId();
        const packet = this.encode(command, requestId, data);

        return new Promise((resolve, reject) => {
            this.pendingCommands.set(requestId, { resolve, reject, timeout: 1000 });
            this.transport.send(packet);
        });
    }

    handleResponse(packet) {
        const { requestId, status, data } = this.decode(packet);
        const pending = this.pendingCommands.get(requestId);
        if (pending) {
            pending.resolve({ status, data });
            this.pendingCommands.delete(requestId);
        }
    }
}

class WebHIDTransport {
    async connect(vendorId, productId) { /* WebHID 连接 */ }
    async send(packet) { /* 发送 */ }
    onReceive(handler) { /* 监听接收 */ }
    async disconnect() { /* 断开 */ }
}
```

### 3️⃣ DeviceDriver 接口模式 (多产品支持)

```javascript
// src/drivers/DeviceDriver.js (基类)
class DeviceDriver {
    constructor(protocol) {
        this.protocol = protocol;
    }

    getCapabilities() { throw new Error('Not implemented'); }
    getKeyLayout() { throw new Error('Not implemented'); }
    getLEDCount() { throw new Error('Not implemented'); }
}

class KeyboardDriver extends DeviceDriver {
    getCapabilities() {
        return { type: 'keyboard', keys: 15, leds: 15, rgb: true, macro: true };
    }

    getKeyLayout() { /* 15键布局 */ }

    async setKeyColor(keyId, rgb) {
        return this.protocol.send(CMD_SET_KEY_COLOR, { keyId, rgb });
    }
}

class MouseDriver extends DeviceDriver {
    getCapabilities() {
        return { type: 'mouse', buttons: 6, dpi: true, rgb: true };
    }

    async setDPI(dpi) {
        return this.protocol.send(CMD_SET_DPI, { dpi });
    }
}
```

---

## 🔌 通讯协议 (64字节格式)

```
字节1:    Report ID (0x04)
字节2-4:  保留字节
字节5:    命令码
字节6:    数据长度
字节7-8:  地址 (16位)
字节9-64: 实际数据 (最多56字节)
```

**发送流程**:

```javascript
const fullData = new Uint8Array(64);  // 构建64字节
fullData[0] = 0x04;                   // Report ID
// ... 其他字节 ...
const reportData = fullData.subarray(1);  // 提取63字节
connectedDevice.sendReport(0x04, reportData);
```

---

## 🗺️ 开发计划 (Roadmap)

### Phase 1: 基础架构搭建 ⭐⭐⭐⭐⭐
**目标**: 搭建模块化骨架，建立核心基础设施

| 任务 | 状态 | 备注 |
|------|------|------|
| 创建目录结构 | 📋 待开始 | 按目标结构创建文件夹 |
| EventBus 实现 | 📋 待开始 | 核心基础 |
| Logger 实现 | 📋 待开始 | 统一日志 |
| Config 配置 | 📋 待开始 | 常量/枚举 |
| Storage 工具 | 📋 待开始 | localStorage 封装 |
| 基础 CSS 拆分 | 📋 待开始 | base.css / components.css |

**预计工作量**: 1-2 天

---

### Phase 2: 通讯层重构 ⭐⭐⭐⭐⭐
**目标**: 重构通讯层，实现 Protocol + Transport 分离

| 任务 | 状态 | 备注 |
|------|------|------|
| Protocol 基类 | 📋 待开始 | 命令/响应匹配 |
| Transport 基类 | 📋 待开始 | 接口定义 |
| WebHIDTransport | 📋 待开始 | 当前 hid 逻辑迁移 |
| MockTransport | 📋 待开始 | 用于测试/演示 |
| ByteUtils/HexUtils | 📋 待开始 | 字节处理工具 |
| 协议命令常量 | 📋 待开始 | CMD_LED_xxx 等 |

**预计工作量**: 2-3 天

---

### Phase 3: 设备驱动层 ⭐⭐⭐⭐
**目标**: 实现 DeviceDriver 接口模式，支持多产品

| 任务 | 状态 | 备注 |
|------|------|------|
| DeviceDriver 基类 | 📋 待开始 | 通用能力抽象 |
| KeyboardDriver | 📋 待开始 | 键盘特有功能 |
| MouseDriver (接口) | 📋 待开始 | 鼠标驱动接口预留 |
| DeviceManager | 📋 待开始 | 设备搜索/连接/断开 |
| 设备类型自动识别 | 📋 待开始 | 根据 VID/PID |

**预计工作量**: 2-3 天

---

### Phase 4: 业务服务层 ⭐⭐⭐⭐
**目标**: 实现 6 大业务服务

| 任务 | 状态 | 备注 |
|------|------|------|
| LightingService | 📋 待开始 | 灯光控制 |
| KeymapService | 📋 待开始 | 按键映射 |
| MacroService | 📋 待开始 | 宏录制/播放 |
| PerformanceService | 📋 待开始 | DPI/轮询率 |
| TestService | 📋 待开始 | 数据收发测试 |
| SyncService (接口) | 📋 待开始 | 云同步预留 |

**预计工作量**: 3-5 天

---

### Phase 5: UI 层重构 ⭐⭐⭐
**目标**: 拆分单文件 UI 到模块化面板

| 任务 | 状态 | 备注 |
|------|------|------|
| UIManager | 📋 待开始 | 面板切换/状态 |
| UI 组件库 | 📋 待开始 | Modal/Toast/ColorPicker/Slider/Tabs |
| 7 个面板迁移 | 📋 待开始 | 从单文件拆分 |
| 事件绑定 | 📋 待开始 | 通过 EventBus 通信 |
| 响应式适配 | 📋 待开始 | 移动端/平板 |

**预计工作量**: 5-7 天

---

### Phase 6: 高级功能 ⭐⭐⭐
**目标**: 实现固件升级、宏录制等高级功能

| 任务 | 状态 | 备注 |
|------|------|------|
| FirmwareService | 📋 待开始 | 固件升级 (DFU/OTA) |
| 固件校验/进度 | 📋 待开始 | 升级流程 |
| Web Worker 宏录制 | 📋 待开始 | 后台录制 |
| 配置导入/导出 | 📋 待开始 | 用户友好 |
| 多语言支持 | 📋 待开始 | i18n 框架 |

**预计工作量**: 3-5 天

---

### Phase 7: 测试与优化 ⭐⭐⭐
**目标**: 测试、性能优化、文档完善

| 任务 | 状态 | 备注 |
|------|------|------|
| 单元测试 | 📋 待开始 | 核心模块 |
| 集成测试 | 📋 待开始 | 模拟设备测试 |
| 性能优化 | 📋 待开始 | 防抖/节流/虚拟DOM |
| 浏览器兼容 | 📋 待开始 | Chrome/Edge |
| 文档完善 | 📋 待开始 | API 文档 |

**预计工作量**: 3-5 天

---

## 📊 总体时间预估

| 阶段 | 优先级 | 预计工作量 |
|------|--------|------------|
| Phase 1: 基础架构 | 🔴 高 | 1-2 天 |
| Phase 2: 通讯层 | 🔴 高 | 2-3 天 |
| Phase 3: 设备驱动 | 🟡 中 | 2-3 天 |
| Phase 4: 业务服务 | 🟡 中 | 3-5 天 |
| Phase 5: UI 重构 | 🟢 低 | 5-7 天 |
| Phase 6: 高级功能 | 🟢 低 | 3-5 天 |
| Phase 7: 测试优化 | 🟢 低 | 3-5 天 |
| **合计** | | **20-30 天** |

---

## 🚀 快速开始

### 1. 创建骨架

```bash
mkdir -p src/{core,protocol,transport,drivers,services,ui,utils}
mkdir -p src/ui/{components,panels}
mkdir -p assets/css
```

### 2. 实现 EventBus (5分钟)

```javascript
// src/core/EventBus.js
export class EventBus {
    constructor() { this.events = new Map(); }
    on(event, handler) {
        if (!this.events.has(event)) this.events.set(event, new Set());
        this.events.get(event).add(handler);
        return () => this.off(event, handler);
    }
    emit(event, data) {
        this.events.get(event)?.forEach(h => h(data));
    }
    off(event, handler) {
        this.events.get(event)?.delete(handler);
    }
}
export const bus = new EventBus();
```

### 3. 在 index.html 中使用 ES Modules

```html
<script type="module" src="src/main.js"></script>
```

### 4. 启动本地服务器

```bash
# Python 3
python -m http.server 8080

# Node.js
npx http-server -p 8080

# VS Code
# 安装 Live Server 扩展，右键 index.html 选择 "Open with Live Server"
```

---

## 🎯 实施建议

### 推荐试点: 数据收发测试面板

**理由**:
- 业务逻辑最复杂
- 涉及完整的发送-接收-对比流程
- 可作为模板验证整体架构

**试点流程**:
1. 抽取 TestService 到独立模块
2. 抽取 DataTestPanel 到独立模块
3. 通过 EventBus 与其他模块通信
4. 验证后形成模板，批量迁移其他面板

---

## 📌 关键原则

1. **依赖倒置** - 上层不依赖下层具体实现，都依赖抽象
2. **开闭原则** - 对扩展开放，对修改关闭
3. **单一职责** - 每个模块只做一件事
4. **DRY** - 消除重复 (Protocol/Transport 已体现)
5. **关注点分离** - UI/业务/协议/传输各司其职

---

## 📝 开发规范

### 文件命名
- 类文件: `PascalCase.js` (如 `EventBus.js`)
- 工具文件: `camelCase.js` (如 `byteUtils.js`)
- 常量文件: `UPPER_SNAKE_CASE.js`

### 事件命名
- 格式: `domain:action`
- 示例: `device:connected`, `lighting:changed`

### 提交规范
- `feat`: 新功能
- `fix`: 修复
- `refactor`: 重构
- `docs`: 文档
- `style`: 格式
- `test`: 测试

---

## 📄 License

MIT License

---

## 👥 维护者

SwiftKey Team

---

**最后更新**: 2026-05-20
