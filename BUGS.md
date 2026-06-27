# Bug 记录与解决方案

本文档记录 keyboard-driver 项目开发和调试过程中遇到的所有 Bug 及其解决方案。

---

## Bug #1: ES Modules 缓存参数导致 EventBus 单例分裂

**严重程度:** 致命  
**文件:** `index_v3.html`, 所有 JS 模块

### 问题描述
设备连接成功后（控制台显示 `设备已连接: STM32 Custom Human interface`），UI 没有切换到主界面，设备信息面板一直显示"未连接设备"。

### 根因
`index_v3.html` 中的 ES Module 导入使用了缓存破坏查询参数 `?v=4`：

```javascript
import { bus } from './src/core/EventBus.js?v=4';
```

而 `DeviceService.js` 内部导入的是不带参数的路径：

```javascript
import { bus } from '../core/EventBus.js';
```

浏览器将 `EventBus.js?v=4` 和 `EventBus.js` 视为**两个不同的模块 URL**，分别创建了**两个独立的 `bus` 实例**：

- `DeviceService` 在实例 B 上 `emit('device:connected')`
- `index_v3.html` 在实例 A 上 `on('device:connected')`
- 事件永远无法传递，UI 层收不到任何设备连接通知

### 解决方案
去掉 `index_v3.html` 中所有导入的 `?v=4` 查询参数，确保所有模块通过相同路径引用 `EventBus.js`，共享同一个单例实例：

```javascript
// 修复前
import { bus } from './src/core/EventBus.js?v=4';

// 修复后
import { bus } from './src/core/EventBus.js';
```

### 教训
- ES Modules 的查询参数会改变模块标识，导致单例模式失效
- 如果需要缓存破坏，应该在所有导入路径中统一使用相同参数，或使用构建工具处理
- 更好的做法：开发时通过 HTTP 头 `Cache-Control: no-cache` 控制缓存，而非查询参数

---

## Bug #2: WebHID 设备选择器不弹出 — 用户手势丢失

**严重程度:** 致命  
**文件:** `index_v3.html`

### 问题描述
点击"直接连接"按钮后，页面卡在"⏳ 正在请求设备权限..."，Chrome 的设备选择器对话框不弹出。

### 根因
`navigator.hid.requestDevice()` 必须在**用户手势（user gesture / transient activation）** 的上下文中调用。当 `directConnect` 函数定义在 `<script type="module">` 中时，Chrome 的 ES Module 作用域会导致用户手势在 `await` 之后丢失，`requestDevice()` 被浏览器安全策略静默阻止。

### 解决方案
将 `directConnect` 函数定义在**普通 `<script>` 标签**（非 module）中，确保用户手势完整传递：

```html
<!-- 普通 script 标签，非 module -->
<script>
    window.directConnect = async function() {
        var devices = await navigator.hid.requestDevice({
            filters: [{ vendorId: 0x320F, productId: 0x1234 }]
        });
        // ...
    };
</script>
```

同时按钮使用 `onclick="directConnect()"` 而非 `addEventListener`，确保点击事件直接触发全局函数。

### 教训
- Chrome 的 user gesture 在 ES Module 的 `await` 之后可能失效
- WebHID / WebUSB / WebBluetooth 等需要用户授权的 API 必须在普通 script 的用户交互回调中调用
- 避免在 `requestDevice()` 之前有任何 `await` 调用（包括 `getDevices()`），否则会消耗用户手势

---

## Bug #3: 已授权设备调用 requestDevice() 返回空数组

**严重程度:** 高  
**文件:** `index_v3.html`

### 问题描述
设备之前已经授权过，再次点击"直接连接"时 `requestDevice()` 返回 0 个设备，不弹出选择器。

### 根因
Chrome 对已授权的 HID 设备调用 `requestDevice()` 时，不会重新弹出选择器，直接返回空数组。

### 解决方案
先调用 `getDevices()` 查找已授权设备，找到目标设备后直接连接；只有未找到时才调用 `requestDevice()` 弹出选择器：

```javascript
var devices = await navigator.hid.getDevices();
// 过滤目标设备
var targetDevice = null;
for (var i = 0; i < devices.length; i++) {
    if (devices[i].vendorId === 0x320F && devices[i].productId === 0x1234) {
        targetDevice = devices[i];
        break;
    }
}
if (!targetDevice) {
    devices = await navigator.hid.requestDevice({
        filters: [{ vendorId: 0x320F, productId: 0x1234 }]
    });
    if (devices.length > 0) targetDevice = devices[0];
}
```

### 教训
- `requestDevice()` 不总是弹出选择器，已授权设备会直接返回空数组
- 连接逻辑应先尝试 `getDevices()` 复用已授权设备

---

## Bug #4: WebHIDTransport.listDevices 不是函数

**严重程度:** 高  
**文件:** `WebHIDTransport.js`, `DeviceService.js`

### 问题描述
`WebHIDTransport.listDevices is not a function`

### 根因
`listDevices` 和 `request` 被定义为实例方法，但 `DeviceService` 以静态方式调用。

### 解决方案
将 `listDevices` 和 `request` 改为 `WebHIDTransport` 的静态方法：

```javascript
static async request(filters) {
    return await navigator.hid.requestDevice({ filters });
}

static async listDevices() {
    return await navigator.hid.getDevices();
}
```

