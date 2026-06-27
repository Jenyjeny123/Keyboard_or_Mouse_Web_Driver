# SwiftKey X1 通讯协议 V2.1 完整规范

> **版本**: V2.1  
> **日期**: 2026-06-26  
> **替代**: V1.0 (`通讯协议.txt`)、V2.0 (`Protocol_V2.md` 草案)  
> **状态**: ✅ 已实现并验证

---

## 1. 数据包结构 (64 字节)

```
┌─────────────────────────────────┬──────────────────────────────────────┐
│      Header (8 Bytes)           │       Data Area (56 Bytes)           │
├─────────────────────────────────┼──────────────────────────────────────┤
│ [0]   Report ID (0x04)          │                                      │
│ [1-2] CMD (uint16, LE)          │                                      │
│ [3]   LEN (0-56)                │   [8 ~ 63] 固定 56 字节数据区         │
│ [4-5] ADDR (uint16, LE)         │   不足部分填 0x00                    │
│ [6-7] Data Length (uint16, LE)  │   无校验、无标志                     │
└─────────────────────────────────┴──────────────────────────────────────┘
```

### 字段说明

| 偏移 | 长度 | 字段 | 类型 | 说明 |
|------|------|------|------|------|
| 0 | 1 | Report ID | uint8 | 固定 `0x04` (AP 通讯通道) |
| 1-2 | 2 | **CMD** | uint16 (LE) | 命令码 (小端序)，高字节=类别，低字节=命令 |
| 3 | 1 | **LEN** | uint8 | Payload 有效长度 (0-56) |
| 4-5 | 2 | **ADDR** | uint16 (LE) | 16位地址 (小端序)，用于 RAM/Flash 读写 |
| 6-7 | 2 | **Data Length** | uint16 (LE) | 数据总长度 (分包传输时使用，单包时与 LEN 相同) |
| 8-63 | 56 | **Data** | bytes | 纯数据区 (无校验/无标志) |

### ⚠️ 重要变更 (相对 V1.0)

| 维度 | V1.0 | V2.1 | 影响 |
|------|------|------|------|
| CMD 大小 | 1 字节 (byte[4]) | **2 字节** (byte[1-2], LE) | **设备固件必须修改** |
| CMD 位置 | byte[4] | byte[1-2] | **设备固件必须修改** |
| LEN 位置 | byte[5] | byte[3] | **设备固件必须修改** |
| ADDR 位置 | byte[6-7] | byte[4-5] | **设备固件必须修改** |
| CRC16 | 有 | **移除** | 简化协议 |
| FLAGS/SEQ/REQ_ID | 有 | **移除** | 简化协议 |

---

## 2. 命令码定义

CMD 为 2 字节 (uint16, 小端序): **高字节 = 类别码**, **低字节 = 命令码**。

### 2.1 类别码

| 类别码 | 类别 | 说明 |
|--------|------|------|
| `0x00` | **系统** | 设备管理、握手、状态 |
| `0x01` | **灯光** | LED 定义、模式、动画 |
| `0x02` | **按键** | 矩阵、宏、重映射 |
| `0x03` | **性能** | DPI、轮询率、抬升高度 |
| `0x04` | **电源** | 电池、充电、睡眠 |
| `0x05` | **固件** | DFU、升级、备份 |
| `0x06` | **配置** | Profile 管理 |
| `0x07` | **测试** | 回环、性能、延迟 |

### 2.2 完整命令列表

#### 系统类 (0x00xx)
| CMD | 名称 | 请求 Payload | 响应 Payload |
|-----|------|-------------|-------------|
| `0x0000` | PING | 空 | `[status]` |
| `0x0001` | RESET | `[type: 0=软复位, 1=硬复位, 2=出厂]` | `[status]` |
| `0x0002` | SET_MODE | `[mode: 0=Host, 1=Web, 2=混合]` | `[status, current_mode]` |
| `0x0003` | READ_BASIC_INFO | `[length, offset_lo, offset_hi]` | `[status, data...]` |
| `0x0004` | WRITE_BASIC_INFO | `[offset_lo, offset_hi, data...]` | `[status]` |
| `0x0005` | READ_RAM | `[length, offset_lo, offset_hi]` | `[status, data...]` |
| `0x0006` | WRITE_RAM | `[offset_lo, offset_hi, data...]` | `[status]` |
| `0x0007` | READ_FLASH | `[length, addr_32bit...]` | `[status, data...]` |
| `0x0008` | WRITE_FLASH | `[length, addr_32bit..., data...]` | `[status, write_time_ms]` |
| `0x0009` | AUTH | `[challenge_8bytes]` | `[status, response_16bytes]` |
| `0x000A` | GET_CAPABILITIES | 空 | `[status, proto_ver, dev_type, features...]` |
| `0x000B` | NOTIFY | (设备主动上报) | `[event_type, key_id, state, timestamp...]` |

