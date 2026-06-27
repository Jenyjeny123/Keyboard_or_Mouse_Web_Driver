/**
 * MockTransport - 模拟设备传输层
 *
 * 用于:
 *   - 无设备时的开发调试
 *   - 单元测试
 *   - 演示模式
 *
 * 行为模拟:
 *   - 模拟 WebHID Transport 接口
 *   - 默认回环模式 (原样返回数据)
 *   - 可配置响应延迟
 *   - 可配置错误率
 *   - 可配置响应模式 (loopback/echo/static/custom)
 *   - 可定时自动推送数据
 *   - 支持 6 种预制数据格式
 */

import { bus } from '../core/EventBus.js';
import { logger } from '../core/Logger.js';

// ============================================================
// 预制数据格式 (供 UI 选择)
// ============================================================
export const MockDataPresets = {
    /** 按键事件 - 模拟随机按键按下/释放 */
    KEY_EVENT: 'key_event',
    /** 灯光数据 - 模拟当前灯光模式状态 */
    LIGHTING: 'lighting',
    /** 性能数据 - 模拟 DPI / 轮询率 */
    PERFORMANCE: 'performance',
    /** 电池电量 - 模拟电池状态 */
    BATTERY: 'battery',
    /** 宏执行 - 模拟宏播放进度 */
    MACRO: 'macro',
    /** 设备信息 - 模拟固件版本/序列号 */
    DEVICE_INFO: 'device_info',
};

export class MockTransport {
    /**
     * @param {object} options
     * @param {number} options.responseDelay - 响应延迟 (ms)
     * @param {number} options.errorRate - 错误率 (0-1)
     * @param {boolean} options.loopback - 是否回环
     * @param {string} options.responseMode - 响应模式: 'loopback'|'echo'|'static'|'none'|'custom'
     * @param {Function} options.customResponse - 自定义响应生成函数 (packet) => Uint8Array
     * @param {string[]} options.autoSendPresets - 启动时自动定时发送的预设类型
     * @param {number} options.autoSendInterval - 自动发送间隔 (ms)
     */
    constructor(options = {}) {
        this.options = {
            responseDelay: 2,
            errorRate: 0,
            loopback: true,
            responseMode: 'loopback',
            customResponse: null,
            autoSendPresets: [],
            autoSendInterval: 1000,
            realDevice: null,        // 🆕 真实设备 (WebHIDDevice) - 启用透传模式
            passthrough: false,      // 🆕 透传模式: 数据走真实设备 (Bus Hound 可见)
            ...options,
        };

        this.connected = false;
        this.receiveHandlers = [];
        this.errorHandlers = [];
        this.sendCount = 0;
        this.receiveCount = 0;

        this._autoSendTimers = new Map();
        this._autoSendEnabled = false;
        this._counter = 0;

        logger.info('MockTransport 已创建', this.options);
    }

    // ============================================================
    // 连接管理 (模拟)
    // ============================================================

    static isSupported() {
        return true;
    }

    static async listDevices() {
        return [{
            vendorId: 0x0000,
            productId: 0x0001,
            productName: 'Mock SwiftKey X1',
            serialNumber: 'MOCK-001',
            opened: false,
        }];
    }

    static async requestDevice() {
        return (await this.listDevices())[0];
    }

    async connect() {
        await new Promise(r => setTimeout(r, 10));
        this.connected = true;
        logger.info('MockTransport 已连接');
        if (this.options.autoSendPresets.length > 0) {
            this.startAutoSend(this.options.autoSendPresets);
        }
    }

    async disconnect() {
        this.stopAutoSend();
        this.connected = false;
        logger.info('MockTransport 已断开');
    }

    // ============================================================
    // 数据收发
    // ============================================================

    async send(packet) {
        if (!this.connected) {
            throw new Error('MockTransport 未连接');
        }

        this.sendCount++;
        logger.debug(`Mock send #${this.sendCount}: ${this._toHex(packet)}`);

        // 🆕 透传模式: 数据走真实设备 (Bus Hound 可见)
        if (this.options.passthrough && this.options.realDevice) {
            try {
                await this.options.realDevice.sendReport(packet[0], packet.slice(1));
                bus.emit('mock:passthrough-sent', { data: packet });
                logger.info('✓ 数据已透传到真实设备 (Bus Hound 可见)');
            } catch (err) {
                logger.error('透传失败:', err);
                throw err;
            }
        }

        if (Math.random() < this.options.errorRate) {
            const err = new Error('模拟发送错误');
            this.errorHandlers.forEach(h => h(err));
            throw err;
        }

        if (this.options.responseDelay > 0) {
            await new Promise(r => setTimeout(r, this.options.responseDelay));
        }

        const response = this._generateResponse(packet);
        if (response) {
            this.receiveCount++;
            this.receiveHandlers.forEach(h => h(response));
        }
    }

