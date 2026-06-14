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
    // 示例: 后续接入真实设备时填写
    // 0x1234: { vendor: 0x1234, product: 0x5678, type: DeviceType.KEYBOARD, name: 'SwiftKey X1' }
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
            logger.info(`找到 ${devices.length} 个已授权设备`);
            bus.emit('device:search-completed', { devices });
            return devices;
        } catch (err) {
            logger.error(`搜索设备失败: ${err.message}`);
            this._setStatus(DeviceStatus.ERROR);
            bus.emit('device:error', { error: err });
            throw err;
        }
    }

    /**
     * 请求设备权限 (弹出选择器)
     */
    async requestDevice() {
        this._setStatus(DeviceStatus.CONNECTING);
        try {
            const device = await WebHIDTransport.requestDevice();
            logger.info(`用户选择了设备: ${device.productName || 'Unknown'}`);
            return await this._connectDevice(device);
        } catch (err) {
            logger.error(`请求设备失败: ${err.message}`);
            this._setStatus(DeviceStatus.ERROR);
            bus.emit('device:error', { error: err });
            throw err;
        }
    }

    /**
     * 直接连接 (用户已选择过)
     */
    async directConnect() {
        const devices = await this.searchDevices();
        if (devices.length === 0) {
            throw new Error('没有可用的设备, 请先请求权限');
        }
        return await this._connectDevice(devices[0]);
    }

    /**
     * 连接到指定设备
     */
    async _connectDevice(device) {
        this._setStatus(DeviceStatus.CONNECTING);
        try {
            // 1. 创建 Transport
            this.transport = new WebHIDTransport(device);
            await this.transport.connect();

            // 2. 识别设备类型
            this.deviceType = this._detectDeviceType(device);
            this.deviceInfo = {
                vendorId: device.vendorId,
                productId: device.productId,
                productName: device.productName || 'Unknown',
                serialNumber: device.serialNumber,
                type: this.deviceType,
            };

            // 3. 创建 Protocol
            this.protocol = new Protocol(this.transport);

            // 4. 设置接收监听
            this.transport.onReceive((data) => {
                bus.emit('device:data-received', { data });
            });

            this.transport.onError((err) => {
                logger.error(`Transport 错误: ${err.message}`);
                bus.emit('device:error', { error: err });
            });

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
     */
    async activateMockMode() {
        this.mockMode = true;
        this.transport = new MockTransport();
        await this.transport.connect();  // ← 关键: 先连接
        this.protocol = new Protocol(this.transport);
        this.deviceType = DeviceType.KEYBOARD; // 默认为键盘
        this.deviceInfo = {
            vendorId: 0x0000,
            productId: 0x0001,
            productName: 'Mock Device',
            serialNumber: 'MOCK-001',
            type: this.deviceType,
        };
        this._setStatus(DeviceStatus.CONNECTED);
        logger.warn('已进入模拟模式 (无真实设备)');
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
