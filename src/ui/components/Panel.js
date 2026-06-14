/**
 * Panel - 玻璃面板组件
 *
 * 用途: 统一的卡片容器, 支持标题、副标题、操作区
 *
 * 用法:
 *   const panel = new Panel({
 *       title: '设备信息',
 *       subtitle: '显示当前连接设备',
 *       actions: [{ label: '刷新', onClick: () => ... }],
 *   });
 *   panel.mount(container);
 *
 * 动态更新:
 *   panel.setActions([{ label: '断开', onClick: ... }]);
 *   panel.setContent('<p>新内容</p>');
 *   panel.setTitle('新标题');
 */

import { Component } from '../Component.js';

export class Panel extends Component {
    static defaultProps = {
        title: '',
        subtitle: '',
        actions: [],
        variant: 'default',  // default | success | warning | danger
        collapsible: false,
        initiallyCollapsed: false,
    };

    static variants = {
        default: 'border-slate-700/50',
        success: 'border-emerald-500/30',
        warning: 'border-amber-500/30',
        danger: 'border-red-500/30',
    };

    constructor(props = {}) {
        super({ ...Panel.defaultProps, ...props });
        this.collapsed = this.props.initiallyCollapsed;
    }

    render() {
        const borderClass = Panel.variants[this.props.variant] || Panel.variants.default;

        return `
            <section class="glass-panel ${borderClass} rounded-xl overflow-hidden" data-component="Panel">
                <div data-header-slot></div>
                <div class="p-4" data-content ${this.collapsed ? 'style="display:none"' : ''}>
                    ${this.props.content || ''}
                </div>
            </section>
        `;
    }

    onMount() {
        this._renderHeader();

        // 绑定折叠
        const toggle = this.element.querySelector('[data-toggle]');
        if (toggle) {
            toggle.addEventListener('click', () => this.toggle());
        }
    }

    /**
     * 渲染 header (标题 + 副标题 + 操作按钮)
     */
    _renderHeader() {
        const hasTitle = this.props.title || this.props.subtitle;
        const hasActions = this.props.actions && this.props.actions.length > 0;
        const slot = this.element.querySelector('[data-header-slot]');
        if (!slot) return;

        if (!hasTitle && !hasActions && !this.props.collapsible) {
            slot.innerHTML = '';
            return;
        }

        const actionsHtml = (this.props.actions || []).map((action, i) => {
            const variant = action.variant || 'default';
            const colorClass = {
                'default': 'bg-slate-800 hover:bg-slate-700 text-slate-300',
                'primary': 'bg-cyan-600 hover:bg-cyan-500 text-white',
                'danger': 'bg-rose-600 hover:bg-rose-500 text-white',
                'success': 'bg-emerald-600 hover:bg-emerald-500 text-white',
                'warning': 'bg-amber-600 hover:bg-amber-500 text-white',
            }[variant] || 'bg-slate-800 hover:bg-slate-700 text-slate-300';
            const disabledClass = action.disabled ? 'opacity-50 cursor-not-allowed' : '';
            const disabledAttr = action.disabled ? 'disabled' : '';
            return `<button class="px-3 py-1.5 text-sm rounded-lg ${colorClass} ${disabledClass} transition-colors" data-action-index="${i}" ${disabledAttr}>${action.label}</button>`;
        }).join('');

        slot.innerHTML = `
            <header class="flex items-center justify-between p-4 border-b border-slate-700/30">
                ${hasTitle ? `
                    <div>
                        ${this.props.title ? `<h3 class="text-lg font-semibold text-cyan-300">${this.props.title}</h3>` : ''}
                        ${this.props.subtitle ? `<p class="text-sm text-slate-400 mt-0.5">${this.props.subtitle}</p>` : ''}
                    </div>
                ` : '<div></div>'}
                <div class="flex items-center gap-2">
                    ${hasActions ? `<div class="flex gap-2">${actionsHtml}</div>` : ''}
                    ${this.props.collapsible ? `
                        <button class="ml-2 p-1 rounded hover:bg-slate-800 text-slate-400 transition-transform" data-toggle>
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            </header>
        `;

        // 重新绑定折叠
        const toggle = this.element.querySelector('[data-toggle]');
        if (toggle) {
            toggle.addEventListener('click', () => this.toggle());
        }

        // 绑定操作按钮
        this.element.querySelectorAll('[data-action-index]').forEach(btn => {
            const idx = parseInt(btn.dataset.actionIndex);
            const action = this.props.actions[idx];
            if (action && action.onClick && !action.disabled) {
                btn.addEventListener('click', () => action.onClick(this));
            }
        });
    }

    /**
     * 切换折叠
     */
    toggle() {
        this.collapsed = !this.collapsed;
        const content = this.element.querySelector('[data-content]');
        if (content) {
            content.style.display = this.collapsed ? 'none' : '';
        }
    }

    /**
     * 动态更新操作按钮列表
     * @param {Array} actions 新的 actions 数组
     */
    setActions(actions = []) {
        this.props.actions = actions;
        this._renderHeader();
    }

    /**
     * 动态更新标题
     * @param {string} title
     */
    setTitle(title) {
        this.props.title = title;
        this._renderHeader();
    }

    /**
     * 动态更新副标题
     * @param {string} subtitle
     */
    setSubtitle(subtitle) {
        this.props.subtitle = subtitle;
        this._renderHeader();
    }

    /**
     * 更新内容
     */
    setContent(html) {
        this.props.content = html;
        const content = this.element.querySelector('[data-content]');
        if (content) {
            content.innerHTML = html;
        }
    }
}

export default Panel;
