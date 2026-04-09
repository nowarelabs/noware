import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIAccordion extends NofoElement {
  static props = {
    type: "single",
    value: null,
    defaultValue: null,
    collapsible: false,
  };

  onMount() {
    this.sync()
      .attr("type")
      .toDataAttr("type")
      .attr("value")
      .toDataAttr("value")
      .attr("defaultValue")
      .toDataAttr("defaultValue")
      .attr("collapsible")
      .toDataAttr("collapsible");
  }

  template() {
    return `
      <nofo-accordion 
        type="${this.state.type}" 
        value="${this.state.value || ""}" 
        defaultValue="${this.state.defaultValue || ""}"
        ${this.state.collapsible ? "collapsible" : ""}
      >
        <slot></slot>
      </nofo-accordion>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; width: 100%; }
      nofo-accordion { display: block; width: 100%; }
    `;
  }
}

class NofoUIAccordionItem extends NofoElement {
  static props = {
    value: "",
    disabled: false,
  };

  onMount() {
    this.sync().attr("value").toDataAttr("value").attr("disabled").toDataAttr("disabled");
  }

  template() {
    return `
      <nofo-accordion-item value="${this.state.value}" ${this.state.disabled ? "disabled" : ""}>
        <slot></slot>
      </nofo-accordion-item>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host {
        display: block;
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        margin-bottom: var(--nofo-ui-spacing-md);
      }
      nofo-accordion-item { display: block; }
    `;
  }
}

class NofoUIAccordionTrigger extends NofoElement {
  template() {
    return `
      <nofo-accordion-trigger>
        <slot></slot>
      </nofo-accordion-trigger>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-accordion-trigger {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: var(--nofo-ui-spacing-lg);
        font-size: var(--nofo-ui-font-size-base);
        font-weight: 500;
        color: var(--nofo-ui-foreground);
        background-color: transparent;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      nofo-accordion-trigger:hover {
        background-color: var(--nofo-ui-hover);
      }
      nofo-accordion-trigger[data-state="open"] {
        border-bottom: 1px solid var(--nofo-ui-border);
      }
    `;
  }
}

class NofoUIAccordionContent extends NofoElement {
  template() {
    return `
      <nofo-accordion-content>
        <slot></slot>
      </nofo-accordion-content>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-accordion-content {
        padding: var(--nofo-ui-spacing-lg);
        color: var(--nofo-ui-foreground-secondary);
        font-size: var(--nofo-ui-font-size-sm);
      }
    `;
  }
}

customElements.define("nofo-ui-accordion", NofoUIAccordion);
customElements.define("nofo-ui-accordion-item", NofoUIAccordionItem);
customElements.define("nofo-ui-accordion-trigger", NofoUIAccordionTrigger);
customElements.define("nofo-ui-accordion-content", NofoUIAccordionContent);

export { NofoUIAccordion, NofoUIAccordionItem, NofoUIAccordionTrigger, NofoUIAccordionContent };
