import { NofoElement } from "../../index.js";

class NofoTimeline extends NofoElement {
  onMount() {
    this.setAttribute("data-timeline", "true");

    const styles = {
      display: "flex",
      flexDirection: "column",
      position: "relative",
      paddingLeft: "var(--space-4)",
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
        position: relative;
        padding-left: var(--space-4);
        box-sizing: border-box;
      }
      :host::before {
        content: '';
        position: absolute;
        left: 0.75rem;
        top: 0;
        bottom: 0;
        width: 2px;
        background-color: var(--gray-6);
      }
    `;
  }
}

class NofoTimelineItem extends NofoElement {
  static props = {
    status: { type: String, default: "complete" },
  };

  onMount() {
    this.setAttribute("data-status", this.props.status);

    const styles = {
      display: "flex",
      gap: "var(--space-3)",
      position: "relative",
      paddingBottom: "var(--space-4)",
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
        gap: var(--space-3);
        position: relative;
        padding-bottom: var(--space-4);
        box-sizing: border-box;
      }
    `;
  }
}

class NofoTimelineIndicator extends NofoElement {
  getStatusStyles(status) {
    const statusStyles = {
      complete: {
        backgroundColor: "var(--green-9)",
        color: "var(--gray-1)",
        border: "2px solid var(--green-9)",
      },
      current: {
        backgroundColor: "var(--accent-9)",
        color: "var(--gray-1)",
        border: "2px solid var(--accent-9)",
      },
      pending: {
        backgroundColor: "var(--gray-3)",
        color: "var(--gray-9)",
        border: "2px solid var(--gray-6)",
      },
      error: {
        backgroundColor: "var(--red-9)",
        color: "var(--gray-1)",
        border: "2px solid var(--red-9)",
      },
    };
    return statusStyles[status] || statusStyles["complete"];
  }

  onMount() {
    const item = this.closest("nofo-timeline-item");
    const status = item ? item.props?.status || "complete" : "complete";

    const statusStyles = this.getStatusStyles(status);

    const styles = {
      ...statusStyles,
      width: "1.5rem",
      height: "1.5rem",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      position: "relative",
      zIndex: 1,
      marginLeft: "-1.75rem",
      boxSizing: "border-box",
    };
    return styles;
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    const item = this.closest("nofo-timeline-item");
    const status = item ? item.props?.status || "complete" : "complete";
    const statusStyles = this.getStatusStyles(status);

    return `
      :host {
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        position: relative;
        z-index: 1;
        margin-left: -1.75rem;
        box-sizing: border-box;
        ${Object.entries(statusStyles)
          .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
          .join(" ")}
      }
    `;
  }
}

class NofoTimelineContent extends NofoElement {
  onMount() {
    const styles = {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-1)",
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
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        box-sizing: border-box;
      }
    `;
  }
}

class NofoTimelineTitle extends NofoElement {
  onMount() {
    const styles = {
      fontSize: "0.875rem",
      fontWeight: "600",
      color: "var(--gray-12)",
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
        font-weight: 600;
        color: var(--gray-12);
        margin: 0;
        box-sizing: border-box;
        display: block;
      }
    `;
  }
}

class NofoTimelineDescription extends NofoElement {
  onMount() {
    const styles = {
      fontSize: "0.875rem",
      color: "var(--gray-10)",
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
        margin: 0;
        box-sizing: border-box;
        display: block;
      }
    `;
  }
}

class NofoTimelineTime extends NofoElement {
  onMount() {
    const styles = {
      fontSize: "0.75rem",
      color: "var(--gray-9)",
      margin: 0,
      marginTop: "var(--space-1)",
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
        font-size: 0.75rem;
        color: var(--gray-9);
        margin: 0;
        margin-top: var(--space-1);
        box-sizing: border-box;
        display: block;
      }
    `;
  }
}

customElements.define("nofo-timeline", NofoTimeline);
customElements.define("nofo-timeline-item", NofoTimelineItem);
customElements.define("nofo-timeline-indicator", NofoTimelineIndicator);
customElements.define("nofo-timeline-content", NofoTimelineContent);
customElements.define("nofo-timeline-title", NofoTimelineTitle);
customElements.define("nofo-timeline-description", NofoTimelineDescription);
customElements.define("nofo-timeline-time", NofoTimelineTime);

export {
  NofoTimeline,
  NofoTimelineItem,
  NofoTimelineIndicator,
  NofoTimelineContent,
  NofoTimelineTitle,
  NofoTimelineDescription,
  NofoTimelineTime,
};
