/**
 * Button - 按钮组件
 *
 * 用途: 统一的按钮交互, 支持多种风格/尺寸/状态
 *
 * 用法:
 *   const btn = new Button({
 *       label: '保存',
 *       variant: 'primary',
 *       size: 'md',
 *       icon: '💾',
 *       onClick: () => { ... },
 *   });
 *   btn.mount('#container');
 */

import { Component } from '../Component.js';
import { bus } from '../../core/EventBus.js';
import { logger } from '../../core/Logger.js';

export class Button extends Component {
    static defaultProps = {
        label: 'Button',
        variant: 'primary',  // primary | secondary | success | danger | warning | ghost | outline
        size: 'md',           // sm | md | lg
        icon: null,
        iconPosition: 'left', // left | right
        loading: false,
        disabled: false,
        fullWidth: false,
        rounded: 'lg',        // none | md | lg | full
        block: false,         // 占满父容器宽度
        onClick: null,
    };

    static variants = {
        primary: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-500/20',
        secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-300',
        success: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20',
        danger: 'bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-500/20',
        warning: 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-500/20',
        ghost: 'bg-transparent hover:bg-slate-800/50 text-slate-300',
        outline: 'bg-transparent border border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-300',
    };

    static sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-5 py-2.5 text-base',
    };

    static rounded = {
        none: 'rounded-none',
        md: 'rounded-md',
        lg: 'rounded-lg',
        full: 'rounded-full',
    };

    constructor(props = {}) {
        super({ ...Button.defaultProps, ...props });
        this.clickCount = 0;
    }

    render() {
        const variantClass = Button.variants[this.props.variant] || Button.variants.primary;
        const sizeClass = Button.sizes[this.props.size] || Button.sizes.md;
        const roundedClass = Button.rounded[this.props.rounded] || Button.rounded.lg;
        const widthClass = this.props.block || this.props.fullWidth ? 'w-full' : '';

        const iconHtml = this.props.icon
            ? `<span class="inline-flex">${this.props.icon}</span>`
            : '';

        return `
            <button
                class="inline-flex items-center justify-center gap-2 font-medium transition-all
                       ${variantClass} ${sizeClass} ${roundedClass} ${widthClass}
                       ${this.props.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                       ${this.props.loading ? 'pointer-events-none' : ''}"
                ${this.props.disabled ? 'disabled' : ''}
                data-component="Button"
            >
                ${this.props.loading ? `
                    <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"></path>
                    </svg>
                ` : (this.props.iconPosition === 'left' ? iconHtml : '')}
                <span>${this.props.label}</span>
                ${!this.props.loading && this.props.iconPosition === 'right' ? iconHtml : ''}
            </button>
        `;
    }

    onMount() {
        this.element.addEventListener('click', (e) => this._handleClick(e));
    }

    _handleClick(e) {
        if (this.props.disabled || this.props.loading) return;
        this.clickCount++;
        bus.emit('button:clicked', { button: this, count: this.clickCount });
        if (this.props.onClick) {
            this.props.onClick(e, this);
        }
    }

    setLoading(loading) {
        this.props.loading = loading;
        this.update({ loading });
    }

    setDisabled(disabled) {
        this.props.disabled = disabled;
        this.update({ disabled });
    }

    setLabel(label) {
        this.props.label = label;
        this.update({ label });
    }
}

/**
 * 按钮组
 */
export class ButtonGroup extends Component {
    static defaultProps = {
        buttons: [],  // [{label, variant, onClick, ...}]
        direction: 'row',  // row | col
        gap: 2,
    };

    render() {
        const directionClass = this.props.direction === 'col' ? 'flex-col' : 'flex-row';
        const buttonsHtml = this.props.buttons.map((btn, i) => {
            const button = new Button({ ...btn, fullWidth: this.props.direction === 'col' });
            setTimeout(() => {
                if (this.element && button.element) {
                    this.element.appendChild(button.element);
                }
            }, 0);
            return `<div data-btn-placeholder="${i}"></div>`;
        }).join('');

        return `
            <div class="flex ${directionClass} gap-${this.props.gap}" data-component="ButtonGroup">
                ${buttonsHtml}
            </div>
        `;
    }
}

export default Button;
