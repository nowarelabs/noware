import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUICalendar extends NofoElement {
  static props = {
    value: { type: String, default: "" },
    defaultValue: { type: String, default: "" },
    min: { type: String, default: "" },
    max: { type: String, default: "" },
  };

  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: block;
          width: 100%;
        }
        
        .calendar {
          display: flex;
          flex-direction: column;
          gap: var(--nofo-ui-spacing-md);
          padding: var(--nofo-ui-spacing-lg);
          background-color: var(--nofo-ui-background-secondary);
          border: 1px solid var(--nofo-ui-border);
          border-radius: var(--nofo-ui-radius);
        }
        
        .calendar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: var(--nofo-ui-spacing-sm);
        }
        
        .calendar-day {
          display: flex;
          align-items: center;
          justify-content: center;
          aspect-ratio: 1;
          border-radius: var(--nofo-ui-radius);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        
        .calendar-day:hover {
          background-color: var(--nofo-ui-hover);
        }
        
        .calendar-day.selected {
          background-color: var(--nofo-ui-accent-primary);
          color: var(--nofo-ui-background);
        }
      </style>
      <div class="calendar">
        <div class="calendar-header">
          <nofo-ui-button variant="ghost" size="sm">←</nofo-ui-button>
          <nofo-heading size="3">Month Year</nofo-heading>
          <nofo-ui-button variant="ghost" size="sm">→</nofo-ui-button>
        </div>
        <div class="calendar-grid">
        </div>
      </div>
      <slot></slot>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {}
}

customElements.define("nofo-ui-calendar", NofoUICalendar);
