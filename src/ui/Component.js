/**
 * Component - UI 组件基类
 *
 * 设计原则:
 *   - 简单的生命周期管理
 *   - 模板字符串渲染
 *   - props/state 分离
 *
 * 用法:
 *   class MyComponent extends Component {
 *       render() { return `<div>...</div>`; }
 *       onMount() { this.bindEvents(); }
 *   }
 */

export class Component {
    /**
     * @param {object} props - 组件配置
     */
    constructor(props = {}) {
        this.props = props;
        this.element = null;
        this.children = [];
    }

    /**
     * 渲染 HTML (子类必须实现)
     */
    render() {
        throw new Error('Component must implement render()');
    }

    /**
     * 挂载到父元素
     * @param {HTMLElement|string} parent
     */
    mount(parent) {
        const target = typeof parent === 'string'
            ? document.querySelector(parent)
            : parent;

        if (!target) {
            throw new Error('Parent element not found');
        }

        const html = this.render();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html.trim();
        this.element = wrapper.firstElementChild;

        target.appendChild(this.element);
        this.onMount();
        return this.element;
    }

    /**
     * 挂载后的回调 (子类可重写)
     */
    onMount() {
        // 子类实现
    }

    /**
     * 更新 props
     */
    update(newProps) {
        this.props = { ...this.props, ...newProps };
        if (this.element) {
            const newHtml = this.render();
            const wrapper = document.createElement('div');
            wrapper.innerHTML = newHtml.trim();
            const newElement = wrapper.firstElementChild;
            this.element.replaceWith(newElement);
            this.element = newElement;
            this.onMount();
        }
    }

    /**
     * 销毁组件
     */
    destroy() {
        this.children.forEach(c => c.destroy());
        this.children = [];
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
            this.element = null;
        }
    }

    /**
     * 查找内部元素
     */
    $(selector) {
        return this.element ? this.element.querySelector(selector) : null;
    }

    /**
     * 查找所有内部元素
     */
    $$(selector) {
        return this.element ? Array.from(this.element.querySelectorAll(selector)) : [];
    }
}

export default Component;
