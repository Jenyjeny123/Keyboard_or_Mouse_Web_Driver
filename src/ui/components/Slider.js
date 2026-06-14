/**
 * Slider - 滑块组件
 *
 * 用途: 数值调节, 支持单值/范围, 实时显示
 *
 * 用法:
 *   const slider = new Slider({
 *       label: '亮度',
 *       min: 0,
 *       max: 100,
 *       value: 75,
 *       step: 1,
 *       showValue: true,
 *       unit: '%',
 *       onChange: (value) => { ... },
 *   });
 */

import { Component } from '../Component.js';
import { bus } from '../../core/EventBus.js';

export class Slider extends Component {
    static defaultProps = {
        label: '',
        min: 0,
        max: 100,
        value: 50,
        step: 1,
        unit: '',
        showValue: true,
        showMinMax: false,
        disabled: false,
        size: 'md',  // sm | md | lg
        color: 'cyan',  // cyan | emerald | amber | red
        onChange: null,
        onInput: null,
    };

    static sizes = {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3',
    };

    static colors = {
        cyan: 'bg-cyan-500',
        emerald: 'bg-emerald-500',
        amber: 'bg-amber-500',
        red: 'bg-red-500',
    };

    constructor(props = {}) {
        super({ ...Slider.defaultProps, ...props });
    }

    get percent() {
        return ((this.props.value - this.props.min) / (this.props.max - this.props.min)) * 100;
    }

    render() {
        const sizeClass = Slider.sizes[this.props.size] || Slider.sizes.md;
        const colorClass = Slider.colors[this.props.color] || Slider.colors.cyan;

        return `
            <div class="space-y-2" data-component="Slider">
                ${this.props.label ? `
                    <div class="flex items-center justify-between">
                        <label class="text-sm font-medium text-slate-300">${this.props.label}</label>
                        ${this.props.showValue ? `
                            <span class="text-sm font-mono text-cyan-400">
                                ${this.props.value}${this.props.unit}
                            </span>
                        ` : ''}
                    </div>
                ` : ''}
                <div class="relative flex items-center ${this.props.disabled ? 'opacity-50' : ''}">
                    <input
                        type="range"
                        min="${this.props.min}"
                        max="${this.props.max}"
                        step="${this.props.step}"
                        value="${this.props.value}"
                        ${this.props.disabled ? 'disabled' : ''}
                        class="slider w-full appearance-none bg-transparent cursor-pointer
                               [&::-webkit-slider-runnable-track]:${sizeClass}
                               [&::-webkit-slider-runnable-track]:rounded-full
                               [&::-webkit-slider-runnable-track]:bg-slate-700
                               [&::-webkit-slider-thumb]:appearance-none
                               [&::-webkit-slider-thumb]:${sizeClass}
                               [&::-webkit-slider-thumb]:aspect-square
                               [&::-webkit-slider-thumb]:rounded-full
                               [&::-webkit-slider-thumb]:${colorClass}
                               [&::-webkit-slider-thumb]:shadow-lg
                               [&::-webkit-slider-thumb]:cursor-pointer
                               [&::-webkit-slider-thumb]:-mt-1
                               [&::-moz-range-track]:${sizeClass}
                               [&::-moz-range-track]:rounded-full
                               [&::-moz-range-track]:bg-slate-700
                               [&::-moz-range-thumb]:${sizeClass}
                               [&::-moz-range-thumb]:rounded-full
                               [&::-moz-range-thumb]:${colorClass}
                               [&::-moz-range-thumb]:border-0
                               [&::-moz-range-thumb]:cursor-pointer"
                        data-slider
                    />
                </div>
                ${this.props.showMinMax ? `
                    <div class="flex justify-between text-xs text-slate-500">
                        <span>${this.props.min}${this.props.unit}</span>
                        <span>${this.props.max}${this.props.unit}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    onMount() {
        const sliderEl = this.element.querySelector('[data-slider]');
        if (!sliderEl) return;

        sliderEl.addEventListener('input', (e) => this._handleInput(e));
        sliderEl.addEventListener('change', (e) => this._handleChange(e));
    }

    _handleInput(e) {
        this.props.value = parseFloat(e.target.value);
        this._updateDisplay();

        if (this.props.onInput) {
            this.props.onInput(this.props.value, this);
        }
        bus.emit('slider:input', { value: this.props.value, slider: this });
    }

    _handleChange(e) {
        this.props.value = parseFloat(e.target.value);
        this._updateDisplay();

        if (this.props.onChange) {
            this.props.onChange(this.props.value, this);
        }
        bus.emit('slider:change', { value: this.props.value, slider: this });
    }

    _updateDisplay() {
        // 更新数值显示
        const valueEl = this.element.querySelector('[data-value-display]');
        if (valueEl) {
            valueEl.textContent = `${this.props.value}${this.props.unit}`;
        }
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
        this.props.value = value;
        const sliderEl = this.element.querySelector('[data-slider]');
        if (sliderEl) sliderEl.value = value;
        this._updateDisplay();
    }

    /**
     * 增量
     */
    increment(delta = 1) {
        this.setValue(Math.min(this.props.max, this.props.value + delta));
    }

    /**
     * 减量
     */
    decrement(delta = 1) {
        this.setValue(Math.max(this.props.min, this.props.value - delta));
    }
}

export default Slider;
