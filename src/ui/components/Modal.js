/**
 * Modal - 模态框组件
 *
 * 用途: 弹出式对话框, 居中显示
 *
 * 用法:
 *   const modal = new Modal({
 *       title: '确认操作',
 *       body: '确定要执行此操作吗?',
 *       confirmText: '确定',
 *       cancelText: '取消',
 *       onConfirm: () => { ... },
 *       onCancel: () => { ... },
 *   });
 *   modal.show();
 */

import { Component } from '../Component.js';
import { bus } from '../../core/EventBus.js';
import { logger } from '../../core/Logger.js';

export class Modal extends Component {
    static defaultProps = {
        title: '提示',
        body: '',
        confirmText: '确定',
        cancelText: '取消',
        showCancel: true,
        confirmVariant: 'primary',  // primary | success | danger
        onConfirm: null,
        onCancel: null,
        closeOnBackdrop: true,
        width: 'max-w-md',
    };

    constructor(props = {}) {
        super({ ...Modal.defaultProps, ...props });
        this.isShown = false;
    }

    render() {
        const variantClass = {
            primary: 'bg-cyan-600 hover:bg-cyan-500',
            success: 'bg-emerald-600 hover:bg-emerald-500',
            danger: 'bg-red-600 hover:bg-red-500',
        }[this.props.confirmVariant] || 'bg-cyan-600 hover:bg-cyan-500';

        return `
            <div
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm ${this.isShown ? '' : 'hidden'}"
                data-component="Modal"
                data-backdrop
            >
                <div class="glass-panel border border-cyan-500/30 rounded-2xl shadow-2xl ${this.props.width} w-full mx-4 overflow-hidden" data-modal>
                    <header class="px-6 py-4 border-b border-slate-700/30 flex items-center justify-between">
                        <h3 class="text-lg font-semibold text-cyan-300">${this.props.title}</h3>
                        <button class="text-slate-400 hover:text-white" data-close>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </header>
                    <div class="px-6 py-5 text-slate-300">${this.props.body}</div>
                    <footer class="px-6 py-3 border-t border-slate-700/30 flex justify-end gap-2">
                        ${this.props.showCancel ? `
                            <button class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors" data-cancel>
                                ${this.props.cancelText}
                            </button>
                        ` : ''}
                        <button class="px-4 py-2 rounded-lg ${variantClass} text-white transition-colors" data-confirm>
                            ${this.props.confirmText}
                        </button>
                    </footer>
                </div>
            </div>
        `;
    }

    onMount() {
        // 关闭按钮
        this.element.querySelector('[data-close]').addEventListener('click', () => {
            this._handleCancel();
        });

        // 取消按钮
        const cancelBtn = this.element.querySelector('[data-cancel]');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this._handleCancel());
        }

        // 确认按钮
        this.element.querySelector('[data-confirm]').addEventListener('click', () => {
            this._handleConfirm();
        });

        // 点击背景关闭
        this.element.addEventListener('click', (e) => {
            if (e.target.hasAttribute('data-backdrop') && this.props.closeOnBackdrop) {
                this._handleCancel();
            }
        });

        // ESC 关闭
        this._escHandler = (e) => {
            if (e.key === 'Escape' && this.isShown) {
                this._handleCancel();
            }
        };
        document.addEventListener('keydown', this._escHandler);
    }

    /**
     * 显示模态框
     */
    show() {
        this.isShown = true;
        if (this.element) {
            this.element.classList.remove('hidden');
        }
        bus.emit('modal:shown', { modal: this });
        logger.debug('Modal shown: ' + this.props.title);
    }

    /**
     * 隐藏模态框
     */
    hide() {
        this.isShown = false;
        if (this.element) {
            this.element.classList.add('hidden');
        }
        bus.emit('modal:hidden', { modal: this });
    }

    /**
     * 销毁
     */
    destroy() {
        document.removeEventListener('keydown', this._escHandler);
        super.destroy();
    }

    _handleConfirm() {
        if (this.props.onConfirm) {
            this.props.onConfirm(this);
        }
        bus.emit('modal:confirmed', { modal: this });
        this.hide();
    }

    _handleCancel() {
        if (this.props.onCancel) {
            this.props.onCancel(this);
        }
        bus.emit('modal:cancelled', { modal: this });
        this.hide();
    }
}

/**
 * 快捷方法: 显示确认对话框
 */
export function confirm(options) {
    return new Promise((resolve) => {
        const modal = new Modal({
            ...options,
            onConfirm: () => {
                if (options.onConfirm) options.onConfirm();
                resolve(true);
            },
            onCancel: () => {
                if (options.onCancel) options.onCancel();
                resolve(false);
            },
        });
        document.body.appendChild(modal.element || document.createElement('div'));
        modal.mount('body');
        modal.show();
    });
}

export default Modal;
