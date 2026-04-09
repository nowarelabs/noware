import { NofoElement } from "../../index.js";

class NofoTabNav extends NofoElement {
  static props = {
    size: "1",
  };

  onMount() {
    this.sync().attr("size").toDataAttr("size");
  }

  template() {
    return `
      <div class="root">
        <slot></slot>
      </div>
    `;
  }

  styles() {
    return `
      :host { display: block; box-sizing: border-box; }
      .root {
        display: flex;
        gap: var(--space-2);
        border-bottom: 1px solid var(--gray-6);
      }
    `;
  }
}

class NofoTabNavLink extends NofoElement {
  static props = {
    href: "#",
    active: false,
    disabled: false,
  };

  onMount() {
    this.sync().attr("active").toDataAttr("active").attr("disabled").toDataAttr("disabled");
  }

  template() {
    const { href, disabled } = this.state;
    return `
      <a href="${disabled ? "#" : href}" class="link" ${disabled ? 'aria-disabled="true"' : ""}>
        <slot></slot>
      </a>
    `;
  }

  styles() {
    return `
      :host { display: block; box-sizing: border-box; }
      .link {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: 0.5rem 1rem;
        border: none;
        background-color: transparent;
        color: var(--gray-11);
        border-bottom: 2px solid transparent;
        text-decoration: none;
        cursor: pointer;
        font-size: var(--font-size-2);
        transition: all 0.2s ease;
        margin-bottom: -1px;
      }
      :host([data-active]) .link {
        color: var(--accent-11);
        border-bottom-color: var(--accent-9);
        font-weight: 500;
      }
      :host(:hover:not([data-active]):not([data-disabled])) .link {
        color: var(--accent-11);
        background-color: var(--gray-2);
      }
      :host([data-disabled]) { opacity: 0.5; pointer-events: none; }
    `;
  }
}

customElements.define("nofo-tab-nav", NofoTabNav);
customElements.define("nofo-tab-nav-link", NofoTabNavLink);

export { NofoTabNav, NofoTabNavLink };
