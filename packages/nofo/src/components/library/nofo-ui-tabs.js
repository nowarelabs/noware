import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUITabs extends NofoElement {
  static props = {
    value: null,
    defaultValue: null,
    orientation: "horizontal",
  };

  onMount() {
    this.sync()
      .attr("value")
      .toDataAttr("value")
      .attr("defaultValue")
      .toDataAttr("defaultValue")
      .attr("orientation")
      .toDataAttr("orientation");
  }

  template() {
    return `
      <nofo-tabs 
        value="${this.state.value || ""}" 
        defaultValue="${this.state.defaultValue || ""}"
        orientation="${this.state.orientation}"
      >
        <slot></slot>
      </nofo-tabs>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; width: 100%; }
      nofo-tabs { display: block; width: 100%; }
    `;
  }
}

class NofoUITabsList extends NofoElement {
  template() {
    return `
      <nofo-tabs-list>
        <slot></slot>
      </nofo-tabs-list>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-tabs-list {
        display: inline-flex;
        align-items: center;
        background-color: var(--nofo-ui-background-secondary);
        border-radius: var(--nofo-ui-radius);
        padding: var(--nofo-ui-spacing-sm);
        border: 1px solid var(--nofo-ui-border);
      }
    `;
  }
}

class NofoUITabsTrigger extends NofoElement {
  static props = {
    value: "",
    disabled: false,
  };

  onMount() {
    this.sync().attr("value").toDataAttr("value").attr("disabled").toDataAttr("disabled");
  }

  template() {
    return `
      <nofo-tabs-trigger value="${this.state.value}" ${this.state.disabled ? "disabled" : ""}>
        <slot></slot>
      </nofo-tabs-trigger>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-tabs-trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: var(--nofo-ui-spacing-sm) var(--nofo-ui-spacing-md);
        border-radius: calc(var(--nofo-ui-radius) * 0.5);
        font-size: var(--nofo-ui-font-size-sm);
        font-weight: 500;
        color: var(--nofo-ui-foreground-secondary);
        background-color: transparent;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      nofo-tabs-trigger:hover {
        color: var(--nofo-ui-foreground);
        background-color: var(--nofo-ui-hover);
      }
      nofo-tabs-trigger[data-state="active"] {
        color: var(--nofo-ui-foreground);
        background-color: var(--nofo-ui-background);
        box-shadow: var(--nofo-ui-shadow);
      }
      nofo-tabs-trigger[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
  }
}

class NofoUITabsContent extends NofoElement {
  static props = {
    value: "",
  };

  onMount() {
    this.sync().attr("value").toDataAttr("value");
  }

  template() {
    return `
      <nofo-tabs-content value="${this.state.value}">
        <slot></slot>
      </nofo-tabs-content>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host {
        display: block;
        margin-top: var(--nofo-ui-spacing-lg);
      }
      nofo-tabs-content {
        display: block;
        padding: var(--nofo-ui-spacing-lg);
        background-color: var(--nofo-ui-background-secondary);
        border-radius: var(--nofo-ui-radius);
        border: 1px solid var(--nofo-ui-border);
      }
    `;
  }
}

customElements.define("nofo-ui-tabs", NofoUITabs);
customElements.define("nofo-ui-tabs-list", NofoUITabsList);
customElements.define("nofo-ui-tabs-trigger", NofoUITabsTrigger);
customElements.define("nofo-ui-tabs-content", NofoUITabsContent);

export { NofoUITabs, NofoUITabsList, NofoUITabsTrigger, NofoUITabsContent };
