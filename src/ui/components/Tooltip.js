/**
 * Tooltip - 工具提示组件
 *
 * 用途: 鼠标悬停时显示提示信息
 *
 * 用法:
 *   const tip = new Tooltip({
 *       target: '#myButton',
 *       content: '点击保存设置',
 *       position: 'top',  // top | bottom | left | right
 *   });
 */

import { bus } from '../../core/EventBus.js';

const POSITIONS = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const ARROW_POSITIONS = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-slate-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-slate-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-slate-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-slate-800',
};

export class Tooltip {
    constructor(props = {}) {
        this.props = {
            content: '',
            position: 'top',
            delay: 200,
            disabled: false,
            className: '',
            ...props,
        };
        this.target = null;
        this.tooltipEl = null;
        this.showTimer = null;
        this.hideTimer = null;
        this.isVisible = false;

        if (props.target) {
            this.attach(props.target);
        }
    }

    /**
     * 附加到目标元素
     */
    attach(target) {
        if (typeof target === 'string') {
            this.target = document.querySelector(target);
        } else {
            this.target = target;
        }

        if (!this.target) {
            console.warn('Tooltip target not found:', target);
            return;
        }

        this.target.addEventListener('mouseenter', () => this._handleEnter());
        this.target.addEventListener('mouseleave', () => this._handleLeave());
        this.target.addEventListener('focus', () => this._handleEnter());
        this.target.addEventListener('blur', () => this._handleLeave());
    }

    /**
     * 创建 tooltip DOM
     */
    _createElement() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="absolute z-50 px-2 py-1 text-xs text-slate-200
                        bg-slate-800 border border-slate-700 rounded-md
                        shadow-lg whitespace-nowrap pointer-events-none
                        ${this.props.className}"
                 data-tooltip>
                ${this.props.content}
                <div class="absolute w-0 h-0 border-4 ${ARROW_POSITIONS[this.props.position]}"
                     data-arrow></div>
            </div>
        `;
        this.tooltipEl = wrapper.firstElementChild;
    }

    _handleEnter() {
        if (this.props.disabled) return;
        clearTimeout(this.hideTimer);
        this.showTimer = setTimeout(() => this._show(), this.props.delay);
    }

    _handleLeave() {
        clearTimeout(this.showTimer);
        this.hideTimer = setTimeout(() => this._hide(), 100);
    }

    _show() {
        if (this.isVisible) return;
        this._createElement();

        const positionClass = POSITIONS[this.props.position] || POSITIONS.top;
        this.tooltipEl.className = `absolute z-50 px-2 py-1 text-xs text-slate-200
                                    bg-slate-800 border border-slate-700 rounded-md
                                    shadow-lg whitespace-nowrap pointer-events-none
                                    opacity-0 transition-opacity
                                    ${positionClass}
                                    ${this.props.className}`;

        // 设置父元素为相对定位
        const computed = window.getComputedStyle(this.target);
        if (computed.position === 'static') {
            this.target.style.position = 'relative';
        }

        this.target.appendChild(this.tooltipEl);
        this.isVisible = true;

        requestAnimationFrame(() => {
            this.tooltipEl.classList.remove('opacity-0');
            this.tooltipEl.classList.add('opacity-100');
        });

        bus.emit('tooltip:shown', { tooltip: this, target: this.target });
    }

    _hide() {
        if (!this.isVisible) return;
        if (this.tooltipEl) {
            this.tooltipEl.classList.remove('opacity-100');
            this.tooltipEl.classList.add('opacity-0');
            setTimeout(() => {
                if (this.tooltipEl && this.tooltipEl.parentNode) {
                    this.tooltipEl.parentNode.removeChild(this.tooltipEl);
                }
                this.tooltipEl = null;
            }, 200);
        }
        this.isVisible = false;
        bus.emit('tooltip:hidden', { tooltip: this, target: this.target });
    }

    /**
     * 更新内容
     */
    setContent(content) {
        this.props.content = content;
        if (this.tooltipEl) {
            this.tooltipEl.innerHTML = `
                ${content}
                <div class="absolute w-0 h-0 border-4 ${ARROW_POSITIONS[this.props.position]}"
                     data-arrow></div>
            `;
        }
    }

    /**
     * 销毁
     */
    destroy() {
        this._hide();
        if (this.target) {
            this.target.removeEventListener('mouseenter', this._handleEnter);
            this.target.removeEventListener('mouseleave', this._handleLeave);
        }
        clearTimeout(this.showTimer);
        clearTimeout(this.hideTimer);
    }
}

/**
 * 全局 helper: 快速创建 tooltip
 */
export function createTooltip(target, content, options = {}) {
    return new Tooltip({
        target,
        content,
        ...options,
    });
}

export default Tooltip;
