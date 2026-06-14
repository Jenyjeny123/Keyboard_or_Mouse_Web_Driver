/**
 * Theme - 主题切换器
 *
 * 用途: 切换深色/浅色/自定义主题
 *
 * 用法:
 *   import { theme } from './Theme.js';
 *   theme.set('dark');
 *   theme.toggle();
 *   theme.onChange((newTheme) => { ... });
 */

import { bus } from '../../core/EventBus.js';
import { logger } from '../../core/Logger.js';

const STORAGE_KEY = 'swiftkey-theme';

const THEMES = {
    dark: {
        name: '深色',
        icon: '🌙',
        bg: 'bg-slate-900',
        text: 'text-slate-100',
        panel: 'bg-slate-800/50',
        border: 'border-slate-700/50',
        accent: 'text-cyan-400',
    },
    light: {
        name: '浅色',
        icon: '☀️',
        bg: 'bg-slate-50',
        text: 'text-slate-900',
        panel: 'bg-white',
        border: 'border-slate-200',
        accent: 'text-cyan-600',
    },
    midnight: {
        name: '午夜蓝',
        icon: '🌌',
        bg: 'bg-slate-950',
        text: 'text-slate-200',
        panel: 'bg-slate-900/80',
        border: 'border-blue-900/50',
        accent: 'text-blue-400',
    },
};

class ThemeManager {
    constructor() {
        this.current = 'dark';
        this.listeners = [];
        this._load();
    }

    /**
     * 加载保存的主题
     */
    _load() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && THEMES[saved]) {
                this.current = saved;
            }
        } catch (err) {
            logger.warn('加载主题失败: ' + err.message);
        }
    }

    /**
     * 保存主题
     */
    _save() {
        try {
            localStorage.setItem(STORAGE_KEY, this.current);
        } catch (err) {
            logger.warn('保存主题失败: ' + err.message);
        }
    }

    /**
     * 应用主题到 DOM
     */
    _apply() {
        const root = document.documentElement;
        const theme = THEMES[this.current];

        // 设置 data-theme 属性
        root.setAttribute('data-theme', this.current);

        // 移除旧主题类
        Object.keys(THEMES).forEach(key => {
            root.classList.remove(`theme-${key}`);
        });
        root.classList.add(`theme-${this.current}`);

        bus.emit('theme:changed', { theme: this.current, config: theme });
        logger.info(`主题已切换: ${theme.name}`);
    }

    /**
     * 设置主题
     */
    set(themeName) {
        if (!THEMES[themeName]) {
            logger.warn(`未知主题: ${themeName}`);
            return;
        }

        this.current = themeName;
        this._save();
        this._apply();
        this._notify();
    }

    /**
     * 切换到下一个主题
     */
    toggle() {
        const keys = Object.keys(THEMES);
        const idx = keys.indexOf(this.current);
        const next = keys[(idx + 1) % keys.length];
        this.set(next);
    }

    /**
     * 获取当前主题
     */
    get() {
        return this.current;
    }

    /**
     * 获取主题配置
     */
    getConfig() {
        return { ...THEMES[this.current] };
    }

    /**
     * 获取所有主题
     */
    getAll() {
        return Object.entries(THEMES).map(([key, value]) => ({
            id: key,
            ...value,
            active: key === this.current,
        }));
    }

    /**
     * 监听主题变化
     */
    onChange(callback) {
        this.listeners.push(callback);
        return () => {
            const idx = this.listeners.indexOf(callback);
            if (idx >= 0) this.listeners.splice(idx, 1);
        };
    }

    _notify() {
        this.listeners.forEach(cb => cb(this.current, this.getConfig()));
    }
}

// 单例
export const theme = new ThemeManager();

/**
 * 主题切换按钮组件
 */
export class ThemeToggle {
    /**
     * 渲染切换按钮
     */
    static render() {
        const all = theme.getAll();
        return `
            <div class="flex items-center gap-1" data-component="ThemeToggle">
                <button class="p-2 rounded-lg hover:bg-slate-800 transition-colors" data-toggle>
                    <span data-current-icon>${all.find(t => t.active).icon}</span>
                </button>
            </div>
        `;
    }

    /**
     * 绑定事件
     */
    static mount(parent) {
        const target = typeof parent === 'string'
            ? document.querySelector(parent)
            : parent;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = ThemeToggle.render().trim();
        const element = wrapper.firstElementChild;
        target.appendChild(element);

        const toggleBtn = element.querySelector('[data-toggle]');
        toggleBtn.addEventListener('click', () => {
            theme.toggle();
            const iconEl = element.querySelector('[data-current-icon]');
            const all = theme.getAll();
            iconEl.textContent = all.find(t => t.active).icon;
        });

        return element;
    }
}

export default theme;
