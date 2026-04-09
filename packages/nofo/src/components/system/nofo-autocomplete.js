import { NofoElement } from "../../index.js";

class NofoAutocomplete extends NofoElement {
  static props = {
    value: "",
    defaultValue: "",
    options: "",
    placeholder: "",
    size: "2",
    variant: "surface",
    disabled: false,
    loading: false,
    multiple: false,
    open: false,
  };

  onMount() {
    const s = this.sync();
    s.attr("size").toDataAttr("size");
    s.attr("variant").toDataAttr("variant");
    s.attr("disabled").toDataAttr("disabled");
    s.attr("loading").toDataAttr("loading");
    s.attr("open").toDataAttr("state", (v) => (v ? "open" : "closed"));
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: inline-block;
        position: relative;
        width: 100%;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoAutocompleteInput extends NofoElement {
  static props = {
    value: "",
    placeholder: "",
    size: "2",
    variant: "surface",
    disabled: false,
    loading: false,
  };

  onMount() {
    const s = this.sync();
    s.attr("size").toDataAttr("size");
    s.attr("variant").toDataAttr("variant");
  }

  template() {
    const { placeholder, value, disabled, loading } = this.state;
    return `
      <input 
        type="text" 
        value="${value || ""}"
        placeholder="${placeholder || ""}"
        ?disabled="${disabled}"
        autocomplete="off"
      />
    `;
  }

  styles() {
    return `
      :host {
        display: block;
        position: relative;
        box-sizing: border-box;
        width: 100%;
      }
      input {
        display: block;
        width: 100%;
        height: 100%;
        border: 1px solid var(--gray-6);
        border-radius: var(--radius);
        padding: 0 0.75rem;
        font-size: 0.875rem;
        outline: none;
        transition: all 0.2s ease;
        box-sizing: border-box;
      }
      input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
  }
}

class NofoAutocompletePopover extends NofoElement {
  static props = {
    open: false,
  };

  onMount() {
    const s = this.sync();
    s.attr("open").toDataAttr("state", (v) => (v ? "open" : "closed"));
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        position: absolute;
        top: calc(100% + 5px);
        left: 0;
        right: 0;
        background-color: var(--color-panel-solid);
        border-radius: var(--radius);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        border: 1px solid var(--gray-6);
        z-index: 50;
        display: none;
        max-height: 300px;
        overflow-y: auto;
        box-sizing: border-box;
      }
      :host([data-state="open"]) {
        display: block;
      }
    `;
  }
}

class NofoAutocompleteList extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        flex-direction: column;
        padding: 0.5rem;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoAutocompleteItem extends NofoElement {
  static props = {
    value: "",
    disabled: false,
  };

  onMount() {
    const s = this.sync();
    s.attr("disabled").toDataAttr("disabled");
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        align-items: center;
        padding: 0.5rem 0.75rem;
        border-radius: 0.25rem;
        cursor: pointer;
        font-size: 0.875rem;
        line-height: 1.25rem;
        transition: all 0.15s;
        box-sizing: border-box;
      }
      :host([data-disabled]) {
        cursor: not-allowed;
        color: var(--gray-8);
      }
      :host(:not([data-disabled]):hover) {
        background-color: var(--gray-3);
      }
    `;
  }
}

class NofoAutocompleteEmpty extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        padding: 2rem;
        text-align: center;
        color: var(--gray-10);
        font-size: 0.875rem;
        box-sizing: border-box;
      }
    `;
  }
}

customElements.define("nofo-autocomplete", NofoAutocomplete);
customElements.define("nofo-autocomplete-input", NofoAutocompleteInput);
customElements.define("nofo-autocomplete-popover", NofoAutocompletePopover);
customElements.define("nofo-autocomplete-list", NofoAutocompleteList);
customElements.define("nofo-autocomplete-item", NofoAutocompleteItem);
customElements.define("nofo-autocomplete-empty", NofoAutocompleteEmpty);

export {
  NofoAutocomplete,
  NofoAutocompleteInput,
  NofoAutocompletePopover,
  NofoAutocompleteList,
  NofoAutocompleteItem,
  NofoAutocompleteEmpty,
};
