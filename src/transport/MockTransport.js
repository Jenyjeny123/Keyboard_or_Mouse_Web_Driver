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
 */

import { bus } from '../core/EventBus.js';
import { logger } from '../core/Logger.js';

export class MockTransport {
    /**
     * @param {object} options
     * @param {number} options.responseDelay - 响应延迟 (ms)
     * @param {number} options.errorRate - 错误率 (0-1)
     * @param {boolean} options.loopback - 是否回环
     * @param {string} options.responseMode - 响应模式: 'loopback'|'echo'|'static'|'none'
     */
    constructor(options = {}) {
        this.options = {
            responseDelay: 2,
            errorRate: 0,
            loopback: true,
            responseMode: 'loopback',  // loopback: 原样返回, echo: 镜像返回
            ...options,
        };

        this.connected = false;
        this.receiveHandlers = [];
        this.errorHandlers = [];
        this.sendCount = 0;
        this.receiveCount = 0;

        logger.info('MockTransport 已创建', this.options);
    }

    // ============================================================
    // 连接管理 (模拟)
    // ============================================================

    static isSupported() {
        return true; // 模拟设备总是"支持"
    }

    static async listDevices() {
        // 返回一个模拟设备
        return [{
            vendorId: 0x0000,
            productId: 0x0001,
            productName: 'Mock SwiftKey X1',
            serialNumber: 'MOCK-001',
            opened: false,
        }];
    }

    static async requestDevice() {
        // 模拟用户选择
        return (await this.listDevices())[0];
    }

    async connect() {
        await new Promise(r => setTimeout(r, 10));
        this.connected = true;
        logger.info('MockTransport 已连接');
    }

    async disconnect() {
        this.connected = false;
        logger.info('MockTransport 已断开');
    }

    // ============================================================
    // 数据收发
    // ============================================================

    /**
     * 发送数据
     * @param {Uint8Array} packet - 完整 64 字节包 (含 Report ID)
     */
    async send(packet) {
        if (!this.connected) {
            throw new Error('MockTransport 未连接');
        }

        this.sendCount++;
        logger.debug(`Mock send #${this.sendCount}: ${this._toHex(packet)}`);

        // 模拟错误
        if (Math.random() < this.options.errorRate) {
            const err = new Error('模拟发送错误');
            this.errorHandlers.forEach(h => h(err));
            throw err;
        }

        // 模拟响应延迟
        if (this.options.responseDelay > 0) {
            await new Promise(r => setTimeout(r, this.options.responseDelay));
        }

        // 生成响应
        const response = this._generateResponse(packet);
        if (response) {
            this.receiveCount++;
            this.receiveHandlers.forEach(h => h(response));
        }
    }

    /**
     * 生成响应数据
     */
    _generateResponse(packet) {
        switch (this.options.responseMode) {
            case 'loopback':
                // 回环: 原样返回 (去除 Report ID 后的部分)
                return packet.slice();

            case 'echo':
                // 镜像: 将数据反向返回
                const echoed = new Uint8Array(packet.length);
                for (let i = 0; i < packet.length; i++) {
                    echoed[i] = packet[packet.length - 1 - i];
                }
                return echoed;

            case 'static':
                // 静态: 返回固定数据
                return new Uint8Array(64); // 全 0

            case 'none':
            default:
                return null;
        }
    }

    /**
     * 监听接收
     */
    onReceive(handler) {
        this.receiveHandlers.push(handler);
        return () => {
            const idx = this.receiveHandlers.indexOf(handler);
            if (idx >= 0) this.receiveHandlers.splice(idx, 1);
        };
    }

    /**
     * 监听错误
     */
    onError(handler) {
        this.errorHandlers.push(handler);
        return () => {
            const idx = this.errorHandlers.indexOf(handler);
            if (idx >= 0) this.errorHandlers.splice(idx, 1);
        };
    }

    // ============================================================
    // 配置
    // ============================================================

    /**
     * 设置响应延迟
     */
    setResponseDelay(ms) {
        this.options.responseDelay = ms;
        logger.info(`MockTransport 响应延迟: ${ms}ms`);
    }

    /**
     * 设置错误率
     */
    setErrorRate(rate) {
        this.options.errorRate = Math.max(0, Math.min(1, rate));
        logger.info(`MockTransport 错误率: ${(this.options.errorRate * 100).toFixed(1)}%`);
    }

    /**
     * 设置响应模式
     */
    setResponseMode(mode) {
        this.options.responseMode = mode;
        logger.info(`MockTransport 响应模式: ${mode}`);
    }

    /**
     * 获取统计
     */
    getStats() {
        return {
            sendCount: this.sendCount,
            receiveCount: this.receiveCount,
            connected: this.connected,
        };
    }

    /**
     * 重置统计
     */
    resetStats() {
        this.sendCount = 0;
        this.receiveCount = 0;
    }

    // ============================================================
    // 工具
    // ============================================================

    _toHex(data) {
        return Array.from(data)
            .map(b => b.toString(16).padStart(2, '0').toUpperCase())
            .join(' ');
    }
}

export default MockTransport;
