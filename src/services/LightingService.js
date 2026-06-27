/**
 * LightingService - 灯光控制服务层
 *
 * 协议版本: V2.1
 * 参考文档: PROTOCOL_V2.1_COMPLETE.md 第 7 节
 *
 * 灯效模式 (0-9):
 *   0=固定颜色, 1=彩虹呼吸, 2=波浪, 3=旋转点, 4=彗星,
 *   5=风车, 6=按键涟漪, 7=单色呼吸, 8=星光闪烁, 9=渐变流水
 *
 * 亮度 (0-4): 0=全灭, 1=25%, 2=50%, 3=75%, 4=100%
 * 速度 (0-4): 0=最慢, 1=较慢, 2=中速, 3=较快, 4=最快
 * 方向 (0-3): 0=正向, 1=反向, 2=双向交替, 3=随机
 */

import { bus } from '../core/EventBus.js';
import { logger } from '../core/Logger.js';
import { LIGHTING } from '../core/Config.js';
import { CMD } from '../protocol/commands/BaseCommands.js';

/**
 * 灯效模式枚举 (与协议 7.1 节对应)
 */
export const LightMode = {
    SOLID_COLOR: 'solid-color',           // 0 - 固定颜色 (单色常亮)
    RAINBOW_BREATHING: 'rainbow-breathing', // 1 - 彩虹呼吸 (色相循环+亮度呼吸)
    WAVE: 'wave',                         // 2 - 波浪 (4组色相错位流动)
    ROTATING_SPOT: 'rotating-spot',       // 3 - 旋转点 (单点跑马灯)
    COMET: 'comet',                       // 4 - 彗星 (带尾迹移动点)
    WINDMILL: 'windmill',                 // 5 - 风车 (4叶片多色旋转)
    KEY_STATUS: 'key-status',             // 6 - 按键涟漪 (按键触发+渐灭)
    BREATHING: 'breathing',               // 7 - 单色呼吸 (固定颜色+亮度呼吸)
    STARLIGHT: 'starlight',               // 8 - 星光闪烁 (伪随机点亮衰减)
    GRADIENT_FLOW: 'gradient-flow',       // 9 - 渐变流水 (色相渐变流动)
};

/**
 * 灯效模式代码 → 协议 mode 值 (0-9)
 */
const LIGHT_MODE_CODE = {
    [LightMode.SOLID_COLOR]: 0,
    [LightMode.RAINBOW_BREATHING]: 1,
    [LightMode.WAVE]: 2,
    [LightMode.ROTATING_SPOT]: 3,
    [LightMode.COMET]: 4,
    [LightMode.WINDMILL]: 5,
    [LightMode.KEY_STATUS]: 6,
    [LightMode.BREATHING]: 7,
    [LightMode.STARLIGHT]: 8,
    [LightMode.GRADIENT_FLOW]: 9,
};

/**
 * 反向映射: 模式代码 (0-9) → 模式名称
 */
const CODE_TO_MODE = Object.fromEntries(
    Object.entries(LIGHT_MODE_CODE).map(([name, code]) => [code, name])
);

/**
 * 亮度等级说明 (协议 7.2 节)
 * 0=全灭, 1=25%(64), 2=50%(128), 3=75%(192), 4=100%(255)
 */
const BRIGHTNESS_LEVELS = [0, 64, 128, 192, 255];

/**
 * 亮度标签
 */
const BRIGHTNESS_LABELS = ['全灭 (0%)', '低亮 (25%)', '中亮 (50%)', '较高 (75%)', '最亮 (100%)'];

/**
 * 速度标签
 */
const SPEED_LABELS = ['最慢', '较慢', '中速', '较快', '最快'];

/**
 * 方向标签
 */
const DIRECTION_LABELS = ['正向', '反向', '双向交替', '随机'];

