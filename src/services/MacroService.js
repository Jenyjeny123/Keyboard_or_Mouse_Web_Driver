/**
 * MacroService - 宏录制/播放服务
 *
 * 负责管理宏的录制、播放、保存、加载、删除
 *
 * @example
 *   const macro = new MacroService(protocol);
 *   await macro.startRecord(0x01);  // 开始录制到 slot 1
 *   await macro.stopRecord();
 *   await macro.play(0x01);
 */

import { CMD } from '../protocol/commands/BaseCommands.js';

export class MacroService {
    constructor(protocol) {
        this.protocol = protocol;
        this.bus = protocol.bus;
        this.isRecording = false;
        this.isPlaying = false;
        this.currentSlot = null;
        this.recordedEvents = [];
        this.recordStartTime = 0;
        this.macros = [];  // [{slot, name, length, createdAt}]
        this._setupListeners();
    }

    _setupListeners() {
        this.bus.on('macro:event-captured', (event) => {
            if (this.isRecording) {
                const elapsed = Date.now() - this.recordStartTime;
                this.recordedEvents.push({
                    ...event,
                    timestamp: elapsed,
                });
                this.bus.emit('macro:event-recorded', { count: this.recordedEvents.length, event });
            }
        });
    }

    // ==================== 录制 ====================

    /**
     * 开始录制
     * @param {number} slot 槽位 0x01-0x10
     * @param {string} name 宏名称
     */
    async startRecord(slot, name = `Macro ${slot}`) {
        if (this.isRecording) {
            throw new Error('已经在录制中');
        }
        if (this.isPlaying) {
            throw new Error('正在播放中,无法开始录制');
        }
        if (slot < 0x01 || slot > 0x10) {
            throw new Error(`无效的槽位: ${slot}. 范围 0x01-0x10`);
        }

        this.bus.emit('macro:recording-starting', { slot, name });
        const result = await this.protocol.send(CMD.MACRO_RECORD_START, [slot]);

        if (result.success !== false) {
            this.isRecording = true;
            this.currentSlot = slot;
            this.recordedEvents = [];
            this.recordStartTime = Date.now();
            this.recordedName = name;
            this.bus.emit('macro:recording-started', { slot, name });
        }
        return result.success !== false;
    }

    /**
     * 停止录制
     * @returns {Promise<object>} 录制的宏数据
     */
    async stopRecord() {
        if (!this.isRecording) {
            throw new Error('当前没有在录制');
        }

        this.bus.emit('macro:recording-stopping');
        const result = await this.protocol.send(CMD.MACRO_RECORD_STOP, [this.currentSlot]);

        const macroData = {
            slot: this.currentSlot,
            name: this.recordedName,
            events: [...this.recordedEvents],
            duration: Date.now() - this.recordStartTime,
            eventCount: this.recordedEvents.length,
        };

        // 写入到设备
        if (this.recordedEvents.length > 0) {
            await this.writeMacroData(this.currentSlot, macroData);
        }

        this.isRecording = false;
        const oldSlot = this.currentSlot;
        this.currentSlot = null;
        this.recordedName = null;

        this.bus.emit('macro:recording-stopped', { slot: oldSlot, data: macroData });
        return macroData;
    }

    /**
     * 取消录制 (不保存)
     */
    cancelRecord() {
        if (!this.isRecording) return;
        this.isRecording = false;
        this.recordedEvents = [];
        this.currentSlot = null;
        this.bus.emit('macro:recording-cancelled');
    }

    /**
     * 手动添加事件到当前录制
     * @param {object} event {keyCode, type: 'down'|'up', delay}
     */
    captureEvent(event) {
        if (!this.isRecording) return;
        const elapsed = Date.now() - this.recordStartTime;
        this.recordedEvents.push({
            keyCode: event.keyCode,
            type: event.type || 'down',
            delay: event.delay || 0,
            timestamp: elapsed,
        });
        this.bus.emit('macro:event-recorded', {
            count: this.recordedEvents.length,
            event: this.recordedEvents[this.recordedEvents.length - 1],
        });
    }

    // ==================== 播放 ====================

