import { NofoElement } from "../../index.js";

class NofoNavigation extends NofoElement {
  static props = {
    orientation: "vertical",
  };

  onMount() {
    this.sync().attr("orientation").toDataAttr("orientation");
  }

  handleSubToggle(e) {
    const trigger = e.target.closest("nofo-nav-sub-trigger");
    if (!trigger) return;

    const sub = trigger.closest("nofo-nav-sub");
    if (!sub) return;

    const content = sub.querySelector("nofo-nav-sub-content");
    if (content) {
      content.state.open = !content.state.open;
    }
  }

  template() {
    return `
      <nav class="root" on-click="handleSubToggle">
        <slot></slot>
      </nav>
    `;
  }

  styles() {
    const { orientation } = this.state;
    return `
      :host { display: block; box-sizing: border-box; }
      .root {
        display: flex;
        flex-direction: ${orientation === "horizontal" ? "row" : "column"};
        gap: var(--space-2);
      }
    `;
  }
}

class NofoNavGroup extends NofoElement {
  static props = {
    label: "",
  };

  template() {
    const { label } = this.state;
    return `
      <div class="group-container" role="group" aria-label="${label}">
        ${label ? `<div class="label">${label}</div>` : ""}
        <slot></slot>
      </div>
    `;
  }

  styles() {
    return `
      :host { display: block; box-sizing: border-box; }
      .group-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .label {
        padding: 0.5rem 0.75rem;
        font-size: var(--font-size-1);
        font-weight: 600;
        color: var(--gray-10);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
    `;
  }
}

class NofoNavItem extends NofoElement {
  static props = {
    value: "",
    href: "#",
    active: false,
  };

  onMount() {
    this.sync().attr("active").toDataAttr("active");
  }

  template() {
    const { href } = this.state;
    return `
      <a href="${href}" class="item">
        <slot></slot>
      </a>
    `;
  }

  styles() {
    return `
      :host { display: block; box-sizing: border-box; }
      .item {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: 0.5rem 0.75rem;
        border-radius: var(--radius-2);
        text-decoration: none;
        color: var(--gray-11);
        font-size: var(--font-size-2);
        transition: all 0.2s ease;
      }
      :host([data-active]) .item {
        color: var(--accent-11);
        background-color: var(--accent-3);
        font-weight: 500;
      }
      :host(:hover:not([data-active])) .item {
        background-color: var(--gray-2);
      }
    `;
  }
}

class NofoNavSub extends NofoElement {
  template() {
    return `
      <div class="sub-container">
        <slot></slot>
      </div>
    `;
  }

  styles() {
    return `
      :host { display: block; box-sizing: border-box; }
      .sub-container {
        display: flex;
        flex-direction: column;
      }
    `;
  }
}

class NofoNavSubTrigger extends NofoElement {
  onMount() {
    const sub = this.closest("nofo-nav-sub");
    if (sub) {
      const content = sub.querySelector("nofo-nav-sub-content");
      if (content) {
        this.effect(() => {
          this.setAttribute("data-open", content.state.open ? "true" : "false");
        });
      }
    }
  }

  template() {
    return `
      <button type="button" class="trigger">
        <div class="content">
          <slot></slot>
        </div>
        <div class="chevron">
          <nofo-icon name="chevron-down" size="sm"></nofo-icon>
        </div>
      </button>
    `;
  }

  styles() {
    return `
      :host { display: block; box-sizing: border-box; }
      .trigger {
        all: unset;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
        padding: 0.5rem 0.75rem;
        border-radius: var(--radius-2);
        cursor: pointer;
        color: var(--gray-11);
        font-size: var(--font-size-2);
        width: 100%;
        transition: all 0.2s ease;
      }
      .trigger:hover { background-color: var(--gray-2); }
      .content { display: flex; align-items: center; gap: inherit; }
      .chevron { transition: transform 0.2s ease; }
      :host([data-open="true"]) .chevron { transform: rotate(180deg); }
    `;
  }
}

class NofoNavSubContent extends NofoElement {
  static props = {
    open: false,
  };

  onMount() {
    this.sync().attr("open").toDataAttr("open");
  }

  template() {
    return `
      <div class="content-wrapper">
        <slot></slot>
      </div>
    `;
  }

  styles() {
    return `
      :host { display: block; box-sizing: border-box; }
      .content-wrapper {
        display: none;
        flex-direction: column;
        gap: var(--space-1);
        padding-left: var(--space-4);
        margin-top: var(--space-1);
      }
      :host([data-open]) .content-wrapper { display: flex; }
    `;
  }
}

customElements.define("nofo-navigation", NofoNavigation);
customElements.define("nofo-nav-group", NofoNavGroup);
customElements.define("nofo-nav-item", NofoNavItem);
customElements.define("nofo-nav-sub", NofoNavSub);
customElements.define("nofo-nav-sub-trigger", NofoNavSubTrigger);
customElements.define("nofo-nav-sub-content", NofoNavSubContent);

export {
  NofoNavigation,
  NofoNavGroup,
  NofoNavItem,
  NofoNavSub,
  NofoNavSubTrigger,
  NofoNavSubContent,
};
