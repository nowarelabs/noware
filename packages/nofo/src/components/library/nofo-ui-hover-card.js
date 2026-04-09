import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIHoverCard extends NofoElement {
  static props = {
    openDelay: 200,
    closeDelay: 300,
  };

  onMount() {
    this.sync()
      .attr("openDelay")
      .toDataAttr("open-delay")
      .attr("closeDelay")
      .toDataAttr("close-delay");
  }

  template() {
    return `
      <nofo-hover-card 
        open-delay="${this.state.openDelay}" 
        close-delay="${this.state.closeDelay}"
      >
        <slot></slot>
      </nofo-hover-card>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUIHoverCardTrigger extends NofoElement {
  template() {
    return `
      <nofo-hover-card-trigger>
        <slot></slot>
      </nofo-hover-card-trigger>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUIHoverCardContent extends NofoElement {
  template() {
    return `
      <nofo-hover-card-content>
        <slot></slot>
      </nofo-hover-card-content>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-hover-card-content {
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        box-shadow: var(--nofo-ui-shadow-lg);
        color: var(--nofo-ui-foreground);
        padding: var(--nofo-ui-spacing-lg);
        max-width: 20rem;
      }
    `;
  }
}

customElements.define("nofo-ui-hover-card", NofoUIHoverCard);
customElements.define("nofo-ui-hover-card-trigger", NofoUIHoverCardTrigger);
customElements.define("nofo-ui-hover-card-content", NofoUIHoverCardContent);

export { NofoUIHoverCard, NofoUIHoverCardTrigger, NofoUIHoverCardContent };