    /**
     * 播放宏
     * @param {number} slot
     * @param {number} repeat 重复次数, 0=无限
     */
    async play(slot, repeat = 1) {
        if (this.isRecording) {
            throw new Error('正在录制中,无法播放');
        }
        if (this.isPlaying) {
            throw new Error('已经在播放中');
        }

        this.bus.emit('macro:playing-starting', { slot, repeat });
        const result = await this.protocol.send(CMD.EXEC_MACRO, [slot, repeat]);

        if (result.success !== false) {
            this.isPlaying = true;
            this.bus.emit('macro:playing-started', { slot, repeat });

            // 模拟播放结束
            setTimeout(() => {
                this.isPlaying = false;
                this.bus.emit('macro:playing-stopped', { slot });
            }, 100);
        }
        return result.success !== false;
    }

    /**
     * 停止播放
     */
    async stopPlay() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        this.bus.emit('macro:playing-stopped', { forced: true });
    }

    // ==================== 宏数据管理 ====================

    /**
     * 写入宏数据到设备
     * @param {number} slot
     * @param {object} macroData
     */
    async writeMacroData(slot, macroData) {
        const json = JSON.stringify({
            name: macroData.name,
            events: macroData.events,
        });
        const bytes = Array.from(new TextEncoder().encode(json));
        const chunkSize = 60;
        const chunks = [];

        for (let i = 0; i < bytes.length; i += chunkSize) {
            chunks.push(bytes.slice(i, i + chunkSize));
        }

        for (let i = 0; i < chunks.length; i++) {
            await this.protocol.send(CMD.WRITE_MACRO_DATA, [slot, i, ...chunks[i]]);
        }

        // 更新本地列表
        const existing = this.macros.findIndex(m => m.slot === slot);
        const meta = {
            slot,
            name: macroData.name,
            length: bytes.length,
            eventCount: macroData.events?.length || 0,
            createdAt: new Date().toISOString(),
        };
        if (existing >= 0) {
            this.macros[existing] = meta;
        } else {
            this.macros.push(meta);
        }
        this.bus.emit('macro:written', meta);
        return true;
    }

    /**
     * 读取宏数据
     * @param {number} slot
     * @returns {Promise<object>}
     */
    async readMacroData(slot) {
        const result = await this.protocol.send(CMD.READ_MACRO_DATA, [slot]);
        try {
            const json = new TextDecoder().decode(new Uint8Array(result.data || []));
            return { slot, ...JSON.parse(json) };
        } catch (e) {
            return { slot, name: 'Unknown', events: [] };
        }
    }

    /**
     * 列出所有宏
     * @returns {Promise<Array>}
     */
    async listMacros() {
        const result = await this.protocol.send(CMD.LIST_MACROS, []);
        this.macros = result.data || this.macros;
        this.bus.emit('macro:listed', { macros: this.macros });
        return this.macros;
    }

    /**
     * 删除宏
     * @param {number} slot
     */
    async deleteMacro(slot) {
        const result = await this.protocol.send(CMD.DELETE_MACRO, [slot]);
        if (result.success !== false) {
            this.macros = this.macros.filter(m => m.slot !== slot);
            this.bus.emit('macro:deleted', { slot });
        }
        return result.success !== false;
    }

    // ==================== 实用工具 ====================

    /**
     * 导出宏为 JSON
     * @param {number} slot
     */
    async exportMacro(slot) {
        const data = await this.readMacroData(slot);
        return {
            ...data,
            exportedAt: new Date().toISOString(),
        };
    }

    /**
     * 导入宏
     * @param {number} slot
     * @param {object} macroData
     */
    async importMacro(slot, macroData) {
        return await this.writeMacroData(slot, macroData);
    }

    /**
     * 获取录制状态
     */
    getRecordingStatus() {
        return {
            isRecording: this.isRecording,
            isPlaying: this.isPlaying,
            currentSlot: this.currentSlot,
            eventCount: this.recordedEvents.length,
            duration: this.isRecording ? Date.now() - this.recordStartTime : 0,
        };
    }

    getMacros() {
        return this.macros;
    }
}

export default MacroService;
