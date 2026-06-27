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

/** 连接超时时间 (ms) - 设备被占用时 device.open() 会无限挂起 */
const CONNECT_TIMEOUT = 3000;

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
  static async request(filters = []) {
    if (!WebHIDTransport.isSupported()) {
      throw new Error('当前浏览器不支持 WebHID API, 请使用 Chrome/Edge');
    }
    try {
      // filters 必须是数组, 传 undefined 会报错
      // 当 filters 为空时, 传空数组表示不限制 (让用户选择任意设备)
      const options = { filters: Array.isArray(filters) ? filters : [] };
      const devices = await navigator.hid.requestDevice(options);
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
  static async listDevices() {
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
      logger.info(`准备连接设备: ${device.productName || 'Unknown'} (VID: 0x${(device.vendorId||0).toString(16).padStart(4,'0')}, PID: 0x${(device.productId||0).toString(16).padStart(4,'0')})`);
      logger.info(`当前 opened 状态: ${device.opened}`);

      if (!device.opened) {
        // 等待 500ms 让设备准备就绪 (与原始 index.html 的 directRequestDevice 一致)
        await new Promise(resolve => setTimeout(resolve, 500));
        logger.info(`开始打开设备: ${device.productName || 'Unknown'}`);

        // 设备可能被 Bus Hound 等工具占用, device.open() 会无限挂起, 加超时保护
        await Promise.race([
          device.open(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(
              `设备打开超时 (${CONNECT_TIMEOUT / 1000}s) — 请检查设备是否被 Bus Hound 或其他工具占用`
            )), CONNECT_TIMEOUT)
          ),
        ]);
        logger.info(`设备已打开: ${device.productName || 'Unknown'}`);
      } else {
        logger.info(`设备已经处于打开状态`);
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
      logger.error(`连接设备失败: ${err.message} (${err.name})`);
      // 输出原始错误堆栈便于调试
      if (err.stack) logger.debug(err.stack);
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
