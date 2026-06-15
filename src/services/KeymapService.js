/**
 * KeymapService - 按键映射服务
 *
 * 负责管理键盘按键映射、配置文件切换、按键矩阵读写等
 *
 * @example
 *   const keymap = new KeymapService(protocol);
 *   await keymap.switchProfile(1);
 *   const matrix = await keymap.readMatrix();
 *   await keymap.remapKey(0x0A, 0x04);  // 将 0x0A 键映射为 0x04
 */

import { CMD } from '../protocol/commands/BaseCommands.js';

export class KeymapService {
    constructor(protocol) {
        this.protocol = protocol;
        this.bus = protocol.bus;
        this.currentProfile = 1;
        this.profiles = [];
        this.matrix = new Array(128).fill(0);
        this._setupListeners();
    }

    _setupListeners() {
        this.bus.on('keymap:data', (data) => {
            this.matrix = data.matrix || this.matrix;
        });
    }

    // ==================== 配置文件管理 ====================

    /**
     * 列出所有配置
     * @returns {Promise<Array<{id: number, name: string}>>}
     */
    async listProfiles() {
        const result = await this.protocol.send(CMD.LIST_PROFILES, []);
        this.profiles = result.data || [
            { id: 1, name: 'Profile 1 (默认)' },
            { id: 2, name: 'Profile 2' },
            { id: 3, name: 'Profile 3' },
            { id: 4, name: 'Profile 4' },
        ];
        this.bus.emit('keymap:profiles-listed', { profiles: this.profiles });
        return this.profiles;
    }

    /**
     * 切换配置文件
     * @param {number} profileId 1-4
     * @returns {Promise<boolean>}
     */
    async switchProfile(profileId) {
        if (profileId < 1 || profileId > 4) {
            throw new Error(`无效的 Profile ID: ${profileId}`);
        }

        this.bus.emit('keymap:switching', { from: this.currentProfile, to: profileId });
        const result = await this.protocol.send(CMD.SWITCH_PROFILE, [profileId]);

        if (result.success !== false) {
            this.currentProfile = profileId;
            this.bus.emit('keymap:switched', { profile: profileId });
        }
        return result.success !== false;
    }

    /**
     * 保存当前配置
     * @returns {Promise<boolean>}
     */
    async saveProfile() {
        const result = await this.protocol.send(CMD.SAVE_PROFILE, [this.currentProfile]);
        this.bus.emit('keymap:saved', { profile: this.currentProfile });
        return result.success !== false;
    }

    /**
     * 删除配置文件
     * @param {number} profileId
     * @returns {Promise<boolean>}
     */
    async deleteProfile(profileId) {
        const result = await this.protocol.send(CMD.DELETE_PROFILE, [profileId]);
        this.profiles = this.profiles.filter(p => p.id !== profileId);
        this.bus.emit('keymap:profile-deleted', { profile: profileId });
        return result.success !== false;
    }

    /**
     * 导出配置为 JSON
     * @returns {Promise<object>}
     */
    async exportProfile() {
        const result = await this.protocol.send(CMD.EXPORT_PROFILE, [this.currentProfile]);
        return {
            profileId: this.currentProfile,
            matrix: this.matrix,
            exportedAt: new Date().toISOString(),
            data: result.data,
        };
    }

    /**
     * 从 JSON 导入配置
     * @param {object} profileData
     * @returns {Promise<boolean>}
     */
    async importProfile(profileData) {
        const json = JSON.stringify(profileData);
        const bytes = Array.from(new TextEncoder().encode(json));
        const result = await this.protocol.send(CMD.IMPORT_PROFILE, [this.currentProfile, ...bytes]);
        this.bus.emit('keymap:imported', { profile: this.currentProfile });
        return result.success !== false;
    }

    // ==================== 按键矩阵 ====================

    /**
     * 读取按键矩阵
     * @returns {Promise<Uint8Array>}
     */
    async readMatrix() {
        const result = await this.protocol.send(CMD.READ_MATRIX, []);
        this.matrix = result.data || this.matrix;
        this.bus.emit('keymap:matrix-read', { matrix: this.matrix });
        return this.matrix;
    }

    /**
     * 写入按键矩阵
     * @param {Array<number>|Uint8Array} matrix
     * @returns {Promise<boolean>}
     */
    async writeMatrix(matrix) {
        const bytes = Array.from(matrix).slice(0, 128);
        const result = await this.protocol.send(CMD.WRITE_MATRIX, bytes);
        this.matrix = bytes;
        this.bus.emit('keymap:matrix-written', { matrix: this.matrix });
        return result.success !== false;
    }

    /**
     * 读取按键状态
     * @returns {Promise<Array<{keyCode: number, pressed: boolean}>>}
     */
    async readKeyState() {
        const result = await this.protocol.send(CMD.READ_KEY_STATE, []);
        return result.data || [];
    }

    // ==================== 按键重映射 ====================

    /**
     * 重映射单个按键
     * @param {number} fromKey 原键码
     * @param {number} toKey 目标键码
     * @returns {Promise<boolean>}
     */
    async remapKey(fromKey, toKey) {
        const result = await this.protocol.send(CMD.REMAP_KEY, [fromKey, toKey]);
        this.matrix[fromKey] = toKey;
        this.bus.emit('keymap:remapped', { fromKey, toKey });
        return result.success !== false;
    }

    /**
     * 批量重映射
     * @param {Array<[number, number]>} mappings [[from, to], ...]
     * @returns {Promise<boolean>}
     */
    async remapBatch(mappings) {
        for (const [from, to] of mappings) {
            await this.remapKey(from, to);
        }
        this.bus.emit('keymap:remap-batch-done', { count: mappings.length });
        return true;
    }

    // ==================== 特殊按键 ====================

    /**
     * 禁用某个按键
     * @param {number} keyCode
     */
    async disableKey(keyCode) {
        return await this.remapKey(keyCode, 0x00);
    }

    /**
     * 发送组合键
     * @param {Array<number>} keys
     */
    async comboKey(keys) {
        const result = await this.protocol.send(CMD.COMBO_KEY, keys);
        this.bus.emit('keymap:combo-fired', { keys });
        return result.success !== false;
    }

    /**
     * 触发单键
     * @param {number} keyCode
     */
    async fireKey(keyCode) {
        const result = await this.protocol.send(CMD.FIRE_KEY, [keyCode]);
        this.bus.emit('keymap:key-fired', { keyCode });
        return result.success !== false;
    }

    /**
     * 媒体键
     * @param {number} mediaKeyCode 0x01-0x10
     */
    async mediaKey(mediaKeyCode) {
        const result = await this.protocol.send(CMD.MEDIA_KEY, [mediaKeyCode]);
        return result.success !== false;
    }

    /**
     * 系统键
     * @param {number} sysKeyCode
     */
    async systemKey(sysKeyCode) {
        const result = await this.protocol.send(CMD.SYSTEM_KEY, [sysKeyCode]);
        return result.success !== false;
    }

    // ==================== 状态查询 ====================

    getCurrentProfile() {
        return this.currentProfile;
    }

    getMatrix() {
        return this.matrix;
    }

    getProfiles() {
        return this.profiles;
    }
}

export default KeymapService;
