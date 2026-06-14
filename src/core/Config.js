/**
 * Config - 全局配置
 *
 * 集中管理所有可配置参数，避免魔数散落各处
 */

/** 协议相关常量 */
export const PROTOCOL = {
  REPORT_ID: 0x04,         // AP 通讯通道
  HEADER_SIZE: 8,          // 头部大小
  DATA_AREA_SIZE: 56,      // 数据区固定大小
  PACKET_SIZE: 64,         // 总包大小
  DEFAULT_TIMEOUT: 1000,   // 默认超时 (ms)
};

/** USB HID 设备过滤 */
export const DEVICE_FILTERS = [
  // 默认空过滤器，用户连接时通过 requestDevice 选择
  // 预留: 厂商 ID 0x0000 / 产品 ID 0x0001
  { vendorId: 0x0000, productId: 0x0001 },
];

/** WebHID 配置 */
export const WEBHID = {
  RETRY_COUNT: 3,            // 重试次数
  RETRY_DELAY: 100,          // 重试延迟 (ms)
  RECONNECT_DELAY: 1000,     // 重连延迟 (ms)
};

/** UI 配置 */
export const UI = {
  TOAST_DURATION: 3000,      // Toast 提示时长 (ms)
  ANIMATION_DURATION: 200,   // 动画时长 (ms)
  SCROLL_BEHAVIOR: 'smooth', // 平滑滚动
};

/** 测试配置 */
export const TEST = {
  DEFAULT_COUNT: 50,         // 默认测试次数
  MAX_COUNT: 1000,           // 最大测试次数
  MIN_INTERVAL: 5,           // 最小时间间隔 (ms)
  MAX_INTERVAL: 60000,       // 最大时间间隔 (ms)
  DEFAULT_INTERVAL: 100,     // 默认时间间隔 (ms)
  DEFAULT_DATA_LENGTH: 8,    // 默认数据长度 (字节)
  MAX_DATA_LENGTH: 56,       // 最大数据长度
  LOG_MAX_LINES: 500,        // 日志最大行数
  RESPONSE_TIMEOUT: 1000,    // 响应超时 (ms)
};

/** 灯光配置 */
export const LIGHTING = {
  LED_COUNT: 15,             // LED 数量
  DEFAULT_COLOR: '#06b6d4',  // 默认颜色 (青色)
  DEFAULT_BRIGHTNESS: 100,   // 默认亮度
  DEFAULT_SPEED: 5,          // 默认速度
  COLOR_PRESETS: [           // 颜色预设
    '#06b6d4', // cyan
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#ffffff', // white
  ],
};

/** 性能配置 */
export const PERFORMANCE = {
  POLL_RATES: [              // 轮询率选项
    { code: 0x00, hz: 125 },
    { code: 0x01, hz: 250 },
    { code: 0x02, hz: 500 },
    { code: 0x03, hz: 1000 },
    { code: 0x04, hz: 2000 },
    { code: 0x05, hz: 4000 },
    { code: 0x06, hz: 8000 },
  ],
  DPI_MIN: 100,
  DPI_MAX: 36000,
  DPI_STEP: 100,
  DPI_LEVELS: 8,             // DPI 档位数
};

/** 按键配置 */
export const KEYBOARD = {
  KEY_COUNT: 15,             // 按键数量
  KEY_NAMES: [               // 按键名称
    'ESC', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7',
    'F8', 'F9', 'F10', 'F11', 'F12', 'PrtSc', 'Del',
  ],
  KEYMAP_TYPES: [            // 按键映射类型
    { value: 0, label: '键盘' },
    { value: 1, label: '鼠标' },
    { value: 2, label: '宏' },
    { value: 3, label: '火力键' },
    { value: 4, label: '组合键' },
    { value: 5, label: '媒体' },
    { value: 6, label: '系统' },
    { value: 7, label: '自定义' },
  ],
};

/** 设备类型 */
export const DEVICE_TYPE = {
  KEYBOARD: 1,
  MOUSE: 2,
  MOUSE_PAD: 3,
  HEADSET: 4,
  KEYBOARD_MOUSE: 5,
};

/** 全局配置 (可被运行时修改) */
export const CONFIG = {
  ...PROTOCOL,
  ...DEVICE_FILTERS.length && { DEVICE_FILTERS },
  ...WEBHID,
  ...UI,
  ...TEST,
  ...LIGHTING,
  ...PERFORMANCE,
  ...KEYBOARD,
};