---

## Bug #5: "设备不能为空" 连接错误

**严重程度:** 高  
**文件:** `DeviceService.js`, `WebHIDTransport.js`

### 问题描述
调用 `connectDevice()` 时报错 "设备不能为空"。

### 根因
`WebHIDTransport` 构造函数中传入了 `device` 参数，但 `connect()` 方法又需要传入 `device`，导致构造函数中的设备被覆盖或丢失。

### 解决方案
创建 `WebHIDTransport` 时不传入设备，在 `connect()` 方法中传入：

```javascript
// 修复前
this.transport = new WebHIDTransport(device);
await this.transport.connect();

// 修复后
this.transport = new WebHIDTransport();
await this.transport.connect(device);
```

---

## Bug #6: Bus Hound 无法捕获模拟数据

**严重程度:** 中  
**文件:** `MockTransport.js`

### 问题描述
MockTransport 发送的模拟数据无法被 Bus Hound 等 USB 监控工具捕获。

### 根因
MockTransport 是纯软件模拟，数据不经过真实 USB 传输层。

### 解决方案
添加透传模式（passthrough mode），通过真实 HID 设备的 `sendReport()` 发送数据：

```javascript
async send(packet) {
    if (this.options.passthrough && this.options.realDevice) {
        await this.options.realDevice.sendReport(packet[0], packet.slice(1));
    }
    // ... 原有模拟逻辑
}
```

### 教训
- 纯软件模拟的数据不会出现在 USB 总线监控工具中
- 需要 Bus Hound 可见性时，必须通过真实设备的 `sendReport()` 路由数据

---

## Bug #7: 设备列表点击后进入主界面但设备未连接

**严重程度:** 高  
**文件:** `DeviceService.js`, `index_v3.html`

### 问题描述
点击搜索到的设备列表项后，UI 切换到主界面，但设备实际未连接。

### 根因
`_connectDevice()` 中设置了 `transport.onReceive()` 回调，覆盖了 Protocol 内部的接收处理器，导致协议层无法正常工作。

### 解决方案
移除 `_connectDevice()` 中多余的 `onReceive`/`onError` 监听，让 Protocol 层自行管理传输层的事件回调。

---

## Bug #8: 用户取消设备选择器产生错误日志

**严重程度:** 低  
**文件:** `DeviceService.js`

### 问题描述
用户在设备选择器中点击"取消"时，控制台输出错误日志 "请求设备失败: 未选择任何设备"。

### 根因
`requestDevice()` 返回空数组时被当作错误处理。

### 解决方案
当 `devices.length === 0` 时返回 `null` 而非抛出异常，在 UI 层静默处理（恢复初始状态）。

---

## Bug #9: instanceof 检查在 ES Modules 中失败

**严重程度:** 中  
**文件:** `DeviceService.js`

### 问题描述
检查 `transport instanceof MockTransport` 始终返回 `false`，导致模拟模式无法激活。

### 根因
ES Modules 的类标识在不同模块加载路径下可能不一致，`instanceof` 检查失败。

### 解决方案
用鸭子类型（duck typing）替换 `instanceof`：

```javascript
// 修复前
if (this.transport instanceof MockTransport) { ... }

// 修复后
if (this.transport && typeof this.transport.pushData === 'function') { ... }
```

---

## Bug #10: device.open() 无限挂起

**严重程度:** 高  
**文件:** `WebHIDTransport.js`

### 问题描述
`device.open()` 在设备被 Bus Hound 等工具占用时无限挂起，页面卡死。

### 根因
`device.open()` 没有超时保护，当设备被其他进程占用时会永远等待。

### 解决方案
使用 `Promise.race()` 为 `device.open()` 添加超时保护：

```javascript
const CONNECT_TIMEOUT = 3000;

await Promise.race([
    device.open(),
    new Promise((_, reject) =>
        setTimeout(() => reject(new Error(
            `设备打开超时 (${CONNECT_TIMEOUT / 1000}s) — 请检查设备是否被 Bus Hound 或其他工具占用`
        )), CONNECT_TIMEOUT)
    ),
]);
```

---

## 总结

| # | Bug | 根因 | 关键修复 |
|---|-----|------|---------|
| 1 | EventBus 单例分裂 | `?v=4` 导致模块 URL 不同 | 去掉所有 `?v=` 参数 |
| 2 | 设备选择器不弹出 | ES Module 中 user gesture 丢失 | 改用普通 `<script>` 标签 |
| 3 | 已授权设备返回空数组 | Chrome 不重复弹出选择器 | 先 `getDevices()` 再 `requestDevice()` |
| 4 | listDevices 不是函数 | 实例方法被静态调用 | 改为静态方法 |
| 5 | 设备不能为空 | 构造函数与 connect() 参数冲突 | connect() 中传入设备 |
| 6 | Bus Hound 看不到数据 | 纯软件模拟无 USB 传输 | 添加透传模式 |
| 7 | 设备列表点击未连接 | onReceive 覆盖 Protocol | 移除多余监听 |
| 8 | 取消选择器产生错误日志 | 空数组被当错误 | 返回 null 静默处理 |
| 9 | instanceof 检查失败 | ES Module 类标识不一致 | 改用鸭子类型 |
| 10 | device.open() 无限挂起 | 无超时保护 | Promise.race() 超时 |
