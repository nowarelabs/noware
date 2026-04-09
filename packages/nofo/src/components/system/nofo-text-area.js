import { NofoElement } from "../../index.js";

class NofoTextArea extends NofoElement {
  static props = {
    value: "",
    defaultValue: "",
    placeholder: "",
    size: "2",
    variant: "surface",
    color: "accent",
    resize: "vertical",
    rows: "4",
    cols: "",
    minLength: null,
    maxLength: null,
    disabled: false,
    readOnly: false,
    required: false,
    name: "",
    autoComplete: "off",
    spellCheck: false,
  };

  onMount() {
    this.sync()
      .attr("size")
      .toDataAttr("size")
      .attr("variant")
      .toDataAttr("variant")
      .attr("color")
      .toDataAttr("color")
      .attr("disabled")
      .toDataAttr("disabled");

    if (this.defaultValue && !this.value) {
      this.state.value = this.defaultValue;
    }
  }

  handleInput(e) {
    this.state.value = e.target.value;
    this.dispatchEvent(
      new CustomEvent("value-change", {
        detail: { value: this.state.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  template() {
    const {
      name,
      autoComplete,
      rows,
      cols,
      minLength,
      maxLength,
      disabled,
      readOnly,
      required,
      placeholder,
      spellCheck,
      value,
      resize,
    } = this.state;

    return `
      <textarea 
        name="${name}"
        autocomplete="${autoComplete}"
        rows="${rows}"
        cols="${cols || ""}"
        minlength="${minLength || ""}"
        maxlength="${maxLength || ""}"
        ?disabled="${disabled}"
        ?readonly="${readOnly}"
        ?required="${required}"
        placeholder="${placeholder}"
        ?spellcheck="${spellCheck}"
        .value="${value}"
        on-input="handleInput"
        style="resize: ${resize};"
      ></textarea>
    `;
  }

  styles() {
    return `
      :host { display: block; width: 100%; box-sizing: border-box; }
      textarea {
        width: 100%;
        box-sizing: border-box;
        border-radius: var(--radius);
        color: var(--gray-12);
        outline: none;
        transition: all 0.2s ease;
        font-family: inherit;
        line-height: 1.5;
      }

      :host([data-size="1"]) textarea { font-size: 0.875rem; padding: 0.5rem; }
      :host([data-size="2"]) textarea { font-size: 1rem; padding: 0.75rem; }
      :host([data-size="3"]) textarea { font-size: 1.125rem; padding: 1rem; }

      :host([data-variant="surface"]) textarea { background: var(--color-panel-solid); border: 1px solid var(--gray-6); }
      :host([data-variant="classic"]) textarea { background: var(--color-panel-solid); border: 2px solid var(--gray-6); }
      :host([data-variant="soft"]) textarea { background: var(--gray-2); border: 1px solid var(--gray-5); }
      :host([data-variant="ghost"]) textarea { background: transparent; border: none; }

      :host(:focus-within) textarea { border-color: var(--accent-9); box-shadow: 0 0 0 1px var(--accent-9); }
    `;
  }
}

customElements.define("nofo-text-area", NofoTextArea);
export { NofoTextArea };
