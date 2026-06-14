# SwiftKey X1 通讯协议 V2.0 规范

> **版本**: V2.0
> **创建日期**: 2026-05-20
> **替代版本**: V1.0 (见 `通讯协议.txt`)
> **作者**: SwiftKey Team
> **状态**: 📋 设计中

## 📋 目录

- [1. 协议概述](#1-协议概述)
- [2. 数据包结构](#2-数据包结构)
- [3. 命令码分类](#3-命令码分类)
- [4. 系统/基础命令 (0x00-0x0F)](#4-系统基础命令-0x00-0x0f)
- [5. 灯光控制命令 (0x10-0x1F)](#5-灯光控制命令-0x10-0x1f)
- [6. 按键管理命令 (0x20-0x2F)](#6-按键管理命令-0x20-0x2f)
- [7. 性能调节命令 (0x30-0x3F)](#7-性能调节命令-0x30-0x3f)
- [8. 电源管理命令 (0x40-0x4F)](#8-电源管理命令-0x40-0x4f)
- [9. 固件升级命令 (0x50-0x5F)](#9-固件升级命令-0x50-0x5f)
- [10. 配置管理命令 (0x60-0x6F)](#10-配置管理命令-0x60-0x6f)
- [11. 数据测试命令 (0x70-0x7F)](#11-数据测试命令-0x70-0x7f)
- [12. 厂商扩展命令 (0x80-0xFF)](#12-厂商扩展命令-0x80-0xff)
- [13. 状态码定义](#13-状态码定义)
- [14. 协议版本管理](#14-协议版本管理)
- [15. 通讯流程示例](#15-通讯流程示例)
- [16. Web 端实现建议](#16-web-端实现建议)
- [17. 变更日志](#17-变更日志)

---

## 1. 协议概述

### 1.1 设计目标

| 目标 | 说明 |
|------|------|
| **完整性** | 覆盖设备管理、灯光、按键、性能、固件等所有功能 |
| **扩展性** | 支持鼠标、键盘、耳机等多产品 |
| **健壮性** | 加入 CRC16 校验、状态码、超时机制 |
| **易用性** | 命令编码清晰，类型安全 |
| **可测试性** | 支持模拟器、调试模式 |
| **向后兼容** | 通过版本号管理，平滑升级 |

### 1.2 与 V1.0 的对比

| 维度 | V1.0 原协议 | V2.0 协议 | 改进 |
|------|-------------|-----------|------|
| 命令数量 | ~18 个 | ~70+ 个 | 4 倍扩展 |
| 校验 | 无 | CRC16 | 提升可靠性 |
| 状态码 | 无 | 16 种 | 明确错误 |
| 响应机制 | 不明确 | CMD+0x80 | 清晰对应 |
| 超时处理 | 无 | 1s 默认 | 防止死锁 |
| 设备类型 | 仅 KB | KB/MS/Headset | 扩展产品 |
| DPI 支持 | 8 档固定 | 动态档位 | 灵活配置 |
| 固件升级 | 仅命令 | 完整流程 | 可升级 |
| 配置管理 | 无 | Profile 系统 | 多套配置 |
| 测试命令 | 仅颜色/按键 | 完整测试集 | 易调试 |

---

## 2. 数据包结构

### 2.1 基础包 (64 字节) - V2.1 更新

```
┌────────┬────────────┬──────┬───────┬──────┬──────┬───────┬────────────┬─────┐
│Byte 0  │ Byte 1-2   │Byte 3│Byte4-5│Byte 6│Byte 7│Byte8-9│ Byte 10-63 │     │
├────────┼────────────┼──────┼───────┼──────┼───────┼────────┼────────────┼─────┤
│Report  │   CMD      │ LEN  │  ADDR │FLAGS │  SEQ  │ REQ_ID │  Payload   │CRC16│
│  ID    │ (uint16 LE)│      │(LE)   │      │       │  (LE)  │  (LEN-2)B  │     │
│ 0x04   │            │(0-54)│       │      │       │        │  Data+CRC  │     │
└────────┴────────────┴──────┴───────┴──────┴───────┴────────┴────────────┴─────┘
```

### 2.2 字段说明

| 偏移 | 长度 | 字段 | 类型 | 说明 |
|------|------|------|------|------|
| 0 | 1 | Report ID | uint8 | 固定 `0x04` (AP 通讯通道) |
| 1-2 | 2 | **CMD** | uint16 (LE) | 命令码 (小端序) |
| 3 | 1 | LEN | uint8 | Payload 长度 (0-54) |
| 4-5 | 2 | ADDR | uint16 (LE) | 16位地址 (小端序) |
| 6 | 1 | FLAGS | uint8 | 标志位 (方向/类型等) |
| 7 | 1 | SEQ | uint8 | 序列号 (用于匹配请求/响应) |
| 8-9 | 2 | REQ_ID | uint16 (LE) | 请求 ID (异步匹配) |
| 10 ~ (10+LEN-2-1) | LEN-2 | Data | bytes | 实际业务数据 |
| (10+LEN-2) ~ (10+LEN-1) | 2 | CRC16 | uint16 (LE) | CRC-16/MODBUS 校验 |

### 2.3 字段详细说明

#### CMD (2 字节，小端序)
- **高字节**: 类别码
- **低字节**: 命令码
- 范围: `0x0000` - `0xFFFF` (65536 个命令)
- 示例:
  - `0x0000` = 系统类 + PING
  - `0x0100` = 灯光类 + READ_LED_DEFINE
  - `0x0203` = 按键类 + REMAP_KEY

#### LEN (1 字节)
- Payload 长度: 0-54 字节
- 仅包含 Data + CRC16
- 不含 Report ID、CMD、LEN、ADDR、FLAGS、SEQ、REQ_ID

#### ADDR (2 字节，小端序)
- 16 位地址
- 用于 RAM/Flash 读写
- 范围: 0x0000 - 0xFFFF

#### FLAGS (1 字节) - 标志位
```
Bit 0: 方向 (0=请求, 1=响应)
Bit 1: 类型 (0=命令, 1=事件/通知)
Bit 2: 加密 (0=明文, 1=加密)
Bit 3: 压缩 (0=原始, 1=压缩)
Bit 4: 优先级 (0=普通, 1=高)
Bit 5-7: 保留
```

#### SEQ (1 字节)
- 序列号
- 请求方生成 (0-255 循环)
- 响应方回显相同值
- 用于匹配请求/响应

#### REQ_ID (2 字节，小端序)
- 请求 ID
- 异步命令使用
- 用于多请求并发匹配

### 2.4 Payload 结构

```
┌────────────────────────────┬──────────┐
│      Data (LEN-2)          │  CRC16   │
│      实际业务数据            │  校验码  │
└────────────────────────────┴──────────┘
```

### 2.5 响应包结构

响应包结构与请求包相同，区别在于：

- **FLAGS 字段**: Bit 0 置 1 (表示响应)
- **SEQ 字段**: 回显请求的序列号
- **REQ_ID 字段**: 回显请求的 ID
- **CMD 字段**: 与请求相同 (不再使用 | 0x80 机制)
- **Payload[0]**: 状态码

```
响应包:
┌────────┬────────────┬──────┬───────┬──────┬──────┬───────┬────────────┐
│Report  │   CMD      │ LEN  │  ADDR │FLAGS │  SEQ  │REQ_ID │  Response  │
│  ID    │ (uint16 LE)│      │(LE)   │=0x01 │       │  (LE) │ Status+Data│
│  0x04  │   相同     │(0-54)│       │(响应)│ 回显  │  回显 │  + CRC16   │
└────────┴────────────┴──────┴───────┴──────┴──────┴───────┴────────────┘
```

**响应 Payload 结构**:
```
┌──────────┬──────────────────┬─────┐
│ Byte 0   │   Byte 1~LEN-3   │CRC16│
├──────────┼──────────────────┼─────┤
│ Status   │     Data         │校验 │
│ 状态码   │   响应数据       │     │
└──────────┴──────────────────┴─────┘
```

---

## 3. 命令码分类

CMD 字段为 2 字节 (uint16, 小端序)，采用 **高字节 = 类别码** + **低字节 = 命令码** 的方式组织。

### 3.1 类别码定义 (CMD 高字节)

| 类别码 | 类别 | 说明 |
|--------|------|------|
| `0x00` | **系统/基础** | 设备管理、握手、状态、认证 |
| `0x01` | **灯光控制** | LED 定义、模式、动画、同步 |
| `0x02` | **按键管理** | 矩阵、宏、组合键、火力键 |
| `0x03` | **性能调节** | DPI、轮询率、LOD |
| `0x04` | **电源管理** | 电池、充电、睡眠 |
| `0x05` | **固件升级** | DFU、OTA、备份恢复 |
| `0x06` | **配置管理** | Profile 读写、导入导出 |
| `0x07` | **数据测试** | 回环、性能、延迟、压力 |
| `0x08-0x0F` | **保留** | 系统预留 |
| `0x10-0xFF` | **厂商扩展** | 自定义功能 |

### 3.2 命令码总表 (按类别)

#### 系统类 (0x00xx)
- `0x0000` PING (心跳)
- `0x0001` RESET (复位)
- `0x0002` SET_MODE (模式切换)
- `0x0003` READ_BASIC_INFO
- `0x0004` WRITE_BASIC_INFO
- `0x0005` READ_RAM
- `0x0006` WRITE_RAM
- `0x0007` READ_FLASH
- `0x0008` WRITE_FLASH
- `0x0009` AUTH (认证)
- `0x000A` GET_CAPABILITIES (能力查询)
- `0x000B` NOTIFY (事件通知)

#### 灯光类 (0x01xx)
- `0x0100` READ_LED_DEFINE
- `0x0101` WRITE_LED_DEFINE
- `0x0102` LED_START
- `0x0103` LED_STOP
- `0x0104` SET_SINGLE_LED
- `0x0105` SET_ZONE_LED
- `0x0106` SWITCH_EFFECT
- `0x0107` SET_BREATH_PARAM
- `0x0108` SET_RAINBOW_PARAM
- `0x0109` UPLOAD_CUSTOM_EFFECT
- `0x010A` READ_LED_STATE
- `0x010B` READ_LED_INDEX
- `0x010C` LED_SYNC
- `0x010D` SCREEN_COLOR_CONFIG
- `0x010E` AUDIO_REACTIVE_CONFIG

#### 按键类 (0x02xx)
- `0x0200` READ_MATRIX
- `0x0201` WRITE_MATRIX
- `0x0202` READ_KEY_STATE
- `0x0203` REMAP_KEY
- `0x0204` MACRO_RECORD_START
- `0x0205` MACRO_RECORD_STOP
- `0x0206` EXEC_MACRO
- `0x0207` DELETE_MACRO
- `0x0208` LIST_MACROS
- `0x0209` READ_MACRO_DATA
- `0x020A` WRITE_MACRO_DATA
- `0x020B` COMBO_KEY
- `0x020C` FIRE_KEY
- `0x020D` MEDIA_KEY
- `0x020E` SYSTEM_KEY
- `0x020F` DISABLE_KEY

#### 性能类 (0x03xx)
- `0x0300` READ_DEVICE_ID
- `0x0301` WRITE_DEVICE_ID
- `0x0302` READ_DPI
- `0x0303` WRITE_DPI
- `0x0304` SWITCH_DPI
- `0x0305` READ_POLL_RATE
- `0x0306` WRITE_POLL_RATE
- `0x0307` READ_LIFT_HEIGHT
- `0x0308` WRITE_LIFT_HEIGHT
- `0x0309` ANGLE_SNAPPING
- `0x030A` LINEAR_CALIBRATION
- `0x030B` RIPPLE_CORRECTION
- `0x030C` MOVE_SYNC
- `0x030D` KEY_DELAY
- `0x030E` PERFORMANCE_MODE
- `0x030F` PERFORMANCE_STATS

#### 电源类 (0x04xx)
- `0x0400` READ_BATTERY
- `0x0401` READ_CHARGE_STATUS
- `0x0402` SET_SLEEP_TIME
- `0x0403` WAKE_UP
- `0x0404` SHUTDOWN
- `0x0405` LOW_BATTERY_ALERT
- `0x0406` CHARGE_CURRENT

#### 固件类 (0x05xx)
- `0x0500` ENTER_DFU
- `0x0501` EXIT_DFU
- `0x0502` FIRMWARE_INFO
- `0x0503` FIRMWARE_ERASE
- `0x0504` FIRMWARE_WRITE
- `0x0505` FIRMWARE_VERIFY
- `0x0506` FIRMWARE_INSTALL
- `0x0507` FIRMWARE_ROLLBACK
- `0x0508` UPGRADE_PROGRESS
- `0x0509` BACKUP_FIRMWARE
- `0x050A` RESTORE_BACKUP

#### 配置类 (0x06xx)
- `0x0600` LIST_PROFILES
- `0x0601` SWITCH_PROFILE
- `0x0602` SAVE_PROFILE
- `0x0603` DELETE_PROFILE
- `0x0604` EXPORT_PROFILE
- `0x0605` IMPORT_PROFILE
- `0x0606` RENAME_PROFILE
- `0x0607` COPY_PROFILE

#### 测试类 (0x07xx)
- `0x0700` LOOPBACK_TEST
- `0x0701` PERFORMANCE_TEST
- `0x0702` LATENCY_TEST
- `0x0703` ERROR_RATE_TEST
- `0x0704` STRESS_TEST
- `0x0705` READ_TEST_RESULT
- `0x0706` STOP_TEST
- `0x070F` DEVICE_DEBUG

---

## 4. 系统/基础命令 (0x00-0x0F)

### 4.1 `0x00` PING (心跳检测)

**用途**: 检测设备是否在线，获取设备基本信息

**请求**:
```
Payload: 空
```

**响应**:
```
Payload[0]:   Status (0x00=在线, 0x01=离线)
Payload[1-2]: Protocol Version (Major, Minor)
Payload[3]:   Device Type (1=KB, 2=MS, 3=MSPD, 4=Headset)
Payload[4]:   Feature Flags (bit mask)
Payload[5-8]: Reserved
```

**Feature Flags**:
- Bit 0: 支持 RGB
- Bit 1: 支持宏
- Bit 2: 支持无线
- Bit 3: 支持屏幕取色
- Bit 4: 支持音频律动
- Bit 5: 支持 OTA
- Bit 6: 支持云同步
- Bit 7: 支持多 Profile

### 4.2 `0x01` RESET (设备复位)

**用途**: 复位设备到指定状态

**请求**:
```
Payload[0]: Reset Type
  0x00 = 软复位 (保留 RAM)
  0x01 = 硬复位 (清空 RAM)
  0x02 = 恢复出厂设置
```

**响应**: ACK

### 4.3 `0x02` SET_MODE (设备模式切换)

**用途**: 切换设备工作模式

**请求**:
```
Payload[0]: Mode
  0x00 = Host 模式 (硬件控制)
  0x01 = Web 模式 (Web 驱动控制)
  0x02 = 混合模式
```

**响应**:
```
Payload[0]: Status
Payload[1]: Current Mode
```

### 4.4 `0x03` READ_BASIC_INFO (读取基本信息)

**用途**: 读取设备基本信息区 (29 字节)

**请求**:
```
Payload[0]:   Length (1-29)
Payload[1-2]: Offset (小端序, 0-28)
```

**响应**:
```
Payload[0]:   Status
Payload[1+]:  Basic Info Data
```

**基本信息区结构 (29 字节)**:
```
Offset 0-1:   Magic Number (0xAA, 0x55)
Offset 2-3:   Device Serial
Offset 4:     Device Space (单位 128 字节)
Offset 5:     Matrix Space (单位 3 字节)
Offset 6:     Macro Space (单位 1K 字节)
Offset 7:     Reserved
Offset 8:     Device Type
Offset 9-10:  Sensor Model
Offset 11:    DPI Step
Offset 12-13: DPI Rank
Offset 14-15: DPI Start
Offset 16:    XY Separate
Offset 17:    DPI Level
Offset 18-20: DPI Continue
Offset 21-22: VID
Offset 23-24: PID
Offset 25:    Device Version
Offset 26:    Backlight Type
Offset 27:    LED Count
Offset 28:   Reserved
```

### 4.5 `0x04` WRITE_BASIC_INFO (写入基本信息)

**请求**:
```
Payload[0-1]: Offset (小端序)
Payload[2+]:  Data
```

**响应**: ACK

### 4.6 `0x05` READ_RAM (读取功能区 RAM)

**用途**: 读取功能区参数 (103 字节)

**请求**:
```
Payload[0]:   Length (1-56)
Payload[1-2]: Offset (小端序)
```

**响应**:
```
Payload[0]:   Status
Payload[1+]:  RAM Data
```

### 4.7 `0x06` WRITE_RAM (写入功能区 RAM)

**请求**:
```
Payload[0-1]: Offset
Payload[2+]:  Data
```

**响应**: ACK

### 4.8 `0x07` READ_FLASH (读取 Flash)

**请求**:
```
Payload[0]:     Length
Payload[1-4]:   Address (32-bit 小端序)
```

**响应**:
```
Payload[0]:   Status
Payload[1+]:  Flash Data
```

### 4.9 `0x08` WRITE_FLASH (写入 Flash)

**请求**:
```
Payload[0]:     Length
Payload[1-4]:   Address
Payload[5+]:    Data
```

**响应**:
```
Payload[0]:   Status
Payload[1-2]: Write Time (ms)
```

### 4.10 `0x09` AUTH (设备认证)

**用途**: 双向认证，加密通讯

**请求**:
```
Payload[0-7]: Challenge (8 字节随机数)
```

**响应**:
```
Payload[0]:   Status
Payload[1-16]: Encrypted Response (使用预共享密钥)
```

### 4.11 `0x0A` GET_CAPABILITIES (能力查询)

**请求**: 空

**响应**:
```
Payload[0]:     Status
Payload[1-2]:   Protocol Version
Payload[3]:     Device Type
Payload[4]:     Feature Flags
Payload[5]:     LED Count
Payload[6]:     Key Count
Payload[7-8]:   Max DPI
Payload[9]:     Max Poll Rate Code
Payload[10-11]: Max Macro Count
Payload[12-15]: Reserved
```

---

## 5. 灯光控制命令 (0x10-0x1F)

### 5.1 `0x10` READ_LED_DEFINE (读取 LED 定义)

**请求**:
```
Payload[0]:     Length (1-56)
Payload[1-2]:   Offset (小端序)
```

**响应**:
```
Payload[0]:   Status
Payload[1+]:  LED Data (每 LED 3 字节: R, G, B)
```

### 5.2 `0x11` WRITE_LED_DEFINE (写入 LED 定义)

**请求**:
```
Payload[0]:     Start LED ID
Payload[1]:     LED Count
Payload[2+]:    RGB 数据 (3 字节/LED)
```

**响应**:
```
Payload[0]:   Status
Payload[1-2]: Written Count
```

### 5.3 `0x12` LED_START (启动灯效)

**请求**:
```
Payload[0]: Mode
  0x00 = 关闭
  0x01 = 常亮
  0x02 = 呼吸
  0x03 = 彩虹
  0x04 = 波浪
  0x05 = 跑马灯
  0x06 = 闪烁
  0x07 = 反应
  0x08 = 涟漪
  0x09 = 自定义
  0x0A = 屏幕取色
  0x0B = 音频律动

Payload[1]: Speed (0-10)
Payload[2]: Brightness (0-100)
Payload[3]: Direction (0=正向, 1=反向)
```

**响应**: ACK

### 5.4 `0x13` LED_STOP (停止灯效)

**请求**: 空

**响应**: ACK

### 5.5 `0x14` SET_SINGLE_LED (单 LED 设置)

**请求**:
```
Payload[0]:   LED ID
Payload[1-3]: R, G, B
```

**响应**: ACK

### 5.6 `0x15` SET_ZONE_LED (区域 LED 设置)

**请求**:
```
Payload[0]:   Zone ID
Payload[1-3]: R, G, B
```

**响应**: ACK

### 5.7 `0x16` SWITCH_EFFECT (切换灯效)

**请求**:
```
Payload[0]: Effect ID (见 LED_START Mode)
```

**响应**: ACK

### 5.8 `0x17` SET_BREATH_PARAM (呼吸效果参数)

**请求**:
```
Payload[0-1]: Period (ms, 小端序)
Payload[2]:   Intensity (0-100)
Payload[3]:   Color Mode (0=单色, 1=渐变)
```

**响应**: ACK

### 5.9 `0x18` SET_RAINBOW_PARAM (彩虹效果参数)

**请求**:
```
Payload[0]: Speed (0-10)
Payload[1]: Direction (0=左→右, 1=右→左, 2=中心→外, 3=外→中心)
Payload[2]: Saturation (0-100)
```

**响应**: ACK

### 5.10 `0x19` UPLOAD_CUSTOM_EFFECT (上传自定义灯效)

**用途**: 上传用户自定义灯效帧序列

**请求**:
```
Payload[0-1]:   Frame Count
Payload[2-3]:   Frame Delay (ms)
Payload[4+]:    Frame Data (每帧 N×3 字节 RGB)
```

**响应**:
```
Payload[0]: Status
Payload[1-2]: Effect ID
```

### 5.11 `0x1A` READ_LED_STATE (读取灯效状态)

**请求**: 空

**响应**:
```
Payload[0]:   Current Mode
Payload[1]:   Brightness
Payload[2]:   Speed
Payload[3]:   Direction
Payload[4]:   Is Running (0/1)
```

### 5.12 `0x1B` READ_LED_INDEX (读取 LED 索引)

**请求**: 空

**响应**:
```
Payload[0]:     LED Count
Payload[1+]:    LED IDs (按顺序)
```

### 5.13 `0x1C` LED_SYNC (灯效同步)

**请求**:
```
Payload[0]: Sync Group (0x00-0x0F)
Payload[1]: Role (0=主, 1=从)
```

**响应**: ACK

### 5.14 `0x1D` SCREEN_COLOR_CONFIG (屏幕取色配置)

**请求**:
```
Payload[0]:   Mode (0=关闭, 1=平均色, 2=边缘色, 3=中央色)
Payload[1]:   Speed (响应速度, 0-10)
Payload[2-3]: Sample Area (x, y 坐标或区域 ID)
Payload[4]:   Brightness
```

**响应**: ACK

### 5.15 `0x1E` AUDIO_REACTIVE_CONFIG (音频响应配置)

**请求**:
```
Payload[0]: Sensitivity (0-100)
Payload[1]: Channel (0=立体声, 1=左, 2=右)
Payload[2]: Color Mode (0=音量, 1=频率)
```

**响应**: ACK

---

## 6. 按键管理命令 (0x20-0x2F)

### 6.1 `0x20` READ_MATRIX (读取按键矩阵)

**请求**:
```
Payload[0]:   Length (1-48)
Payload[1-2]: Offset (小端序)
```

**响应**:
```
Payload[0]:   Status
Payload[1+]:  Matrix Data
```

**矩阵数据结构 (每键 3 字节)**:
```
Offset 0: Key Type (0=键盘, 1=鼠标, 2=宏, 3=火力, 4=组合, 5=媒体, 6=系统, 7=自定义)
Offset 1: Key Value 1 (热键/特殊键)
Offset 2: Key Value 2 (普通键)
```

### 6.2 `0x21` WRITE_MATRIX (写入按键矩阵)

**请求**:
```
Payload[0-1]: Offset
Payload[2+]:  Data
```

**响应**:
```
Payload[0]:   Status
Payload[1-2]: Written Keys
```

### 6.3 `0x22` READ_KEY_STATE (读取当前按键状态)

**请求**: 空

**响应**:
```
Payload[0]:     Status
Payload[1-2]:   Pressed Keys Bitmap (16-bit)
Payload[3+]:    Modifier State (Ctrl, Shift, Alt, Win)
```

### 6.4 `0x23` REMAP_KEY (按键重映射)

**请求**:
```
Payload[0]: Key ID
Payload[1]: Key Type
Payload[2-3]: Key Value (2 字节)
```

**响应**: ACK

### 6.5 `0x24` MACRO_RECORD_START (宏录制开始)

**请求**:
```
Payload[0]:   Macro ID (0xFF = 自动分配)
Payload[1-8]: Macro Name (8 字节 ASCII)
```

**响应**:
```
Payload[0]:   Status
Payload[1]:   Assigned Macro ID
```

### 6.6 `0x25` MACRO_RECORD_STOP (宏录制停止)

**请求**: 空

**响应**:
```
Payload[0]:     Status
Payload[1-2]:   Recorded Events Count
Payload[3-4]:   Total Duration (ms)
```

### 6.7 `0x26` EXEC_MACRO (执行宏)

**请求**:
```
Payload[0]: Macro ID
Payload[1]: Repeat Count (0=无限)
```

**响应**: ACK

### 6.8 `0x27` DELETE_MACRO (删除宏)

**请求**:
```
Payload[0]: Macro ID
```

**响应**: ACK

### 6.9 `0x28` LIST_MACROS (宏列表)

**请求**: 空

**响应**:
```
Payload[0]:     Status
Payload[1]:     Macro Count
Payload[2+]:    Macro Entries (每条 12 字节)
  - ID (1)
  - Name (8)
  - Event Count (2)
  - Duration (2)
```

### 6.10 `0x29` READ_MACRO_DATA (读取宏数据)

**请求**:
```
Payload[0]:   Macro ID
Payload[1-2]: Offset
Payload[3]:   Length
```

**响应**:
```
Payload[0]:   Status
Payload[1+]:  Macro Events Data
```

**宏事件结构 (每事件 4 字节)**:
```
Offset 0:   Event Type (1=KeyDown, 2=KeyUp, 3=Delay, 4=MouseMove, 5=MouseClick)
Offset 1-2: Value (键码/延迟ms/坐标)
Offset 3:   Reserved
```

### 6.11 `0x2A` WRITE_MACRO_DATA (写入宏数据)

**请求**:
```
Payload[0]:   Macro ID
Payload[1-2]: Offset
Payload[3+]:  Data
```

**响应**:
```
Payload[0]:   Status
Payload[1-2]: Written Bytes
```

### 6.12 `0x2B` COMBO_KEY (组合键配置)

**请求**:
```
Payload[0]:   Main Key
Payload[1]:   Modifier Count (1-4)
Payload[2+]:  Modifier Keys
```

**响应**: ACK

### 6.13 `0x2C` FIRE_KEY (火力键配置)

**请求**:
```
Payload[0]:   Key ID
Payload[1]:   Mode (0=连点, 1=自动连发, 2=长按连发)
Payload[2-3]: Interval (ms, 小端序)
Payload[4]:   Max CPS
```

**响应**: ACK

### 6.14 `0x2D` MEDIA_KEY (媒体键)

**请求**:
```
Payload[0]: Key ID
Payload[1]: Media Function
  0x01 = 播放/暂停
  0x02 = 下一首
  0x03 = 上一首
  0x04 = 音量+
  0x05 = 音量-
  0x06 = 静音
```

**响应**: ACK

### 6.15 `0x2E` SYSTEM_KEY (系统键)

**请求**:
```
Payload[0]: Key ID
Payload[1]: System Function
  0x01 = 锁屏
  0x02 = 任务管理器
  0x03 = 桌面
  0x04 = 搜索
  0x05 = 浏览器
  0x06 = 邮件
  0x07 = 计算器
```

**响应**: ACK

### 6.16 `0x2F` DISABLE_KEY (禁用按键)

**请求**:
```
Payload[0]: Key ID
```

**响应**: ACK

---

## 7. 性能调节命令 (0x30-0x3F)

### 7.1 `0x30` READ_DEVICE_ID (读取设备 ID)

**请求**: 空

**响应**:
```
Payload[0-1]:   VID (小端序)
Payload[2-3]:   PID (小端序)
Payload[4-7]:   Serial Number (4 字节)
Payload[8-11]:  Manufacture Date (YYYYMMDD)
```

### 7.2 `0x31` WRITE_DEVICE_ID (写入设备 ID)

**请求**:
```
Payload[0-1]:   VID
Payload[2-3]:   PID
Payload[4-7]:   Serial
Payload[8-11]:  Date
```

**响应**: ACK

### 7.3 `0x32` READ_DPI (读取 DPI 配置)

**请求**:
```
Payload[0]: DPI Level (0-7)
```

**响应**:
```
Payload[0]:     Status
Payload[1]:     Enabled
Payload[2]:     XY Separate
Payload[3-4]:   DPI X
Payload[5-6]:   DPI Y
Payload[7-9]:   Color (R, G, B)
```

### 7.4 `0x33` WRITE_DPI (写入 DPI 配置)

**请求**:
```
Payload[0]:   DPI Level
Payload[1]:   Enabled
Payload[2]:   XY Separate
Payload[3-4]: DPI X (小端序)
Payload[5-6]: DPI Y (小端序)
Payload[7-9]: Color
```

**响应**: ACK

### 7.5 `0x34` SWITCH_DPI (切换 DPI 档位)

**请求**:
```
Payload[0]: DPI Level (0-7)
```

**响应**:
```
Payload[0]: Status
Payload[1]: Current Level
```

### 7.6 `0x35` READ_POLL_RATE (读取轮询率)

**请求**: 空

**响应**:
```
Payload[0]: Poll Rate Code
  0x00 = 125 Hz
  0x01 = 250 Hz
  0x02 = 500 Hz
  0x03 = 1000 Hz (1K)
  0x04 = 2000 Hz (2K)
  0x05 = 4000 Hz (4K)
  0x06 = 8000 Hz (8K)
  0x07 = 24000 Hz (24G 无线)
```

### 7.7 `0x36` WRITE_POLL_RATE (写入轮询率)

**请求**:
```
Payload[0]: Poll Rate Code (同上)
```

**响应**: ACK

### 7.8 `0x37` READ_LIFT_HEIGHT (读取静默高度)

**请求**: 空

**响应**:
```
Payload[0]: LOD (0=1mm, 1=2mm, 2=3mm, 3=自定义)
Payload[1]: Custom Value (mm)
```

### 7.9 `0x38` WRITE_LIFT_HEIGHT (写入静默高度)

**请求**:
```
Payload[0]: LOD
Payload[1]: Custom Value
```

**响应**: ACK

### 7.10 `0x39` ANGLE_SNAPPING (角度捕捉)

**请求**:
```
Payload[0]: Enable (0/1)
Payload[1]: Strength (0-100)
```

**响应**: ACK

### 7.11 `0x3A` LINEAR_CALIBRATION (直线校准)

**请求**: 空

**响应**:
```
Payload[0]: Status
Payload[1-2]: Calibration Time (ms)
```

### 7.12 `0x3B` RIPPLE_CORRECTION (波纹修正)

**请求**:
```
Payload[0]: Enable (0/1)
```

**响应**: ACK

### 7.13 `0x3C` MOVE_SYNC (移动同步)

**请求**:
```
Payload[0]: Enable (0/1)
```

**响应**: ACK

### 7.14 `0x3D` KEY_DELAY (按键延时)

**请求**:
```
Payload[0]: Delay (ms, 0-50)
```

**响应**: ACK

### 7.15 `0x3E` PERFORMANCE_MODE (性能模式)

**请求**:
```
Payload[0]: Mode
  0x00 = 性能模式
  0x01 = 平衡模式
  0x02 = 省电模式
```

**响应**: ACK

### 7.16 `0x3F` PERFORMANCE_STATS (性能数据查询)

**请求**: 空

**响应**:
```
Payload[0-3]:   Total Reports
Payload[4-7]:   Dropped Reports
Payload[8-11]:  Avg Latency (us)
Payload[12-15]: Max Latency (us)
```

---

## 8. 电源管理命令 (0x40-0x4F)

### 8.1 `0x40` READ_BATTERY (读取电池电量)

**请求**: 空

**响应**:
```
Payload[0]:     Battery Level (0-100)
Payload[1-2]:   Voltage (mV, 小端序)
Payload[3]:     Status (0=放电, 1=充电, 2=充满, 3=异常)
Payload[4-5]:   Temperature (°C * 10, 小端序)
```

### 8.2 `0x41` READ_CHARGE_STATUS (读取充电状态)

**请求**: 空

**响应**:
```
Payload[0]:   Status
  0x00 = 未连接充电器
  0x01 = 充电中
  0x02 = 已充满
  0x03 = 充电异常
Payload[1-2]: Current (mA)
Payload[3-4]: Charging Time (min)
```

### 8.3 `0x42` SET_SLEEP_TIME (设置睡眠时间)

**请求**:
```
Payload[0-1]: Light Sleep Time (s, 小端序)
Payload[2-3]: Deep Sleep Time (s, 小端序)
```

**响应**: ACK

### 8.4 `0x43` WAKE_UP (唤醒设备)

**请求**: 空

**响应**: ACK

### 8.5 `0x44` SHUTDOWN (关机)

**请求**: 空

**响应**: ACK (设备将立即关机)

### 8.6 `0x45` LOW_BATTERY_ALERT (低电量告警阈值)

**请求**:
```
Payload[0]: Threshold (0-100)
```

**响应**: ACK

### 8.7 `0x46` CHARGE_CURRENT (充电电流配置)

**请求**:
```
Payload[0]: Current (0=自动, 1=慢充, 2=快充, 3=自定义)
Payload[1]: Custom Current (mA, 当 Current=3)
```

**响应**: ACK

---

## 9. 固件升级命令 (0x50-0x5F)

### 9.1 `0x50` ENTER_DFU (进入 DFU 模式)

**请求**: 空

**响应**:
```
Payload[0]:   Status
Payload[1-4]: Bootloader Version
```

### 9.2 `0x51` EXIT_DFU (退出 DFU 模式)

**请求**: 空

**响应**: ACK (设备将重启)

### 9.3 `0x52` FIRMWARE_INFO (固件信息)

**请求**: 空

**响应**:
```
Payload[0-1]:   Firmware Version (Major, Minor)
Payload[2-3]:   Build Number
Payload[4-7]:   Firmware Size
Payload[8-11]:  CRC32
Payload[12-15]: Release Date
```

### 9.4 `0x53` FIRMWARE_ERASE (固件擦除)

**请求**:
```
Payload[0-3]: Start Address (小端序)
Payload[4-7]: Length (小端序)
```

**响应**:
```
Payload[0]:   Status
Payload[1-4]: Erased Length
```

### 9.5 `0x54` FIRMWARE_WRITE (固件写入)

**请求**:
```
Payload[0-3]:   Address
Payload[4-7]:   Total Length
Payload[8-11]:  Offset
Payload[12+]:   Data Block
```

**响应**:
```
Payload[0]:   Status
Payload[1-4]: Written Offset
```

### 9.6 `0x55` FIRMWARE_VERIFY (固件校验)

**请求**:
```
Payload[0-3]: Start Address
Payload[4-7]: Length
```

**响应**:
```
Payload[0]:   Status
Payload[1-4]: CRC32 Result
```

### 9.7 `0x56` FIRMWARE_INSTALL (应用固件)

**请求**: 空

**响应**:
```
Payload[0]: Status (设备将重启)
```

### 9.8 `0x57` FIRMWARE_ROLLBACK (回滚)

**请求**: 空

**响应**:
```
Payload[0]: Status
```

### 9.9 `0x58` UPGRADE_PROGRESS (升级进度)

**请求**: 空

**响应**:
```
Payload[0-1]:   Total Blocks
Payload[2-3]:   Written Blocks
Payload[4]:     Percentage (0-100)
Payload[5]:     Current Stage
  0x01 = 擦除
  0x02 = 写入
  0x03 = 校验
  0x04 = 安装
```

### 9.10 `0x59` BACKUP_FIRMWARE (备份固件)

**请求**: 空

**响应**:
```
Payload[0]: Status
Payload[1-4]: Backup Size
```

### 9.11 `0x5A` RESTORE_BACKUP (恢复备份)

**请求**: 空

**响应**: ACK

---

## 10. 配置管理命令 (0x60-0x6F)

### 10.1 `0x60` LIST_PROFILES (读取 Profile 列表)

**请求**: 空

**响应**:
```
Payload[0]:   Status
Payload[1]:   Active Profile ID
Payload[2]:   Total Profile Count
Payload[3+]:  Profile Entries (每条 16 字节)
  - ID (1)
  - Name (12)
  - Modified (3, DD/MM/YY)
```

### 10.2 `0x61` SWITCH_PROFILE (切换 Profile)

**请求**:
```
Payload[0]: Profile ID
```

**响应**:
```
Payload[0]: Status
Payload[1]: Active Profile ID
```

### 10.3 `0x62` SAVE_PROFILE (保存 Profile)

**请求**:
```
Payload[0]:   Profile ID (0xFF = 新建)
Payload[1-12]: Name (12 字节 ASCII)
```

**响应**:
```
Payload[0]: Status
Payload[1]: New Profile ID
```

### 10.4 `0x63` DELETE_PROFILE (删除 Profile)

**请求**:
```
Payload[0]: Profile ID
```

**响应**: ACK

### 10.5 `0x64` EXPORT_PROFILE (导出 Profile)

**请求**:
```
Payload[0]: Profile ID
```

**响应**:
```
Payload[0]:   Status
Payload[1-2]: Data Length
Payload[3+]:  JSON Data
```

### 10.6 `0x65` IMPORT_PROFILE (导入 Profile)

**请求**:
```
Payload[0-1]: Data Length
Payload[2+]:  JSON Data
```

**响应**:
```
Payload[0]: Status
Payload[1]: New Profile ID
```

### 10.7 `0x66` RENAME_PROFILE (重命名 Profile)

**请求**:
```
Payload[0]:   Profile ID
Payload[1-12]: New Name
```

**响应**: ACK

### 10.8 `0x67` COPY_PROFILE (复制 Profile)

**请求**:
```
Payload[0]:   Source ID
Payload[1-12]: Target Name
```

**响应**:
```
Payload[0]: Status
Payload[1]: New Profile ID
```

---

## 11. 数据测试命令 (0x70-0x7F)

### 11.1 `0x70` LOOPBACK_TEST (回环测试)

**用途**: 测试设备原样返回数据，验证链路完整性

**请求**:
```
Payload[0+]: Test Data (1-54 字节)
```

**响应**:
```
Payload[0]:   Status
Payload[1+]:  Echoed Data (应与请求一致)
```

### 11.2 `0x71` PERFORMANCE_TEST (性能测试)

**用途**: 测试最大吞吐量

**请求**:
```
Payload[0-1]: Duration (s, 小端序)
Payload[2]:   Packet Size (1-56)
```

**响应**:
```
Payload[0]:   Status
Payload[1-4]: Sent Packets
Payload[5-8]: Received Packets
Payload[9-12]: Lost Packets
Payload[13-14]: Throughput (KB/s, 小端序)
```

### 11.3 `0x72` LATENCY_TEST (延迟测试)

**请求**:
```
Payload[0-1]: Packet Count
```

**响应**:
```
Payload[0]:   Status
Payload[1-4]: Min Latency (us)
Payload[5-8]: Max Latency (us)
Payload[9-12]: Avg Latency (us)
```

### 11.4 `0x73` ERROR_RATE_TEST (误码率测试)

**请求**:
```
Payload[0-1]: Packet Count
Payload[2]:   Data Length (1-54)
```

**响应**:
```
Payload[0]:   Status
Payload[1-4]: Sent
Payload[5-8]: Received
Payload[9-12]: Error Count
Payload[13-16]: Error Rate (*10000)
```

### 11.5 `0x74` STRESS_TEST (压力测试)

**请求**:
```
Payload[0-1]: Duration (min)
Payload[2]:   Rate (packets/s)
```

**响应**: ACK (测试在后台进行)

### 11.6 `0x75` READ_TEST_RESULT (读取测试结果)

**请求**:
```
Payload[0]: Test ID
```

**响应**:
```
Payload[0]:   Status
Payload[1]:   Test Type
Payload[2+]:  Test Specific Data
```

### 11.7 `0x76` STOP_TEST (停止测试)

**请求**: 空

**响应**: ACK

### 11.8 `0x7F` DEVICE_DEBUG (设备调试)

**请求**:
```
Payload[0]: Debug Code
Payload[1+]: Debug Data
```

**响应**:
```
Payload[0]: Status
Payload[1+]: Debug Response
```

---

## 12. 厂商扩展命令 (0x80-0xFF)

预留给厂商自定义功能，不在本规范范围内。

---

## 13. 状态码定义

| 状态码 | 名称 | 说明 |
|--------|------|------|
| `0x00` | SUCCESS | 成功 |
| `0x01` | BUSY | 设备忙 |
| `0x02` | INVALID_CMD | 无效命令 |
| `0x03` | INVALID_PARAM | 无效参数 |
| `0x04` | INVALID_ADDR | 地址越界 |
| `0x05` | INVALID_LEN | 长度错误 |
| `0x06` | CHECKSUM_ERR | 校验失败 |
| `0x07` | TIMEOUT | 超时 |
| `0x08` | NOT_SUPPORTED | 不支持 |
| `0x09` | WRITE_FAIL | 写入失败 |
| `0x0A` | READ_FAIL | 读取失败 |
| `0x0B` | NO_AUTH | 未认证 |
| `0x0C` | LOW_BATTERY | 低电量 |
| `0x0D` | DFU_MODE | DFU 模式 |
| `0x0E` | INVALID_STATE | 状态错误 |
| `0xFE` | UNKNOWN | 未知错误 |
| `0xFF` | INTERNAL | 内部错误 |

---

## 14. 协议版本管理

### 14.1 版本号格式

```
MAJOR.MINOR.PATCH
  │     │     └─ 兼容性修复
  │     └────── 新增功能 (向后兼容)
  └──────────── 重大变更 (不兼容)
```

### 14.2 协议能力查询

通过 `0x0A GET_CAPABILITIES` 命令查询：

```
Payload[1-2]:   Protocol Version (Major, Minor)
Payload[3]:     Device Type
Payload[4]:     Feature Flags
```

### 14.3 兼容性策略

- **MAJOR 版本变更**: 需要重新认证、不兼容旧版本
- **MINOR 版本变更**: 向后兼容，可使用新命令
- **PATCH 版本变更**: 完全兼容

---

## 15. 通讯流程示例

### 15.1 读取 DPI 配置 (档位 1)

**请求 (Web → Device)**:
```
[0x04, 0x03, 0x02, 0x01, 0x01, 0x00, 0x00, 0x05, 0x00, 0x00, ...] + CRC16
  └─┬─┘  └──────┬──────┘  └┬─┘  └─┬─┘  └┬─┘  └┬─┘  └─┬─┘
    │         │          │      │     │     │      └─ REQ_ID
    │         │          │      │     │     └─ SEQ=5
    │         │          │      │     └─ FLAGS=0 (请求)
    │         │          │      └─ ADDR=1 (DPI 档位)
    │         │          └─ LEN=1
    │         └─ CMD=0x0302 (READ_DPI, 小端序)
    └─ Report ID
```

**响应 (Device → Web)**:
```
[0x04, 0x03, 0x02, 0x0B, 0x01, 0x00, 0x01, 0x05, 0x00, 0x00,
 0x00, 0x01, 0x00, 0x20, 0x03, 0x20, 0x03, 0x00, 0x00, 0xFF, ...] + CRC16
  └─┬─┘  └──────┬──────┘  └┬─┘  └─┬─┘  └┬─┘  └┬─┘  └─┬─┘
    │         │          │      │     │     │      └─ REQ_ID (回显)
    │         │          │      │     │     └─ SEQ=5 (回显)
    │         │          │      │     └─ FLAGS=1 (响应)
    │         │          │      └─ ADDR=1
    │         │          └─ LEN=11
    │         └─ CMD=0x0302 (READ_DPI)
    └─ Report ID
       
Payload 解析:
[0x00]            Status = SUCCESS
[0x01]            Enabled
[0x00]            XY Separate
[0x20, 0x03]      DPI X = 0x0320 = 800
[0x20, 0x03]      DPI Y = 0x0320 = 800
[0x00, 0x00, 0xFF] Color = Blue
```

### 15.2 设置 RGB 灯效 (15 个 LED)

**请求**:
```
[0x04, 0x01, 0x01, 0x2D, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00,
 0x00, 0x0F, 0xFF, 0x00, 0x00, 0xFF, 0x00, 0x00, ...] + CRC16
  └─┬─┘  └──────┬──────┘  └┬─┘                └┬─┘
    │         │          │                    └─ LED Count
    │         │          └─ LEN=45
    │         └─ CMD=0x0101 (WRITE_LED_DEFINE)
    └─ Report ID
       
Payload:
[0x00]   Start LED ID
[0x0F]   LED Count = 15
[0xFF, 0x00, 0x00] LED 0: Red
[0xFF, 0x00, 0x00] LED 1: Red
... (共 15 个 LED × 3 字节)
```

### 15.3 心跳检测

**请求**:
```
[0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, ...] + CRC16
  └─┬─┘  └──────┬──────┘  └┬─┘  └─┬─┘  └┬─┘  └┬─┘  └─┬─┘
    │         │          │      │     │     │      └─ REQ_ID
    │         │          │      │     │     └─ SEQ=1
    │         │          │      │     └─ FLAGS=0 (请求)
    │         │          │      └─ ADDR=0
    │         │          └─ LEN=0
    │         └─ CMD=0x0000 (PING)
    └─ Report ID
```

**响应**:
```
[0x04, 0x00, 0x00, 0x08, 0x00, 0x00, 0x01, 0x01, 0x00, 0x00,
 0x00, 0x02, 0x00, 0x01, 0x1F, 0x00, 0x00, 0x00, ...] + CRC16
  └─┬─┘  └──────┬──────┘  └┬─┘  └─┬─┘  └┬─┘  └┬─┘  └─┬─┘
    │         │          │      │     │     │      └─ REQ_ID (回显)
    │         │          │      │     │     └─ SEQ=1 (回显)
    │         │          │      │     └─ FLAGS=1 (响应)
    │         │          │      └─ ADDR=0
    │         │          └─ LEN=8
    │         └─ CMD=0x0000 (PING)
    └─ Report ID
       
Payload 解析:
[0x00]      Status = SUCCESS (在线)
[0x02]      Protocol Major V2
[0x00]      Protocol Minor V0
[0x01]      Device Type = Keyboard
[0x1F]      Feature Flags (RGB+Macro+OTA+Sync+Profile)
[0x00-0x03] Reserved
```

### 15.4 错误响应示例

**请求**: 读取不存在的 Profile

**响应**:
```
[0x04, 0x06, 0x00, 0x01, 0x00, 0x00, 0x01, 0x20, 0x00, 0x00,
 0x03, ...] + CRC16
  └─┬─┘  └──────┬──────┘  └┬─┘  └─┬─┘  └┬─┘
    │         │          │      │     └─ FLAGS=1 (响应)
    │         │          │      └─ ADDR
    │         │          └─ LEN=1
    │         └─ CMD=0x0600 (LIST_PROFILES)
    └─ Report ID
       
Payload[0]: Status = 0x03 (INVALID_PARAM)
```

### 15.5 事件通知 (设备主动上报)

```
[0x04, 0x00, 0x0B, 0x05, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00,
 0x00, 0x0F, 0x01, 0x02, 0x00, ...] + CRC16
  └─┬─┘  └──────┬──────┘  └┬─┘  └─┬─┘  └┬─┘
    │         │          │      │     └─ FLAGS=0x02 (事件通知)
    │         │          │      └─ ADDR
    │         │          └─ LEN=5
    │         └─ CMD=0x000B (NOTIFY)
    └─ Report ID
       
Payload 解析:
[0x00]   Event Type = KEY_STATE_CHANGED
[0x0F]   Key ID = 15
[0x01]   State = Pressed
[0x02, 0x00]  Timestamp
```

---

## 16. Web 端实现建议

### 16.1 命令常量定义

```javascript
// src/protocol/commands/BaseCommands.js
// CMD 是 2 字节 (uint16, 小端序): 高字节=类别, 低字节=命令

const C = (category, command) => (category << 8) | command;

export const CMD = {
  // ============ 系统类 (类别 0x00) ============
  PING:                C(0x00, 0x00),  // 0x0000 心跳
  RESET:               C(0x00, 0x01),  // 0x0001 复位
  SET_MODE:            C(0x00, 0x02),  // 0x0002 模式切换
  READ_BASIC_INFO:     C(0x00, 0x03),  // 0x0003 读取基本信息
  WRITE_BASIC_INFO:    C(0x00, 0x04),  // 0x0004 写入基本信息
  READ_RAM:            C(0x00, 0x05),  // 0x0005 读 RAM
  WRITE_RAM:           C(0x00, 0x06),  // 0x0006 写 RAM
  READ_FLASH:          C(0x00, 0x07),  // 0x0007 读 Flash
  WRITE_FLASH:         C(0x00, 0x08),  // 0x0008 写 Flash
  AUTH:                C(0x00, 0x09),  // 0x0009 认证
  GET_CAPABILITIES:    C(0x00, 0x0A),  // 0x000A 能力查询
  NOTIFY:              C(0x00, 0x0B),  // 0x000B 事件通知

  // ============ 灯光类 (类别 0x01) ============
  READ_LED_DEFINE:         C(0x01, 0x00),  // 0x0100
  WRITE_LED_DEFINE:        C(0x01, 0x01),  // 0x0101
  LED_START:               C(0x01, 0x02),  // 0x0102
  LED_STOP:                C(0x01, 0x03),  // 0x0103
  SET_SINGLE_LED:          C(0x01, 0x04),  // 0x0104
  SET_ZONE_LED:            C(0x01, 0x05),  // 0x0105
  SWITCH_EFFECT:           C(0x01, 0x06),  // 0x0106
  SET_BREATH_PARAM:        C(0x01, 0x07),  // 0x0107
  SET_RAINBOW_PARAM:       C(0x01, 0x08),  // 0x0108
  UPLOAD_CUSTOM_EFFECT:    C(0x01, 0x09),  // 0x0109
  READ_LED_STATE:          C(0x01, 0x0A),  // 0x010A
  READ_LED_INDEX:          C(0x01, 0x0B),  // 0x010B
  LED_SYNC:                C(0x01, 0x0C),  // 0x010C
  SCREEN_COLOR_CONFIG:     C(0x01, 0x0D),  // 0x010D
  AUDIO_REACTIVE_CONFIG:   C(0x01, 0x0E),  // 0x010E

  // ============ 按键类 (类别 0x02) ============
  READ_MATRIX:         C(0x02, 0x00),  // 0x0200
  WRITE_MATRIX:        C(0x02, 0x01),  // 0x0201
  READ_KEY_STATE:      C(0x02, 0x02),  // 0x0202
  REMAP_KEY:           C(0x02, 0x03),  // 0x0203
  MACRO_RECORD_START:  C(0x02, 0x04),  // 0x0204
  MACRO_RECORD_STOP:   C(0x02, 0x05),  // 0x0205
  EXEC_MACRO:          C(0x02, 0x06),  // 0x0206
  DELETE_MACRO:        C(0x02, 0x07),  // 0x0207
  LIST_MACROS:         C(0x02, 0x08),  // 0x0208
  READ_MACRO_DATA:     C(0x02, 0x09),  // 0x0209
  WRITE_MACRO_DATA:    C(0x02, 0x0A),  // 0x020A
  COMBO_KEY:           C(0x02, 0x0B),  // 0x020B
  FIRE_KEY:            C(0x02, 0x0C),  // 0x020C
  MEDIA_KEY:           C(0x02, 0x0D),  // 0x020D
  SYSTEM_KEY:          C(0x02, 0x0E),  // 0x020E
  DISABLE_KEY:         C(0x02, 0x0F),  // 0x020F

  // ============ 性能类 (类别 0x03) ============
  READ_DEVICE_ID:      C(0x03, 0x00),  // 0x0300
  WRITE_DEVICE_ID:     C(0x03, 0x01),  // 0x0301
  READ_DPI:            C(0x03, 0x02),  // 0x0302
  WRITE_DPI:           C(0x03, 0x03),  // 0x0303
  SWITCH_DPI:          C(0x03, 0x04),  // 0x0304
  READ_POLL_RATE:      C(0x03, 0x05),  // 0x0305
  WRITE_POLL_RATE:     C(0x03, 0x06),  // 0x0306
  READ_LIFT_HEIGHT:    C(0x03, 0x07),  // 0x0307
  WRITE_LIFT_HEIGHT:   C(0x03, 0x08),  // 0x0308
  ANGLE_SNAPPING:      C(0x03, 0x09),  // 0x0309
  LINEAR_CALIBRATION:  C(0x03, 0x0A),  // 0x030A
  RIPPLE_CORRECTION:   C(0x03, 0x0B),  // 0x030B
  MOVE_SYNC:           C(0x03, 0x0C),  // 0x030C
  KEY_DELAY:           C(0x03, 0x0D),  // 0x030D
  PERFORMANCE_MODE:    C(0x03, 0x0E),  // 0x030E
  PERFORMANCE_STATS:   C(0x03, 0x0F),  // 0x030F

  // ============ 电源类 (类别 0x04) ============
  READ_BATTERY:        C(0x04, 0x00),  // 0x0400
  READ_CHARGE_STATUS:  C(0x04, 0x01),  // 0x0401
  SET_SLEEP_TIME:      C(0x04, 0x02),  // 0x0402
  WAKE_UP:             C(0x04, 0x03),  // 0x0403
  SHUTDOWN:            C(0x04, 0x04),  // 0x0404
  LOW_BATTERY_ALERT:   C(0x04, 0x05),  // 0x0405
  CHARGE_CURRENT:      C(0x04, 0x06),  // 0x0406

  // ============ 固件类 (类别 0x05) ============
  ENTER_DFU:           C(0x05, 0x00),  // 0x0500
  EXIT_DFU:            C(0x05, 0x01),  // 0x0501
  FIRMWARE_INFO:       C(0x05, 0x02),  // 0x0502
  FIRMWARE_ERASE:      C(0x05, 0x03),  // 0x0503
  FIRMWARE_WRITE:      C(0x05, 0x04),  // 0x0504
  FIRMWARE_VERIFY:     C(0x05, 0x05),  // 0x0505
  FIRMWARE_INSTALL:    C(0x05, 0x06),  // 0x0506
  FIRMWARE_ROLLBACK:   C(0x05, 0x07),  // 0x0507
  UPGRADE_PROGRESS:    C(0x05, 0x08),  // 0x0508
  BACKUP_FIRMWARE:     C(0x05, 0x09),  // 0x0509
  RESTORE_BACKUP:      C(0x05, 0x0A),  // 0x050A

  // ============ 配置类 (类别 0x06) ============
  LIST_PROFILES:       C(0x06, 0x00),  // 0x0600
  SWITCH_PROFILE:      C(0x06, 0x01),  // 0x0601
  SAVE_PROFILE:        C(0x06, 0x02),  // 0x0602
  DELETE_PROFILE:      C(0x06, 0x03),  // 0x0603
  EXPORT_PROFILE:      C(0x06, 0x04),  // 0x0604
  IMPORT_PROFILE:      C(0x06, 0x05),  // 0x0605
  RENAME_PROFILE:      C(0x06, 0x06),  // 0x0606
  COPY_PROFILE:        C(0x06, 0x07),  // 0x0607

  // ============ 测试类 (类别 0x07) ============
  LOOPBACK_TEST:       C(0x07, 0x00),  // 0x0700
  PERFORMANCE_TEST:    C(0x07, 0x01),  // 0x0701
  LATENCY_TEST:        C(0x07, 0x02),  // 0x0702
  ERROR_RATE_TEST:     C(0x07, 0x03),  // 0x0703
  STRESS_TEST:         C(0x07, 0x04),  // 0x0704
  READ_TEST_RESULT:    C(0x07, 0x05),  // 0x0705
  STOP_TEST:           C(0x07, 0x06),  // 0x0706
  DEVICE_DEBUG:        C(0x07, 0x0F),  // 0x070F
};

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

export const REPORT_ID = 0x04;
export const DATA_AREA_SIZE = 56;  // 固定 56 字节
export const HEADER_SIZE = 8;
export const PACKET_SIZE = 64;     // 8 + 56
```

### 16.2 数据包构建器

```javascript
// src/protocol/PacketBuilder.js
import { REPORT_ID, DATA_AREA_SIZE, PACKET_SIZE } from './commands/BaseCommands.js';

export class PacketBuilder {
  /**
   * 构建数据包
   * @param {number} cmd 2字节命令码
   * @param {number[]} data 数据数组 (0-56字节)
   * @param {number} address 16位地址
   * @returns {Uint8Array} 64字节数据包 (去除 Report ID 后 63 字节)
   */
  static build(cmd, data = [], address = 0) {
    // 验证数据长度
    if (data.length > DATA_AREA_SIZE) {
      throw new Error(`Data too long: ${data.length} > ${DATA_AREA_SIZE}`);
    }

    // 完整 64 字节包
    const packet = new Uint8Array(PACKET_SIZE);
    
    // [0] Report ID
    packet[0] = REPORT_ID;
    
    // [1-2] CMD (小端序)
    packet[1] = cmd & 0xFF;          // CMD 低字节
    packet[2] = (cmd >> 8) & 0xFF;   // CMD 高字节
    
    // [3] LEN (实际有效数据长度)
    packet[3] = data.length;
    
    // [4-5] ADDR (小端序)
    packet[4] = address & 0xFF;
    packet[5] = (address >> 8) & 0xFF;
    
    // [6-7] Data Length (小端序) - 单包时与 LEN 相同
    packet[6] = data.length & 0xFF;
    packet[7] = (data.length >> 8) & 0xFF;
    
    // [8-63] 数据区 (固定 56 字节)
    for (let i = 0; i < data.length; i++) {
      packet[8 + i] = data[i] & 0xFF;
    }
    // 剩余部分自动为 0x00 (Uint8Array 初始化为 0)
    
    // WebHID sendReport 需要去除 Report ID
    return packet.slice(1);
  }

  /**
   * 解析数据包
   * @param {Uint8Array} packet 63字节数据 (去除 Report ID)
   * @returns {Object} 解析结果
   */
  static parse(packet) {
    return {
      cmd: packet[0] | (packet[1] << 8),     // CMD (LE)
      len: packet[2],                          // LEN
      addr: packet[3] | (packet[4] << 8),     // ADDR (LE)
      dataLength: packet[5] | (packet[6] << 8), // Data Length (LE)
      data: Array.from(packet.slice(7, 7 + packet[2])), // 有效数据
    };
  }
}
```

### 16.3 协议层封装

```javascript
// src/protocol/Protocol.js
import { PacketBuilder } from './PacketBuilder.js';
import { CMD, STATUS, REPORT_ID } from './commands/BaseCommands.js';

export class Protocol {
  constructor(transport) {
    this.transport = transport;
    this.pendingCommands = new Map();
    this.requestId = 0;

    this.transport.onReceive((data) => this.handleResponse(data));
  }

  /**
   * 发送命令
   * @param {number} cmd 命令码 (2字节)
   * @param {number[]} data 数据
   * @param {number} address 地址
   * @param {number} timeout 超时时间(ms)
   */
  async send(cmd, data = [], address = 0, timeout = 1000) {
    const requestId = ++this.requestId;
    const packet = PacketBuilder.build(cmd, data, address);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCommands.delete(requestId);
        reject(new Error(`CMD 0x${cmd.toString(16)} timeout`));
      }, timeout);

      this.pendingCommands.set(requestId, {
        resolve: (data) => { clearTimeout(timer); resolve(data); },
        reject: (err) => { clearTimeout(timer); reject(err); },
        cmd,
        startTime: Date.now(),
      });

      this.transport.send(packet);
    });
  }

  /**
   * 处理响应
   */
  handleResponse(packet) {
    const parsed = PacketBuilder.parse(packet);
    const { cmd, data } = parsed;
    
    if (data.length === 0) return;
    
    const status = data[0];
    const responseData = data.slice(1);

    // 查找匹配的请求
    for (const [id, pending] of this.pendingCommands) {
      if (pending.cmd === cmd) {
        if (status === STATUS.SUCCESS) {
          pending.resolve({ status, data: responseData });
        } else {
          pending.reject(new Error(`CMD 0x${cmd.toString(16)} failed: 0x${status.toString(16)}`));
        }
        this.pendingCommands.delete(id);
        break;
      }
    }
  }
}
```

### 16.4 业务服务示例

```javascript
// src/services/LightingService.js
import { CMD } from '../protocol/commands/BaseCommands.js';

export class LightingService {
  constructor(protocol) {
    this.protocol = protocol;
  }

  async setSingleLED(ledId, r, g, b) {
    return this.protocol.send(CMD.SET_SINGLE_LED, [ledId, r, g, b]);
  }

  async setBulkLED(colors) {
    // colors: [[r,g,b], [r,g,b], ...]
    const flat = colors.flat();
    return this.protocol.send(CMD.WRITE_LED_DEFINE, [0, colors.length, ...flat]);
  }

  async startEffect(mode, speed = 5, brightness = 100) {
    return this.protocol.send(CMD.LED_START, [mode, speed, brightness, 0]);
  }

  async stopEffect() {
    return this.protocol.send(CMD.LED_STOP, []);
  }

  async getCapabilities() {
    return this.protocol.send(CMD.GET_CAPABILITIES, []);
  }
}
```

---

## 17. 变更日志

### V2.1 (2026-05-20) - 当前版本 🔄

**重大修改**:
- 🔄 CMD 字段从 1 字节扩展为 **2 字节** (uint16, 小端序)
- 🔄 数据包结构简化为 **8 字节头 + 56 字节数据**
- 🔄 移除 FLAGS、SEQ、REQ_ID 字段
- 🔄 移除 CRC16 校验 (数据区固定 56 字节，由上层保证完整性)
- 🔄 新增 Data Length 字段 (用于分包传输)

**用户确认的 64 字节包结构**:
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

**字段定义**:
| 偏移 | 长度 | 字段 | 说明 |
|------|------|------|------|
| 0 | 1 | Report ID | 固定 `0x04` (AP 通讯通道) |
| 1-2 | 2 | **CMD** | 命令码 (uint16, 小端序) |
| 3 | 1 | **LEN** | 数据区有效长度 (0-56) |
| 4-5 | 2 | **ADDR** | 16 位地址 (小端序) |
| 6-7 | 2 | **Data Length** | 数据总长度 (分包用) |
| 8-63 | 56 | **Data** | 纯数据区 (无校验/无标志) |

**用户特殊说明**:
- ⏸️ **心跳请求 PING 协议暂定**, 后续实际调试时再定具体格式
- ⏸️ **固件升级分包协议暂定**, 后续实际调试时再实现

**优势**:
- ✅ 头部紧凑 (8 字节)
- ✅ CMD 容量提升至 65536
- ✅ 数据区固定 56 字节，便于硬件 DMA
- ✅ 无校验，依赖 HID 底层
- ✅ 协议简单清晰

### V2.0 (历史版本)

**新增**:
- ✅ 加入 CRC16 校验机制
- ✅ 完整的 16 种状态码
- ✅ 设备认证 (AUTH) 命令
- ✅ 设备能力查询 (GET_CAPABILITIES)
- ✅ 动态 DPI 档位 (不再固定 8 档)
- ✅ 轮询率支持 8K Hz 和 24G 无线
- ✅ 完整固件升级流程 (DFU/OTA)
- ✅ Profile 配置管理 (导入/导出/切换)
- ✅ 完整数据测试命令集 (回环/性能/延迟/误码/压力)
- ✅ 灯效同步 (多设备协同)
- ✅ 屏幕取色灯效
- ✅ 音频律动灯效
- ✅ 媒体键/系统键/组合键/火力键
- ✅ 电源管理 (电池/充电/睡眠)
- ✅ 多产品支持 (KB/MS/Headset)

**修改**:
- 🔄 命令码重新分类 (按功能模块)
- 🔄 响应 CMD 规则: CMD | 0x80
- 🔄 设备类型字段 (1=KB, 2=MS, ...)
- 🔄 状态字段标准化

**废弃** (相对 V1.0):
- ❌ `0xAA` TEST_COLOR (改用 `0x1A` 系列)
- ❌ 固定 8 档 DPI (改用动态档位)

**保留兼容**:
- ✅ 基础 64 字节包结构
- ✅ Report ID = 0x04
- ✅ 主要命令码 (READ/WRITE 类)

### V1.0 (历史版本)

原始协议 (见 `通讯协议.txt`)，18 个命令，无校验，无状态码。

---

## 📂 相关文件

- 📄 [通讯协议.txt](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/通讯协议.txt) - V1.0 原始协议 (历史)
- 📄 [Protocol_V2.md](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/Protocol_V2.md) - V2.0 本文档
- 💻 [src/protocol/commands/BaseCommands.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/protocol/commands/BaseCommands.js) - 命令常量
- 💻 [src/protocol/PacketBuilder.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/protocol/PacketBuilder.js) - 数据包构建
- 💻 [src/utils/CRC16.js](file:///f:/Coding/Trae_project/WEB/keyboard/keyboard-driver/src/utils/CRC16.js) - CRC 工具

---

**最后更新**: 2026-05-20
**协议版本**: V2.0
**维护者**: SwiftKey Team
