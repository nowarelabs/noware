import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIInputOTP extends NofoElement {
  static props = {
    value: "",
    length: 6,
    disabled: false,
  };

  #value = "";

  onMount() {
    this.sync()
      .attr("value")
      .toDataAttr("value")
      .attr("length")
      .toDataAttr("length")
      .attr("disabled")
      .toDataAttr("disabled");

    this.addEventListener("value-change", (e) => {
      this.#value = e.detail.value;
      this.setAttribute("value", this.#value);
    });
  }

  template() {
    return `
      <div class="otp-group">
        <slot></slot>
      </div>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: inline-flex; gap: var(--nofo-ui-spacing-sm); }
      .otp-group { display: flex; gap: var(--nofo-ui-spacing-sm); }
    `;
  }
}

class NofoUIInputOTPGroup extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: flex; gap: var(--nofo-ui-spacing-sm); }
    `;
  }
}

class NofoUIInputOTPInput extends NofoElement {
  static props = {
    index: 0,
    value: "",
    disabled: false,
  };

  onMount() {
    this.sync()
      .attr("index")
      .toDataAttr("index")
      .attr("value")
      .toDataAttr("value")
      .attr("disabled")
      .toDataAttr("disabled");
  }

  template() {
    const { value, disabled } = this.state;
    const index = this.getAttribute("index") || "0";
    return `
      <input 
        type="text" 
        inputmode="numeric" 
        pattern="[0-9]*" 
        maxlength="1"
        value="${value}"
        ?disabled="${disabled}"
        data-index="${index}"
      />
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      input {
        width: 3rem;
        height: 3rem;
        text-align: center;
        font-size: var(--nofo-ui-font-size-xl);
        font-weight: 600;
        font-family: var(--nofo-ui-font-family);
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        color: var(--nofo-ui-foreground);
        transition: all 0.2s ease;
      }
      input:focus {
        border-color: var(--nofo-ui-accent-primary);
        box-shadow: 0 0 0 3px var(--nofo-ui-focus);
        outline: none;
      }
      input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
  }
}

customElements.define("nofo-ui-input-otp", NofoUIInputOTP);
customElements.define("nofo-ui-input-otp-group", NofoUIInputOTPGroup);
customElements.define("nofo-ui-input-otp-input", NofoUIInputOTPInput);

export { NofoUIInputOTP, NofoUIInputOTPGroup, NofoUIInputOTPInput };
