import { NofoElement } from "../../index.js";

class NofoList extends NofoElement {
  static props = {
    size: { type: String, default: "2" },
    variant: { type: String, default: "default" },
  };

  onMount() {
    this.sync();
  }

  sync() {
    const size = this.props.size || "2";
    const variant = this.props.variant || "default";

    this.dataset.size = size;
    this.dataset.variant = variant;
  }

  template() {
    const styles = {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-1)",
    };

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    return `
      <style>
        :host {
          ${styleString}
          box-sizing: border-box;
        }
      </style>
      <slot></slot>
    `;
  }

  styles() {
    return ``;
  }
}

class NofoListItem extends NofoElement {
  static props = {
    selected: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  };

  onMount() {
    this.sync();
  }

  sync() {
    const selected = this.props.selected;
    const disabled = this.props.disabled;

    if (selected) {
      this.dataset.selected = "";
    } else {
      this.removeAttribute("data-selected");
    }

    if (disabled) {
      this.dataset.disabled = "";
    } else {
      this.removeAttribute("data-disabled");
    }
  }

  template() {
    const list = this.closest("nofo-list");
    const size = list ? list.props?.size || "2" : "2";
    const selected = this.props.selected;
    const disabled = this.props.disabled;

    const sizeStyles = {
      1: { padding: "0.5rem" },
      2: { padding: "0.75rem" },
      3: { padding: "1rem" },
    }[size] || { padding: "0.75rem" };

    const styles = {
      ...sizeStyles,
      display: "flex",
      alignItems: "center",
      gap: "var(--space-3)",
      borderRadius: "var(--radius)",
      backgroundColor: selected ? "var(--accent-3)" : "transparent",
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "all 0.2s",
      opacity: disabled ? "0.5" : "1",
    };

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    const hoverStyle =
      !disabled && !selected
        ? `
      :host(:hover) {
        background-color: var(--gray-2);
      }
    `
        : "";

    return `
      <style>
        :host {
          ${styleString}
          box-sizing: border-box;
        }
        ${hoverStyle}
      </style>
      <slot></slot>
    `;
  }

  styles() {
    return ``;
  }
}

class NofoListItemIcon extends NofoElement {
  static props = {};

  onMount() {
    this.render();
  }

  template() {
    const styles = {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      color: "var(--gray-10)",
    };

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    return `
      <style>
        :host {
          ${styleString}
          box-sizing: border-box;
        }
      </style>
      <slot></slot>
    `;
  }

  styles() {
    return ``;
  }
}

class NofoListItemContent extends NofoElement {
  static props = {};

  onMount() {
    this.render();
  }

  template() {
    const styles = {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-1)",
      minWidth: 0,
    };

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    return `
      <style>
        :host {
          ${styleString}
          box-sizing: border-box;
        }
      </style>
      <slot></slot>
    `;
  }

  styles() {
    return ``;
  }
}

class NofoListItemTitle extends NofoElement {
  static props = {};

  onMount() {
    this.render();
  }

  template() {
    const styles = {
      fontSize: "0.875rem",
      fontWeight: "500",
      color: "var(--gray-12)",
      margin: 0,
    };

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    return `
      <style>
        :host {
          ${styleString}
          box-sizing: border-box;
          display: block;
        }
      </style>
      <slot></slot>
    `;
  }

  styles() {
    return ``;
  }
}

class NofoListItemDescription extends NofoElement {
  static props = {};

  onMount() {
    this.render();
  }

  template() {
    const styles = {
      fontSize: "0.75rem",
      color: "var(--gray-10)",
      margin: 0,
    };

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    return `
      <style>
        :host {
          ${styleString}
          box-sizing: border-box;
          display: block;
        }
      </style>
      <slot></slot>
    `;
  }

  styles() {
    return ``;
  }
}

class NofoListItemAction extends NofoElement {
  static props = {};

  onMount() {
    this.render();
  }

  template() {
    const styles = {
      display: "flex",
      alignItems: "center",
      flexShrink: 0,
      marginLeft: "auto",
    };

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    return `
      <style>
        :host {
          ${styleString}
          box-sizing: border-box;
        }
      </style>
      <slot></slot>
    `;
  }

  styles() {
    return ``;
  }
}

customElements.define("nofo-list", NofoList);
customElements.define("nofo-list-item", NofoListItem);
customElements.define("nofo-list-item-icon", NofoListItemIcon);
customElements.define("nofo-list-item-content", NofoListItemContent);
customElements.define("nofo-list-item-title", NofoListItemTitle);
customElements.define("nofo-list-item-description", NofoListItemDescription);
customElements.define("nofo-list-item-action", NofoListItemAction);
export {
  NofoList,
  NofoListItem,
  NofoListItemIcon,
  NofoListItemContent,
  NofoListItemTitle,
  NofoListItemDescription,
  NofoListItemAction,
};
