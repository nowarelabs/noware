import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUISelect extends NofoElement {
  static props = {
    value: null,
    defaultValue: null,
    disabled: false,
    name: null,
    required: false,
  };

  onMount() {
    this.sync()
      .attr("value")
      .toDataAttr("value")
      .attr("defaultValue")
      .toDataAttr("defaultValue")
      .attr("disabled")
      .toDataAttr("disabled")
      .attr("name")
      .toDataAttr("name")
      .attr("required")
      .toDataAttr("required");
  }

  template() {
    return `
      <nofo-select 
        value="${this.state.value || ""}" 
        defaultValue="${this.state.defaultValue || ""}"
        ${this.state.disabled ? "disabled" : ""}
        name="${this.state.name || ""}"
        ${this.state.required ? "required" : ""}
        variant="surface"
        size="2"
      >
        <slot></slot>
      </nofo-select>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; width: 100%; }
      nofo-select { display: block; width: 100%; }
      
      nofo-select-trigger {
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        color: var(--nofo-ui-foreground);
        font-family: var(--nofo-ui-font-family);
      }
      nofo-select-trigger:hover {
        border-color: var(--nofo-ui-accent-primary);
      }
      nofo-select-trigger:focus {
        border-color: var(--nofo-ui-accent-primary);
        box-shadow: 0 0 0 3px var(--nofo-ui-focus);
        outline: none;
      }
    `;
  }
}

class NofoUISelectTrigger extends NofoElement {
  template() {
    return `
      <nofo-select-trigger>
        <slot></slot>
      </nofo-select-trigger>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUISelectValue extends NofoElement {
  static props = {
    placeholder: "",
  };

  onMount() {
    this.sync().attr("placeholder").toDataAttr("placeholder");
  }

  template() {
    return `
      <nofo-select-value placeholder="${this.state.placeholder}">
        <slot></slot>
      </nofo-select-value>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUISelectContent extends NofoElement {
  template() {
    return `
      <nofo-select-content>
        <slot></slot>
      </nofo-select-content>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-select-content {
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        box-shadow: var(--nofo-ui-shadow-lg);
        color: var(--nofo-ui-foreground);
      }
    `;
  }
}

class NofoUISelectItem extends NofoElement {
  static props = {
    value: "",
    disabled: false,
  };

  onMount() {
    this.sync().attr("value").toDataAttr("value").attr("disabled").toDataAttr("disabled");
  }

  template() {
    return `
      <nofo-select-item value="${this.state.value}" ${this.state.disabled ? "disabled" : ""}>
        <slot></slot>
      </nofo-select-item>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-select-item {
        color: var(--nofo-ui-foreground);
        cursor: pointer;
      }
      nofo-select-item:hover {
        background-color: var(--nofo-ui-hover);
      }
      nofo-select-item[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
  }
}

customElements.define("nofo-ui-select", NofoUISelect);
customElements.define("nofo-ui-select-trigger", NofoUISelectTrigger);
customElements.define("nofo-ui-select-value", NofoUISelectValue);
customElements.define("nofo-ui-select-content", NofoUISelectContent);
customElements.define("nofo-ui-select-item", NofoUISelectItem);

export {
  NofoUISelect,
  NofoUISelectTrigger,
  NofoUISelectValue,
  NofoUISelectContent,
  NofoUISelectItem,
};
