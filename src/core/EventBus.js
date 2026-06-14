/**
 * EventBus - 事件总线
 *
 * 实现模块间的发布/订阅模式，用于解耦 UI、服务、驱动之间的通信
 *
 * 事件命名规范: domain:action
 *   - device:connected
 *   - device:disconnected
 *   - lighting:changed
 *   - keymap:updated
 *   - test:progress
 *
 * @example
 * // 订阅事件
 * const unsubscribe = bus.on('device:connected', (data) => {
 *   console.log('设备已连接', data);
 * });
 *
 * // 发布事件
 * bus.emit('device:connected', { deviceInfo });
 *
 * // 取消订阅
 * unsubscribe();
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.events = new Map();
    /** @type {Map<string, Set<Function>>} 一次性事件 */
    this.onceEvents = new Map();
  }

  /**
   * 订阅事件
   * @param {string} event 事件名
   * @param {Function} handler 处理函数
   * @returns {Function} 取消订阅的函数
   */
  on(event, handler) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(handler);

    // 返回取消订阅函数
    return () => this.off(event, handler);
  }

  /**
   * 一次性订阅
   * @param {string} event 事件名
   * @param {Function} handler 处理函数
   */
  once(event, handler) {
    const wrapped = (...args) => {
      this.off(event, wrapped);
      handler(...args);
    };
    this.on(event, wrapped);
  }

  /**
   * 取消订阅
   * @param {string} event 事件名
   * @param {Function} handler 处理函数
   */
  off(event, handler) {
    if (this.events.has(event)) {
      this.events.get(event).delete(handler);
      if (this.events.get(event).size === 0) {
        this.events.delete(event);
      }
    }
  }

  /**
   * 发布事件
   * @param {string} event 事件名
   * @param {*} data 事件数据
   */
  emit(event, data) {
    const handlers = this.events.get(event);
    if (handlers) {
      // 复制一份避免在回调中修改影响迭代
      const list = Array.from(handlers);
      list.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[EventBus] Error in handler for "${event}":`, err);
        }
      });
    }
  }

  /**
   * 清空所有事件
   */
  clear() {
    this.events.clear();
    this.onceEvents.clear();
  }

  /**
   * 获取事件订阅数量（用于调试）
   * @param {string} event 事件名
   * @returns {number}
   */
  listenerCount(event) {
    return this.events.has(event) ? this.events.get(event).size : 0;
  }
}

/**
 * 全局事件总线单例
 */
export const bus = new EventBus();
