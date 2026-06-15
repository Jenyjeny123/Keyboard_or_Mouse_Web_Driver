/**
 * PerformanceService - 性能调节服务
 *
 * 负责管理键盘/鼠标的 DPI、轮询率、抬升高度、角度吸附等
 *
 * @example
 *   const perf = new PerformanceService(protocol);
 *   await perf.setDPI(1600);
 *   await perf.setPollingRate(1000);
 *   await perf.toggleAngleSnapping(true);
 */

import { CMD } from '../protocol/commands/BaseCommands.js';

export class PerformanceService {
    constructor(protocol) {
        this.protocol = protocol;
        this.bus = protocol.bus;
        this.state = {
            dpi: 1200,           // 当前 DPI
            dpiMin: 100,         // 最小 DPI
            dpiMax: 25600,       // 最大 DPI
            currentDpiLevel: 0,  // 当前 DPI 档位
            dpiLevels: [800, 1200, 1600, 2400, 3200, 6400],  // DPI 档位
            pollingRate: 1000,   // 当前轮询率 (Hz)
            liftHeight: 2,       // 抬升高度 (mm): 1/2/3
            angleSnapping: false,// 角度吸附
            linearCalibration: false,  // 直线修正
            rippleCorrection: false,   // 波纹修正
            moveSync: false,     // 移动同步
            performanceMode: 'balanced',  // balanced/gaming/standard
        };
        this._setupListeners();
    }

    _setupListeners() {
        this.bus.on('performance:changed', () => {});
    }

    // ==================== DPI 控制 ====================

    /**
     * 读取当前 DPI
     * @returns {Promise<number>}
     */
    async readDPI() {
        const result = await this.protocol.send(CMD.READ_DPI, []);
        if (result.data && result.data.length >= 2) {
            this.state.dpi = (result.data[0] << 8) | result.data[1];
        }
        this.bus.emit('performance:dpi-read', { dpi: this.state.dpi });
        return this.state.dpi;
    }

    /**
     * 设置 DPI
     * @param {number} dpi 100-25600
     * @returns {Promise<boolean>}
     */
    async setDPI(dpi) {
        dpi = Math.max(this.state.dpiMin, Math.min(this.state.dpiMax, dpi));
        this.bus.emit('performance:dpi-changing', { from: this.state.dpi, to: dpi });

        const high = (dpi >> 8) & 0xFF;
        const low = dpi & 0xFF;
        const result = await this.protocol.send(CMD.WRITE_DPI, [high, low]);

        if (result.success !== false) {
            this.state.dpi = dpi;
            this.bus.emit('performance:dpi-changed', { dpi });
        }
        return result.success !== false;
    }

    /**
     * 切换 DPI 档位
     * @param {number} level 0-5
     * @returns {Promise<boolean>}
     */
    async switchDPILevel(level) {
        if (level < 0 || level >= this.state.dpiLevels.length) {
            throw new Error(`无效的 DPI 档位: ${level}`);
        }

        this.bus.emit('performance:dpi-switching', { level });
        const result = await this.protocol.send(CMD.SWITCH_DPI, [level]);

        if (result.success !== false) {
            this.state.currentDpiLevel = level;
            this.state.dpi = this.state.dpiLevels[level];
            this.bus.emit('performance:dpi-changed', { dpi: this.state.dpi, level });
        }
        return result.success !== false;
    }

    /**
     * 增加 DPI
     * @param {number} step 步进
     */
    async increaseDPI(step = 100) {
        return await this.setDPI(this.state.dpi + step);
    }

    /**
     * 减少 DPI
     * @param {number} step 步进
     */
    async decreaseDPI(step = 100) {
        return await this.setDPI(this.state.dpi - step);
    }

    // ==================== 轮询率 ====================

    /**
     * 读取轮询率
     * @returns {Promise<number>} Hz
     */
    async readPollingRate() {
        const result = await this.protocol.send(CMD.READ_POLL_RATE, []);
        if (result.data && result.data.length >= 2) {
            this.state.pollingRate = (result.data[0] << 8) | result.data[1];
        }
        this.bus.emit('performance:polling-read', { rate: this.state.pollingRate });
        return this.state.pollingRate;
    }

