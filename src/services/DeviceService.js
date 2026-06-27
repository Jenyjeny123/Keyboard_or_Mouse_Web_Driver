/**
 * DeviceService - 设备管理服务层
 *
 * 职责:
 *   - 设备搜索、连接、断开
 *   - 设备类型识别
 *   - 驱动创建
 *   - 设备状态管理
 *   - 连接状态变化通知
 */

import { bus } from '../core/EventBus.js';
import { logger } from '../core/Logger.js';
import { WebHIDTransport } from '../transport/WebHIDTransport.js';
import { MockTransport } from '../transport/MockTransport.js';
import { Protocol } from '../protocol/Protocol.js';

/**
 * 设备类型
 */
export const DeviceType = {
    KEYBOARD: 'keyboard',
    MOUSE: 'mouse',
    MOUSEPAD: 'mousepad',
    HEADSET: 'headset',
    UNKNOWN: 'unknown',
};

/**
 * 设备类型检测 (基于 VID/PID)
 * 实际项目应使用真实的产品 ID
 */
const KNOWN_DEVICES = {
    // SwiftKey X1 键盘
    '0x320f:0x1234': { vendor: 0x320F, product: 0x1234, type: DeviceType.KEYBOARD, name: 'SwiftKey X1' },
};

/**
 * 设备状态
 */
export const DeviceStatus = {
    DISCONNECTED: 'disconnected',
    SEARCHING: 'searching',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    ERROR: 'error',
};

export class DeviceService {
    constructor() {
        this.transport = null;
        this.protocol = null;
        this.status = DeviceStatus.DISCONNECTED;
        this.deviceInfo = null;
        this.deviceType = DeviceType.UNKNOWN;
        this.mockMode = false;
        this.cachedDevices = [];  // 🆕 缓存搜索到的设备列表

        logger.info('DeviceService 已创建');
    }

    // ============================================================
    // 状态
    // ============================================================

    getStatus() {
        return this.status;
    }

    isConnected() {
        return this.status === DeviceStatus.CONNECTED;
    }

    getDeviceInfo() {
        return { ...this.deviceInfo };
    }

    getDeviceType() {
        return this.deviceType;
    }

    getProtocol() {
        return this.protocol;
    }

    isMockMode() {
        return this.mockMode;
    }

    // ============================================================
    // 设备搜索与连接
    // ============================================================

    /**
     * 检查 WebHID 支持
     */
    static isWebHIDSupported() {
        return WebHIDTransport.isSupported();
    }

    /**
     * 搜索已授权的设备
     */
    async searchDevices() {
        this._setStatus(DeviceStatus.SEARCHING);
        try {
            const devices = await WebHIDTransport.listDevices();
            // 过滤目标设备: SwiftKey X1 (VID: 0x320F, PID: 0x1234)
            this.cachedDevices = devices.filter(d =>
                d.vendorId === 0x320F && d.productId === 0x1234
            );
            logger.info(`找到 ${this.cachedDevices.length} 个 SwiftKey X1 设备 (共 ${devices.length} 个已授权设备)`);
            bus.emit('device:search-completed', { devices: this.cachedDevices });
            return this.cachedDevices;
        } catch (err) {
            logger.error(`搜索设备失败: ${err.message}`);
            this._setStatus(DeviceStatus.ERROR);
            bus.emit('device:error', { error: err });
            throw err;
        }
    }

