import { NofoElement } from "../../index.js";

class NofoRadioCards extends NofoElement {
  static props = {
    value: null,
    defaultValue: null,
    columns: "1",
    gap: "3",
    size: "2",
  };

  onMount() {
    this.sync().attr("columns").toDataAttr("columns").attr("size").toDataAttr("size");

    if (!this.state.value && this.state.defaultValue) {
      this.state.value = this.state.defaultValue;
    }

    this.effect(["value"], () => {
      this.updateCards();
    });
  }

  updateCards() {
    const cards = this.querySelectorAll("nofo-radio-cards-item");
    cards.forEach((card) => {
      card.state.selected = card.state.value === this.state.value;
    });
  }

  handleCardClick(e) {
    const card = e.target.closest("nofo-radio-cards-item");
    if (!card || card.state.disabled) return;

    const newValue = card.state.value;
    if (newValue === this.state.value) return;

    this.state.value = newValue;
    this.dispatchEvent(
      new CustomEvent("value-change", {
        detail: { value: newValue },
        bubbles: true,
        composed: true,
      }),
    );
  }

  template() {
    return `
      <div class="root" on-click="handleCardClick">
        <slot></slot>
      </div>
    `;
  }

  styles() {
    const { columns, gap } = this.state;
    const spacingScale = {
      0: "0",
      1: "var(--space-1)",
      2: "var(--space-2)",
      3: "var(--space-3)",
      4: "var(--space-4)",
      5: "var(--space-5)",
      6: "var(--space-6)",
      7: "var(--space-7)",
      8: "var(--space-8)",
      9: "var(--space-9)",
    };
    const gapValue = spacingScale[gap] || spacingScale["3"];

    return `
      :host { display: block; box-sizing: border-box; }
      .root {
        display: grid;
        grid-template-columns: repeat(${columns}, 1fr);
        gap: ${gapValue};
      }
    `;
  }
}

class NofoRadioCardsItem extends NofoElement {
  static props = {
    value: "",
    selected: false,
    disabled: false,
  };

  onMount() {
    this.sync().attr("selected").toDataAttr("selected").attr("disabled").toDataAttr("disabled");
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: block;
        padding: var(--space-4);
        border-radius: var(--radius-3);
        border: 1px solid var(--gray-6);
        background-color: var(--color-panel-solid);
        cursor: pointer;
        transition: all 0.2s ease;
        box-sizing: border-box;
      }

      :host([data-selected]) {
        border: 2px solid var(--accent-9);
        background-color: var(--accent-3);
        padding: calc(var(--space-4) - 1px);
      }

      :host(:hover:not([data-disabled]):not([data-selected])) {
        border-color: var(--gray-8);
        background-color: var(--gray-2);
      }

      :host([data-disabled]) {
        cursor: not-allowed;
        opacity: 0.5;
      }
    `;
  }
}

customElements.define("nofo-radio-cards", NofoRadioCards);
customElements.define("nofo-radio-cards-item", NofoRadioCardsItem);

export { NofoRadioCards, NofoRadioCardsItem };
