/**
 * LightingService - 灯光控制服务层
 *
 * 职责:
 *   - 封装灯光控制业务逻辑
 *   - 维护灯光状态
 *   - 与设备驱动层通信
 *   - 状态变化通过 EventBus 广播
 *
 * 设计原则:
 *   - 不直接操作 DOM
 *   - 不直接调用 transport
 *   - 通过 protocol 与驱动层交互
 *   - 状态变更通过事件发布
 */

import { bus } from '../core/EventBus.js';
import { logger } from '../core/Logger.js';
import { LIGHTING } from '../core/Config.js';
import { CMD } from '../protocol/commands/BaseCommands.js';

/**
 * 灯光模式枚举
 */
export const LightMode = {
    STATIC: 'static',         // 恒亮
    BREATHING: 'breathing',   // 呼吸
    WAVE: 'wave',             // 波浪
    RIPPLE: 'ripple',         // 波纹
    REACTIVE: 'reactive',     // 按键响应
    RAINBOW: 'rainbow',       // 彩虹
    CUSTOM: 'custom',         // 自定义
    WEB_CUSTOM: 'web-custom', // Web 驱动
};

/**
 * 灯光模式代码 (与设备协议对应)
 */
const LIGHT_MODE_CODE = {
    [LightMode.STATIC]: 0x00,
    [LightMode.BREATHING]: 0x01,
    [LightMode.WAVE]: 0x02,
    [LightMode.RIPPLE]: 0x03,
    [LightMode.REACTIVE]: 0x04,
    [LightMode.RAINBOW]: 0x05,
    [LightMode.CUSTOM]: 0x06,
    [LightMode.WEB_CUSTOM]: 0x07,
};

export class LightingService {
    /**
     * @param {Protocol} protocol - 协议层实例
     */
    constructor(protocol) {
        this.protocol = protocol;
        this.state = {
            enabled: false,                    // 总开关
            mode: LightMode.STATIC,            // 当前模式
            mainColor: { r: 6, g: 182, b: 212 }, // 默认青色
            brightness: 100,                   // 亮度 0-100
            speed: 5,                          // 速度 1-10
            webControlMode: false,             // Web 驱动模式
            perKeyColors: new Map(),           // 独立按键颜色
            isApplying: false,                 // 正在应用
        };

        logger.info('LightingService 已创建');
    }

    // ============================================================
    // 状态管理
    // ============================================================

    /**
     * 获取当前状态
     */
    getState() {
        return { ...this.state, perKeyColors: new Map(this.state.perKeyColors) };
    }

    /**
     * 设置灯光总开关
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        const old = this.state.enabled;
        this.state.enabled = enabled;
        logger.info(`灯光总开关: ${old} -> ${enabled}`);
        bus.emit('lighting:enabled-changed', { enabled });
        return this.applyState();
    }

    /**
     * 设置灯光模式
     * @param {string} mode - LightMode 枚举
     */
    setMode(mode) {
        if (!(mode in LIGHT_MODE_CODE)) {
            logger.error(`无效的灯光模式: ${mode}`);
            return Promise.reject(new Error(`Invalid light mode: ${mode}`));
        }
        this.state.mode = mode;
        logger.info(`灯光模式: ${mode}`);
        bus.emit('lighting:mode-changed', { mode });
        return this.applyState();
    }