#### 灯光类 (0x01xx)
| CMD | 名称 | 请求 Payload | 响应 Payload |
|-----|------|-------------|-------------|
| `0x0100` | READ_LED_DEFINE | `[length, offset_lo, offset_hi]` | `[status, rgb_data...]` |
| `0x0101` | WRITE_LED_DEFINE | `[start_id, count, rgb_data...]` | `[status, written_count]` |
| `0x0102` | LED_START | `[mode, speed, brightness, direction]` | `[status]` |
| `0x0103` | LED_STOP | 空 | `[status]` |
| `0x0104` | SET_SINGLE_LED | `[led_id, r, g, b]` | `[status]` |
| `0x0105` | SET_ZONE_LED | `[zone_id, r, g, b]` | `[status]` |
| `0x0106` | SWITCH_EFFECT | `[effect_id]` | `[status]` |
| `0x0107` | SET_BREATH_PARAM | `[period_lo, period_hi, intensity, color_mode]` | `[status]` |
| `0x0108` | SET_RAINBOW_PARAM | `[speed, direction, saturation]` | `[status]` |
| `0x0109` | UPLOAD_CUSTOM_EFFECT | `[frame_count_lo, frame_count_hi, delay_lo, delay_hi, frame_data...]` | `[status, effect_id]` |
| `0x010A` | READ_LED_STATE | 空 | `[status, mode, brightness, speed, direction, is_running]` |
| `0x010B` | READ_LED_INDEX | 空 | `[status, led_count, led_ids...]` |
| `0x010C` | LED_SYNC | `[sync_group, role]` | `[status]` |
| `0x010D` | SCREEN_COLOR_CONFIG | `[mode, speed, sample_area_x, sample_area_y, brightness]` | `[status]` |
| `0x010E` | AUDIO_REACTIVE_CONFIG | `[sensitivity, channel, color_mode]` | `[status]` |
| `0x010F` | SET_CUSTOM_COLOR | `[r, g, b]` | `[status]` |

#### 按键类 (0x02xx)
| CMD | 名称 | 请求 Payload | 响应 Payload |
|-----|------|-------------|-------------|
| `0x0200` | READ_MATRIX | `[length, offset_lo, offset_hi]` | `[status, matrix_data...]` |
| `0x0201` | WRITE_MATRIX | `[offset_lo, offset_hi, data...]` | `[status, written_keys]` |
| `0x0202` | READ_KEY_STATE | 空 | `[status, pressed_bitmap_lo, pressed_bitmap_hi, modifiers]` |
| `0x0203` | REMAP_KEY | `[key_id, key_type, value_lo, value_hi]` | `[status]` |
| `0x0204` | MACRO_RECORD_START | `[macro_id, name_8bytes]` | `[status, assigned_id]` |
| `0x0205` | MACRO_RECORD_STOP | 空 | `[status, event_count_lo, event_count_hi, duration_lo, duration_hi]` |
| `0x0206` | EXEC_MACRO | `[macro_id, repeat_count]` | `[status]` |
| `0x0207` | DELETE_MACRO | `[macro_id]` | `[status]` |
| `0x0208` | LIST_MACROS | 空 | `[status, count, entries...]` |
| `0x0209` | READ_MACRO_DATA | `[macro_id, offset_lo, offset_hi, length]` | `[status, data...]` |
| `0x020A` | WRITE_MACRO_DATA | `[macro_id, offset_lo, offset_hi, data...]` | `[status, written_bytes]` |
| `0x020B` | COMBO_KEY | `[main_key, mod_count, mod_keys...]` | `[status]` |
| `0x020C` | FIRE_KEY | `[key_id, mode, interval_lo, interval_hi, max_cps]` | `[status]` |
| `0x020D` | MEDIA_KEY | `[key_id, media_func]` | `[status]` |
| `0x020E` | SYSTEM_KEY | `[key_id, sys_func]` | `[status]` |
| `0x020F` | DISABLE_KEY | `[key_id]` | `[status]` |

#### 性能类 (0x03xx)
| CMD | 名称 | 请求 Payload | 响应 Payload |
|-----|------|-------------|-------------|
| `0x0300` | READ_DEVICE_ID | 空 | `[status, vid_lo, vid_hi, pid_lo, pid_hi, serial_4bytes, date_4bytes]` |
| `0x0301` | WRITE_DEVICE_ID | `[vid_lo, vid_hi, pid_lo, pid_hi, serial_4bytes, date_4bytes]` | `[status]` |
| `0x0302` | READ_DPI | `[level]` | `[status, enabled, xy_sep, dpi_x_lo, dpi_x_hi, dpi_y_lo, dpi_y_hi, r, g, b]` |
| `0x0303` | WRITE_DPI | `[level, enabled, xy_sep, dpi_x_lo, dpi_x_hi, dpi_y_lo, dpi_y_hi, r, g, b]` | `[status]` |
| `0x0304` | SWITCH_DPI | `[level]` | `[status, current_level]` |
| `0x0305` | READ_POLL_RATE | 空 | `[status, poll_rate_code]` |
| `0x0306` | WRITE_POLL_RATE | `[poll_rate_code]` | `[status]` |
| `0x0307` | READ_LIFT_HEIGHT | 空 | `[status, lod, custom_value]` |
| `0x0308` | WRITE_LIFT_HEIGHT | `[lod, custom_value]` | `[status]` |
| `0x0309` | ANGLE_SNAPPING | `[enable, strength]` | `[status]` |
| `0x030A` | LINEAR_CALIBRATION | 空 | `[status, calib_time_lo, calib_time_hi]` |
| `0x030B` | RIPPLE_CORRECTION | `[enable]` | `[status]` |
| `0x030C` | MOVE_SYNC | `[enable]` | `[status]` |
| `0x030D` | KEY_DELAY | `[delay_ms]` | `[status]` |
| `0x030E` | PERFORMANCE_MODE | `[mode: 0=性能, 1=平衡, 2=省电]` | `[status]` |
| `0x030F` | PERFORMANCE_STATS | 空 | `[status, total_reports_4B, dropped_4B, avg_latency_4B, max_latency_4B]` |