    /**
     * 从已搜索的设备列表中连接指定设备
     * @param {number} index 设备在列表中的索引
     */
    async connectFromList(index) {
        this._setStatus(DeviceStatus.CONNECTING);
        try {
            // 优先使用缓存的设备列表, 避免重新查询
            let devices = this.cachedDevices;
            if (!devices || devices.length === 0) {
                devices = await WebHIDTransport.listDevices();
                this.cachedDevices = devices;
            }
            if (index < 0 || index >= devices.length) {
                throw new Error(`设备索引 ${index} 超出范围 (0-${devices.length - 1}), 请重新搜索`);
            }
            const device = devices[index];
            logger.info(`正在连接设备 #${index}: ${device.productName || 'Unknown'} (VID: 0x${(device.vendorId||0).toString(16).padStart(4,'0')}, PID: 0x${(device.productId||0).toString(16).padStart(4,'0')})`);
            return await this._connectDevice(device);
        } catch (err) {
            logger.error(`连接设备失败: ${err.message}`);
            this._setStatus(DeviceStatus.ERROR);
            bus.emit('device:error', { error: err });
            throw err;
        }
    }

    /**
     * 连接指定的 HIDDevice 对象 (供 inline onclick 全局函数调用)
     * @param {HIDDevice} device - 从 navigator.hid.requestDevice() 获取的设备
     */
    async connectDevice(device) {
        return await this._connectDevice(device);
    }

    /**
     * 请求设备权限 (弹出选择器)
     * @param {HIDDeviceFilter[]} filters - 设备过滤器 (VID/PID)
     */
    async requestDevice(filters = null) {
        this._setStatus(DeviceStatus.CONNECTING);
        try {
            // 直接用 navigator.hid.requestDevice() 弹出选择器,
            // 获取全新的 device 对象 (与原始 index.html 的 directRequestDevice 一致)
            const deviceFilters = filters || [
                { vendorId: 0x320F, productId: 0x1234 }
            ];
            const devices = await WebHIDTransport.request(deviceFilters);
            if (devices.length === 0) {
                // 用户取消了选择器, 静默返回
                this._setStatus(DeviceStatus.DISCONNECTED);
                return null;
            }

            // 过滤键盘接口 (有 OUT 端点)
            const keyboardDevice = this._findKeyboardInterface(devices);
            if (!keyboardDevice) {
                const err = new Error('未找到键盘接口，请确保连接的是键盘而非鼠标接口');
                logger.error(err.message);
                this._setStatus(DeviceStatus.ERROR);
                bus.emit('device:error', { error: err });
                throw err;
            }

            logger.info(`用户选择了设备: ${keyboardDevice.productName || 'Unknown'}`);
            return await this._connectDevice(keyboardDevice);
        } catch (err) {
            logger.error(`请求设备失败: ${err.message}`);
            this._setStatus(DeviceStatus.ERROR);
            bus.emit('device:error', { error: err });
            throw err;
        }
    }

    /**
     * 直接连接 (用户已选择过, 优先匹配 VID/PID)
     */
    async directConnect() {
        const devices = await this.searchDevices();
        if (devices.length === 0) {
            throw new Error('没有可用的设备, 请先点击「直接连接」授权设备');
        }
        // 优先匹配 SwiftKey X1 (VID: 0x320F, PID: 0x1234)
        const target = devices.find(d =>
            d.vendorId === 0x320F && d.productId === 0x1234
        ) || devices[0];
        logger.info(`直接连接目标设备: ${target.productName || 'Unknown'} (VID: 0x${target.vendorId.toString(16).padStart(4,'0')}, PID: 0x${target.productId.toString(16).padStart(4,'0')})`);
        return await this._connectDevice(target);
    }

    /**
     * 连接到指定设备
     */
    async _connectDevice(device) {
        this._setStatus(DeviceStatus.CONNECTING);
        try {
            // 1. 创建 Transport 并连接设备
            this.transport = new WebHIDTransport();
            await this.transport.connect(device);

            // 2. 设备打开后，验证接口类型（键盘 vs 鼠标）
            if (!this._isKeyboardInterface(device)) {
                logger.error(`检测到鼠标接口，正在关闭设备...`);
                await this.transport.disconnect();
                throw new Error('连接的是鼠标接口，请选择键盘接口');
            }

            // 3. 识别设备类型
            this.deviceType = this._detectDeviceType(device);
            this.deviceInfo = {
                vendorId: device.vendorId,
                productId: device.productId,
                productName: device.productName || 'Unknown',
                serialNumber: device.serialNumber,
                type: this.deviceType,
            };

            // 4. 创建 Protocol (Protocol 内部会接管 transport.onReceive/onError)
            this.protocol = new Protocol(this.transport);

            // 5. 更新状态
            this.mockMode = false;
            this._setStatus(DeviceStatus.CONNECTED);
            logger.info(`设备已连接: ${this.deviceInfo.productName} (${this.deviceType})`);
            bus.emit('device:connected', { deviceInfo: this.deviceInfo });

            return this.deviceInfo;
        } catch (err) {
            logger.error(`连接设备失败: ${err.message}`);
            this._setStatus(DeviceStatus.ERROR);
            this._cleanup();
            throw err;
        }
    }