    /**
     * 设置主色调
     * @param {string|object} color - '#RRGGBB' 或 {r,g,b}
     */
    setMainColor(color) {
        const rgb = this._parseColor(color);
        this.state.mainColor = rgb;
        logger.info(`主色调: rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
        bus.emit('lighting:color-changed', { color: rgb });
        return this.applyState();
    }

    /**
     * 设置亮度
     * @param {number} value - 0-100
     */
    setBrightness(value) {
        const v = Math.max(0, Math.min(100, value));
        this.state.brightness = v;
        logger.info(`亮度: ${v}%`);
        bus.emit('lighting:brightness-changed', { brightness: v });
        return this.applyState();
    }

    /**
     * 设置速度
     * @param {number} value - 1-10
     */
    setSpeed(value) {
        const v = Math.max(1, Math.min(10, value));
        this.state.speed = v;
        logger.info(`速度: ${v}`);
        bus.emit('lighting:speed-changed', { speed: v });
        return this.applyState();
    }

    /**
     * 设置单个按键颜色
     * @param {string|number} keyId
     * @param {string|object} color
     */
    setKeyColor(keyId, color) {
        const rgb = this._parseColor(color);
        this.state.perKeyColors.set(keyId, rgb);
        logger.info(`按键 ${keyId} 颜色: rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
        bus.emit('lighting:key-color-changed', { keyId, color: rgb });
    }

    /**
     * 清除按键颜色 (恢复主色调)
     * @param {string|number} keyId
     */
    clearKeyColor(keyId) {
        this.state.perKeyColors.delete(keyId);
        logger.info(`清除按键 ${keyId} 颜色`);
        bus.emit('lighting:key-color-cleared', { keyId });
    }

    /**
     * 全选设置颜色
     * @param {string|object} color
     */
    setAllKeysColor(color) {
        const rgb = this._parseColor(color);
        this.state.perKeyColors.clear();
        for (let i = 0; i < LIGHTING.LED_COUNT; i++) {
            this.state.perKeyColors.set(i, rgb);
        }
        logger.info(`全选颜色: rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
        bus.emit('lighting:all-keys-color-changed', { color: rgb });
        return this.applyState();
    }

    /**
     * 清除所有按键颜色
     */
    clearAllKeysColor() {
        this.state.perKeyColors.clear();
        logger.info('清除所有按键颜色');
        bus.emit('lighting:all-keys-color-cleared');
        return this.applyState();
    }

    // ============================================================
    // 设备交互
    // ============================================================

    /**
     * 应用当前状态到设备
     */
    async applyState() {
        if (!this.protocol) {
            logger.warn('Protocol 未设置, 跳过应用');
            return;
        }
        if (this.state.isApplying) {
            logger.debug('正在应用中, 跳过');
            return;
        }

        this.state.isApplying = true;
        bus.emit('lighting:applying', { state: this.getState() });

        try {
            if (!this.state.enabled) {
                await this._stopLighting();
            } else {
                await this._applyLighting();
            }
            bus.emit('lighting:applied', { state: this.getState() });
            logger.info('灯光状态已应用');
        } catch (err) {
            logger.error(`应用灯光状态失败: ${err.message}`);
            bus.emit('lighting:error', { error: err });
            throw err;
        } finally {
            this.state.isApplying = false;
        }
    }

    /**
     * 启动 Web 驱动模式
     * Web 端实时控制每个 LED
     */
    async startWebControlMode() {
        this.state.webControlMode = true;
        this.state.mode = LightMode.WEB_CUSTOM;
        this.state.enabled = true;

        logger.info('启动 Web 驱动模式');
        bus.emit('lighting:web-mode-started');

        await this.protocol.send(CMD.SWITCH_EFFECT, [LIGHT_MODE_CODE[LightMode.WEB_CUSTOM]]);
    }

    /**
     * 停止 Web 驱动模式
     */
    async stopWebControlMode() {
        this.state.webControlMode = false;
        logger.info('停止 Web 驱动模式');
        bus.emit('lighting:web-mode-stopped');
    }

    /**
     * 在 Web 驱动模式下设置单 LED
     * @param {number} ledId
     * @param {object} color - {r,g,b}
     */
    async setSingleLED(ledId, color) {
        if (!this.state.webControlMode) {
            logger.warn('未在 Web 驱动模式, 单 LED 设置将被忽略');
            return;
        }

        const rgb = this._parseColor(color);
        try {
            await this.protocol.send(
                CMD.SET_SINGLE_LED,
                [ledId, rgb.r, rgb.g, rgb.b]
            );
            bus.emit('lighting:single-led-set', { ledId, color: rgb });
        } catch (err) {
            logger.error(`设置单 LED 失败: ${err.message}`);
            throw err;
        }
    }

    // ============================================================
    // 内部方法
    // ============================================================

    /**
     * 应用灯光 (内部)
     */
    async _applyLighting() {
        const { mode, mainColor, brightness, speed, perKeyColors } = this.state;
        const colorHex = this._rgbToHex(mainColor);

        // 1. 设置 LED 颜色 (批量)
        if (perKeyColors.size > 0) {
            // 自定义模式 - 上传所有按键颜色
            const payload = [];
            perKeyColors.forEach((color, keyId) => {
                payload.push(parseInt(keyId), color.r, color.g, color.b);
            });
            await this.protocol.send(CMD.WRITE_LED_DEFINE, payload);
        } else {
            // 单色模式 - 设置所有 LED 为同一颜色
            const payload = [];
            for (let i = 0; i < LIGHTING.LED_COUNT; i++) {
                payload.push(i, mainColor.r, mainColor.g, mainColor.b);
            }
            await this.protocol.send(CMD.WRITE_LED_DEFINE, payload);
        }

        // 2. 切换灯效模式
        await this.protocol.send(
            CMD.SWITCH_EFFECT,
            [LIGHT_MODE_CODE[mode], brightness, speed]
        );

        // 3. 启动灯效
        await this.protocol.send(CMD.LED_START, []);

        logger.debug(`应用灯光: 模式=${mode}, 色=${colorHex}, 亮度=${brightness}%, 速度=${speed}`);
    }

    /**
     * 停止灯光 (内部)
     */
    async _stopLighting() {
        await this.protocol.send(CMD.LED_STOP, []);
        logger.debug('停止灯光');
    }

    /**
     * 解析颜色
     * @param {string|object} color
     * @returns {{r:number, g:number, b:number}}
     */
    _parseColor(color) {
        if (typeof color === 'string') {
            return this._hexToRgb(color);
        }
        if (typeof color === 'object' && 'r' in color) {
            return {
                r: Math.max(0, Math.min(255, color.r)),
                g: Math.max(0, Math.min(255, color.g)),
                b: Math.max(0, Math.min(255, color.b)),
            };
        }
        throw new Error('无效的颜色格式');
    }

    /**
     * HEX 转 RGB
     */
    _hexToRgb(hex) {
        const clean = hex.replace('#', '');
        const num = parseInt(clean, 16);
        return {
            r: (num >> 16) & 0xFF,
            g: (num >> 8) & 0xFF,
            b: num & 0xFF,
        };
    }

    /**
     * RGB 转 HEX
     */
    _rgbToHex(rgb) {
        return '#' + [rgb.r, rgb.g, rgb.b]
            .map(v => v.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
    }

    /**
     * 销毁服务
     */
    destroy() {
        this.state.perKeyColors.clear();
        bus.emit('lighting:destroyed');
        logger.info('LightingService 已销毁');
    }
}

export default LightingService;