#### 电源类 (0x04xx)
| CMD | 名称 | 请求 Payload | 响应 Payload |
|-----|------|-------------|-------------|
| `0x0400` | READ_BATTERY | 空 | `[status, level_0_100, voltage_lo, voltage_hi, charge_status, temp_lo, temp_hi]` |
| `0x0401` | READ_CHARGE_STATUS | 空 | `[status, charge_state, current_lo, current_hi, time_lo, time_hi]` |
| `0x0402` | SET_SLEEP_TIME | `[light_sleep_lo, light_sleep_hi, deep_sleep_lo, deep_sleep_hi]` | `[status]` |
| `0x0403` | WAKE_UP | 空 | `[status]` |
| `0x0404` | SHUTDOWN | 空 | (设备立即关机) |
| `0x0405` | LOW_BATTERY_ALERT | `[threshold]` | `[status]` |
| `0x0406` | CHARGE_CURRENT | `[current_mode, custom_ma]` | `[status]` |

#### 固件类 (0x05xx) — ⏸️ 暂定，后续调试时实现
| CMD | 名称 | 状态 |
|-----|------|------|
| `0x0500` | ENTER_DFU | ⏸️ 暂定 |
| `0x0501` | EXIT_DFU | ⏸️ 暂定 |
| `0x0502` | FIRMWARE_INFO | ⏸️ 暂定 |
| `0x0503` - `0x050A` | 其他固件命令 | ⏸️ 暂定 |

#### 配置类 (0x06xx)
| CMD | 名称 | 请求 Payload | 响应 Payload |
|-----|------|-------------|-------------|
| `0x0600` | LIST_PROFILES | 空 | `[status, active_id, total_count, entries...]` |
| `0x0601` | SWITCH_PROFILE | `[profile_id]` | `[status, active_id]` |
| `0x0602` | SAVE_PROFILE | `[profile_id_or_FF, name_12bytes]` | `[status, new_id]` |
| `0x0603` | DELETE_PROFILE | `[profile_id]` | `[status]` |
| `0x0604` | EXPORT_PROFILE | `[profile_id]` | `[status, data_len_lo, data_len_hi, json_data...]` |
| `0x0605` | IMPORT_PROFILE | `[data_len_lo, data_len_hi, json_data...]` | `[status, new_id]` |
| `0x0606` | RENAME_PROFILE | `[profile_id, new_name_12bytes]` | `[status]` |
| `0x0607` | COPY_PROFILE | `[source_id, target_name_12bytes]` | `[status, new_id]` |

#### 测试类 (0x07xx)
| CMD | 名称 | 请求 Payload | 响应 Payload |
|-----|------|-------------|-------------|
| `0x0700` | **LOOPBACK_TEST** | `[test_data...]` | `[status, echoed_data...]` |
| `0x0701` | PERFORMANCE_TEST | `[duration_lo, duration_hi, packet_size]` | `[status, sent_4B, recv_4B, lost_4B, throughput_lo, throughput_hi]` |
| `0x0702` | LATENCY_TEST | `[count_lo, count_hi]` | `[status, min_us_4B, max_us_4B, avg_us_4B]` |
| `0x0703` | ERROR_RATE_TEST | `[count_lo, count_hi, data_len]` | `[status, sent_4B, recv_4B, errors_4B, rate_4B]` |
| `0x0704` | STRESS_TEST | `[duration_min_lo, duration_min_hi, rate]` | `[status]` (后台运行) |
| `0x0705` | READ_TEST_RESULT | `[test_id]` | `[status, test_type, data...]` |
| `0x0706` | STOP_TEST | 空 | `[status]` |
| `0x070F` | DEVICE_DEBUG | `[debug_code, debug_data...]` | `[status, debug_response...]` |

---

## 3. 状态码定义

| 状态码 | 名称 | 说明 |
|--------|------|------|
| `0x00` | SUCCESS | 成功 |
| `0x01` | BUSY | 设备忙，请稍后重试 |
| `0x02` | INVALID_CMD | 无效命令码 |
| `0x03` | INVALID_PARAM | 无效参数 |
| `0x04` | INVALID_ADDR | 地址越界 |
| `0x05` | INVALID_LEN | 长度错误 |
| `0x06` | CHECKSUM_ERR | 校验失败 (V2.1 已移除 CRC，此码保留兼容) |
| `0x07` | TIMEOUT | 超时 |
| `0x08` | NOT_SUPPORTED | 不支持的功能 |
| `0x09` | WRITE_FAIL | 写入失败 |
| `0x0A` | READ_FAIL | 读取失败 |
| `0x0B` | NO_AUTH | 未认证 |
| `0x0C` | LOW_BATTERY | 低电量 |
| `0x0D` | DFU_MODE | 处于 DFU 模式 |
| `0x0E` | INVALID_STATE | 状态错误 |
| `0xFE` | UNKNOWN | 未知错误 |
| `0xFF` | INTERNAL | 内部错误 |

