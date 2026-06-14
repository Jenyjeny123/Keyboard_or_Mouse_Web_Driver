/**
 * Switch - 开关组件
 *
 * 用途: 二元状态切换, 支持标签、图标
 *
 * 用法:
 *   const sw = new Switch({
 *       label: '启用灯光',
 *       value: true,
 *       onChange: (value) => { ... },
 *   });
 */

import { Component } from '../Component.js';
import { bus } from '../../core/EventBus.js';

export class Switch extends Component {
    static defaultProps = {
        label: '',
        description: '',
        value: false,
        disabled: false,
        size: 'md',  // sm | md | lg
        color: 'cyan',  // cyan | emerald | amber | red
        labelPosition: 'right',  // left | right
        onChange: null,
    };

    static sizes = {
        sm: { track: 'w-8 h-4', thumb: 'w-3 h-3', translate: 'translate-x-4' },
        md: { track: 'w-10 h-5', thumb: 'w-4 h-4', translate: 'translate-x-5' },
        lg: { track: 'w-12 h-6', thumb: 'w-5 h-5', translate: 'translate-x-6' },
    };

    static trackColors = {
        cyan: 'bg-cyan-500',
        emerald: 'bg-emerald-500',
        amber: 'bg-amber-500',
        red: 'bg-red-500',
    };

    render() {
        const sizeConfig = Switch.sizes[this.props.size] || Switch.sizes.md;
        const activeColor = Switch.trackColors[this.props.color] || Switch.trackColors.cyan;
        const trackClass = this.props.value
            ? `${activeColor}`
            : 'bg-slate-700';

        const labelHtml = (this.props.label || this.props.description) ? `
            <div class="flex-1">
                ${this.props.label ? `
                    <div class="text-sm font-medium text-slate-200">${this.props.label}</div>
                ` : ''}
                ${this.props.description ? `
                    <div class="text-xs text-slate-400 mt-0.5">${this.props.description}</div>
                ` : ''}
            </div>
        ` : '';

        const switchHtml = `
            <button
                type="button"
                role="switch"
                aria-checked="${this.props.value}"
                class="relative inline-flex items-center ${sizeConfig.track}
                       rounded-full transition-colors
                       ${trackClass}
                       ${this.props.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
                ${this.props.disabled ? 'disabled' : ''}
                data-switch
            >
                <span
                    class="inline-block ${sizeConfig.thumb} bg-white rounded-full shadow-md
                           transform transition-transform
                           ${this.props.value ? sizeConfig.translate : 'translate-x-0.5'}"
                ></span>
            </button>
        `;

        const inner = this.props.labelPosition === 'left'
            ? labelHtml + switchHtml
            : switchHtml + labelHtml;

        return `
            <label class="flex items-center gap-3 select-none ${this.props.disabled ? 'cursor-not-allowed' : 'cursor-pointer'}" data-component="Switch">
                ${inner}
            </label>
        `;
    }

    onMount() {
        const switchEl = this.element.querySelector('[data-switch]');
        if (!switchEl) return;

        switchEl.addEventListener('click', (e) => {
            e.preventDefault();
            this._toggle();
        });
    }

    _toggle() {
        if (this.props.disabled) return;
        this.props.value = !this.props.value;
        this.update({});

        if (this.props.onChange) {
            this.props.onChange(this.props.value, this);
        }
        bus.emit('switch:change', { value: this.props.value, switch: this });
    }

    /**
     * 获取值
     */
    getValue() {
        return this.props.value;
    }

    /**
     * 设置值
     */
    setValue(value) {
        this.props.value = !!value;
        this.update({});
        if (this.props.onChange) {
            this.props.onChange(this.props.value, this);
        }
    }

    /**
     * 切换
     */
    toggle() {
        this._toggle();
    }
}

export default Switch;
