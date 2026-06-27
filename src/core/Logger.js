/**
 * Logger - 统一日志系统
 *
 * 提供分级日志记录，输出到 console 和 UI 日志面板
 *
 * @example
 * import { logger } from './Logger.js';
 * logger.debug('调试信息');
 * logger.info('设备已连接');
 * logger.warn('电量低');
 * logger.error('发送失败', error);
 */
import { bus } from './EventBus.js';

export const LOG_LEVEL = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
};

export const LOG_LEVEL_NAME = {
  0: 'DEBUG',
  1: 'INFO',
  2: 'WARN',
  3: 'ERROR',
  4: 'NONE',
};

export const LOG_LEVEL_COLOR = {
  DEBUG: '#94a3b8', // slate-400
  INFO: '#06b6d4',  // cyan-500
  WARN: '#f59e0b',  // amber-500
  ERROR: '#ef4444', // red-500
};

class Logger {
  constructor() {
    this.level = LOG_LEVEL.DEBUG;
    this.maxLogs = 500;       // 内存中最大日志数
    this.logs = [];           // 日志缓存
    this.enableUI = true;     // 是否推送到 UI
  }

  /**
   * 设置日志级别
   * @param {number} level LOG_LEVEL.*
   */
  setLevel(level) {
    this.level = level;
  }

  /**
   * 启用/禁用 UI 推送
   * @param {boolean} enable
   */
  setUIEnabled(enable) {
    this.enableUI = enable;
  }

  /**
   * 格式化时间戳
   * @returns {string}
   */
  _timestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  }

  /**
   * 核心记录方法
   * @param {number} level
   * @param {string} message
   * @param {*} args
   */
  _log(level, message, ...args) {
    if (level < this.level) return;

    const levelName = LOG_LEVEL_NAME[level];
    const timestamp = this._timestamp();
    const color = LOG_LEVEL_COLOR[levelName];

    // 输出到 console
    const consoleMethod = level === LOG_LEVEL.ERROR ? 'error'
                        : level === LOG_LEVEL.WARN  ? 'warn'
                        : level === LOG_LEVEL.INFO  ? 'info'
                        : 'debug';
    console[consoleMethod](
      `%c[${timestamp}] [${levelName}]`,
      `color: ${color}; font-weight: bold;`,
      message,
      ...args
    );

    // 推送到 UI
    if (this.enableUI) {
      const logEntry = {
        timestamp,
        level: levelName,
        levelNum: level,
        message: String(message),
        data: args,
        color,
        time: Date.now(),
      };
      this.logs.push(logEntry);
      if (this.logs.length > this.maxLogs) {
        this.logs.shift();
      }
      // 通过事件总线推送
      bus.emit('log:new', logEntry);
    }
  }

  debug(message, ...args) {
    this._log(LOG_LEVEL.DEBUG, message, ...args);
  }

  info(message, ...args) {
    this._log(LOG_LEVEL.INFO, message, ...args);
  }

  warn(message, ...args) {
    this._log(LOG_LEVEL.WARN, message, ...args);
  }

  error(message, ...args) {
    this._log(LOG_LEVEL.ERROR, message, ...args);
  }

  /**
   * 获取所有日志
   * @returns {Array}
   */
  getLogs() {
    return this.logs;
  }

  /**
   * 清空日志
   */
  clear() {
    this.logs = [];
    bus.emit('log:clear', null);
  }
}

/**
 * 导出 Logger 类 (供需要自定义实例的模块使用)
 */
export { Logger };

/**
 * 全局日志器单例
 */
export const logger = new Logger();
