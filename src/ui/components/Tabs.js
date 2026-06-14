/**
 * Tabs - 标签页组件
 *
 * 用途: 标签页 / 侧边栏导航切换
 *
 * 用法:
 *   const tabs = new Tabs({
 *       tabs: [
 *           { id: 'lighting', label: '灯光', icon: '💡' },
 *           { id: 'keymap', label: '按键', icon: '⌨️' },
 *       ],
 *       active: 'lighting',
 *       variant: 'default',  // default | pills | underline | vertical
 *       onChange: (tabId) => { ... },
 *   });
 *   tabs.mount(container);
 */

import { Component } from '../Component.js';
import { bus } from '../../core/EventBus.js';

export class Tabs extends Component {
    static defaultProps = {
        tabs: [],
        active: null,
        variant: 'default',  // default | pills | underline | vertical
        onChange: null,
    };

    static variants = {
        default: {
            container: 'flex gap-1 border-b border-slate-700/30',
            button: 'flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all',
            active: 'bg-cyan-500/10 text-cyan-300 border-b-2 border-cyan-500',
            inactive: 'text-slate-400 hover:text-white hover:bg-slate-800/50',
        },
        pills: {
            container: 'flex gap-1',
            button: 'flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
            active: 'bg-cyan-500/20 text-cyan-300',
            inactive: 'text-slate-400 hover:text-white hover:bg-slate-800/50',
        },
        underline: {
            container: 'flex gap-4 border-b border-slate-700',
            button: 'flex items-center gap-2 px-2 py-2 transition-all',
            active: 'text-cyan-400 border-b-2 border-cyan-400',
            inactive: 'text-slate-400 hover:text-white',
        },
        vertical: {
            container: 'flex flex-col gap-2',
            button: 'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left',
            active: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
            inactive: 'text-slate-400 hover:bg-slate-800/50 hover:text-white',
        },
    };

    constructor(props = {}) {
        super({ ...Tabs.defaultProps, ...props });
        this.active = this.props.active || (this.props.tabs[0] && this.props.tabs[0].id);
    }

    render() {
        const variant = Tabs.variants[this.props.variant] || Tabs.variants.default;
        const isVertical = this.props.variant === 'vertical';

        const tabsHtml = this.props.tabs.map(tab => {
            const isActive = tab.id === this.active;
            const activeClass = isActive ? variant.active : variant.inactive;
            const justifyClass = isVertical ? 'justify-start' : '';
            const wClass = isVertical ? 'w-full' : '';

            return `
                <button
                    class="${wClass} ${variant.button} ${activeClass} ${justifyClass}"
                    data-tab-id="${tab.id}"
                >
                    ${tab.icon ? `<span>${tab.icon}</span>` : ''}
                    <span>${tab.label}</span>
                    ${tab.badge ? `<span class="ml-1 px-2 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-300">${tab.badge}</span>` : ''}
                </button>
            `;
        }).join('');

        return `
            <div class="${variant.container}" data-component="Tabs" data-variant="${this.props.variant}" role="tablist">
                ${tabsHtml}
            </div>
        `;
    }

    onMount() {
        this.element.querySelectorAll('[data-tab-id]').forEach(btn => {
            btn.addEventListener('click', () => this._handleClick(btn.dataset.tabId));
        });
    }

    _handleClick(tabId) {
        this.active = tabId;
        this.update({});
        if (this.props.onChange) {
            this.props.onChange(tabId);
        }
        bus.emit('tabs:changed', { active: tabId, tabs: this });
    }

    setActive(tabId) {
        this._handleClick(tabId);
    }
}

export default Tabs;
