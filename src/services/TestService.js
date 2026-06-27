/**
 * TestService - 数据收发测试服务层
 *
 * 职责:
 *   - 自动化数据收发测试
 *   - 计算成功率和统计
 *   - 错误日志记录
 *   - 报告导出
 *
 * 测试流程:
 *   1. 启动测试 (startTest)
 *   2. 按时间间隔循环发送数据
 *   3. 等待设备响应并对比
 *   4. 实时更新统计
 *   5. 生成测试报告
 */

import { bus } from '../core/EventBus.js';
import { logger } from '../core/Logger.js';
import { TEST, PROTOCOL } from '../core/Config.js';
import { CMD, STATUS } from '../protocol/commands/BaseCommands.js';

/**
 * 测试数据类型
 */
export const TestDataType = {
    INCREMENT: 'increment',  // 递增序列
    RANDOM: 'random',        // 随机数据
    FIXED: 'fixed',          // 固定数据
};

/**
 * 测试状态
 */
export const TestStatus = {
    IDLE: 'idle',
    RUNNING: 'running',
    STOPPED: 'stopped',
    COMPLETED: 'completed',
};

export class TestService {
    /**
     * @param {Protocol} protocol - 协议层实例
     */
    constructor(protocol) {
        this.protocol = protocol;
        this.status = TestStatus.IDLE;

        this.config = {
            sendCount: TEST.DEFAULT_COUNT,         // 发送次数
            interval: TEST.DEFAULT_INTERVAL,        // 时间间隔 (ms)
            dataType: TestDataType.INCREMENT,       // 数据类型
            dataLength: TEST.DEFAULT_DATA_LENGTH,   // 数据长度 (字节)
            fixedValue: 0xAA,                       // 固定值
        };

        this.stats = this._initStats();
        this.testResults = [];      // 详细测试结果
        this.errors = [];            // 错误日志
        this.startTime = 0;
        this.endTime = 0;
        this.stopFlag = false;
        this.timeout = null;

        logger.info('TestService 已创建');
    }

    /**
     * 初始化统计
     */
    _initStats() {
        return {
            totalSent: 0,
            totalReceived: 0,
            success: 0,
            failed: 0,
            successRate: 0,
            avgLatency: 0,
            minLatency: Infinity,
            maxLatency: 0,
            totalBytes: 0,
        };
    }

    // ============================================================
    // 配置
    // ============================================================

    /**
     * 设置测试配置
     * @param {object} config
     */
    setConfig(config) {
        this.config = {
            ...this.config,
            ...config,
        };
        logger.info('测试配置已更新', this.config);
        bus.emit('test:config-updated', { config: this.config });
    }

    /**
     * 获取配置
     */
    getConfig() {
        return { ...this.config };
    }

    // ============================================================
    // 统计
    // ============================================================

    /**
     * 获取统计信息
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * 获取测试结果
     */
    getResults() {
        return [...this.testResults];
    }

    /**
     * 获取错误日志
     */
    getErrors() {
        return [...this.errors];
    }

    /**
     * 重置统计
     */
    resetStats() {
        this.stats = this._initStats();
        this.testResults = [];
        this.errors = [];
        bus.emit('test:stats-reset');
        logger.info('测试统计已重置');
    }

    // ============================================================
    // 测试控制
    // ============================================================

    /**
     * 启动测试
     */
    async startTest(customConfig = null) {
        if (this.status === TestStatus.RUNNING) {
            logger.warn('测试已在进行中');
            return;
        }

        if (customConfig) {
            this.setConfig(customConfig);
        }

        // 验证配置
        this._validateConfig();

        // 重置
        this.resetStats();
        this.status = TestStatus.RUNNING;
        this.stopFlag = false;
        this.startTime = Date.now();

        logger.info(`测试开始: ${this.config.sendCount} 次, 间隔 ${this.config.interval}ms`);
        bus.emit('test:started', { config: this.config });

        try {
            await this._runTestLoop();
        } catch (err) {
            logger.error(`测试异常: ${err.message}`);
            bus.emit('test:error', { error: err });
        } finally {
            this.endTime = Date.now();
            this.status = this.stopFlag ? TestStatus.STOPPED : TestStatus.COMPLETED;
            this._finalizeStats();
            bus.emit('test:finished', {
                status: this.status,
                stats: this.stats,
                duration: this.endTime - this.startTime,
            });
            logger.info(`测试结束: ${this.status}, 耗时 ${this.endTime - this.startTime}ms`);
        }
    }

