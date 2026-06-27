# 📚 V2 架构 API 文档

> SwiftKey X1 - WebHID 驱动 - V2 架构 API 参考

## 📋 目录

1. [核心层 (Core)](#-核心层-core)
2. [协议层 (Protocol)](#-协议层-protocol)
3. [传输层 (Transport)](#-传输层-transport)
4. [服务层 (Services)](#-服务层-services)
   - [DeviceService](#deviceservice)
   - [LightingService](#lightingservice)
   - [TestService](#testservice)
   - [KeymapService](#keymapservice) 🆕
   - [PerformanceService](#performanceservice) 🆕
   - [MacroService](#macroservice) 🆕
5. [UI 组件 (UI Components)](#-ui-组件-ui-components)

---

## 🆕 新增服务 (V2.2)
5. [UI 组件 (UI Components)](#-ui-组件-ui-components)

---

## 🧠 核心层 (Core)

### EventBus - 事件总线

**位置**: [src/core/EventBus.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/core/EventBus.js)

解耦的发布/订阅模式事件系统。

```javascript
import { bus } from './src/core/EventBus.js';

// 订阅事件
const unsub = bus.on('device:connected', (data) => {
    console.log('设备已连接:', data.deviceInfo);
});

// 取消订阅
unsub();

// 一次性订阅
bus.once('test:finished', (stats) => { ... });

// 发布事件
bus.emit('lighting:mode-changed', { mode: 'breathing' });

// 监听器数量
const count = bus.listenerCount('test:progress');
```

**API**:
| 方法 | 参数 | 说明 |
|------|------|------|
| `on(event, handler)` | event, handler | 订阅, 返回取消函数 |
| `once(event, handler)` | event, handler | 一次性订阅 |
| `off(event, handler)` | event, handler | 取消订阅 |
| `emit(event, data)` | event, data | 发布事件 |
| `clear(event?)` | event (可选) | 清空监听器 |
| `listenerCount(event)` | event | 监听器数量 |

---

### Logger - 日志系统

**位置**: [src/core/Logger.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/core/Logger.js)

统一日志接口, 支持 4 级日志, 自动推送到 EventBus。

```javascript
import { logger } from './src/core/Logger.js';

logger.debug('调试信息');
logger.info('一般信息');
logger.warn('警告');
logger.error('错误', err);

// 自定义级别
logger.log(LOG_LEVEL.INFO, '自定义日志');

// 监听日志事件
bus.on('log:new', (entry) => {
    console.log(`[${entry.level}] ${entry.message}`);
});
```

**API**:
| 方法 | 说明 |
|------|------|
| `debug(msg, ...args)` | 调试日志 |
| `info(msg, ...args)` | 信息日志 |
| `warn(msg, ...args)` | 警告日志 |
| `error(msg, ...args)` | 错误日志 |
| `log(level, msg, ...args)` | 自定义级别 |
| `getCache()` | 获取日志缓存 |
| `clearCache()` | 清空缓存 |

**事件**: `log:new` 携带 `{ level, message, timestamp, color }`

---

### Config - 全局配置

**位置**: [src/core/Config.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/core/Config.js)

集中管理所有配置常量。

```javascript
import { PROTOCOL, TEST, LIGHTING, PERFORMANCE, KEYBOARD } from './src/core/Config.js';

console.log(PROTOCOL.PACKET_SIZE);   // 64
console.log(TEST.MIN_INTERVAL);       // 5
console.log(LIGHTING.LED_COUNT);      // 15
```

**配置项**:

#### PROTOCOL (协议)
| 字段 | 值 | 说明 |
|------|-----|------|
| REPORT_ID | 0x04 | 报告 ID |
| HEADER_SIZE | 8 | 头部大小 |
| DATA_AREA_SIZE | 56 | 数据区大小 |
| PACKET_SIZE | 64 | 总包大小 |
| DEFAULT_TIMEOUT | 1000 | 默认超时 (ms) |

#### TEST (测试)
| 字段 | 值 | 说明 |
|------|-----|------|
| DEFAULT_COUNT | 50 | 默认次数 |
| MAX_COUNT | 1000 | 最大次数 |
| MIN_INTERVAL | 5 | 最小间隔 (ms) |
| MAX_INTERVAL | 60000 | 最大间隔 (ms) |
| DEFAULT_INTERVAL | 100 | 默认间隔 (ms) |
| DEFAULT_DATA_LENGTH | 8 | 默认数据长度 (字节) |
| MAX_DATA_LENGTH | 56 | 最大数据长度 |
| LOG_MAX_LINES | 500 | 日志最大行数 |
| RESPONSE_TIMEOUT | 1000 | 响应超时 (ms) |

#### LIGHTING (灯光)
| 字段 | 值 | 说明 |
|------|-----|------|
| LED_COUNT | 15 | LED 数量 |
| DEFAULT_COLOR | #06b6d4 | 默认颜色 (青色) |
| DEFAULT_BRIGHTNESS | 100 | 默认亮度 |
| DEFAULT_SPEED | 5 | 默认速度 |
| COLOR_PRESETS | [...] | 颜色预设数组 |

---

## 📡 协议层 (Protocol)

### BaseCommands - 命令常量

**位置**: [src/protocol/commands/BaseCommands.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/protocol/commands/BaseCommands.js)

70+ 命令常量定义, 按类别组织。

```javascript
import { CMD, STATUS, CATEGORY, getCmdName, getStatusName } from './src/protocol/commands/BaseCommands.js';

await protocol.send(CMD.READ_DPI, [0x01]);
console.log(getCmdName(CMD.READ_DPI));    // 'READ_DPI'
console.log(getStatusName(0x00));          // 'SUCCESS'
```

**命令分类**:
- **0x00xx** - 系统 (PING/RESET/...)
- **0x01xx** - 灯光 (LED_START/LED_STOP/...)
- **0x02xx** - 按键 (READ_MATRIX/MACRO_RECORD/...)
- **0x03xx** - 性能 (READ_DPI/WRITE_POLL_RATE/...)
- **0x04xx** - 电源 (READ_BATTERY/...)
- **0x05xx** - 固件 (ENTER_DFU/...)
- **0x06xx** - 配置 (LIST_PROFILES/...)
- **0x07xx** - 测试 (LOOPBACK_TEST/...)

---

### PacketBuilder - 数据包构建

**位置**: [src/protocol/PacketBuilder.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/protocol/PacketBuilder.js)

构建/解析 64 字节数据包。

```javascript
import { PacketBuilder } from './src/protocol/PacketBuilder.js';
import { CMD } from './src/protocol/commands/BaseCommands.js';

// 构建数据包
const packet = PacketBuilder.build(
    CMD.READ_DPI,        // 命令码
    [0x01],              // 数据
    0x0000,              // 地址
    1                    // 数据总长度 (可选)
);
// packet: 63 字节 (去除 Report ID)

// 解析数据包
const parsed = PacketBuilder.parse(packet);
console.log(parsed.cmd);      // 0x0302
console.log(parsed.cmdName);  // 'READ_DPI'
console.log(parsed.data);     // [0x01]

// 调试输出
PacketBuilder.dump(packet, 'SEND');
```

**API**:
| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `build(cmd, data, addr, dataLength)` | cmd, data[], addr, dataLength | Uint8Array(63) | 构建包 |
| `parse(packet)` | Uint8Array | object | 解析包 |
| `dump(packet, label)` | packet, label | void | 打印调试 |
| `toHex(data, sep)` | data, sep=' ' | string | 转 hex |

---

### Protocol - 协议封装

**位置**: [src/protocol/Protocol.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/protocol/Protocol.js)

异步命令发送 + 响应匹配 + 超时控制。

```javascript
import { Protocol } from './src/protocol/Protocol.js';
import { WebHIDTransport } from './src/transport/WebHIDTransport.js';
import { CMD } from './src/protocol/commands/BaseCommands.js';

const transport = new WebHIDTransport(device);
await transport.connect();

const protocol = new Protocol(transport);
protocol.setTimeout(2000);  // 2 秒超时

// 发送命令 (异步)
try {
    const result = await protocol.send(CMD.READ_DPI, [0x01]);
    console.log('DPI:', result.data);
    console.log('耗时:', result.elapsed, 'ms');
} catch (err) {
    console.error('命令失败:', err.message);
}

// 监听协议事件
bus.on('protocol:send', (e) => { ... });
bus.on('protocol:receive', (e) => { ... });
bus.on('protocol:error', (e) => { ... });
```

**API**:
| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `setTimeout(ms)` | ms | void | 设置默认超时 |
| `send(cmd, data, addr, options)` | cmd, data[], addr, {timeout, dataLength} | Promise | 发送命令 |
| `handleResponse(packet)` | packet | void | 内部: 处理响应 |

**返回结果**: `{ status, data, elapsed }`

**事件**:
| 事件 | 数据 | 触发时机 |
|------|------|----------|
| `protocol:send` | `{ cmd, data, address, requestId }` | 发送时 |
| `protocol:receive` | `parsed packet` | 接收时 |
| `protocol:error` | `{ error, cmd }` | 错误时 |

---

## 🔌 传输层 (Transport)

### WebHIDTransport - WebHID 设备

**位置**: [src/transport/WebHIDTransport.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/transport/WebHIDTransport.js)

真实 WebHID 设备传输。

```javascript
import { WebHIDTransport } from './src/transport/WebHIDTransport.js';

// 检查支持
if (!WebHIDTransport.isSupported()) {
    alert('请使用 Chrome/Edge 浏览器');
}

// 列出已授权设备
const devices = await WebHIDTransport.listDevices();

// 请求设备 (弹出选择器)
const device = await WebHIDTransport.requestDevice();

// 创建传输
const transport = new WebHIDTransport(device);
await transport.connect();

// 发送数据
await transport.send(packet);

// 监听
transport.onReceive((data) => { ... });
transport.onError((err) => { ... });

// 断开
await transport.disconnect();
```

**API**:
| 静态方法 | 说明 |
|----------|------|
| `isSupported()` | 浏览器支持检测 |
| `listDevices()` | 列出已授权设备 |
| `requestDevice()` | 请求用户授权 |

| 实例方法 | 说明 |
|----------|------|
| `connect()` | 打开设备 |
| `disconnect()` | 关闭设备 |
| `send(packet)` | 发送数据 |
| `onReceive(handler)` | 监听接收 |
| `onError(handler)` | 监听错误 |

---

### MockTransport - 模拟设备

**位置**: [src/transport/MockTransport.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/transport/MockTransport.js)

模拟设备用于测试和演示。

```javascript
import { MockTransport } from './src/transport/MockTransport.js';

const transport = new MockTransport({
    responseDelay: 5,    // 响应延迟
    errorRate: 0.1,      // 10% 错误率
    responseMode: 'loopback',  // loopback | echo | static | none
});
await transport.connect();

// 动态调整
transport.setResponseDelay(10);
transport.setErrorRate(0.2);
transport.setResponseMode('echo');

// 统计
console.log(transport.getStats());
```

**响应模式**:
| 模式 | 说明 |
|------|------|
| `loopback` | 原样返回 (默认) |
| `echo` | 镜像返回 |
| `static` | 静态零数据 |
| `none` | 不响应 |

---

## 🛠️ 服务层 (Services)

### DeviceService - 设备管理

**位置**: [src/services/DeviceService.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/services/DeviceService.js)

```javascript
import { DeviceService, DeviceStatus } from './src/services/DeviceService.js';

const device = new DeviceService();

// 搜索设备
const devices = await device.searchDevices();

// 请求连接
await device.requestDevice();

// 模拟模式 (无设备)
await device.activateMockMode();

// 状态
console.log(device.getStatus());     // 'connected'
console.log(device.isConnected());  // true
console.log(device.getDeviceInfo()); // { vendorId, productId, ... }

// 获取 Protocol
const protocol = device.getProtocol();

// 断开
await device.disconnect();

// 监听事件
bus.on('device:connected', (data) => { ... });
bus.on('device:disconnected', (data) => { ... });
bus.on('device:status-changed', (data) => { ... });
```

**状态**:
| 状态 | 说明 |
|------|------|
| DISCONNECTED | 未连接 |
| SEARCHING | 搜索中 |
| CONNECTING | 连接中 |
| CONNECTED | 已连接 |
| ERROR | 错误 |

---

### LightingService - 灯光控制

**位置**: [src/services/LightingService.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/services/LightingService.js)

```javascript
import { LightingService, LightMode } from './src/services/LightingService.js';

const lighting = new LightingService(protocol);

// 开关
await lighting.setEnabled(true);

// 模式
await lighting.setMode(LightMode.BREATHING);
// 模式: STATIC, BREATHING, WAVE, RIPPLE, REACTIVE, RAINBOW, CUSTOM, WEB_CUSTOM

// 颜色
await lighting.setMainColor('#FF0000');         // HEX
await lighting.setMainColor({r:255,g:0,b:0});   // RGB

// 亮度/速度
await lighting.setBrightness(75);
await lighting.setSpeed(7);

// 单键颜色
lighting.setKeyColor('A', '#00FF00');
lighting.clearKeyColor('A');

// 全选/清除
await lighting.setAllKeysColor('#FF00FF');
await lighting.clearAllKeysColor();

// 状态
const state = lighting.getState();

// 事件
bus.on('lighting:mode-changed', (e) => { ... });
bus.on('lighting:color-changed', (e) => { ... });
bus.on('lighting:applying', (e) => { ... });
bus.on('lighting:applied', (e) => { ... });
bus.on('lighting:error', (e) => { ... });
```

---

### TestService - 数据收发测试

**位置**: [src/services/TestService.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/services/TestService.js)

```javascript
import { TestService, TestDataType, TestStatus } from './src/services/TestService.js';

const test = new TestService(protocol);

// 配置
test.setConfig({
    sendCount: 100,
    interval: 50,
    dataType: TestDataType.INCREMENT,
    dataLength: 16,
});

// 启动
await test.startTest();

// 停止
test.stopTest();

// 统计
console.log(test.getStats());
/*
{
    totalSent: 100,
    totalReceived: 100,
    success: 100,
    failed: 0,
    successRate: '100.00',
    avgLatency: 5.2,
    minLatency: 3,
    maxLatency: 12,
    totalBytes: 1600
}
*/

// 报告
console.log(test.exportReport());
test.downloadReport();  // 下载 txt 报告

// 事件
bus.on('test:started', (e) => { ... });
bus.on('test:progress', (e) => { ... });
bus.on('test:finished', (e) => { ... });
bus.on('test:item-success', (e) => { ... });
bus.on('test:item-failed', (e) => { ... });
```

**数据类型**:
| 类型 | 说明 |
|------|------|
| INCREMENT | 递增序列 |
| RANDOM | 随机数据 |
| FIXED | 固定值 |

---

## 🎨 UI 组件 (UI Components)

### 组件清单 (11 个)

| 组件 | 文件 | 说明 |
|------|------|------|
| [Panel](#-panel---面板) | components/Panel.js | 玻璃面板容器 |
| [Modal](#-modal---模态框) | components/Modal.js | 模态对话框 |
| [Toast](#-toast---轻提示) | components/Toast.js | 轻提示消息 |
| [Tabs](#-tabs---标签页) | components/Tabs.js | 标签页切换 |
| [Theme](#-theme---主题) | components/Theme.js | 主题切换器 |
| [Button](#-button---按钮) | components/Button.js | 多种风格按钮 |
| [Input](#-input---输入框) | components/Input.js | 验证输入框 |
| [Select](#-select---下拉选择) | components/Select.js | 下拉选择器 |
| [Slider](#-slider---滑块) | components/Slider.js | 数值滑块 |
| [Switch](#-switch---开关) | components/Switch.js | 二元开关 |
| [Tooltip](#-tooltip---工具提示) | components/Tooltip.js | 鼠标悬停提示 |

---

### Panel - 面板

**位置**: [src/ui/components/Panel.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/ui/components/Panel.js)

```javascript
import { Panel } from './src/ui/components/Panel.js';

const panel = new Panel({
    title: '设备信息',
    subtitle: '当前连接的设备',
    variant: 'default',  // default | success | warning | danger
    collapsible: true,
    actions: [
        { label: '刷新', onClick: () => refresh() },
    ],
    content: '<p>面板内容</p>',
});
panel.mount('#container');

// 动态更新
panel.setContent('<p>新内容</p>');
panel.toggle();  // 折叠/展开
panel.destroy();
```

---

### Modal - 模态框

**位置**: [src/ui/components/Modal.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/ui/components/Modal.js)

```javascript
import { Modal, confirm } from './src/ui/components/Modal.js';

// 基础用法
const modal = new Modal({
    title: '提示',
    body: '操作内容',
    confirmText: '确定',
    cancelText: '取消',
    onConfirm: () => { ... },
    onCancel: () => { ... },
});
modal.mount('body');
modal.show();
modal.hide();

// 确认对话框 (Promise)
const ok = await confirm({
    title: '危险操作',
    body: '确定要继续?',
    confirmVariant: 'danger',
});
```

---

### Toast - 轻提示

**位置**: [src/ui/components/Toast.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/ui/components/Toast.js)

```javascript
import { toast } from './src/ui/components/Toast.js';

toast.success('操作成功');
toast.error('操作失败');
toast.warn('警告');
toast.info('提示');
toast.clear();  // 清空

// 自定义
toast.show('消息', 'success', 5000);  // 5秒
```

---

### Tabs - 标签页

**位置**: [src/ui/components/Tabs.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/ui/components/Tabs.js)

```javascript
import { Tabs } from './src/ui/components/Tabs.js';

const tabs = new Tabs({
    tabs: [
        { id: 'lighting', label: '灯光', icon: '💡' },
        { id: 'keymap', label: '按键', icon: '⌨️', badge: '15' },
    ],
    active: 'lighting',
    onChange: (id) => { ... },
});
tabs.mount('#container');

tabs.setActive('keymap');
tabs.updateTab('lighting', { badge: '!' });
```

---

### Theme - 主题

**位置**: [src/ui/components/Theme.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/ui/components/Theme.js)

```javascript
import { theme, ThemeToggle } from './src/ui/components/Theme.js';

theme.set('dark');
theme.set('light');
theme.set('midnight');
theme.toggle();  // 循环切换

const current = theme.get();
const config = theme.getConfig();

const unsub = theme.onChange((newTheme, config) => {
    console.log('主题变更:', newTheme);
});

// 渲染切换按钮
ThemeToggle.mount('#header');
```

**主题**:
| ID | 名称 | 图标 |
|----|------|------|
| dark | 深色 | 🌙 |
| light | 浅色 | ☀️ |
| midnight | 午夜蓝 | 🌌 |

---

### Button - 按钮

**位置**: [src/ui/components/Button.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/ui/components/Button.js)

```javascript
import { Button, ButtonGroup } from './src/ui/components/Button.js';

// 基础按钮
const btn = new Button({
    label: '保存',
    variant: 'primary',      // primary | secondary | success | danger | warning | ghost | outline
    size: 'md',              // sm | md | lg
    icon: '💾',
    iconPosition: 'left',    // left | right
    loading: false,
    disabled: false,
    fullWidth: false,
    rounded: 'lg',           // none | md | lg | full
    onClick: () => { ... },
});
btn.mount('#container');

// 方法
btn.setLoading(true);       // 切换加载状态
btn.setDisabled(true);      // 切换禁用
btn.setLabel('新文本');     // 修改文本

// 按钮组
const group = new ButtonGroup({
    buttons: [
        { label: '取消', variant: 'secondary', onClick: () => {} },
        { label: '确定', variant: 'primary', onClick: () => {} },
    ],
    direction: 'row',  // row | col
});
group.mount('#container');
```

**事件**: `button:clicked` 携带 `{ button, count }`

---

### Input - 输入框

**位置**: [src/ui/components/Input.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/ui/components/Input.js)

```javascript
import { Input } from './src/ui/components/Input.js';

const input = new Input({
    label: '用户名',
    placeholder: '请输入',
    value: '',
    type: 'text',              // text | number | email | password | tel | url
    icon: '👤',
    prefix: null,
    suffix: null,
    hint: '提示信息',
    errorMessage: '错误信息',
    required: false,
    disabled: false,
    minLength: 0,
    maxLength: 255,
    min: null,
    max: null,
    validator: (v) => v.length >= 3,
    validateOn: 'blur',        // blur | input | change
    showCounter: false,
    onChange: (value) => { ... },
    onInput: (value) => { ... },
    onBlur: (value) => { ... },
});
input.mount('#container');

// 方法
input.getValue();              // 获取值
input.setValue('hello');       // 设置值
input.reset();                 // 重置
input.focus();                 // 聚焦
```

**事件**: `input:input`, `input:change`, `input:blur`, `input:focus`

---

### Select - 下拉选择

**位置**: [src/ui/components/Select.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/ui/components/Select.js)

```javascript
import { Select } from './src/ui/components/Select.js';

const select = new Select({
    label: '灯光模式',
    placeholder: '请选择',
    options: [
        { value: 'static', label: '静态', icon: '🔵' },
        { value: 'breathing', label: '呼吸', icon: '💨' },
    ],
    value: 'static',
    multiple: false,            // 多选
    searchable: false,          // 可搜索
    disabled: false,
    onChange: (value) => { ... },
});
select.mount('#container');

// 方法
select.getValue();
select.setValue('breathing');
```

**事件**: `select:change` 携带 `{ value, select }`

**特性**:
- ESC 关闭
- 点击外部关闭
- 多选模式
- 搜索过滤

---

### Slider - 滑块

**位置**: [src/ui/components/Slider.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/ui/components/Slider.js)

```javascript
import { Slider } from './src/ui/components/Slider.js';

const slider = new Slider({
    label: '亮度',
    min: 0,
    max: 100,
    value: 75,
    step: 1,
    unit: '%',
    showValue: true,
    showMinMax: false,
    color: 'cyan',              // cyan | emerald | amber | red
    size: 'md',                 // sm | md | lg
    onChange: (value) => { ... },
    onInput: (value) => { ... },
});
slider.mount('#container');

// 方法
slider.getValue();
slider.setValue(80);
slider.increment(5);            // +5
slider.decrement(5);            // -5
```

**事件**: `slider:input`, `slider:change`

---

### Switch - 开关

**位置**: [src/ui/components/Switch.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/ui/components/Switch.js)

```javascript
import { Switch } from './src/ui/components/Switch.js';

const sw = new Switch({
    label: '启用灯光',
    description: '关闭后所有 LED 将熄灭',
    value: true,
    color: 'cyan',              // cyan | emerald | amber | red
    size: 'md',                 // sm | md | lg
    labelPosition: 'right',     // left | right
    disabled: false,
    onChange: (value) => { ... },
});
sw.mount('#container');

// 方法
sw.getValue();
sw.setValue(false);
sw.toggle();
```

**事件**: `switch:change` 携带 `{ value, switch }`

---

### Tooltip - 工具提示

**位置**: [src/ui/components/Tooltip.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/ui/components/Tooltip.js)

```javascript
import { Tooltip, createTooltip } from './src/ui/components/Tooltip.js';

const tip = new Tooltip({
    target: '#myButton',       // 元素选择器
    content: '点击保存设置',
    position: 'top',           // top | bottom | left | right
    delay: 200,
    disabled: false,
});

// 快捷创建
const tip2 = createTooltip('#btn', '提示内容', { position: 'bottom' });

// 方法
tip.setContent('新内容');
tip.destroy();
```

**事件**: `tooltip:shown`, `tooltip:hidden`

---

## 📚 完整事件列表

| 事件 | 数据 | 触发 |
|------|------|------|
| `log:new` | `{level,message,timestamp,color}` | 日志 |
| `device:status-changed` | `{old,new}` | 设备状态 |
| `device:connected` | `{deviceInfo,mock}` | 连接成功 |
| `device:disconnected` | `{mock}` | 断开 |
| `device:error` | `{error}` | 设备错误 |
| `device:data-received` | `{data}` | 数据接收 |
| `device:search-completed` | `{devices}` | 搜索完成 |
| `protocol:send` | `{cmd,data,address,requestId}` | 发送 |
| `protocol:receive` | `parsed` | 接收 |
| `protocol:error` | `{error,cmd}` | 协议错误 |
| `protocol:timeout` | `{cmd,elapsed}` | 超时 |
| `lighting:mode-changed` | `{mode}` | 灯光模式 |
| `lighting:color-changed` | `{color}` | 颜色 |
| `lighting:brightness-changed` | `{brightness}` | 亮度 |
| `lighting:speed-changed` | `{speed}` | 速度 |
| `lighting:enabled-changed` | `{enabled}` | 开关 |
| `lighting:applying` | `{state}` | 应用中 |
| `lighting:applied` | `{state}` | 应用完成 |
| `lighting:error` | `{error}` | 错误 |
| `test:started` | `{config}` | 测试开始 |
| `test:progress` | `{current,total,percent}` | 进度 |
| `test:finished` | `{status,stats,duration}` | 测试结束 |
| `test:item-success` | `{index,latency}` | 单项成功 |
| `test:item-failed` | `{index,error}` | 单项失败 |
| `test:config-updated` | `{config}` | 配置更新 |
| `test:stats-reset` | - | 重置 |
| `modal:shown` | `{modal}` | 模态框显示 |
| `modal:hidden` | `{modal}` | 模态框隐藏 |
| `modal:confirmed` | `{modal}` | 确认 |
| `modal:cancelled` | `{modal}` | 取消 |
| `toast:shown` | `{type,message,id}` | Toast 显示 |
| `toast:dismissed` | `{id}` | Toast 关闭 |
| `tabs:changed` | `{active,previous}` | Tab 切换 |
| `theme:changed` | `{theme,config}` | 主题变更 |

---

## 🚀 快速开始

```javascript
// 1. 导入
import { bus, logger } from './src/core/EventBus.js';
import { Protocol } from './src/protocol/Protocol.js';
import { WebHIDTransport } from './src/transport/WebHIDTransport.js';
import { DeviceService } from './src/services/DeviceService.js';
import { LightingService, LightMode } from './src/services/LightingService.js';
import { CMD } from './src/protocol/commands/BaseCommands.js';

// 2. 连接设备
const device = new DeviceService();
await device.requestDevice();

// 3. 创建服务
const protocol = device.getProtocol();
const lighting = new LightingService(protocol);

// 4. 控制灯光
await lighting.setEnabled(true);
await lighting.setMode(LightMode.BREATHING);
await lighting.setMainColor('#06b6d4');
```

---

> 📖 **相关文档**:
> - [README.md](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/README.md) - 项目说明
> - [Protocol_V2.md](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/Protocol_V2.md) - 通讯协议
> - [MIGRATION.md](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/MIGRATION.md) - 迁移指南

---

## 🆕 KeymapService

按键映射管理服务，负责配置文件管理、按键矩阵读写、按键重映射等。

### 构造函数
```javascript
new KeymapService(protocol)
```

### 配置文件管理

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `listProfiles()` | 列出所有配置 | `Promise<Array>` |
| `switchProfile(id)` | 切换配置 (1-4) | `Promise<boolean>` |
| `saveProfile()` | 保存当前配置 | `Promise<boolean>` |
| `deleteProfile(id)` | 删除配置 | `Promise<boolean>` |
| `exportProfile()` | 导出为 JSON | `Promise<object>` |
| `importProfile(data)` | 从 JSON 导入 | `Promise<boolean>` |

### 按键矩阵

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `readMatrix()` | 读取按键矩阵 | `Promise<Uint8Array>` |
| `writeMatrix(m)` | 写入按键矩阵 | `Promise<boolean>` |
| `readKeyState()` | 读取按键状态 | `Promise<Array>` |

### 按键重映射

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `remapKey(from, to)` | 重映射单个按键 | `Promise<boolean>` |
| `remapBatch(mappings)` | 批量重映射 | `Promise<boolean>` |
| `disableKey(keyCode)` | 禁用按键 | `Promise<boolean>` |
| `comboKey(keys)` | 发送组合键 | `Promise<boolean>` |
| `fireKey(keyCode)` | 触发单键 | `Promise<boolean>` |
| `mediaKey(code)` | 媒体键 | `Promise<boolean>` |
| `systemKey(code)` | 系统键 | `Promise<boolean>` |

### 事件

| 事件 | 触发时机 |
|------|----------|
| `keymap:switching` | 切换 Profile 时 |
| `keymap:switched` | 切换完成 |
| `keymap:saved` | 保存完成 |
| `keymap:remapped` | 重映射完成 |
| `keymap:combo-fired` | 组合键触发 |

### 用法示例

```javascript
import { KeymapService } from './src/services/KeymapService.js';

const keymap = new KeymapService(protocol);

// 切换配置
await keymap.switchProfile(1);

// 读取按键矩阵
const matrix = await keymap.readMatrix();
console.log('按键矩阵:', matrix);

// 重映射: 将 Q 改为 W
await keymap.remapKey(0x0A, 0x0B);

// 批量重映射
await keymap.remapBatch([
    [0x0A, 0x0B],  // Q -> W
    [0x0B, 0x0C],  // W -> E
]);

// 导出配置
const exported = await keymap.exportProfile();
const json = JSON.stringify(exported);
```

---

## 🆕 PerformanceService

性能调节服务，负责 DPI、轮询率、抬升高度、角度吸附等性能参数。

### 构造函数
```javascript
new PerformanceService(protocol)
```

### DPI 控制

| 方法 | 说明 | 范围 |
|------|------|------|
| `readDPI()` | 读取当前 DPI | - |
| `setDPI(dpi)` | 设置 DPI | 100-25600 |
| `switchDPILevel(level)` | 切换档位 (0-5) | - |
| `increaseDPI(step)` | 增加 DPI | 默认 100 |
| `decreaseDPI(step)` | 减少 DPI | 默认 100 |

### 轮询率

| 方法 | 说明 | 支持值 |
|------|------|--------|
| `readPollingRate()` | 读取轮询率 | - |
| `setPollingRate(rate)` | 设置轮询率 (Hz) | 125/250/500/1000/2000/4000/8000 |

### 抬升 & 修正

| 方法 | 说明 | 参数 |
|------|------|------|
| `readLiftHeight()` | 读取抬升高度 | - |
| `setLiftHeight(mm)` | 设置抬升高度 | 1/2/3 mm |
| `toggleAngleSnapping(b)` | 切换角度吸附 | boolean |
| `toggleLinearCalibration(b)` | 切换直线修正 | boolean |
| `toggleRippleCorrection(b)` | 切换波纹修正 | boolean |

### 性能模式

| 方法 | 说明 | 模式 |
|------|------|------|
| `setPerformanceMode(m)` | 设置模式 | standard/balanced/gaming |
| `getPerformanceStats()` | 获取统计 | - |

### 默认 DPI 档位

```javascript
dpiLevels = [800, 1200, 1600, 2400, 3200, 6400]
```

### 状态

```javascript
service.state = {
    dpi: 1200,
    dpiMin: 100,
    dpiMax: 25600,
    currentDpiLevel: 0,
    dpiLevels: [800, 1200, 1600, 2400, 3200, 6400],
    pollingRate: 1000,
    liftHeight: 2,
    angleSnapping: false,
    linearCalibration: false,
    rippleCorrection: false,
    moveSync: false,
    performanceMode: 'balanced',
}
```

### 事件

| 事件 | 触发时机 |
|------|----------|
| `performance:dpi-changed` | DPI 变化 |
| `performance:polling-changed` | 轮询率变化 |
| `performance:lift-changed` | 抬升高度变化 |
| `performance:angle-toggled` | 角度吸附切换 |
| `performance:mode-changed` | 性能模式变化 |

### 用法示例

```javascript
import { PerformanceService } from './src/services/PerformanceService.js';

const perf = new PerformanceService(protocol);

// 设置 DPI
await perf.setDPI(1600);

// 切换轮询率
await perf.setPollingRate(1000);

// 切换档位
await perf.switchDPILevel(2);  // 1600 DPI

// 开启角度吸附
await perf.toggleAngleSnapping(true);

// 设置游戏模式
await perf.setPerformanceMode('gaming');

// 监听变化
bus.on('performance:dpi-changed', ({ dpi }) => {
    console.log('DPI 已变更为:', dpi);
});
```

---

## 🆕 MacroService

宏录制/播放服务，负责宏的录制、播放、保存、加载、删除。

### 构造函数
```javascript
new MacroService(protocol)
```

### 录制

| 方法 | 说明 | 参数 |
|------|------|------|
| `startRecord(slot, name)` | 开始录制 | slot: 0x01-0x10, name? |
| `stopRecord()` | 停止并保存 | - |
| `cancelRecord()` | 取消录制 (不保存) | - |
| `captureEvent(event)` | 手动添加事件 | {keyCode, type, delay} |

### 播放

| 方法 | 说明 | 参数 |
|------|------|------|
| `play(slot, repeat)` | 播放宏 | slot, repeat=1 (0=无限) |
| `stopPlay()` | 停止播放 | - |

### 宏数据管理

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `writeMacroData(slot, data)` | 写入宏到设备 | `Promise<boolean>` |
| `readMacroData(slot)` | 读取宏 | `Promise<object>` |
| `listMacros()` | 列出所有宏 | `Promise<Array>` |
| `deleteMacro(slot)` | 删除宏 | `Promise<boolean>` |
| `exportMacro(slot)` | 导出宏 | `Promise<object>` |
| `importMacro(slot, data)` | 导入宏 | `Promise<boolean>` |

### 状态查询

| 方法 | 说明 |
|------|------|
| `getRecordingStatus()` | 获取录制状态 |
| `getMacros()` | 获取宏列表 |

### 宏数据结构

```javascript
{
    slot: 0x01,            // 槽位
    name: 'My Macro',      // 名称
    events: [              // 事件序列
        { keyCode: 0x04, type: 'down', delay: 50, timestamp: 0 },
        { keyCode: 0x04, type: 'up',   delay: 100, timestamp: 100 },
        ...
    ],
    duration: 5000,        // 总时长 (ms)
    eventCount: 10,        // 事件数
}
```

### 事件

| 事件 | 触发时机 |
|------|----------|
| `macro:recording-started` | 开始录制 |
| `macro:recording-stopped` | 停止录制 |
| `macro:recording-cancelled` | 取消录制 |
| `macro:event-recorded` | 捕获到事件 |
| `macro:playing-started` | 开始播放 |
| `macro:playing-stopped` | 停止播放 |
| `macro:listed` | 列出宏 |
| `macro:deleted` | 删除宏 |

### 用法示例

```javascript
import { MacroService } from './src/services/MacroService.js';

const macro = new MacroService(protocol);

// 1. 开始录制
await macro.startRecord(0x01, 'My Combo');

// 2. 模拟捕获按键 (实际使用时从键盘事件)
macro.captureEvent({ keyCode: 0x04, type: 'down', delay: 50 });  // A down
macro.captureEvent({ keyCode: 0x04, type: 'up',   delay: 50 });  // A up
macro.captureEvent({ keyCode: 0x05, type: 'down', delay: 50 });  // B down
macro.captureEvent({ keyCode: 0x05, type: 'up',   delay: 50 });  // B up

// 3. 停止并保存
const saved = await macro.stopRecord();
console.log('已保存宏:', saved);

// 4. 列出所有宏
const macros = await macro.listMacros();

// 5. 播放宏
await macro.play(0x01);

// 6. 删除宏
await macro.deleteMacro(0x01);

// 7. 监听录制事件
bus.on('macro:event-recorded', ({ count, event }) => {
    console.log(`已捕获 ${count} 个事件:`, event);
});
```

---

## 📊 3 个新服务对比

| 维度 | KeymapService | PerformanceService | MacroService |
|------|---------------|--------------------|--------------| 
| **类别码** | 0x02 + 0x06 | 0x03 | 0x02 |
| **核心命令** | REMAP_KEY, SWITCH_PROFILE | WRITE_DPI, WRITE_POLL_RATE | MACRO_RECORD_*, EXEC_MACRO |
| **状态持久化** | 矩阵 128 字节 | DPI + 轮询率等 | 宏数据分片 |
| **事件数** | 5+ | 5+ | 8+ |
| **复杂度** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