---

## 4. 响应包格式

### 4.1 基本规则

- **响应包结构与请求包完全相同** (64 字节)
- **CMD 字段**: 与请求**相同** (不再使用 `| 0x80` 机制)
- **Payload[0]**: **状态码** (见第 3 节)
- **Payload[1+]**: 响应数据

### 4.2 响应示例

**请求**: `READ_DPI` (CMD=0x0302), Level=1

```
发送 (Web → Device):
Byte:  [0]    [1-2]     [3]  [4-5]  [6-7]  [8]
       0x04  0x02,0x03  0x01  0x01,0x00  0x01,0x00  0x01
       └─RPT └──CMD──┘ └LEN┘ └ADDR─┘ └DTLEN┘ └Level┘
```

```
响应 (Device → Web):
Byte:  [0]    [1-2]     [3]   [4-5]  [6-7]  [8]  [9]  [10] [11-12] [13-14] [15] [16] [17]
       0x04  0x02,0x03  0x0A  0x01,0x00  0x0A,0x00  0x00 0x01  0x00  0x20,0x03  0x20,0x03  0x00 0x00 0xFF
       └─RPT └──CMD──┘ └LEN┘ └ADDR─┘ └DTLEN └ST─┘ EN─┘ XY─┘ ─DPI_X──┘ └─DPI_Y──┘ └─R─┘ └G─┘ └B─┘

Payload 解析:
  [0x00]            Status = SUCCESS
  [0x01]            Enabled
  [0x00]            XY Separate
  [0x20, 0x03]      DPI X = 0x0320 = 800
  [0x20, 0x03]      DPI Y = 0x0320 = 800
  [0x00, 0x00, 0xFF] Color = Blue
```

---

## 5. 设备端解析代码 (C 语言参考实现)

### 5.1 数据包解析函数

