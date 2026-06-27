/**
 * BaseCommands - 基础命令常量 (V2.1 协议)
 *
 * CMD 是 2 字节 (uint16, 小端序): 高字节=类别, 低字节=命令
 * 通过组合函数 C(category, command) 生成最终命令码
 *
 * 类别码:
 *   0x00 - 系统
 *   0x01 - 灯光
 *   0x02 - 按键
 *   0x03 - 性能
 *   0x04 - 电源
 *   0x05 - 固件
 *   0x06 - 配置
 *   0x07 - 测试
 *
 * @example
 * import { CMD } from './BaseCommands.js';
 * protocol.send(CMD.PING, []);        // 发送心跳
 * protocol.send(CMD.LED_START, [1]);  // 启动灯效
 */

/** 类别码常量 */
export const CATEGORY = {
  SYSTEM: 0x00,
  LIGHTING: 0x01,
  KEYBOARD: 0x02,
  PERFORMANCE: 0x03,
  POWER: 0x04,
  FIRMWARE: 0x05,
  PROFILE: 0x06,
  TEST: 0x07,
};

/**
 * 组合函数: (category << 8) | command
 */
const C = (category, command) => (category << 8) | command;

/**
 * 命令码定义
 */
export const CMD = {
  // ============ 系统类 (0x00xx) ============
  PING:                C(0x00, 0x00),  // 心跳
  RESET:               C(0x00, 0x01),  // 复位
  SET_MODE:            C(0x00, 0x02),  // 模式切换
  READ_BASIC_INFO:     C(0x00, 0x03),  // 读基本信息
  WRITE_BASIC_INFO:    C(0x00, 0x04),  // 写基本信息
  READ_RAM:            C(0x00, 0x05),  // 读 RAM
  WRITE_RAM:           C(0x00, 0x06),  // 写 RAM
  READ_FLASH:          C(0x00, 0x07),  // 读 Flash
  WRITE_FLASH:         C(0x00, 0x08),  // 写 Flash
  AUTH:                C(0x00, 0x09),  // 认证
  GET_CAPABILITIES:    C(0x00, 0x0A),  // 能力查询
  NOTIFY:              C(0x00, 0x0B),  // 事件通知

  // ============ 灯光类 (0x01xx) ============
  READ_LED_DEFINE:         C(0x01, 0x00),
  WRITE_LED_DEFINE:        C(0x01, 0x01),
  LED_START:               C(0x01, 0x02),
  LED_STOP:                C(0x01, 0x03),
  SET_SINGLE_LED:          C(0x01, 0x04),
  SET_ZONE_LED:            C(0x01, 0x05),
  SWITCH_EFFECT:           C(0x01, 0x06),
  SET_BREATH_PARAM:        C(0x01, 0x07),
  SET_RAINBOW_PARAM:       C(0x01, 0x08),
  UPLOAD_CUSTOM_EFFECT:    C(0x01, 0x09),
  READ_LED_STATE:          C(0x01, 0x0A),
  READ_LED_INDEX:          C(0x01, 0x0B),
  LED_SYNC:                C(0x01, 0x0C),
  SCREEN_COLOR_CONFIG:     C(0x01, 0x0D),
  AUDIO_REACTIVE_CONFIG:   C(0x01, 0x0E),
  SET_CUSTOM_COLOR:        C(0x01, 0x0F),

  // ============ 按键类 (0x02xx) ============
  READ_MATRIX:         C(0x02, 0x00),
  WRITE_MATRIX:        C(0x02, 0x01),
  READ_KEY_STATE:      C(0x02, 0x02),
  REMAP_KEY:           C(0x02, 0x03),
  MACRO_RECORD_START:  C(0x02, 0x04),
  MACRO_RECORD_STOP:   C(0x02, 0x05),
  EXEC_MACRO:          C(0x02, 0x06),
  DELETE_MACRO:        C(0x02, 0x07),
  LIST_MACROS:         C(0x02, 0x08),
  READ_MACRO_DATA:     C(0x02, 0x09),
  WRITE_MACRO_DATA:    C(0x02, 0x0A),
  COMBO_KEY:           C(0x02, 0x0B),
  FIRE_KEY:            C(0x02, 0x0C),
  MEDIA_KEY:           C(0x02, 0x0D),
  SYSTEM_KEY:          C(0x02, 0x0E),
  DISABLE_KEY:         C(0x02, 0x0F),

  // ============ 性能类 (0x03xx) ============
  READ_DEVICE_ID:      C(0x03, 0x00),
  WRITE_DEVICE_ID:     C(0x03, 0x01),
  READ_DPI:            C(0x03, 0x02),
  WRITE_DPI:           C(0x03, 0x03),
  SWITCH_DPI:          C(0x03, 0x04),
  READ_POLL_RATE:      C(0x03, 0x05),
  WRITE_POLL_RATE:     C(0x03, 0x06),
  READ_LIFT_HEIGHT:    C(0x03, 0x07),
  WRITE_LIFT_HEIGHT:   C(0x03, 0x08),
  ANGLE_SNAPPING:      C(0x03, 0x09),
  LINEAR_CALIBRATION:  C(0x03, 0x0A),
  RIPPLE_CORRECTION:   C(0x03, 0x0B),
  MOVE_SYNC:           C(0x03, 0x0C),
  KEY_DELAY:           C(0x03, 0x0D),
  PERFORMANCE_MODE:    C(0x03, 0x0E),
  PERFORMANCE_STATS:   C(0x03, 0x0F),

  // ============ 电源类 (0x04xx) ============
  READ_BATTERY:        C(0x04, 0x00),
  READ_CHARGE_STATUS:  C(0x04, 0x01),
  SET_SLEEP_TIME:      C(0x04, 0x02),
  WAKE_UP:             C(0x04, 0x03),
  SHUTDOWN:            C(0x04, 0x04),
  LOW_BATTERY_ALERT:   C(0x04, 0x05),
  CHARGE_CURRENT:      C(0x04, 0x06),

  // ============ 固件类 (0x05xx) ============
  ENTER_DFU:           C(0x05, 0x00),
  EXIT_DFU:            C(0x05, 0x01),
  FIRMWARE_INFO:       C(0x05, 0x02),
  FIRMWARE_ERASE:      C(0x05, 0x03),
  FIRMWARE_WRITE:      C(0x05, 0x04),
  FIRMWARE_VERIFY:     C(0x05, 0x05),
  FIRMWARE_INSTALL:    C(0x05, 0x06),
  FIRMWARE_ROLLBACK:   C(0x05, 0x07),
  UPGRADE_PROGRESS:    C(0x05, 0x08),
  BACKUP_FIRMWARE:     C(0x05, 0x09),
  RESTORE_BACKUP:      C(0x05, 0x0A),

  // ============ 配置类 (0x06xx) ============
  LIST_PROFILES:       C(0x06, 0x00),
  SWITCH_PROFILE:      C(0x06, 0x01),
  SAVE_PROFILE:        C(0x06, 0x02),
  DELETE_PROFILE:      C(0x06, 0x03),
  EXPORT_PROFILE:      C(0x06, 0x04),
  IMPORT_PROFILE:      C(0x06, 0x05),
  RENAME_PROFILE:      C(0x06, 0x06),
  COPY_PROFILE:        C(0x06, 0x07),

  // ============ 测试类 (0x07xx) ============
  LOOPBACK_TEST:       C(0x07, 0x00),
  PERFORMANCE_TEST:    C(0x07, 0x01),
  LATENCY_TEST:        C(0x07, 0x02),
  ERROR_RATE_TEST:     C(0x07, 0x03),
  STRESS_TEST:         C(0x07, 0x04),
  READ_TEST_RESULT:    C(0x07, 0x05),
  STOP_TEST:           C(0x07, 0x06),
  DEVICE_DEBUG:        C(0x07, 0x0F),
};