export class LightingService {
    /**
     * @param {Protocol} protocol - 协议层实例
     */
    constructor(protocol) {
        this.protocol = protocol;
        this.state = {
            enabled: true,                     // 总开关
            mode: LightMode.SOLID_COLOR,       // 当前模式 (默认固定颜色)
            mainColor: { r: 6, g: 182, b: 212 }, // 默认青色
            brightness: 4,                     // 亮度 0-4 (协议 7.2 节)
            speed: 2,                          // 速度 0-4 (协议 7.3 节)
            direction: 0,                      // 方向 0-3 (协议 7.4 节)
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
        this.state.enabled = enabled;
        logger.info(`灯光总开关: ${enabled}`);
        bus.emit('lighting:enabled-changed', { enabled });
        return this.applyState();
    }

    /**
     * 设置灯效模式
     * 协议 7.5.2: LED_START [mode, speed, brightness, direction]
     * @param {string} mode - LightMode 枚举值
     */
    setMode(mode) {
        if (!(mode in LIGHT_MODE_CODE)) {
            logger.error(`无效的灯效模式: ${mode}`);
            return Promise.reject(new Error(`Invalid light mode: ${mode}`));
        }
        this.state.mode = mode;
        logger.info(`灯效模式: ${mode} (code=${LIGHT_MODE_CODE[mode]})`);
        bus.emit('lighting:mode-changed', { mode });
        return this.applyState();
    }

    /**
     * 设置预设颜色 (固件内置颜色)
     * 协议 7.5.2: 通过 LED_START 的 color 参数 (0-8) 传递
     * @param {number} index - 颜色索引 0-8
     */
    async setPresetColor(index) {
        if (index < 0 || index > 8) {
            logger.warn(`预设颜色索引无效: ${index}，应为 0-8`);
            return;
        }
        this.state.colorIndex = index;
        logger.info(`设置预设颜色: ${index}`);
        bus.emit('lighting:color-changed', { index });
        return this.applyState();
    }

    /**
     * 设置自定义颜色 (Web 驱动颜色)
     * 协议 7.5.3: SET_CUSTOM_COLOR (0x010F) [r, g, b]
     * 然后 LED_START 带 color=9
     * @param {string|object} color - '#RRGGBB' 或 {r,g,b}
     */
    async setMainColor(color) {
        const rgb = this._parseColor(color);
        this.state.mainColor = rgb;
        this.state.colorIndex = 9; // 标记为自定义颜色模式
        logger.info(`自定义颜色: rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
        bus.emit('lighting:color-changed', { color: rgb, index: 9 });
        return this.applyState();
    }

    /**
     * 设置亮度
     * 协议 7.2 节: brightness 0-4
     * @param {number} value - 0-4
     */
    setBrightness(value) {
        const v = Math.max(0, Math.min(4, Math.round(value)));
        this.state.brightness = v;
        logger.info(`亮度: ${v} (${BRIGHTNESS_LABELS[v]})`);
        bus.emit('lighting:brightness-changed', { brightness: v });
        return this.applyState();
    }

    /**
     * 设置速度
     * 协议 7.3 节: speed 0-4
     * @param {number} value - 0-4
     */
    setSpeed(value) {
        const v = Math.max(0, Math.min(4, Math.round(value)));
        this.state.speed = v;
        logger.info(`速度: ${v} (${SPEED_LABELS[v]})`);
        bus.emit('lighting:speed-changed', { speed: v });
        return this.applyState();
    }

    /**
     * 设置方向
     * 协议 7.4 节: direction 0-3
     * @param {number} value - 0=正向, 1=反向, 2=双向交替, 3=随机
     */
    setDirection(value) {
        const v = Math.max(0, Math.min(3, Math.round(value)));
        this.state.direction = v;
        logger.info(`方向: ${v} (${DIRECTION_LABELS[v]})`);
        bus.emit('lighting:direction-changed', { direction: v });
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
     *
     * 协议 7.5.2: CMD_LED_START (0x0102)
     *   Payload: [mode, speed, brightness, direction]
     *   - mode:       0-9
     *   - speed:      0-4
     *   - brightness: 0-4
     *   - direction:  0-3
     *
     * 协议 7.5.1: CMD_SWITCH_EFFECT (0x0106)
     *   Payload: [effect_id]  (仅切换模式)
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
                // 发送灯效参数（包含颜色索引）
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
     * 从设备读取当前灯效状态
     * 协议 7.5.3: CMD_READ_LED_STATE (0x010A)
     *   响应 Payload: [status, mode, brightness, speed, direction, is_running]
     */
    async readLedState() {
        if (!this.protocol) {
            logger.warn('Protocol 未设置');
            return null;
        }

        try {
            const response = await this.protocol.send(CMD.READ_LED_STATE, []);
            const data = response.data;

            if (data.length >= 5) {
                const modeCode = data[0];
                const brightness = data[1];
                const speed = data[2];
                const direction = data[3];
                const isRunning = data[4];

                const mode = CODE_TO_MODE[modeCode] || LightMode.SOLID_COLOR;

                this.state.mode = mode;
                this.state.brightness = brightness;
                this.state.speed = speed;
                this.state.direction = direction;
                this.state.enabled = isRunning === 1;

                logger.info(`读取灯效状态: mode=${mode}(${modeCode}), brightness=${brightness}, speed=${speed}, direction=${direction}, running=${isRunning}`);
                bus.emit('lighting:state-read', { mode, brightness, speed, direction, isRunning });

                return { mode, brightness, speed, direction, isRunning };
            }
        } catch (err) {
            logger.error(`读取灯效状态失败: ${err.message}`);
        }
        return null;
    }

    /**
     * 启动 Web 驱动模式 (自定义逐键控制)
     */
    async startWebControlMode() {
        this.state.webControlMode = true;
        this.state.enabled = true;

        logger.info('启动 Web 驱动模式');
        bus.emit('lighting:web-mode-started');

        // 使用 LED_START 设置模式为固定颜色 (mode=0), 后续用 SET_SINGLE_LED 逐键控制
        await this.protocol.send(CMD.LED_START, [
            LIGHT_MODE_CODE[LightMode.SOLID_COLOR],
            this.state.speed,
            this.state.brightness,
            this.state.direction
        ]);
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
     * 协议: SET_SINGLE_LED (0x0104) [led_id, r, g, b]
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
     *
     * 协议 7.5.2: LED_START [mode, speed, brightness, direction, color]
     *   mode:       0-9  (灯效模式)
     *   speed:      0-4  (速度档位)
     *   brightness: 0-4  (亮度档位)
     *   direction:  0-3  (方向)
     *   color:      0-9  (颜色索引, 0-8预设, 9自定义)
     */
    async _applyLighting() {
        const { mode, brightness, speed, direction, colorIndex, mainColor } = this.state;
        const modeCode = LIGHT_MODE_CODE[mode];

        // 如果是自定义颜色 (colorIndex=9)，先发送 SET_CUSTOM_COLOR
        if (colorIndex === 9 && mainColor) {
            await this.protocol.send(CMD.SET_CUSTOM_COLOR, [
                mainColor.r,
                mainColor.g,
                mainColor.b
            ]);
            logger.debug(`设置自定义颜色: rgb(${mainColor.r}, ${mainColor.g}, ${mainColor.b})`);
        }

        // 协议 7.5.2: LED_START [mode, speed, brightness, direction, color]
        await this.protocol.send(CMD.LED_START, [
            modeCode,
            speed,
            brightness,
            direction,
            colorIndex
        ]);

        logger.debug(`应用灯光: mode=${mode}(${modeCode}), speed=${speed}, brightness=${brightness}, direction=${direction}, color=${colorIndex}`);
    }

    /**
     * 停止灯光 (内部)
     * 协议: LED_STOP (0x0103) 空
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