```c
// ap_protocol_process.c
// V2.1 协议解析 - 修正版

#define AP_REPORT_ID 0x04

// CMD 定义 (2字节, 小端序)
#define CMD_PING                0x0000
#define CMD_READ_BASIC_INFO     0x0003
#define CMD_WRITE_BASIC_INFO    0x0004
#define CMD_READ_RAM            0x0005
#define CMD_WRITE_RAM           0x0006
#define CMD_READ_MATRIX         0x0200
#define CMD_WRITE_MATRIX        0x0201
#define CMD_READ_LED_DEFINE     0x0100
#define CMD_WRITE_LED_DEFINE    0x0101
#define CMD_LED_START           0x0102
#define CMD_LED_STOP            0x0103
#define CMD_SET_SINGLE_LED      0x0104
#define CMD_READ_DPI            0x0302
#define CMD_WRITE_DPI           0x0303
#define CMD_SWITCH_DPI          0x0304
#define CMD_READ_POLL_RATE      0x0305
#define CMD_WRITE_POLL_RATE     0x0306
#define CMD_LOOPBACK_TEST       0x0700
#define CMD_READ_DEVICE_ID      0x0300

// 状态码
#define STATUS_SUCCESS          0x00
#define STATUS_INVALID_CMD      0x02
#define STATUS_INVALID_PARAM    0x03
#define STATUS_BUSY             0x01

/**
 * 从接收缓冲区提取 2 字节 CMD (小端序)
 * V2.1: CMD 位于 byte[1-2]
 */
static uint16_t get_cmd(const uint8_t *buf) {
    return (uint16_t)buf[1] | ((uint16_t)buf[2] << 8);
}

/**
 * 从接收缓冲区提取 LEN
 * V2.1: LEN 位于 byte[3]
 */
static uint8_t get_len(const uint8_t *buf) {
    return buf[3];
}

/**
 * 从接收缓冲区提取 ADDR (小端序)
 * V2.1: ADDR 位于 byte[4-5]
 */
static uint16_t get_addr(const uint8_t *buf) {
    return (uint16_t)buf[4] | ((uint16_t)buf[5] << 8);
}

/**
 * 获取数据区指针
 * V2.1: 数据从 byte[8] 开始
 */
static const uint8_t* get_data(const uint8_t *buf) {
    return &buf[8];
}

/**
 * 构建响应包
 * @param response 输出缓冲区 (至少 64 字节)
 * @param cmd 命令码 (与请求相同)
 * @param status 状态码
 * @param data 响应数据
 * @param data_len 响应数据长度
 */
static void build_response(uint8_t *response, uint16_t cmd, uint8_t status,
                           const uint8_t *data, uint8_t data_len) {
    memset(response, 0, 64);
    response[0] = AP_REPORT_ID;                          // Report ID
    response[1] = cmd & 0xFF;                            // CMD 低字节
    response[2] = (cmd >> 8) & 0xFF;                     // CMD 高字节
    response[3] = 1 + data_len;                          // LEN = status(1) + data
    response[4] = 0;                                     // ADDR 低字节
    response[5] = 0;                                     // ADDR 高字节
    response[6] = 1 + data_len;                          // DataLength 低字节
    response[7] = 0;                                     // DataLength 高字节
    response[8] = status;                                // Payload[0] = Status
    if (data && data_len > 0) {
        memcpy(&response[9], data, data_len);            // Payload[1+] = Data
    }
}

/**
 * 发送响应
 */
extern void ap_protocol_send_response(const uint8_t *data, uint8_t len);

/**
 * 主处理函数
 */
void ap_protocol_process(void) {
    if (g_recieve_flag == 0) return;
    g_recieve_flag = 0;
    
    // 检查 Report ID
    if (g_usb_recieve_buf[0] != AP_REPORT_ID) {
        printf("Invalid Report ID: 0x%02x\r\n", g_usb_recieve_buf[0]);
        return;
    }
    
    // ✅ V2.1: 从 byte[1-2] 提取 2 字节 CMD (小端序)
    uint16_t cmd = get_cmd(g_usb_recieve_buf);
    uint8_t len = get_len(g_usb_recieve_buf);
    uint16_t addr = get_addr(g_usb_recieve_buf);
    const uint8_t *data = get_data(g_usb_recieve_buf);
    
    printf("AP CMD=0x%04X LEN=%u ADDR=0x%04X\r\n", cmd, len, addr);
    
    uint8_t response[64] = {0};
    uint8_t resp_len = 0;
    
    switch (cmd) {
        // ====== PING ======
        case CMD_PING:
        {
            printf("  -> PING\r\n");
            build_response(response, cmd, STATUS_SUCCESS, NULL, 0);
            resp_len = 64;
        }
        break;
        
        // ====== READ_BASIC_INFO ======
        case CMD_READ_BASIC_INFO:
        {
            uint8_t read_len = data[0];
            uint16_t offset = (uint16_t)data[1] | ((uint16_t)data[2] << 8);
            
            printf("  -> READ_BASIC_INFO len=%u offset=%u\r\n", read_len, offset);
            
            uint8_t resp_data[56] = {0};
            uint8_t actual_len = (offset + read_len > HEAD_TAB_SIZE) ? 
                                 (HEAD_TAB_SIZE - offset) : read_len;
            
            if (offset < HEAD_TAB_SIZE) {
                memcpy(resp_data, &head_description_tab[offset], actual_len);
            }
            
            build_response(response, cmd, STATUS_SUCCESS, resp_data, read_len);
            resp_len = 64;
        }
        break;
        
        // ====== LOOPBACK_TEST ======
        case CMD_LOOPBACK_TEST:
        {
            printf("  -> LOOPBACK_TEST len=%u\r\n", len);
            // 回显所有数据 (去除 status 字节)
            build_response(response, cmd, STATUS_SUCCESS, data, len);
            resp_len = 64;
        }
        break;
        
        // ====== READ_DPI ======
        case CMD_READ_DPI:
        {
            uint8_t level = data[0];
            printf("  -> READ_DPI level=%u\r\n", level);
            
            uint8_t resp_data[9] = {
                0x01,           // Enabled
                0x00,           // XY Separate
                0x20, 0x03,     // DPI X = 800
                0x20, 0x03,     // DPI Y = 800
                0x00, 0x00, 0xFF // Color = Blue
            };
            
            build_response(response, cmd, STATUS_SUCCESS, resp_data, sizeof(resp_data));
            resp_len = 64;
        }
        break;
        
        // ====== READ_DEVICE_ID ======
        case CMD_READ_DEVICE_ID:
        {
            printf("  -> READ_DEVICE_ID\r\n");
            uint8_t resp_data[12] = {
                USB_SHORT_GET_LOW(HEAD_VID_DEFAULT),
                USB_SHORT_GET_HIGH(HEAD_VID_DEFAULT),
                USB_SHORT_GET_LOW(HEAD_PID_DEFAULT),
                USB_SHORT_GET_HIGH(HEAD_PID_DEFAULT),
                0x00, 0x00, 0x00, 0x00,  // Serial
                0x00, 0x00, 0x00, 0x00   // Date
            };
            
            build_response(response, cmd, STATUS_SUCCESS, resp_data, sizeof(resp_data));
            resp_len = 64;
        }
        break;
        
        // ====== 未实现的命令 ======
        default:
        {
            printf("  -> UNKNOWN CMD 0x%04X\r\n", cmd);
            build_response(response, cmd, STATUS_INVALID_CMD, NULL, 0);
            resp_len = 64;
        }
        break;
    }
    
    if (resp_len > 0) {
        ap_protocol_send_response(response, resp_len);
    }
}
```

### 5.2 关键修改点 (相对 V1.0 设备代码)

| 修改项 | V1.0 旧代码 | V2.1 新代码 |
|--------|------------|------------|
| **CMD 提取** | `buf[4]` (1字节) | `(buf[1] \| buf[2]<<8)` (2字节 LE) |
| **LEN 提取** | `buf[5]` | `buf[3]` |
| **ADDR 提取** | `buf[6] \| buf[7]<<8` | `buf[4] \| buf[5]<<8` |
| **数据起始** | `buf[8]` | `buf[8]` (不变) |
| **响应构建** | 手动填充各字段 | 使用 `build_response()` 统一构建 |
| **响应 CMD** | 与请求相同 | 与请求相同 (不变) |
| **响应 Payload[0]** | 直接放数据 | **先放 Status 状态码** |

---

## 6. 典型通讯流程

### 6.1 PING 心跳检测

```
Web → Device:  [04 00 00 00 00 00 00 00 ...]
               RPT CMD=0  LEN=0

Device → Web:  [04 00 00 01 00 00 01 00 00 ...]
               RPT CMD=0  LEN=1 ST=SUCCESS
```