/**
 * 状态码定义
 */
export const STATUS = {
  SUCCESS: 0x00,
  BUSY: 0x01,
  INVALID_CMD: 0x02,
  INVALID_PARAM: 0x03,
  INVALID_ADDR: 0x04,
  INVALID_LEN: 0x05,
  CHECKSUM_ERR: 0x06,
  TIMEOUT: 0x07,
  NOT_SUPPORTED: 0x08,
  WRITE_FAIL: 0x09,
  READ_FAIL: 0x0A,
  NO_AUTH: 0x0B,
  LOW_BATTERY: 0x0C,
  DFU_MODE: 0x0D,
  INVALID_STATE: 0x0E,
  UNKNOWN: 0xFE,
  INTERNAL: 0xFF,
};

/**
 * 获取命令名称 (用于调试日志)
 * @param {number} cmd 命令码
 * @returns {string} 命令名
 */
export function getCmdName(cmd) {
  for (const [name, value] of Object.entries(CMD)) {
    if (value === cmd) return name;
  }
  return `UNKNOWN(0x${cmd.toString(16).padStart(4, '0')})`;
}

/**
 * 获取状态名称
 * @param {number} status 状态码
 * @returns {string} 状态名
 */
export function getStatusName(status) {
  for (const [name, value] of Object.entries(STATUS)) {
    if (value === status) return name;
  }
  return `UNKNOWN(0x${status.toString(16).padStart(2, '0')})`;
}
