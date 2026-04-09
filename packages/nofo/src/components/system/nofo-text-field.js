import { NofoElement } from "../../index.js";

class NofoTextField extends NofoElement {
  static props = {
    value: "",
    defaultValue: "",
    placeholder: "",
    size: "2",
    variant: "surface",
    color: "accent",
    type: "text",
    disabled: false,
    readOnly: false,
    required: false,
    name: "",
    autoComplete: "",
    pattern: "",
    minLength: null,
    maxLength: null,
    min: null,
    max: null,
    step: null,
    error: "",
    invalid: false,
    helperText: "",
    label: "",
    description: "",
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
      .toDataAttr("disabled")
      .attr("invalid")
      .toDataAttr("invalid")
      .attr("error")
      .toDataAttr("invalid", (v) => !!v);

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
      type,
      name,
      autoComplete,
      pattern,
      minLength,
      maxLength,
      min,
      max,
      step,
      disabled,
      readOnly,
      required,
      placeholder,
      label,
      error,
      helperText,
      description,
      value,
    } = this.state;

    return `
      <div class="root">
        ${label ? `<label class="label">${label}</label>` : ""}
        <div class="field-wrapper">
          <div class="prefix"><slot name="prefix"></slot></div>
          <input 
            type="${type}" 
            name="${name}"
            autocomplete="${autoComplete}"
            pattern="${pattern}"
            minlength="${minLength || ""}"
            maxlength="${maxLength || ""}"
            min="${min || ""}"
            max="${max || ""}"
            step="${step || ""}"
            ?disabled="${disabled}"
            ?readonly="${readOnly}"
            ?required="${required}"
            placeholder="${placeholder}"
            .value="${value}"
            on-input="handleInput"
          />
          <div class="suffix"><slot name="suffix"></slot></div>
        </div>
        ${error ? `<div class="error-text">${error}</div>` : ""}
        ${helperText && !error ? `<div class="helper-text">${helperText}</div>` : ""}
        ${description ? `<div class="description">${description}</div>` : ""}
      </div>
    `;
  }

  styles() {
    return `
      :host { display: block; width: 100%; box-sizing: border-box; }
      .root { display: flex; flex-direction: column; width: 100%; }
      .field-wrapper { display: flex; align-items: center; position: relative; width: 100%; }
      
      input {
        flex: 1;
        width: 100%;
        box-sizing: border-box;
        border-radius: var(--radius);
        color: var(--gray-12);
        outline: none;
        transition: all 0.2s ease;
        padding: 0 0.75rem;
      }

      :host([data-size="1"]) input { height: 2rem; font-size: 0.875rem; }
      :host([data-size="2"]) input { height: 2.5rem; font-size: 1rem; }
      :host([data-size="3"]) input { height: 3rem; font-size: 1.125rem; }

      :host([data-variant="surface"]) input { background: var(--color-panel-solid); border: 1px solid var(--gray-6); }
      :host([data-variant="classic"]) input { background: var(--color-panel-solid); border: 2px solid var(--gray-6); }
      :host([data-variant="soft"]) input { background: var(--gray-2); border: 1px solid var(--gray-5); }
      :host([data-variant="ghost"]) input { background: transparent; border: none; }

      :host(:focus-within) input { border-color: var(--accent-9); box-shadow: 0 0 0 1px var(--accent-9); }
      :host([data-invalid]) input { border-color: var(--red-9); }
      :host([data-invalid]:focus-within) input { box-shadow: 0 0 0 1px var(--red-9); }

      .prefix, .suffix { position: absolute; top: 50%; transform: translateY(-50%); z-index: 1; pointer-events: none; }
      .prefix { left: 0.75rem; }
      .suffix { right: 0.75rem; }

      /* Inset adjustments when slots are used */
      .field-wrapper:has(slot[name="prefix"] ::slotted(*)) input { padding-left: 2.25rem; }
      .field-wrapper:has(slot[name="suffix"] ::slotted(*)) input { padding-right: 2.25rem; }

      .label { font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem; color: var(--gray-12); }
      .helper-text, .error-text, .description { font-size: 0.75rem; margin-top: 0.25rem; }
      .helper-text, .description { color: var(--gray-10); }
      .error-text { color: var(--red-9); }
    `;
  }
}

class NofoTextFieldSlot extends NofoElement {
  static props = { name: "" };
  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `:host { display: contents; }`;
  }
}

customElements.define("nofo-text-field", NofoTextField);
customElements.define("nofo-text-field-slot", NofoTextFieldSlot);
export { NofoTextField, NofoTextFieldSlot };