    /**
     * 激活模拟模式 (无设备时使用)
     * @param {object} options
     * @param {boolean} options.passthrough - 是否启用透传到真实设备 (Bus Hound 可见)
     * @param {HIDDevice} options.realDevice - 真实 HID 设备 (透传目标)
     */
    async activateMockMode(options = {}) {
        this.mockMode = true;
        // 🆕 支持透传模式: Mock 数据实际通过真实设备发出 (Bus Hound 可见)
        this.transport = new MockTransport({
            passthrough: !!options.passthrough,
            realDevice: options.realDevice || null,
        });
        await this.transport.connect();
        this.protocol = new Protocol(this.transport);
        this.deviceType = DeviceType.KEYBOARD; // 默认为键盘
        this.deviceInfo = {
            vendorId: options.realDevice?.vendorId || 0x0000,
            productId: options.realDevice?.productId || 0x0001,
            productName: options.realDevice?.productName || 'Mock Device',
            serialNumber: options.realDevice?.serialNumber || 'MOCK-001',
            type: this.deviceType,
            passthrough: !!options.passthrough,
        };
        this._setStatus(DeviceStatus.CONNECTED);
        if (options.passthrough) {
            logger.warn('已进入模拟模式 (透传真实设备) - Bus Hound 可见');
        } else {
            logger.warn('已进入模拟模式 (无真实设备) - Bus Hound 不可见');
        }
        bus.emit('device:connected', { deviceInfo: this.deviceInfo, mock: true });
        return this.deviceInfo;
    }

    /**
     * 断开设备
     */
    async disconnect() {
        if (!this.isConnected()) {
            return;
        }

        try {
            if (this.transport) {
                await this.transport.disconnect();
            }
        } catch (err) {
            logger.warn(`断开时出现错误: ${err.message}`);
        } finally {
            this._cleanup();
            this._setStatus(DeviceStatus.DISCONNECTED);
            logger.info('设备已断开');
            bus.emit('device:disconnected', { mock: this.mockMode });
        }
    }

    // ============================================================
    // 内部方法
    // ============================================================

    /**
     * 检测设备类型
     */
    _detectDeviceType(device) {
        const { vendorId, productId } = device;
        const key = `${vendorId}:${productId}`;
        const known = KNOWN_DEVICES[key];
        if (known) {
            return known.type;
        }

        // 默认根据接口类型判断 (HID 设备细分困难, 默认为键盘)
        return DeviceType.KEYBOARD;
    }