    /**
     * 停止测试
     */
    stopTest() {
        if (this.status !== TestStatus.RUNNING) {
            logger.warn('测试未在运行');
            return;
        }
        this.stopFlag = true;
        logger.info('收到停止测试请求');
    }

    /**
     * 验证配置
     */
    _validateConfig() {
        const { sendCount, interval, dataLength } = this.config;
        if (sendCount < 1 || sendCount > 1000) {
            throw new Error(`发送次数超出范围 (1-1000): ${sendCount}`);
        }
        if (interval < TEST.MIN_INTERVAL || interval > 1000) {
            throw new Error(`时间间隔超出范围 (${TEST.MIN_INTERVAL}-1000ms): ${interval}`);
        }
        if (dataLength < 1 || dataLength > PROTOCOL.MAX_PAYLOAD) {
            throw new Error(`数据长度超出范围 (1-${PROTOCOL.MAX_PAYLOAD}): ${dataLength}`);
        }
    }

    // ============================================================
    // 测试循环
    // ============================================================

    /**
     * 运行测试循环
     */
    async _runTestLoop() {
        for (let i = 0; i < this.config.sendCount; i++) {
            if (this.stopFlag) {
                logger.info(`测试在第 ${i} 次时停止`);
                break;
            }

            const testData = this._generateTestData(i);
            await this._sendAndVerify(testData, i);

            // 进度事件
            bus.emit('test:progress', {
                current: i + 1,
                total: this.config.sendCount,
                percent: ((i + 1) / this.config.sendCount * 100).toFixed(1),
            });

            // 间隔等待 (最后一次不等待)
            if (i < this.config.sendCount - 1) {
                await this._sleep(this.config.interval);
            }
        }
    }

    /**
     * 发送并验证
     */
    async _sendAndVerify(data, index) {
        const sendTime = Date.now();
        this.stats.totalSent++;
        this.stats.totalBytes += data.length;

        const result = {
            index,
            sent: Array.from(data),
            received: null,
            success: false,
            latency: 0,
            error: null,
            timestamp: sendTime,
        };

        try {
            const response = await this.protocol.send(
                CMD.LOOPBACK_TEST,
                Array.from(data),
                0,
                { timeout: TEST.RESPONSE_TIMEOUT }
            );

            result.received = Array.from(response.data);
            result.latency = Date.now() - sendTime;

            this.stats.totalReceived++;
            this._updateLatency(result.latency);

            // 数据对比
            const compareResult = this._compareData(data, response.data);
            result.success = compareResult.match;

            if (compareResult.match) {
                this.stats.success++;
                bus.emit('test:item-success', { index, latency: result.latency });
            } else {
                this.stats.failed++;
                result.error = `数据不匹配: ${compareResult.reason}`;
                this._recordError(index, result.error);
                bus.emit('test:item-failed', { index, error: result.error });
            }
        } catch (err) {
            result.latency = Date.now() - sendTime;
            result.error = err.message;
            this.stats.failed++;
            this._recordError(index, err.message);
            bus.emit('test:item-failed', { index, error: err.message });
            logger.warn(`测试 #${index} 失败: ${err.message}`);
        }

        this.testResults.push(result);
        this._updateSuccessRate();
    }

    /**
     * 数据对比
     * 设备回显: 收到 N 字节数据 → 返回 [status(1B) + 原数据(NB)]
     * Protocol 已剥离 status, 所以 received 就是原始数据的回显
     */
    _compareData(sent, received) {
        if (!received || received.length === 0) {
            return { match: false, reason: '无响应数据' };
        }

        const sentData = Array.from(sent);
        const recvData = Array.from(received);

        if (sentData.length !== recvData.length) {
            return {
                match: false,
                reason: `长度不匹配 (发送 ${sentData.length}, 接收 ${recvData.length})`
            };
        }

        for (let i = 0; i < sentData.length; i++) {
            if (sentData[i] !== recvData[i]) {
                return {
                    match: false,
                    reason: `字节 ${i} 不匹配 (发送 0x${sentData[i].toString(16)}, 接收 0x${recvData[i].toString(16)})`
                };
            }
        }

        return { match: true };
    }

    // ============================================================
    // 数据生成
    // ============================================================

