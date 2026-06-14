/**
 * WebHIDTransport - WebHID 传输层
 *
 * 封装 navigator.hid API, 提供统一的设备连接、发送、接收接口
 *
 * @example
 * const transport = new WebHIDTransport();
 * await transport.request();  // 弹出设备选择器
 * await transport.connect();  // 连接已授权设备
 * transport.onReceive((data) => console.log('收到:', data));
 * await transport.send(packet);
 */

import { logger } from '../core/Logger.js';
import { bus } from '../core/EventBus.js';
import { PROTOCOL } from '../core/Config.js';

export class WebHIDTransport {
  constructor() {
    /** @type {HIDDevice|null} */
    this.device = null;
    /** @type {Function|null} 接收回调 */
    this.receiveHandler = null;
    /** @type {Function|null} 错误回调 */
    this.errorHandler = null;
    /** @type {HIDInputReportEvent|null} */
    this._inputReportHandler = null;
  }

  /**
   * 检查浏览器是否支持 WebHID
   * @returns {boolean}
   */
  static isSupported() {
    return 'hid' in navigator;
  }

  /**
   * 弹出设备选择器请求用户授权
   * @param {HIDDeviceFilter[]} filters 设备过滤器
   * @returns {Promise<HIDDevice[]>}
   */
  async request(filters = []) {
    if (!WebHIDTransport.isSupported()) {
      throw new Error('当前浏览器不支持 WebHID API, 请使用 Chrome/Edge');
    }
    try {
      const devices = await navigator.hid.requestDevice({
        filters: filters.length > 0 ? filters : undefined,
      });
      logger.info(`用户选择了 ${devices.length} 个设备`);
      return devices;
    } catch (err) {
      logger.error(`设备选择失败: ${err.message}`);
      throw err;
    }
  }

  /**
   * 列出已授权的设备
   * @returns {Promise<HIDDevice[]>}
   */
  async listDevices() {
    if (!WebHIDTransport.isSupported()) return [];
    return await navigator.hid.getDevices();
  }

  /**
   * 连接到指定设备
   * @param {HIDDevice} device
   */
  async connect(device) {
    if (!device) {
      throw new Error('设备不能为空');
    }

    try {
      if (!device.opened) {
        await device.open();
        logger.info(`设备已打开: ${device.productName || 'Unknown'}`);
      }

      this.device = device;
      this._attachListeners();
      this._monitorConnection();

      bus.emit('transport:connected', {
        vendorId: device.vendorId,
        productId: device.productId,
        productName: device.productName,
      });

      return device;
    } catch (err) {
      logger.error(`连接设备失败: ${err.message}`);
      throw err;
    }
  }

  /**
   * 断开当前设备
   */
  async disconnect() {
    if (!this.device) return;

    this._detachListeners();

    try {
      if (this.device.opened) {
        await this.device.close();
      }
      logger.info('设备已断开');
    } catch (err) {
      logger.warn(`断开设备时出错: ${err.message}`);
    }

    this.device = null;
    bus.emit('transport:disconnected', null);
  }

  /**
   * 发送数据
   * @param {Uint8Array} data 63 字节数据 (去除 Report ID)
   * @returns {Promise<void>}
   */
  async send(data) {
    if (!this.device || !this.device.opened) {
      throw new Error('设备未连接');
    }
    if (data.length !== PROTOCOL.PACKET_SIZE - 1) {
      throw new Error(
        `Invalid packet size: ${data.length}, expected ${PROTOCOL.PACKET_SIZE - 1}`
      );
    }

    try {
      // Report ID = 0x04
      await this.device.sendReport(PROTOCOL.REPORT_ID, data);
    } catch (err) {
      logger.error(`Send report failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * 监听设备接收
   * @param {Function} handler (data: Uint8Array) => void
   */
  onReceive(handler) {
    this.receiveHandler = handler;
  }

  /**
   * 监听传输错误
   * @param {Function} handler (err: Error) => void
   */
  onError(handler) {
    this.errorHandler = handler;
  }

  /**
   * 获取当前设备信息
   * @returns {Object|null}
   */
  getDeviceInfo() {
    if (!this.device) return null;
    return {
      vendorId: this.device.vendorId,
      productId: this.device.productId,
      productName: this.device.productName,
      opened: this.device.opened,
    };
  }

  /**
   * 是否已连接
   * @returns {boolean}
   */
  isConnected() {
    return this.device !== null && this.device.opened;
  }

  // ============ 私有方法 ============

  /**
   * 附加设备事件监听
   */
  _attachListeners() {
    if (!this.device) return;

    this._inputReportHandler = (event) => {
      const { data, reportId } = event;
      if (reportId !== PROTOCOL.REPORT_ID) return;

      // 转换为 Uint8Array
      const buffer = new Uint8Array(data.buffer);
      logger.debug(
        `← HID Input Report (${buffer.length} bytes): ` +
        Array.from(buffer.slice(0, 16))
          .map(b => b.toString(16).padStart(2, '0'))
          .join(' ')
      );

      if (this.receiveHandler) {
        try {
          this.receiveHandler(buffer);
        } catch (err) {
          logger.error(`Receive handler error: ${err.message}`);
        }
      }
    };

    this.device.addEventListener('inputreport', this._inputReportHandler);
  }

  /**
   * 移除设备事件监听
   */
  _detachListeners() {
    if (this.device && this._inputReportHandler) {
      this.device.removeEventListener('inputreport', this._inputReportHandler);
      this._inputReportHandler = null;
    }
  }

  /**
   * 监听连接断开
   */
  _monitorConnection() {
    if (!this.device) return;
    this.device.addEventListener('disconnect', () => {
      logger.warn('设备意外断开');
      bus.emit('transport:disconnected', { reason: 'unexpected' });
      this.device = null;
    });
  }
}