    /**
     * 从设备列表中查找键盘接口
     *
     * 检测策略 (按优先级):
     *   1. collections 中 usagePage=0x01, usage=0x06 → 键盘
     *   2. collections 中有 outputReports → 有 OUT 端点 → 键盘
     *   3. 排除 usagePage=0x01, usage=0x02 → 鼠标
     *
     * @param {HIDDevice[]} devices - 设备列表
     * @returns {HIDDevice|null} - 键盘接口设备或 null
     */
    _findKeyboardInterface(devices) {
        // 先打印所有设备的详细信息，方便调试
        for (let i = 0; i < devices.length; i++) {
            const d = devices[i];
            logger.info(`[设备 ${i}] ${d.productName} | ` +
                `opened=${d.opened} | ` +
                `collections=${JSON.stringify((d.collections || []).map(c => ({
                    usagePage: '0x' + (c.usagePage || 0).toString(16),
                    usage: '0x' + (c.usage || 0).toString(16),
                    inputReports: c.inputReports?.length ?? 0,
                    outputReports: c.outputReports?.length ?? 0,
                    featureReports: c.featureReports?.length ?? 0,
                })))}`
            );
        }

        for (const device of devices) {
            if (!device.collections || device.collections.length === 0) {
                continue;
            }

            let isKeyboard = false;
            let isMouse = false;
            let hasOutput = false;

            for (const collection of device.collections) {
                // 键盘: usagePage=0x01, usage=0x06
                if (collection.usagePage === 0x01 && collection.usage === 0x06) {
                    isKeyboard = true;
                }
                // 鼠标: usagePage=0x01, usage=0x02
                if (collection.usagePage === 0x01 && collection.usage === 0x02) {
                    isMouse = true;
                }
                // 有 outputReports 说明有 OUT 端点
                if (collection.outputReports && collection.outputReports.length > 0) {
                    hasOutput = true;
                }
            }

            logger.info(`设备 ${device.productName}: isKeyboard=${isKeyboard}, isMouse=${isMouse}, hasOutput=${hasOutput}`);

            // 是键盘接口 且 不是鼠标接口
            if (isKeyboard && !isMouse) {
                logger.info(`找到键盘接口: ${device.productName}`);
                return device;
            }

            // 有 OUT 端点且不是鼠标
            if (hasOutput && !isMouse) {
                logger.info(`找到有 OUT 端点的非鼠标设备: ${device.productName}`);
                return device;
            }
        }

        // 未找到键盘接口
        logger.warn(`未找到键盘接口，共 ${devices.length} 个设备均为鼠标或未知类型`);
        return null;
    }

    /**
     * 验证单个设备是否为键盘接口 (在设备打开后调用)
     * @param {HIDDevice} device - 已打开的设备
     * @returns {boolean} - true=键盘接口, false=鼠标接口
     */
    _isKeyboardInterface(device) {
        logger.info(`验证接口类型: ${device.productName}`);
        logger.info(`  opened=${device.opened}`);
        logger.info(`  collections=${JSON.stringify((device.collections || []).map(c => ({
            usagePage: '0x' + (c.usagePage || 0).toString(16),
            usage: '0x' + (c.usage || 0).toString(16),
            outputReports: c.outputReports?.length ?? 0,
        })))}`);

        if (!device.collections || device.collections.length === 0) {
            // 如果没有 collections 信息，默认认为是键盘（兼容旧设备）
            logger.warn('无 collections 信息，默认认为是键盘接口');
            return true;
        }

        let isKeyboard = false;
        let isMouse = false;

        for (const collection of device.collections) {
            // 键盘: usagePage=0x01, usage=0x06
            if (collection.usagePage === 0x01 && collection.usage === 0x06) {
                isKeyboard = true;
            }
            // 鼠标: usagePage=0x01, usage=0x02
            if (collection.usagePage === 0x01 && collection.usage === 0x02) {
                isMouse = true;
            }
        }

        logger.info(`  isKeyboard=${isKeyboard}, isMouse=${isMouse}`);

        // 如果是鼠标接口，返回 false
        if (isMouse && !isKeyboard) {
            return false;
        }

        // 其他情况（键盘或未知）都认为是键盘接口
        return true;
    }

    /**
     * 设置状态
     */
    _setStatus(status) {
        const old = this.status;
        this.status = status;
        if (old !== status) {
            bus.emit('device:status-changed', { old, new: status });
        }
    }

    /**
     * 清理资源
     */
    _cleanup() {
        this.transport = null;
        this.protocol = null;
        this.deviceInfo = null;
        this.deviceType = DeviceType.UNKNOWN;
        this.mockMode = false;
    }
}

export default DeviceService;
