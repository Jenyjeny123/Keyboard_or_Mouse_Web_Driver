/**
 * Protocol - 协议层封装
 *
 * 提供命令发送、响应匹配、Promise 化、超时控制
 *
 * 通讯流程:
 * 1. 调用 protocol.send(cmd, data) 发送命令
 * 2. 设备返回响应包
 * 3. handleResponse() 解析响应
 * 4. 匹配到对应请求后 resolve Promise
 *
 * 响应数据格式 (V2.1 协议):
 * - 数据区[0] = Status (状态码)
 * - 数据区[1+] = Response Data
 *
 * @example
 * const protocol = new Protocol(transport);
 * try {
 *   const result = await protocol.send(CMD.READ_DPI, [1]);
 *   console.log('DPI 数据:', result.data);
 * } catch (err) {
 *   console.error('命令失败:', err.message);
 * }
 */

import { PacketBuilder } from './PacketBuilder.js';
import { STATUS, getCmdName, getStatusName } from './commands/BaseCommands.js';
import { PROTOCOL } from '../core/Config.js';
import { logger } from '../core/Logger.js';
import { bus } from '../core/EventBus.js';

export class Protocol {
  /**
   * @param {Object} transport 传输层实例
   */
  constructor(transport) {
    this.transport = transport;
    /** @type {Map<number, Object>} 待响应的请求 */
    this.pendingCommands = new Map();
    this.requestId = 0;
    this.commandTimeout = PROTOCOL.DEFAULT_TIMEOUT;

    // 监听传输层接收
    this.transport.onReceive((data) => this.handleResponse(data));
    this.transport.onError((err) => this.handleTransportError(err));

    logger.info('Protocol initialized');
  }

  /**
   * 设置默认超时时间
   * @param {number} ms
   */
  setTimeout(ms) {
    this.commandTimeout = ms;
  }

  /**
   * 发送命令 (异步, 等待响应)
   * @param {number} cmd 2 字节命令码
   * @param {number[]} data 数据 (0-56 字节)
   * @param {number} address 地址 (默认 0)
   * @param {Object} options 选项 { timeout, dataLength }
   * @returns {Promise<{status: number, data: number[]}>}
   */
  async send(cmd, data = [], address = 0, options = {}) {
    const requestId = ++this.requestId;
    const timeout = options.timeout || this.commandTimeout;
    const dataLength = options.dataLength !== undefined
      ? options.dataLength
      : data.length;

    const packet = PacketBuilder.build(cmd, data, address, dataLength);

    logger.debug(
      `→ SEND CMD=0x${cmd.toString(16).padStart(4, '0')} (${getCmdName(cmd)})` +
      ` LEN=${data.length} ADDR=0x${address.toString(16).padStart(4, '0')}` +
      ` DataLength=${dataLength}`
    );

    bus.emit('protocol:send', { cmd, data, address, requestId });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCommands.delete(requestId);
        const err = new Error(
          `CMD 0x${cmd.toString(16).padStart(4, '0')} (${getCmdName(cmd)}) timeout after ${timeout}ms`
        );
        err.code = 'TIMEOUT';
        err.cmd = cmd;
        logger.warn(err.message);
        bus.emit('protocol:timeout', { cmd, requestId });
        reject(err);
      }, timeout);

      this.pendingCommands.set(requestId, {
        cmd,
        address,
        startTime: Date.now(),
        timer,
        resolve: (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      // 通过传输层发送
      this.transport.send(packet).catch((err) => {
        clearTimeout(timer);
        this.pendingCommands.delete(requestId);
        logger.error(`Send failed: ${err.message}`);
        reject(err);
      });
    });
  }

  /**
   * 处理响应数据
   * @param {Uint8Array} packet
   */
  handleResponse(packet) {
    let parsed;
    try {
      parsed = PacketBuilder.parse(packet);
    } catch (err) {
      logger.error(`Parse error: ${err.message}`);
      return;
    }

    const { cmd, data } = parsed;

    logger.debug(
      `← RECV CMD=0x${cmd.toString(16).padStart(4, '0')} (${parsed.cmdName})` +
      ` LEN=${parsed.len}`
    );

    bus.emit('protocol:receive', parsed);

    if (data.length === 0) {
      logger.warn(`Empty response data for CMD 0x${cmd.toString(16)}`);
      return;
    }

    const status = data[0];
    const responseData = data.slice(1);

    // 查找匹配的请求 (按 CMD 匹配)
    let matched = null;
    for (const [id, pending] of this.pendingCommands) {
      if (pending.cmd === cmd) {
        matched = { id, pending };
        break;
      }
    }

    if (!matched) {
      logger.warn(
        `No matching request for CMD 0x${cmd.toString(16)} (${parsed.cmdName})`
      );
      // 可能是设备主动上报, 触发事件
      bus.emit('protocol:notification', parsed);
      return;
    }

    const { id, pending } = matched;
    this.pendingCommands.delete(id);

    const elapsed = Date.now() - pending.startTime;
    if (status === STATUS.SUCCESS) {
      logger.debug(
        `✓ ${parsed.cmdName} success (${elapsed}ms)` +
        ` Data=[${responseData.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join(' ')}...]`
      );
      pending.resolve({ status, data: responseData, elapsed });
    } else {
      const err = new Error(
        `${parsed.cmdName} failed: ${getStatusName(status)} (0x${status.toString(16)})`
      );
      err.code = 'STATUS_ERROR';
      err.status = status;
      err.cmd = cmd;
      logger.warn(err.message);
      pending.reject(err);
    }
  }

  /**
   * 处理传输层错误
   * @param {Error} err
   */
  handleTransportError(err) {
    logger.error(`Transport error: ${err.message}`);
    // 拒绝所有待响应的请求
    for (const [id, pending] of this.pendingCommands) {
      pending.reject(err);
    }
    this.pendingCommands.clear();
  }

  /**
   * 获取待响应请求数
   * @returns {number}
   */
  getPendingCount() {
    return this.pendingCommands.size;
  }

  /**
   * 取消所有待响应的请求
   */
  cancelAll() {
    for (const [id, pending] of this.pendingCommands) {
      clearTimeout(pending.timer);
      const err = new Error('Request cancelled');
      err.code = 'CANCELLED';
      pending.reject(err);
    }
    this.pendingCommands.clear();
  }
}
