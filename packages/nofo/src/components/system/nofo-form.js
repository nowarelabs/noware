import { NofoElement } from "../../index.js";

class NofoForm extends NofoElement {
  static props = {
    onSubmit: { type: Function, default: null },
  };

  onMount() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    const form = this.shadowRoot.querySelector("form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();

        const event = new CustomEvent("form-submit", {
          detail: { formData: new FormData(form) },
          bubbles: true,
          composed: true,
        });
        this.dispatchEvent(event);

        if (this.props.onSubmit) {
          this.props.onSubmit(new FormData(form));
        }
      });
    }
  }

  template() {
    return `
      <form>
        <slot></slot>
      </form>
    `;
  }

  styles() {
    return `
      :host {
        display: block;
        box-sizing: border-box;
      }
    `;
  }
}

customElements.define("nofo-form", NofoForm);
export { NofoForm };
