import { NofoElement } from "../../index.js";

class NofoEmptyState extends NofoElement {
  onMount() {
    this.setAttribute("data-empty-state", "true");

    const styles = {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "3rem 1rem",
      textAlign: "center",
      gap: "1rem",
      boxSizing: "border-box",
    };
    return styles;
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 3rem 1rem;
        text-align: center;
        gap: 1rem;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoEmptyStateTitle extends NofoElement {
  onMount() {
    const styles = {
      fontSize: "1.25rem",
      fontWeight: "600",
      color: "var(--gray-11)",
      margin: 0,
      boxSizing: "border-box",
    };
    return styles;
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--gray-11);
        margin: 0;
        box-sizing: border-box;
        display: block;
      }
    `;
  }
}

class NofoEmptyStateDescription extends NofoElement {
  onMount() {
    const styles = {
      fontSize: "0.875rem",
      color: "var(--gray-10)",
      maxWidth: "400px",
      margin: 0,
      boxSizing: "border-box",
    };
    return styles;
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        font-size: 0.875rem;
        color: var(--gray-10);
        max-width: 400px;
        margin: 0;
        box-sizing: border-box;
        display: block;
      }
    `;
  }
}

customElements.define("nofo-empty-state", NofoEmptyState);
customElements.define("nofo-empty-state-title", NofoEmptyStateTitle);
customElements.define("nofo-empty-state-description", NofoEmptyStateDescription);

export { NofoEmptyState, NofoEmptyStateTitle, NofoEmptyStateDescription };
