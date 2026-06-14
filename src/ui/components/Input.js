/**
 * Input - 输入框组件
 *
 * 用途: 文本输入, 支持验证、图标、前后缀
 *
 * 用法:
 *   const input = new Input({
 *       label: '用户名',
 *       placeholder: '请输入',
 *       value: '',
 *       type: 'text',  // text | number | email | password | tel | url
 *       validator: (value) => value.length >= 3,
 *       errorMessage: '至少 3 个字符',
 *       onChange: (value) => { ... },
 *   });
 *   input.mount('#container');
 */

import { Component } from '../Component.js';
import { bus } from '../../core/EventBus.js';
import { logger } from '../../core/Logger.js';

export class Input extends Component {
    static defaultProps = {
        label: '',
        placeholder: '',
        value: '',
        type: 'text',
        icon: null,
        prefix: null,
        suffix: null,
        hint: '',
        errorMessage: '',
        required: false,
        disabled: false,
        readonly: false,
        minLength: 0,
        maxLength: 255,
        min: null,
        max: null,
        validator: null,
        validateOn: 'blur',  // blur | input | change
        showCounter: false,
        size: 'md',
        onChange: null,
        onInput: null,
        onBlur: null,
        onFocus: null,
    };

    static sizes = {
        sm: 'px-2 py-1 text-sm',
        md: 'px-3 py-2 text-sm',
        lg: 'px-4 py-3 text-base',
    };

    constructor(props = {}) {
        super({ ...Input.defaultProps, ...props });
        this.isValid = true;
        this._touched = false;
    }

    render() {
        const sizeClass = Input.sizes[this.props.size] || Input.sizes.md;
        const borderClass = !this.isValid && this._touched
            ? 'border-red-500/50 focus:border-red-400 focus:ring-red-500/20'
            : 'border-slate-700 focus:border-cyan-500/50 focus:ring-cyan-500/20';

        return `
            <div class="space-y-1" data-component="Input">
                ${this.props.label ? `
                    <label class="block text-sm font-medium text-slate-300">
                        ${this.props.label}
                        ${this.props.required ? '<span class="text-red-400">*</span>' : ''}
                    </label>
                ` : ''}
                <div class="relative flex items-center">
                    ${this.props.icon ? `
                        <span class="absolute left-3 text-slate-400 pointer-events-none">${this.props.icon}</span>
                    ` : ''}
                    ${this.props.prefix ? `
                        <span class="absolute left-3 text-slate-400 text-sm pointer-events-none">${this.props.prefix}</span>
                    ` : ''}
                    <input
                        type="${this.props.type}"
                        value="${this._escape(this.props.value)}"
                        placeholder="${this._escape(this.props.placeholder)}"
                        ${this.props.disabled ? 'disabled' : ''}
                        ${this.props.readonly ? 'readonly' : ''}
                        ${this.props.minLength ? `minlength="${this.props.minLength}"` : ''}
                        ${this.props.maxLength ? `maxlength="${this.props.maxLength}"` : ''}
                        ${this.props.min !== null ? `min="${this.props.min}"` : ''}
                        ${this.props.max !== null ? `max="${this.props.max}"` : ''}
                        class="w-full bg-slate-900/50 border ${borderClass}
                               ${this.props.icon || this.props.prefix ? 'pl-10' : ''}
                               ${this.props.suffix ? 'pr-10' : ''}
                               rounded-lg ${sizeClass}
                               text-slate-200 placeholder-slate-500
                               focus:outline-none focus:ring-2
                               transition-colors
                               ${this.props.disabled ? 'opacity-50 cursor-not-allowed' : ''}"
                        data-input
                    />
                    ${this.props.suffix ? `
                        <span class="absolute right-3 text-slate-400 text-sm pointer-events-none">${this.props.suffix}</span>
                    ` : ''}
                </div>
                <div class="flex justify-between items-start min-h-[1.25rem]">
                    <div class="text-xs flex-1">
                        ${!this.isValid && this._touched ? `
                            <span class="text-red-400">⚠ ${this.props.errorMessage || '输入有误'}</span>
                        ` : this.props.hint ? `
                            <span class="text-slate-500">${this.props.hint}</span>
                        ` : ''}
                    </div>
                    ${this.props.showCounter ? `
                        <span class="text-xs text-slate-500 ml-2">
                            ${(this.props.value || '').length}/${this.props.maxLength}
                        </span>
                    ` : ''}
                </div>
            </div>
        `;
    }

    onMount() {
        const inputEl = this.element.querySelector('[data-input]');
        if (!inputEl) return;

        inputEl.addEventListener('input', () => this._handleInput(inputEl));
        inputEl.addEventListener('change', () => this._handleChange(inputEl));
        inputEl.addEventListener('blur', () => this._handleBlur(inputEl));
        inputEl.addEventListener('focus', () => this._handleFocus(inputEl));
    }

    _handleInput(el) {
        this.props.value = el.value;
        this._touched = true;
        this._validate();

        if (this.props.validateOn === 'input') {
            this._refreshCounter();
        }

        if (this.props.onInput) {
            this.props.onInput(el.value, this);
        }
        bus.emit('input:input', { value: el.value, input: this });
    }

    _handleChange(el) {
        this.props.value = el.value;
        this._validate();

        if (this.props.onChange) {
            this.props.onChange(el.value, this);
        }
        bus.emit('input:change', { value: el.value, input: this });
    }

    _handleBlur(el) {
        this._touched = true;
        this._validate();
        this.update({});

        if (this.props.onBlur) {
            this.props.onBlur(el.value, this);
        }
        bus.emit('input:blur', { value: el.value, input: this });
    }

    _handleFocus(el) {
        if (this.props.onFocus) {
            this.props.onFocus(el.value, this);
        }
        bus.emit('input:focus', { value: el.value, input: this });
    }

    _validate() {
        if (!this.props.validator) {
            this.isValid = true;
            return true;
        }

        try {
            this.isValid = this.props.validator(this.props.value);
        } catch (err) {
            this.isValid = false;
            logger.error('验证器错误: ' + err.message);
        }
        return this.isValid;
    }

    _refreshCounter() {
        const counter = this.element.querySelector('[data-counter]');
        if (counter) {
            counter.textContent = `${(this.props.value || '').length}/${this.props.maxLength}`;
        }
    }

    _escape(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
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
        const inputEl = this.element.querySelector('[data-input]');
        if (inputEl) inputEl.value = value;
        this._validate();
    }

    /**
     * 重置
     */
    reset() {
        this.setValue('');
        this._touched = false;
        this.isValid = true;
        this.update({});
    }

    /**
     * 聚焦
     */
    focus() {
        const inputEl = this.element.querySelector('[data-input]');
        if (inputEl) inputEl.focus();
    }
}

export default Input;
