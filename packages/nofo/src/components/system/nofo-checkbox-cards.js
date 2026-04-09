import { NofoElement } from "../../index.js";

class NofoCheckboxCards extends NofoElement {
  static props = {
    value: [],
    defaultValue: [],
    columns: "1",
    gap: "3",
  };

  onMount() {
    this.sync().attr("columns").toDataAttr("columns");

    if (this.state.value.length === 0 && this.state.defaultValue.length > 0) {
      this.state.value = [...this.state.defaultValue];
    }

    this.effect(["value"], () => {
      this.updateCards();
    });
  }

  updateCards() {
    const cards = this.querySelectorAll("nofo-checkbox-cards-item");
    cards.forEach((card) => {
      card.state.selected = this.state.value.includes(card.state.value);
    });
  }

  handleCardClick(e) {
    const card = e.target.closest("nofo-checkbox-cards-item");
    if (!card || card.state.disabled) return;

    const val = card.state.value;
    if (!val) return;

    const currentValues = [...this.state.value];
    const isSelected = currentValues.includes(val);

    if (isSelected) {
      const idx = currentValues.indexOf(val);
      if (idx > -1) currentValues.splice(idx, 1);
    } else {
      currentValues.push(val);
    }

    this.state.value = currentValues;
    this.dispatchEvent(
      new CustomEvent("value-change", {
        detail: { value: currentValues },
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

class NofoCheckboxCardsItem extends NofoElement {
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

customElements.define("nofo-checkbox-cards", NofoCheckboxCards);
customElements.define("nofo-checkbox-cards-item", NofoCheckboxCardsItem);

export { NofoCheckboxCards, NofoCheckboxCardsItem };