    /**
     * 设置轮询率
     * @param {number} rate Hz (125/250/500/1000/2000/4000/8000)
     * @returns {Promise<boolean>}
     */
    async setPollingRate(rate) {
        const validRates = [125, 250, 500, 1000, 2000, 4000, 8000];
        if (!validRates.includes(rate)) {
            throw new Error(`无效的轮询率: ${rate}. 支持: ${validRates.join('/')}`);
        }

        this.bus.emit('performance:polling-changing', { from: this.state.pollingRate, to: rate });
        const high = (rate >> 8) & 0xFF;
        const low = rate & 0xFF;
        const result = await this.protocol.send(CMD.WRITE_POLL_RATE, [high, low]);

        if (result.success !== false) {
            this.state.pollingRate = rate;
            this.bus.emit('performance:polling-changed', { rate });
        }
        return result.success !== false;
    }

    // ==================== 抬升高度 / 角度吸附 ====================

    /**
     * 读取抬升高度
     * @returns {Promise<number>} mm
     */
    async readLiftHeight() {
        const result = await this.protocol.send(CMD.READ_LIFT_HEIGHT, []);
        if (result.data && result.data.length >= 1) {
            this.state.liftHeight = result.data[0];
        }
        return this.state.liftHeight;
    }

    /**
     * 设置抬升高度
     * @param {number} mm 1/2/3
     */
    async setLiftHeight(mm) {
        if (![1, 2, 3].includes(mm)) {
            throw new Error(`无效的抬升高度: ${mm}. 必须是 1/2/3`);
        }
        const result = await this.protocol.send(CMD.WRITE_LIFT_HEIGHT, [mm]);
        if (result.success !== false) {
            this.state.liftHeight = mm;
            this.bus.emit('performance:lift-changed', { height: mm });
        }
        return result.success !== false;
    }

    /**
     * 切换角度吸附
     * @param {boolean} enable
     */
    async toggleAngleSnapping(enable) {
        const value = enable ? 0x01 : 0x00;
        const result = await this.protocol.send(CMD.ANGLE_SNAPPING, [value]);
        if (result.success !== false) {
            this.state.angleSnapping = enable;
            this.bus.emit('performance:angle-toggled', { enabled: enable });
        }
        return result.success !== false;
    }

    /**
     * 切换直线修正
     * @param {boolean} enable
     */
    async toggleLinearCalibration(enable) {
        const value = enable ? 0x01 : 0x00;
        const result = await this.protocol.send(CMD.LINEAR_CALIBRATION, [value]);
        if (result.success !== false) {
            this.state.linearCalibration = enable;
            this.bus.emit('performance:linear-toggled', { enabled: enable });
        }
        return result.success !== false;
    }

    /**
     * 切换波纹修正
     * @param {boolean} enable
     */
    async toggleRippleCorrection(enable) {
        const value = enable ? 0x01 : 0x00;
        const result = await this.protocol.send(CMD.RIPPLE_CORRECTION, [value]);
        if (result.success !== false) {
            this.state.rippleCorrection = enable;
            this.bus.emit('performance:ripple-toggled', { enabled: enable });
        }
        return result.success !== false;
    }

    // ==================== 性能模式 ====================

    /**
     * 设置性能模式
     * @param {'standard'|'balanced'|'gaming'} mode
     */
    async setPerformanceMode(mode) {
        const modeMap = { standard: 0, balanced: 1, gaming: 2 };
        if (!(mode in modeMap)) {
            throw new Error(`无效的模式: ${mode}`);
        }
        const result = await this.protocol.send(CMD.PERFORMANCE_MODE, [modeMap[mode]]);
        if (result.success !== false) {
            this.state.performanceMode = mode;
            this.bus.emit('performance:mode-changed', { mode });
        }
        return result.success !== false;
    }

    /**
     * 获取性能统计
     * @returns {Promise<object>}
     */
    async getPerformanceStats() {
        const result = await this.protocol.send(CMD.PERFORMANCE_STATS, []);
        return {
            ...this.state,
            stats: result.data,
        };
    }

    // ==================== 状态查询 ====================

    getState() {
        return { ...this.state };
    }

    getDPI() {
        return this.state.dpi;
    }

    getPollingRate() {
        return this.state.pollingRate;
    }
}

export default PerformanceService;
