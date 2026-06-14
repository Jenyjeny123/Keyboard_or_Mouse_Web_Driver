/**
 * PacketBuilder - 64 字节数据包构建与解析 (V2.1 协议)
 *
 * 数据包结构:
 * ┌─────────────────────────────────┬──────────────────────────────────────┐
 * │      Header (8 Bytes)           │       Data Area (56 Bytes)           │
 * ├─────────────────────────────────┼──────────────────────────────────────┤
 * │ [0]   Report ID (0x04)          │                                      │
 * │ [1-2] CMD (uint16, LE)          │                                      │
 * │ [3]   LEN (0-56)                │   [8 ~ 63] 固定 56 字节数据区         │
 * │ [4-5] ADDR (uint16, LE)         │   不足部分填 0x00                    │
 * │ [6-7] Data Length (uint16, LE)  │   无校验、无标志                     │
 * └─────────────────────────────────┴──────────────────────────────────────┘
 *
 * WebHID 的 sendReport() 不需要 Report ID 字节
 * 因此发送时返回 63 字节 (去除 Byte 0)
 */

import { PROTOCOL } from '../core/Config.js';
import { logger } from '../core/Logger.js';
import { getCmdName } from './commands/BaseCommands.js';

export class PacketBuilder {
  /**
   * 构建数据包 (去除 Report ID 的 63 字节)
   * @param {number} cmd 2 字节命令码
   * @param {number[]} data 数据数组 (0-56 字节)
   * @param {number} address 16 位地址 (默认 0)
   * @param {number} dataLength 数据总长度 (分包用, 默认与 data.length 相同)
   * @returns {Uint8Array} 63 字节数据包
   */
  static build(cmd, data = [], address = 0, dataLength = null) {
    // 参数验证
    if (!Number.isInteger(cmd) || cmd < 0 || cmd > 0xFFFF) {
      throw new Error(`Invalid CMD: ${cmd}`);
    }
    if (data.length > PROTOCOL.DATA_AREA_SIZE) {
      throw new Error(
        `Data too long: ${data.length} > ${PROTOCOL.DATA_AREA_SIZE}`
      );
    }

    // 完整 64 字节包
    const packet = new Uint8Array(PROTOCOL.PACKET_SIZE);

    // [0] Report ID
    packet[0] = PROTOCOL.REPORT_ID;

    // [1-2] CMD (小端序)
    packet[1] = cmd & 0xFF;          // CMD 低字节
    packet[2] = (cmd >> 8) & 0xFF;   // CMD 高字节

    // [3] LEN (实际有效数据长度)
    packet[3] = data.length;

    // [4-5] ADDR (小端序)
    packet[4] = address & 0xFF;
    packet[5] = (address >> 8) & 0xFF;

    // [6-7] Data Length (小端序) - 分包时为总长度
    const totalLen = dataLength !== null ? dataLength : data.length;
    packet[6] = totalLen & 0xFF;
    packet[7] = (totalLen >> 8) & 0xFF;

    // [8-63] 数据区 (固定 56 字节)
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      packet[8 + i] = (byte & 0xFF);
    }
    // 剩余部分自动为 0x00 (Uint8Array 初始化为 0)

    // WebHID sendReport 需要去除 Report ID
    return packet.slice(1);
  }

  /**
   * 解析接收到的数据包
   * @param {Uint8Array} packet 63 字节数据 (WebHID inputReport.data)
   * @returns {Object} 解析结果
   */
  static parse(packet) {
    if (!packet || packet.length < 7) {
      throw new Error('Packet too short');
    }

    const cmd = packet[0] | (packet[1] << 8);          // CMD (LE)
    const len = packet[2];                              // LEN
    const addr = packet[3] | (packet[4] << 8);         // ADDR (LE)
    const dataLength = packet[5] | (packet[6] << 8);   // Data Length (LE)

    // 提取有效数据
    const data = Array.from(packet.slice(7, 7 + Math.min(len, PROTOCOL.DATA_AREA_SIZE)));

    return {
      cmd,
      cmdName: getCmdName(cmd),
      len,
      addr,
      dataLength,
      data,
      raw: Array.from(packet),
    };
  }

  /**
   * 调试输出: 字节数组转十六进制字符串
   * @param {Uint8Array} bytes
   * @param {string} separator
   * @returns {string}
   */
  static toHex(bytes, separator = ' ') {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(separator);
  }

  /**
   * 调试输出: 数据包格式化
   * @param {Uint8Array} packet
   * @param {string} label
   */
  static dump(packet, label = 'Packet') {
    const hex = this.toHex(packet);
    const parsed = this.parse(packet);
    logger.debug(
      `${label} [${hex}]\n` +
      `  CMD: 0x${parsed.cmd.toString(16).padStart(4, '0')} (${parsed.cmdName})\n` +
      `  LEN: ${parsed.len}\n` +
      `  ADDR: 0x${parsed.addr.toString(16).padStart(4, '0')}\n` +
      `  DataLength: ${parsed.dataLength}\n` +
      `  Data: [${parsed.data.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`
    );
  }
}