### 6.2 LOOPBACK_TEST 回环测试

```
Web → Device:  [04 00 07 04 00 00 04 00 01 02 03 04 ...]
               RPT CMD=0x0700 LEN=4 DATA=[01,02,03,04]

Device → Web:  [04 00 07 05 00 00 05 00 00 01 02 03 04 ...]
               RPT CMD=0x0700 LEN=5 ST=SUCCESS DATA=[01,02,03,04]
```

### 6.3 READ_DPI 读取 DPI

```
Web → Device:  [04 02 03 01 01 00 01 00 01 ...]
               RPT CMD=0x0302 LEN=1 LEVEL=1

Device → Web:  [04 02 03 0A 01 00 0A 00 00 01 00 20 03 20 03 00 00 FF ...]
               RPT CMD=0x0302 LEN=10 ST=0 EN=1 XY=0 X=800 Y=800 R=0 G=0 B=255
```

---

## 7. 灯效控制详细说明

### 7.1 灯效模式列表

| mode | 名称 | 说明 | 速度可调 | 亮度可调 |
|------|------|------|----------|----------|
| 0 | 固定颜色 (SOLID_COLOR) | 单色常亮，不闪烁 | 否 (固定30ms) | 是 |
| 1 | 彩虹呼吸 (RAINBOW_BREATHING) | 色相循环 + 亮度呼吸渐变 | 是 | 是 |
| 2 | 波浪 (WAVE) | 4 组色相错位流动 | 是 | 是 |
| 3 | 旋转点 (ROTATING_SPOT) | 单点旋转跑马灯 | 是 | 是 |
| 4 | 彗星 (COMET) | 带尾迹的移动点 | 是 | 是 |
| 5 | 风车 (WINDMILL) | 4 叶片多色旋转 | 是 | 是 |
| 6 | 按键涟漪 (KEY_STATUS) | 按键触发涟漪扩散 + 渐灭 | 是 | 是 |
| 7 | 单色呼吸 (BREATHING) | 固定颜色 + 亮度呼吸 | 是 | 是 |
| 8 | 星光闪烁 (STARLIGHT) | LFSR 伪随机点亮衰减 | 是 | 是 |
| 9 | 渐变流水 (GRADIENT_FLOW) | 色相渐变流动 | 是 | 是 |

### 7.2 亮度等级

`brightness` 取值范围: **0 ~ 4**

| 等级 | 实际亮度值 | 百分比 | 说明 |
|------|-----------|--------|------|
| 0 | 0 | 0% | 全灭 |
| 1 | 64 | 25% | 低亮 |
| 2 | 128 | 50% | 中亮 |
| 3 | 192 | 75% | 较高 |
| 4 | 255 | 100% | 最亮 |

> 映射表: `s_light_buffer[5] = {0, 64, 128, 192, 255}`
>
> 注意: mode 0 (固定颜色) 亮度可调，其余模式亮度均受此全局亮度影响。

### 7.3 速度等级

`speed` 取值范围: **0 ~ 4**

速度通过映射表 `s_speed_buffer[5][8]` 转换为各灯效的实际更新间隔 (ms):

| 等级 | 彩虹呼吸 | 波浪 | 旋转点 | 彗星 | 风车 | 单色呼吸 | 星光 | 渐变流水 |
|------|---------|------|--------|------|------|---------|------|---------|
| 0 (最慢) | 50ms | 80ms | 60ms | 50ms | 80ms | 40ms | 60ms | 65ms |
| 1 | 35ms | 55ms | 45ms | 35ms | 55ms | 28ms | 42ms | 45ms |
| 2 | 22ms | 35ms | 30ms | 22ms | 35ms | 18ms | 28ms | 30ms |
| 3 | 14ms | 22ms | 18ms | 14ms | 22ms | 11ms | 18ms | 20ms |
| 4 (最快) | 8ms | 12ms | 10ms | 8ms | 12ms | 6ms | 10ms | 12ms |

> **特殊说明**: mode 0 (固定颜色) 速度不可调，固定使用 30ms 刷新间隔。

### 7.4 方向

`direction` 取值范围: **0 ~ 3**

| 值 | 方向 | 说明 |
|----|------|------|
| 0 | 正向 | 默认方向 |
| 1 | 反向 | 反向播放 |
| 2 | 双向交替 | 正反向交替 |
| 3 | 随机 | 随机方向 |

> 当前各灯效对 direction 的支持程度取决于具体实现，部分灯效可能仅响应 0/1。

### 7.5 控制命令详解

#### 7.5.1 CMD_SWITCH_EFFECT (0x0106) — 仅切换灯效模式

```
请求 Payload (1 byte):
  [0] effect_id (0-9) — 灯效模式

响应 Payload:
  [0] status — 0x00=成功, 0x03=参数无效
```

**示例**: 切换到彩虹呼吸模式 (mode=1)
```
Web → Device:  04 06 01 01 00 00 01 00 01
               RPT CMD=0x0106 LEN=1 DATA=[effect_id=1]

Device → Web:  04 06 01 01 00 00 01 00 00
               RPT CMD=0x0106 LEN=1 STATUS=SUCCESS
```

