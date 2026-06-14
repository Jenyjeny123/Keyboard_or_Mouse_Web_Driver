/**
 * Toast - 轻提示组件
 *
 * 用途: 非阻塞式消息提示, 自动消失
 *
 * 用法:
 *   import { toast } from './Toast.js';
 *   toast.success('操作成功');
 *   toast.error('操作失败');
 *   toast.info('提示信息');
 *   toast.warn('警告');
 */

import { bus } from '../../core/EventBus.js';
import { logger } from '../../core/Logger.js';
import { UI } from '../../core/Config.js';

const TOAST_TYPES = {
    success: {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        text: 'text-emerald-300',
        icon: '✓',
    },
    error: {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        text: 'text-red-300',
        icon: '✗',
    },
    warn: {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-300',
        icon: '⚠',
    },
    info: {
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-500/30',
        text: 'text-cyan-300',
        icon: 'ℹ',
    },
};

class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = [];
    }

    /**
     * 初始化容器
     */
    _init() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = 'fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(this.container);
    }

    /**
     * 显示 toast
     */
    show(message, type = 'info', duration = UI.TOAST_DURATION) {
        this._init();

        const config = TOAST_TYPES[type] || TOAST_TYPES.info;
        const id = Date.now() + Math.random();
        const toast = document.createElement('div');
        toast.id = `toast-${id}`;
        toast.className = `
            pointer-events-auto
            flex items-center gap-3 px-4 py-3 rounded-xl
            ${config.bg} ${config.border} border backdrop-blur-md
            shadow-lg
            transform transition-all duration-300
            translate-x-full opacity-0
        `;
        toast.innerHTML = `
            <span class="text-2xl">${config.icon}</span>
            <span class="${config.text} text-sm font-medium">${message}</span>
            <button class="ml-2 text-slate-400 hover:text-white" data-close>×</button>
        `;

        this.container.appendChild(toast);
        this.toasts.push({ id, element: toast });

        // 动画进入
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        });

        // 关闭按钮
        toast.querySelector('[data-close]').addEventListener('click', () => {
            this.dismiss(id);
        });

        // 自动关闭
        const timer = setTimeout(() => this.dismiss(id), duration);

        // 鼠标悬停暂停
        toast.addEventListener('mouseenter', () => clearTimeout(timer));
        toast.addEventListener('mouseleave', () => {
            setTimeout(() => this.dismiss(id), duration / 2);
        });

        bus.emit('toast:shown', { type, message, id });
        logger.debug(`Toast [${type}]: ${message}`);

        return id;
    }

    /**
     * 关闭 toast
     */
    dismiss(id) {
        const idx = this.toasts.findIndex(t => t.id === id);
        if (idx < 0) return;

        const { element } = this.toasts[idx];
        element.classList.add('translate-x-full', 'opacity-0');

        setTimeout(() => {
            element.remove();
            this.toasts.splice(idx, 1);
        }, 300);

        bus.emit('toast:dismissed', { id });
    }

    /**
     * 清空所有 toast
     */
    clear() {
        this.toasts.forEach(t => {
            t.element.remove();
        });
        this.toasts = [];
    }

    /**
     * 快捷方法
     */
    success(message, duration) { return this.show(message, 'success', duration); }
    error(message, duration) { return this.show(message, 'error', duration); }
    warn(message, duration) { return this.show(message, 'warn', duration); }
    info(message, duration) { return this.show(message, 'info', duration); }
}

// 单例
export const toast = new ToastManager();

export default toast;
