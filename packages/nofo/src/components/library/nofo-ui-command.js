import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUICommand extends NofoElement {
  static props = {
    open: false,
  };

  onMount() {
    this.sync().attr("open").toDataAttr("open");
  }

  template() {
    return `
      <nofo-command-menu ?open="${this.state.open}">
        <slot></slot>
      </nofo-command-menu>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUICommandTrigger extends NofoElement {
  template() {
    return `
      <nofo-command-menu-trigger>
        <slot></slot>
      </nofo-command-menu-trigger>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUICommandContent extends NofoElement {
  template() {
    return `
      <nofo-command-menu-content>
        <slot></slot>
      </nofo-command-menu-content>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-command-menu-content {
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        box-shadow: var(--nofo-ui-shadow-xl);
        color: var(--nofo-ui-foreground);
        max-width: 32rem;
        width: 100%;
      }
    `;
  }
}

class NofoUICommandInput extends NofoElement {
  static props = {
    placeholder: "",
  };

  onMount() {
    this.sync().attr("placeholder").toDataAttr("placeholder");
  }

  template() {
    return `
      <nofo-command-menu-input placeholder="${this.state.placeholder}"></nofo-command-menu-input>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-command-menu-input {
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        color: var(--nofo-ui-foreground);
        font-family: var(--nofo-ui-font-family);
        padding: var(--nofo-ui-spacing-md);
        width: 100%;
      }
      nofo-command-menu-input:focus {
        border-color: var(--nofo-ui-accent-primary);
        outline: none;
      }
    `;
  }
}

class NofoUICommandList extends NofoElement {
  template() {
    return `
      <nofo-command-menu-list>
        <slot></slot>
      </nofo-command-menu-list>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUICommandGroup extends NofoElement {
  static props = {
    heading: "",
  };

  onMount() {
    this.sync().attr("heading").toDataAttr("heading");
  }

  template() {
    return `
      <nofo-command-menu-group heading="${this.state.heading}">
        <slot></slot>
      </nofo-command-menu-group>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-command-menu-group {
        display: flex;
        flex-direction: column;
        gap: var(--nofo-ui-spacing-sm);
      }
    `;
  }
}

class NofoUICommandItem extends NofoElement {
  static props = {
    value: "",
    disabled: false,
  };

  onMount() {
    this.sync().attr("value").toDataAttr("value").attr("disabled").toDataAttr("disabled");
  }

  template() {
    return `
      <nofo-command-menu-item value="${this.state.value}" ?disabled="${this.state.disabled}">
        <slot></slot>
      </nofo-command-menu-item>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-command-menu-item {
        display: flex;
        align-items: center;
        padding: var(--nofo-ui-spacing-sm) var(--nofo-ui-spacing-md);
        border-radius: calc(var(--nofo-ui-radius) * 0.5);
        color: var(--nofo-ui-foreground);
        font-size: var(--nofo-ui-font-size-sm);
        cursor: pointer;
        transition: background-color 0.15s ease;
      }
      nofo-command-menu-item:hover {
        background-color: var(--nofo-ui-hover);
      }
      nofo-command-menu-item[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
  }
}

class NofoUICommandEmpty extends NofoElement {
  template() {
    return `
      <nofo-command-menu-empty>
        <slot></slot>
      </nofo-command-menu-empty>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; padding: var(--nofo-ui-spacing-xl); text-align: center; color: var(--nofo-ui-foreground-secondary); font-size: var(--nofo-ui-font-size-sm); }
      nofo-command-menu-empty { display: block; }
    `;
  }
}

customElements.define("nofo-ui-command", NofoUICommand);
customElements.define("nofo-ui-command-trigger", NofoUICommandTrigger);
customElements.define("nofo-ui-command-content", NofoUICommandContent);
customElements.define("nofo-ui-command-input", NofoUICommandInput);
customElements.define("nofo-ui-command-list", NofoUICommandList);
customElements.define("nofo-ui-command-group", NofoUICommandGroup);
customElements.define("nofo-ui-command-item", NofoUICommandItem);
customElements.define("nofo-ui-command-empty", NofoUICommandEmpty);

export {
  NofoUICommand,
  NofoUICommandTrigger,
  NofoUICommandContent,
  NofoUICommandInput,
  NofoUICommandList,
  NofoUICommandGroup,
  NofoUICommandItem,
  NofoUICommandEmpty,
};