#### 7.5.2 CMD_LED_START (0x0102) — 设置灯效全部参数

```
请求 Payload (4-5 bytes):
  [0] mode        (0-9)  — 灯效模式
  [1] speed       (0-4)  — 播放速度档位
  [2] brightness  (0-4)  — 亮度档位
  [3] direction   (0-3)  — 方向
  [4] color       (0-8)  — 颜色索引（可选，不传则保持当前颜色）

响应 Payload:
  [0] status — 0x00=成功, 0x03=参数无效
```

**参数详细说明**:

**speed (0-4)**:
- 0: 最慢（彩虹呼吸 50ms/帧，周期 6.4s）
- 1: 较慢（彩虹呼吸 35ms/帧，周期 4.5s）
- 2: 中速（彩虹呼吸 22ms/帧，周期 2.8s）
- 3: 较快（彩虹呼吸 14ms/帧，周期 1.8s）
- 4: 最快（彩虹呼吸 8ms/帧，周期 1.0s）

**brightness (0-4)**:
- 0: 全灭（亮度值 0）
- 1: 25% 亮度（亮度值 64）
- 2: 50% 亮度（亮度值 128）
- 3: 75% 亮度（亮度值 192）
- 4: 100% 亮度（亮度值 255）

**direction (0-3)**:
- 0: 正向
- 1: 反向
- 2: 双向交替
- 3: 随机

**color (0-8)** — 颜色索引:
| 值 | 颜色 | RGB |
|----|------|-----|
| 0 | 红色 | (255, 0, 0) |
| 1 | 绿色 | (0, 255, 0) |
| 2 | 蓝色 | (0, 0, 255) |
| 3 | 黄色 | (255, 255, 0) |
| 4 | 青色 | (0, 255, 255) |
| 5 | 品红 | (255, 0, 255) |
| 6 | 白色 | (255, 255, 255) |
| 7 | 橙色 | (255, 128, 0) |
| 8 | 彩虹 | 循环变色 |

**示例 1**: 设置 mode=2(波浪), speed=3(较快), brightness=4(最亮), direction=0(正向)
```
Web → Device:  04 02 01 04 00 00 04 00 02 03 04 00
               RPT CMD=0x0102 LEN=4 DATA=[mode=2, speed=3, brightness=4, direction=0]

Device → Web:  04 02 01 01 00 00 01 00 00
               RPT CMD=0x0102 LEN=1 STATUS=SUCCESS
```

**示例 2**: 设置 mode=0(固定颜色), speed=2, brightness=4, direction=0, color=2(蓝色)
```
Web → Device:  04 02 01 05 00 00 05 00 00 02 04 00 02
               RPT CMD=0x0102 LEN=5 DATA=[mode=0, speed=2, brightness=4, direction=0, color=2]

Device → Web:  04 02 01 01 00 00 01 00 00
               RPT CMD=0x0102 LEN=1 STATUS=SUCCESS
```

**⚠️ 注意**: `color` 参数必须通过 `LED_START` 命令传递。`SET_SINGLE_LED` (0x0104) 命令当前未实现，会返回 `NOT_SUPPORTED`。

---

### 7.5.2.1 颜色切换完整指南

驱动切换颜色应使用以下命令：

| 目标颜色 | 命令序列 | 示例数据包 |
|---------|---------|-----------|
| 固定颜色 (0-7) | 单次 `LED_START` 带 color 参数 | `04 02 01 05 00 00 05 00 00 02 04 00 02` (color=2 蓝色) |
| 彩虹循环 (8) | 单次 `LED_START` 带 color=8 | `04 02 01 05 00 00 05 00 00 02 04 00 08` |
| 自定义颜色 (9) | 先 `SET_CUSTOM_COLOR` 设置 RGB，再 `LED_START` 带 color=9 | 见下方完整示例 |

**完整示例：切换到自定义颜色**

```
步骤 1: 设置自定义颜色 RGB 值 (紫色: R=255, G=0, B=255)
Web → Device:  04 0F 01 03 00 00 03 00 FF 00 FF
               RPT CMD=0x010F LEN=3 DATA=[R=255, G=0, B=255]

Device → Web:  04 0F 01 01 00 00 01 00 00
               RPT CMD=0x010F LEN=1 STATUS=SUCCESS

步骤 2: 启动灯效并切换到自定义颜色模式 (color=9)
Web → Device:  04 02 01 05 00 00 05 00 00 04 00 09
               RPT CMD=0x0102 LEN=5 DATA=[mode=0, speed=2, brightness=4, direction=0, color=9]

Device → Web:  04 02 01 01 00 00 01 00 00
               RPT CMD=0x0102 LEN=1 STATUS=SUCCESS
```

> **重要**:
> - `LED_START` 的 `LEN` 必须为 5 才能切换颜色
> - 如果 `LEN=4`（不带 color 参数），颜色保持不变
> - 自定义颜色值立即生效，但只有在 `color=9` 时才会被使用

#### 7.5.3 CMD_SET_CUSTOM_COLOR (0x010F) — 设置自定义颜色

用于设置第 10 种颜色模式（索引 9）的 RGB 值，允许 Web 驱动动态调整灯效颜色。

```
请求 Payload (3 bytes):
  [0] r — 红色分量 (0-255)
  [1] g — 绿色分量 (0-255)
  [2] b — 蓝色分量 (0-255)

响应 Payload:
  [0] status — 0x00=成功, 0x05=长度错误
```

