import { NofoElement } from "../../index.js";

class NofoAccordion extends NofoElement {
  static props = {
    type: "single",
    value: null,
    defaultValue: null,
    collapsible: false,
  };

  onMount() {
    this.sync().attr("type").toDataAttr("type");

    if (this.state.value === null && this.state.defaultValue !== null) {
      this.state.value = this.state.defaultValue;
    }

    if (this.state.type === "multiple" && !Array.isArray(this.state.value)) {
      this.state.value = this.state.value ? [this.state.value] : [];
    }

    this.addEventListener("nofo-accordion-select", (e) => {
      const { value } = e.detail;
      const { type, collapsible } = this.state;

      if (type === "single") {
        const isCurrent = this.state.value === value;
        if (isCurrent && collapsible) {
          this.state.value = null;
        } else if (!isCurrent) {
          this.state.value = value;
        }
      } else {
        const values = Array.isArray(this.state.value) ? [...this.state.value] : [];
        const index = values.indexOf(value);
        if (index > -1 && collapsible) {
          values.splice(index, 1);
        } else if (index === -1) {
          values.push(value);
        }
        this.state.value = values;
      }

      this.dispatchEvent(
        new CustomEvent("value-change", {
          detail: { value: this.state.value },
          bubbles: true,
          composed: true,
        }),
      );
    });
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        width: 100%;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoAccordionItem extends NofoElement {
  static props = {
    value: null,
  };

  onMount() {
    const accordion = this.closest("nofo-accordion");
    if (accordion) {
      this.effect(() => {
        const parentValue = accordion.state.value;
        const type = accordion.state.type;
        const isOpen =
          type === "single"
            ? parentValue === this.state.value
            : Array.isArray(parentValue) && parentValue.includes(this.state.value);

        this.setAttribute("data-state", isOpen ? "open" : "closed");
      });
    }
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        flex-direction: column;
        border: 1px solid var(--gray-6);
        border-radius: var(--radius);
        overflow: hidden;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoAccordionTrigger extends NofoElement {
  onMount() {
    const item = this.closest("nofo-accordion-item");
    if (item) {
      this.effect(() => {
        const isOpen = item.getAttribute("data-state") === "open";
        this.setAttribute("data-state", isOpen ? "open" : "closed");
      });
    }
  }

  handleClick() {
    const item = this.closest("nofo-accordion-item");
    if (item) {
      this.dispatchEvent(
        new CustomEvent("nofo-accordion-select", {
          detail: { value: item.state.value },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  template() {
    return `
      <button type="button" on-click="handleClick">
        <slot></slot>
      </button>
    `;
  }

  styles() {
    return `
      :host {
        display: block;
        box-sizing: border-box;
      }
      button {
        all: unset;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem;
        background-color: transparent;
        cursor: pointer;
        width: 100%;
        text-align: left;
        transition: background-color 0.2s;
        box-sizing: border-box;
      }
      button:hover {
        background-color: var(--gray-2);
      }
      
      ::slotted(nofo-icon) {
        transition: transform 0.2s ease;
      }
      :host([data-state="open"]) ::slotted(nofo-icon) {
        transform: rotate(180deg);
      }
    `;
  }
}

class NofoAccordionContent extends NofoElement {
  onMount() {
    const item = this.closest("nofo-accordion-item");
    if (item) {
      this.effect(() => {
        const isOpen = item.getAttribute("data-state") === "open";
        this.setAttribute("data-state", isOpen ? "open" : "closed");
      });
    }
  }

  template() {
    return `
      <div class="content-inner">
        <slot></slot>
      </div>
    `;
  }

  styles() {
    return `
      :host {
        display: none;
        overflow: hidden;
        box-sizing: border-box;
      }
      :host([data-state="open"]) {
        display: block;
      }
      .content-inner {
        padding: 0 1rem 1rem 1rem;
      }
    `;
  }
}

customElements.define("nofo-accordion", NofoAccordion);
customElements.define("nofo-accordion-item", NofoAccordionItem);
customElements.define("nofo-accordion-trigger", NofoAccordionTrigger);
customElements.define("nofo-accordion-content", NofoAccordionContent);

export { NofoAccordion, NofoAccordionItem, NofoAccordionTrigger, NofoAccordionContent };
