import { NofoElement } from "../../index.js";

class NofoSteps extends NofoElement {
  static props = {
    value: { type: String, reflect: true },
    defaultValue: { type: String },
    orientation: { type: String, reflect: true },
  };

  _value = null;

  onMount() {
    if (this.defaultValue) {
      this._value = this.defaultValue;
    }
    if (this.value) {
      this._value = this.value;
    }
    this.updateSteps();

    this.addEventListener("click", (e) => {
      const trigger = e.target.closest("nofo-steps-trigger");
      if (!trigger) return;

      const item = trigger.closest("nofo-steps-item");
      if (!item) return;

      const value = item.value;
      if (!value) return;

      const status = item.status;
      if (status === "pending") return;

      this._value = value;

      const event = new CustomEvent("value-change", {
        detail: { value },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(event);

      this.updateSteps();
    });
  }

  updateSteps() {
    const items = this.querySelectorAll("nofo-steps-item");
    let foundCurrent = false;

    items.forEach((item) => {
      const value = item.value;
      const status = item.status;

      if (value === this._value) {
        item.status = "current";
        foundCurrent = true;
      } else if (!foundCurrent) {
        item.status = "complete";
      } else {
        item.status = "pending";
      }
    });
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    const orientation = this.orientation || "horizontal";
    return `
      :host {
        display: flex;
        flex-direction: ${orientation === "vertical" ? "column" : "row"};
        width: 100%;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoStepsList extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    const steps = this.closest("nofo-steps");
    const orientation = steps ? steps.orientation || "horizontal" : "horizontal";
    return `
      :host {
        display: flex;
        flex-direction: ${orientation === "vertical" ? "column" : "row"};
        gap: 1rem;
        flex: 1;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoStepsItem extends NofoElement {
  static props = {
    value: { type: String, reflect: true },
    status: { type: String, reflect: true },
  };

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        position: relative;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoStepsTrigger extends NofoElement {
  template() {
    return `<div><slot></slot></div>`;
  }

  styles() {
    const item = this.closest("nofo-steps-item");
    const status = item ? item.status || "pending" : "pending";
    return `
      :host {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        cursor: ${status === "pending" ? "default" : "pointer"};
        padding: 0.5rem;
        border-radius: var(--radius);
        transition: all 0.2s;
        box-sizing: border-box;
      }
      ${status !== "pending" ? `:host(:hover) { background-color: var(--gray-2); }` : ""}
    `;
  }
}

class NofoStepsIndicator extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    const item = this.closest("nofo-steps-item");
    const status = item ? item.status || "pending" : "pending";

    const statusColors = {
      complete: { bg: "var(--green-9)", color: "var(--gray-1)" },
      current: { bg: "var(--accent-9)", color: "var(--gray-1)" },
      pending: { bg: "var(--gray-6)", color: "var(--gray-9)" },
    };
    const colors = statusColors[status] || statusColors.pending;

    return `
      :host {
        background-color: ${colors.bg};
        color: ${colors.color};
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 0.875rem;
        flex-shrink: 0;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoStepsTitle extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    const item = this.closest("nofo-steps-item");
    const status = item ? item.status || "pending" : "pending";
    return `
      :host {
        font-weight: ${status === "current" ? "600" : "400"};
        font-size: 0.875rem;
        color: ${status === "pending" ? "var(--gray-9)" : "var(--gray-12)"};
        display: block;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoStepsContent extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    const item = this.closest("nofo-steps-item");
    const status = item ? item.status || "pending" : "pending";
    return `
      :host {
        display: ${status === "current" ? "block" : "none"};
        padding: 1rem;
        margin-top: 0.5rem;
        box-sizing: border-box;
      }
    `;
  }
}

customElements.define("nofo-steps", NofoSteps);
customElements.define("nofo-steps-list", NofoStepsList);
customElements.define("nofo-steps-item", NofoStepsItem);
customElements.define("nofo-steps-trigger", NofoStepsTrigger);
customElements.define("nofo-steps-indicator", NofoStepsIndicator);
customElements.define("nofo-steps-title", NofoStepsTitle);
customElements.define("nofo-steps-content", NofoStepsContent);

export {
  NofoSteps,
  NofoStepsList,
  NofoStepsItem,
  NofoStepsTrigger,
  NofoStepsIndicator,
  NofoStepsTitle,
  NofoStepsContent,
};
