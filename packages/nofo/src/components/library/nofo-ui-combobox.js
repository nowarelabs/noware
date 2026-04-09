import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUICombobox extends NofoElement {
  static props = {
    value: null,
    defaultValue: null,
    options: null,
    placeholder: null,
    disabled: false,
    loading: false,
    multiple: false,
  };

  onMount() {
    this.sync()
      .attr("value")
      .toDataAttr("value")
      .attr("defaultValue")
      .toDataAttr("defaultValue")
      .attr("options")
      .toDataAttr("options")
      .attr("placeholder")
      .toDataAttr("placeholder")
      .attr("disabled")
      .toDataAttr("disabled")
      .attr("loading")
      .toDataAttr("loading")
      .attr("multiple")
      .toDataAttr("multiple");
  }

  template() {
    return `
      <nofo-autocomplete 
        variant="surface" 
        size="2"
        value="${this.state.value || ""}"
        defaultValue="${this.state.defaultValue || ""}"
        options="${this.state.options || ""}"
        placeholder="${this.state.placeholder || ""}"
        ?disabled="${this.state.disabled}"
        ?loading="${this.state.loading}"
        ?multiple="${this.state.multiple}"
      >
        <slot></slot>
      </nofo-autocomplete>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; width: 100%; }
      nofo-autocomplete { display: block; width: 100%; }
    `;
  }
}

class NofoUIComboboxInput extends NofoElement {
  template() {
    return `
      <nofo-autocomplete-input>
        <slot></slot>
      </nofo-autocomplete-input>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUIComboboxPopover extends NofoElement {
  template() {
    return `
      <nofo-autocomplete-popover>
        <slot></slot>
      </nofo-autocomplete-popover>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-autocomplete-popover {
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        box-shadow: var(--nofo-ui-shadow-lg);
      }
    `;
  }
}

class NofoUIComboboxList extends NofoElement {
  template() {
    return `
      <nofo-autocomplete-list>
        <slot></slot>
      </nofo-autocomplete-list>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUIComboboxItem extends NofoElement {
  static props = {
    value: "",
    disabled: false,
  };

  onMount() {
    this.sync().attr("value").toDataAttr("value").attr("disabled").toDataAttr("disabled");
  }

  template() {
    return `
      <nofo-autocomplete-item value="${this.state.value}" ?disabled="${this.state.disabled}">
        <slot></slot>
      </nofo-autocomplete-item>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-autocomplete-item {
        padding: var(--nofo-ui-spacing-sm) var(--nofo-ui-spacing-md);
        color: var(--nofo-ui-foreground);
        cursor: pointer;
        transition: background-color 0.15s ease;
      }
      nofo-autocomplete-item:hover {
        background-color: var(--nofo-ui-hover);
      }
      nofo-autocomplete-item[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
  }
}

class NofoUIComboboxEmpty extends NofoElement {
  template() {
    return `
      <nofo-autocomplete-empty>
        <slot></slot>
      </nofo-autocomplete-empty>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; padding: var(--nofo-ui-spacing-xl); text-align: center; color: var(--nofo-ui-foreground-secondary); font-size: var(--nofo-ui-font-size-sm); }
      nofo-autocomplete-empty { display: block; }
    `;
  }
}

customElements.define("nofo-ui-combobox", NofoUICombobox);
customElements.define("nofo-ui-combobox-input", NofoUIComboboxInput);
customElements.define("nofo-ui-combobox-popover", NofoUIComboboxPopover);
customElements.define("nofo-ui-combobox-list", NofoUIComboboxList);
customElements.define("nofo-ui-combobox-item", NofoUIComboboxItem);
customElements.define("nofo-ui-combobox-empty", NofoUIComboboxEmpty);

export {
  NofoUICombobox,
  NofoUIComboboxInput,
  NofoUIComboboxPopover,
  NofoUIComboboxList,
  NofoUIComboboxItem,
  NofoUIComboboxEmpty,
};