    _generateResponse(packet) {
        switch (this.options.responseMode) {
            case 'loopback':
                return packet.slice();
            case 'echo': {
                const echoed = new Uint8Array(packet.length);
                for (let i = 0; i < packet.length; i++) {
                    echoed[i] = packet[packet.length - 1 - i];
                }
                return echoed;
            }
            case 'static':
                return new Uint8Array(64);
            case 'custom':
                if (typeof this.options.customResponse === 'function') {
                    try {
                        return this.options.customResponse(packet);
                    } catch (err) {
                        logger.error('自定义响应出错:', err);
                        return null;
                    }
                }
                return null;
            case 'none':
            default:
                return null;
        }
    }

    // ============================================================
    // 自动发送 (模拟设备主动上报)
    // ============================================================

    startAutoSend(presets = null) {
        if (presets) this.options.autoSendPresets = presets;
        this.stopAutoSend();
        this._autoSendEnabled = true;
        for (const preset of this.options.autoSendPresets) {
            this._startPresetTimer(preset);
        }
        logger.info(`MockTransport 自动发送已启动: [${this.options.autoSendPresets.join(', ')}]`);
    }

    stopAutoSend() {
        this._autoSendEnabled = false;
        for (const [, timer] of this._autoSendTimers) {
            clearInterval(timer);
        }
        this._autoSendTimers.clear();
    }

    _startPresetTimer(preset) {
        if (this._autoSendTimers.has(preset)) return;
        const timer = setInterval(() => {
            if (!this._autoSendEnabled || !this.connected) return;
            const data = MockTransport.generatePresetData(preset, this._counter++);
            this.receiveCount++;
            this.receiveHandlers.forEach(h => h(data));
            bus.emit('mock:data-sent', { preset, data });
        }, this.options.autoSendInterval);
        this._autoSendTimers.set(preset, timer);
    }

    pushData(preset, counter = 0) {
        if (!this.connected) return;
        const data = MockTransport.generatePresetData(preset, counter);
        this.receiveCount++;
        this.receiveHandlers.forEach(h => h(data));
        bus.emit('mock:data-sent', { preset, data });
    }

    static generatePresetData(preset, counter = 0) {
        const data = new Uint8Array(64);
        switch (preset) {
            case MockDataPresets.KEY_EVENT: {
                data[0] = 0x01;
                data[1] = 0x00;
                data[2] = 0x00;
                const keyCodes = [0x04, 0x05, 0x06, 0x07, 0x08, 0x09];
                const idx = counter % keyCodes.length;
                data[3] = keyCodes[idx];
                data[4] = counter % 2 === 0 ? keyCodes[(idx + 1) % keyCodes.length] : 0x00;
                return data;
            }
            case MockDataPresets.LIGHTING: {
                data[0] = 0x02;
                data[1] = 0x01;
                data[2] = (counter * 10) % 256;
                data[3] = (counter * 5) % 256;
                data[4] = 128;
                data[5] = 200;
                data[6] = 50;
                return data;
            }
            case MockDataPresets.PERFORMANCE: {
                data[0] = 0x03;
                data[1] = (1600 >> 0) & 0xFF;
                data[2] = (1600 >> 8) & 0xFF;
                data[3] = (1600 >> 0) & 0xFF;
                data[4] = (1600 >> 8) & 0xFF;
                data[5] = 8;
                data[6] = 0;
                data[7] = 2;
                return data;
            }
            case MockDataPresets.BATTERY: {
                data[0] = 0x05;
                data[1] = 80 + (counter % 20);
                data[2] = 0x01;
                data[3] = 4200 & 0xFF;
                data[4] = (4200 >> 8) & 0xFF;
                return data;
            }
            case MockDataPresets.MACRO: {
                data[0] = 0x06;
                data[1] = 0x01;
                data[2] = (counter * 5) % 100;
                data[3] = 0x00;
                return data;
            }
            case MockDataPresets.DEVICE_INFO: {
                data[0] = 0x07;
                const fw = 'V3.0.1';
                for (let i = 0; i < fw.length; i++) {
                    data[1 + i] = fw.charCodeAt(i);
                }
                const sn = 'SN20260001';
                for (let i = 0; i < sn.length && (1 + fw.length + i) < 64; i++) {
                    data[1 + fw.length + i] = sn.charCodeAt(i);
                }
                return data;
            }
            default:
                return data;
        }
    }

    setCustomResponse(fn) {
        this.options.customResponse = fn;
        this.options.responseMode = 'custom';
    }

    onReceive(handler) {
        this.receiveHandlers.push(handler);
    }

    onError(handler) {
        this.errorHandlers.push(handler);
    }

    _toHex(data) {
        return Array.from(data).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    }
}
