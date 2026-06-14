/**
 * Select - 下拉选择组件
 *
 * 用途: 从一组选项中选择一个或多个
 *
 * 用法:
 *   const select = new Select({
 *       label: '灯光模式',
 *       options: [
 *           { value: 'static', label: '静态' },
 *           { value: 'breathing', label: '呼吸' },
 *       ],
 *       value: 'static',
 *       onChange: (value) => { ... },
 *   });
 */

import { Component } from '../Component.js';
import { bus } from '../../core/EventBus.js';

export class Select extends Component {
    static defaultProps = {
        label: '',
        placeholder: '请选择',
        options: [],     // [{value, label, disabled?, icon?}]
        value: null,
        multiple: false,
        size: 'md',      // sm | md | lg
        searchable: false,
        disabled: false,
        required: false,
        onChange: null,
    };

    static sizes = {
        sm: 'px-2 py-1 text-sm',
        md: 'px-3 py-2 text-sm',
        lg: 'px-4 py-3 text-base',
    };

    constructor(props = {}) {
        super({ ...Select.defaultProps, ...props });
        this.isOpen = false;
        this._query = '';
    }

    render() {
        const sizeClass = Select.sizes[this.props.size] || Select.sizes.md;
        const selected = this._getSelected();
        const displayText = this.props.multiple
            ? (selected.length ? `已选 ${selected.length} 项` : this.props.placeholder)
            : (selected ? selected.label : this.props.placeholder);

        return `
            <div class="relative" data-component="Select">
                ${this.props.label ? `
                    <label class="block text-sm font-medium text-slate-300 mb-1">
                        ${this.props.label}
                        ${this.props.required ? '<span class="text-red-400">*</span>' : ''}
                    </label>
                ` : ''}
                <button
                    type="button"
                    class="w-full flex items-center justify-between
                           bg-slate-900/50 border border-slate-700
                           hover:border-slate-600 focus:border-cyan-500/50
                           ${sizeClass} rounded-lg
                           text-slate-200
                           transition-colors
                           ${this.props.disabled ? 'opacity-50 cursor-not-allowed' : ''}"
                    ${this.props.disabled ? 'disabled' : ''}
                    data-toggle
                >
                    <span class="${selected ? '' : 'text-slate-500'} truncate">${displayText}</span>
                    <svg class="w-4 h-4 ml-2 transition-transform ${this.isOpen ? 'rotate-180' : ''}"
                         fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </button>
                ${this.isOpen ? `
                    <div class="absolute z-30 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                        ${this.props.searchable ? `
                            <div class="p-2 border-b border-slate-700">
                                <input
                                    type="text"
                                    placeholder="搜索..."
                                    class="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                                    data-search
                                >
                            </div>
                        ` : ''}
                        <div class="py-1" data-options>
                            ${this._renderOptions()}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    _renderOptions() {
        const filtered = this._filterOptions();

        if (filtered.length === 0) {
            return '<div class="px-3 py-2 text-sm text-slate-500 text-center">无匹配项</div>';
        }

        return filtered.map(opt => {
            const isSelected = this.props.multiple
                ? (Array.isArray(this.props.value) && this.props.value.includes(opt.value))
                : this.props.value === opt.value;

            return `
                <button
                    type="button"
                    class="w-full flex items-center justify-between px-3 py-2 text-sm text-left
                           hover:bg-slate-700/50 transition-colors
                           ${isSelected ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-200'}
                           ${opt.disabled ? 'opacity-50 cursor-not-allowed' : ''}"
                    data-value="${this._escape(opt.value)}"
                    ${opt.disabled ? 'disabled' : ''}
                >
                    <span class="flex items-center gap-2 truncate">
                        ${opt.icon ? `<span>${opt.icon}</span>` : ''}
                        ${opt.label}
                    </span>
                    ${isSelected ? `
                        <svg class="w-4 h-4 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clip-rule="evenodd"/>
                        </svg>
                    ` : ''}
                </button>
            `;
        }).join('');
    }

    _filterOptions() {
        if (!this._query) return this.props.options;
        const q = this._query.toLowerCase();
        return this.props.options.filter(o =>
            o.label.toLowerCase().includes(q) ||
            (o.value + '').toLowerCase().includes(q)
        );
    }

    _getSelected() {
        if (this.props.multiple) {
            return this.props.options.filter(o =>
                Array.isArray(this.props.value) && this.props.value.includes(o.value)
            );
        }
        return this.props.options.find(o => o.value === this.props.value);
    }

    _escape(str) {
        return (str + '').replace(/"/g, '&quot;');
    }

    onMount() {
        // 切换下拉
        this.element.querySelector('[data-toggle]').addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggle();
        });

        // 全局点击关闭
        this._docClickHandler = (e) => {
            if (this.isOpen && !this.element.contains(e.target)) {
                this._close();
            }
        };
        document.addEventListener('click', this._docClickHandler);

        // ESC 关闭
        this._escHandler = (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this._close();
            }
        };
        document.addEventListener('keydown', this._escHandler);

        // 搜索
        const searchEl = this.element.querySelector('[data-search]');
        if (searchEl) {
            searchEl.addEventListener('input', (e) => {
                this._query = e.target.value;
                this._refreshOptions();
            });
        }
    }

    _refreshOptions() {
        const optionsEl = this.element.querySelector('[data-options]');
        if (optionsEl) {
            optionsEl.innerHTML = this._renderOptions();
            this._bindOptions();
        }
    }

    _bindOptions() {
        this.element.querySelectorAll('[data-value]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = btn.dataset.value;
                this._select(value);
            });
        });
    }

    _toggle() {
        this.isOpen = !this.isOpen;
        this.update({});
        if (this.isOpen) {
            this._bindOptions();
        }
    }

    _open() {
        this.isOpen = true;
        this.update({});
        this._bindOptions();
    }

    _close() {
        this.isOpen = false;
        this._query = '';
        this.update({});
    }

    _select(value) {
        if (this.props.multiple) {
            const arr = Array.isArray(this.props.value) ? [...this.props.value] : [];
            const idx = arr.indexOf(value);
            if (idx >= 0) {
                arr.splice(idx, 1);
            } else {
                arr.push(value);
            }
            this.props.value = arr;
        } else {
            this.props.value = value;
            this._close();
        }

        if (this.props.onChange) {
            this.props.onChange(this.props.value, this);
        }
        bus.emit('select:change', { value: this.props.value, select: this });
        this.update({});
        if (this.props.multiple) {
            this._bindOptions();
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
        this.update({});
    }

    destroy() {
        document.removeEventListener('click', this._docClickHandler);
        document.removeEventListener('keydown', this._escHandler);
        super.destroy();
    }
}

export default Select;