    /**
     * 生成测试数据
     */
    _generateTestData(index) {
        const length = this.config.dataLength;
        const data = new Uint8Array(length);

        switch (this.config.dataType) {
            case TestDataType.INCREMENT:
                for (let i = 0; i < length; i++) {
                    data[i] = (index + i) & 0xFF;
                }
                break;

            case TestDataType.RANDOM:
                for (let i = 0; i < length; i++) {
                    data[i] = Math.floor(Math.random() * 256);
                }
                break;

            case TestDataType.FIXED:
                for (let i = 0; i < length; i++) {
                    data[i] = this.config.fixedValue;
                }
                break;

            default:
                throw new Error(`未知数据类型: ${this.config.dataType}`);
        }

        return data;
    }

    // ============================================================
    // 统计更新
    // ============================================================

    /**
     * 更新延迟统计
     */
    _updateLatency(latency) {
        this.stats.minLatency = Math.min(this.stats.minLatency, latency);
        this.stats.maxLatency = Math.max(this.stats.maxLatency, latency);

        // 移动平均
        const total = this.stats.totalReceived;
        this.stats.avgLatency = (
            (this.stats.avgLatency * (total - 1) + latency) / total
        );
    }

    /**
     * 更新成功率
     */
    _updateSuccessRate() {
        if (this.stats.totalReceived > 0) {
            this.stats.successRate = (
                (this.stats.success / this.stats.totalReceived) * 100
            ).toFixed(2);
        }
    }

    /**
     * 完成后最终统计
     */
    _finalizeStats() {
        if (this.stats.minLatency === Infinity) {
            this.stats.minLatency = 0;
        }
    }

    /**
     * 记录错误
     */
    _recordError(index, message) {
        const err = {
            index,
            message,
            timestamp: Date.now(),
        };
        this.errors.push(err);
        if (this.errors.length > 100) {
            this.errors.shift(); // 保留最近 100 条
        }
    }

    // ============================================================
    // 报告导出
    // ============================================================

    /**
     * 导出测试报告
     * @returns {string} 报告文本
     */
    exportReport() {
        const report = {
            title: '数据收发测试报告',
            generatedAt: new Date().toISOString(),
            duration: this.endTime - this.startTime,
            config: this.config,
            stats: this.stats,
            results: this.testResults,
            errors: this.errors,
        };

        return this._formatReport(report);
    }

    /**
     * 格式化报告为文本
     */
    _formatReport(report) {
        const lines = [];
        lines.push('='.repeat(60));
        lines.push(`  ${report.title}`);
        lines.push('='.repeat(60));
        lines.push('');
        lines.push(`生成时间: ${report.generatedAt}`);
        lines.push(`测试耗时: ${report.duration}ms`);
        lines.push('');
        lines.push('-'.repeat(60));
        lines.push('  测试配置');
        lines.push('-'.repeat(60));
        lines.push(`发送次数: ${report.config.sendCount}`);
        lines.push(`时间间隔: ${report.config.interval}ms`);
        lines.push(`数据类型: ${report.config.dataType}`);
        lines.push(`数据长度: ${report.config.dataLength} 字节`);
        lines.push('');
        lines.push('-'.repeat(60));
        lines.push('  测试统计');
        lines.push('-'.repeat(60));
        lines.push(`总发送:   ${report.stats.totalSent}`);
        lines.push(`总接收:   ${report.stats.totalReceived}`);
        lines.push(`成功次数: ${report.stats.success}`);
        lines.push(`失败次数: ${report.stats.failed}`);
        lines.push(`成功率:   ${report.stats.successRate}%`);
        lines.push(`总字节数: ${report.stats.totalBytes}`);
        lines.push(`平均延迟: ${report.stats.avgLatency.toFixed(2)}ms`);
        lines.push(`最小延迟: ${report.stats.minLatency}ms`);
        lines.push(`最大延迟: ${report.stats.maxLatency}ms`);
        lines.push('');

        if (report.errors.length > 0) {
            lines.push('-'.repeat(60));
            lines.push('  错误详情');
            lines.push('-'.repeat(60));
            report.errors.forEach((err, i) => {
                lines.push(`#${i + 1} [${new Date(err.timestamp).toISOString()}] 测试 ${err.index}: ${err.message}`);
            });
            lines.push('');
        }

        lines.push('='.repeat(60));
        return lines.join('\n');
    }

    /**
     * 下载报告
     */
    downloadReport() {
        const text = this.exportReport();
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `test-report-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        logger.info('测试报告已下载');
    }

    // ============================================================
    // 工具
    // ============================================================

    /**
     * 休眠
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 销毁服务
     */
    destroy() {
        this.stopTest();
        this.testResults = [];
        this.errors = [];
        bus.emit('test:destroyed');
        logger.info('TestService 已销毁');
    }
}

export default TestService;