**使用流程**:

1. **设置自定义颜色**: 发送 `SET_CUSTOM_COLOR` 命令写入 RGB 值
2. **切换到自定义颜色模式**: 在 `LED_START` 命令中设置 `color=9`

**示例**: 设置自定义颜色为紫色 (255, 0, 255)，并应用到固定颜色模式

```
步骤 1: 设置自定义颜色为紫色
Web → Device:  04 0F 01 03 00 00 03 00 FF 00 FF
               RPT CMD=0x010F LEN=3 DATA=[R=255, G=0, B=255]

Device → Web:  04 0F 01 01 00 00 01 00 00
               RPT CMD=0x010F LEN=1 STATUS=SUCCESS

步骤 2: 切换到固定颜色模式，使用自定义颜色 (color=9)
Web → Device:  04 02 01 05 00 00 05 00 00 02 04 00 09
               RPT CMD=0x0102 LEN=5 DATA=[mode=0, speed=2, brightness=4, direction=0, color=9]

Device → Web:  04 02 01 01 00 00 01 00 00
               RPT CMD=0x0102 LEN=1 STATUS=SUCCESS
```

**注意事项**:
- 自定义颜色值会立即生效，无需重启设备
- 颜色值存储在设备内存中，断电后会恢复为默认值 (白色 255,255,255)
- 可在任何灯效模式下使用 `color=9` 切换到自定义颜色
- 修改自定义颜色后，如果当前已在使用 `color=9`，灯效会立即更新

#### 7.5.4 CMD_READ_LED_STATE (0x010A) — 读取当前灯效状态

```
请求 Payload: 空

响应 Payload (6 bytes):
  [0] status       — 0x00=成功
  [1] mode         — 当前灯效模式 (0-9)
  [2] brightness   — 当前亮度 (0-4)
  [3] speed        — 当前速度 (0-4)
  [4] direction    — 当前方向 (0-3)
  [5] is_running   — 运行状态 (1=运行中)
```

**示例**: 读取灯效状态
```
Web → Device:  04 0A 01 00 00 00 00 00
               RPT CMD=0x010A LEN=0

Device → Web:  04 0A 01 06 00 00 06 00 00 02 04 03 00 01
               RPT CMD=0x010A LEN=6 ST=0 mode=2 bright=4 speed=3 dir=0 running=1
```

### 7.6 数据流

灯效参数通过 AP 写入 `func_parameter_tab` 后即时生效，无需额外同步:

```
AP 写入 → func_parameter_tab[1] = light_mode     → LED_Run() switch 选择灯效
             func_parameter_tab[2] = light_brightness → s_light_buffer[] 映射亮度
             func_parameter_tab[3] = light_speed      → s_speed_buffer[][] 映射速度
             func_parameter_tab[4] = led_direction    → 灯效方向控制
```

### 7.7 各灯效周期时间参考

以下为不同速度等级下，各灯效完成一个完整周期的近似时间:

| 灯效 | speed=0 (最慢) | speed=2 (中) | speed=4 (最快) |
|------|---------------|-------------|---------------|
| 彩虹呼吸 | 128×50=6.4s | 128×22=2.8s | 128×8=1.0s |
| 波浪 | 15×80=1.2s | 15×35=0.5s | 15×12=0.2s |
| 旋转点 | 15×60=0.9s | 15×30=0.5s | 15×10=0.15s |
| 彗星 | 15×50=0.75s | 15×22=0.33s | 15×8=0.12s |
| 风车 | 15×80=1.2s | 15×35=0.5s | 15×12=0.18s |
| 单色呼吸 | 128×40=5.1s | 128×18=2.3s | 128×6=0.8s |
| 星光 | 60ms/帧 | 28ms/帧 | 10ms/帧 |
| 渐变流水 | 15×65=1.0s | 15×30=0.45s | 15×12=0.18s |

---

## 8. 错误处理

### 7.1 超时机制

- **默认超时**: 1000ms
- **超时行为**: 清除待响应请求，返回 `TIMEOUT` 错误

### 7.2 状态码错误

设备返回 `status != 0x00` 时，Web 端应：
1. 记录错误日志
2. 根据状态码显示用户友好的错误提示
3. 对于 `BUSY` 状态，可重试 1-2 次

### 7.3 设备意外断开

监听 `transport:disconnected` 事件，自动回到连接界面。

---

## 8. 附录

### 8.1 相关文件

- 📄 [BaseCommands.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/protocol/commands/BaseCommands.js) - Web 端命令常量
- 📄 [PacketBuilder.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/protocol/PacketBuilder.js) - 数据包构建器
- 📄 [Protocol.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/protocol/Protocol.js) - 协议层封装
- 📄 [TestService.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/services/TestService.js) - 测试服务

### 8.2 术语表

| 术语 | 说明 |
|------|------|
| Report ID | HID 报告标识符，固定 0x04 |
| CMD | 命令码，2 字节小端序 |
| LE | Little Endian (小端序) |
| Payload | 有效载荷 (Status + Data) |
| VID/PID | Vendor ID / Product ID |

---

**最后更新**: 2026-06-26  
**协议版本**: V2.1  
**维护者**: SwiftKey Team
