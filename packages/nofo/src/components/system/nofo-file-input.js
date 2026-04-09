import { NofoElement } from "../../index.js";

class NofoFileInput extends NofoElement {
  static props = {
    accept: { type: String },
    multiple: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    required: { type: Boolean, reflect: true },
    name: { type: String },
    size: { type: String, reflect: true },
    variant: { type: String, reflect: true },
  };

  _files = [];

  onMount() {
    const input = this.shadowRoot.querySelector('input[type="file"]');
    if (input) {
      input.addEventListener("change", (e) => {
        if (this.disabled) return;

        const files = Array.from(e.target.files);
        this._files = this.multiple ? [...this._files, ...files] : files;

        const event = new CustomEvent("file-change", {
          detail: { files: this._files },
          bubbles: true,
          composed: true,
        });
        this.dispatchEvent(event);

        this.updateFileList();
      });
    }

    this.addEventListener("click", (e) => {
      const removeBtn = e.target.closest("nofo-file-input-item-remove");
      if (!removeBtn) return;

      const item = removeBtn.closest("nofo-file-input-item");
      if (!item) return;

      const fileName = item.getAttribute("data-file-name");
      this._files = this._files.filter((f) => f.name !== fileName);

      const event = new CustomEvent("file-change", {
        detail: { files: this._files },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(event);

      this.updateFileList();
    });
  }

  updateFileList() {
    const list = this.querySelector("nofo-file-input-list");
    if (!list) return;

    list.innerHTML = "";
    this._files.forEach((file) => {
      const item = document.createElement("nofo-file-input-item");
      item.setAttribute("data-file-name", file.name);
      item.setAttribute("data-file-size", file.size);
      item.setAttribute("data-file-type", file.type);

      const name = document.createElement("nofo-file-input-item-name");
      name.textContent = file.name;

      const size = document.createElement("nofo-file-input-item-size");
      size.textContent = this.formatFileSize(file.size);

      const remove = document.createElement("nofo-file-input-item-remove");

      item.appendChild(name);
      item.appendChild(size);
      item.appendChild(remove);

      list.appendChild(item);
    });
  }

  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  template() {
    const accept = this.accept || "";
    const name = this.name || "files";

    return `
      <input 
        type="file" 
        accept="${accept}"
        ${this.multiple ? "multiple" : ""}
        ${this.disabled ? "disabled" : ""}
        ${this.required ? "required" : ""}
        name="${name}"
      />
      <slot></slot>
    `;
  }

  styles() {
    return `
      :host {
        display: block;
        box-sizing: border-box;
      }
      input[type="file"] {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
      }
    `;
  }
}

class NofoFileInputTrigger extends NofoElement {
  onMount() {
    this.addEventListener("click", () => {
      const fileInput = this.closest("nofo-file-input");
      if (!fileInput) return;

      const input = fileInput.shadowRoot.querySelector('input[type="file"]');
      if (input) {
        input.click();
      }
    });
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: contents;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoFileInputList extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        margin-top: var(--space-3);
        box-sizing: border-box;
      }
    `;
  }
}

class NofoFileInputItem extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2);
        background-color: var(--gray-2);
        border-radius: var(--radius);
        border: 1px solid var(--gray-6);
        box-sizing: border-box;
      }
    `;
  }
}

class NofoFileInputItemName extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        flex: 1;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--gray-12);
        display: block;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoFileInputItemSize extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        font-size: 0.75rem;
        color: var(--gray-10);
        display: block;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoFileInputItemRemove extends NofoElement {
  template() {
    return `<button type="button" aria-label="Remove file"><nofo-icon name="cross" size="sm"></nofo-icon></button>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 1.5rem;
        cursor: pointer;
        border-radius: var(--radius);
        transition: all 0.2s;
        box-sizing: border-box;
      }
      :host(:hover) {
        background-color: var(--gray-4);
      }
    `;
  }
}

customElements.define("nofo-file-input", NofoFileInput);
customElements.define("nofo-file-input-trigger", NofoFileInputTrigger);
customElements.define("nofo-file-input-list", NofoFileInputList);
customElements.define("nofo-file-input-item", NofoFileInputItem);
customElements.define("nofo-file-input-item-name", NofoFileInputItemName);
customElements.define("nofo-file-input-item-size", NofoFileInputItemSize);
customElements.define("nofo-file-input-item-remove", NofoFileInputItemRemove);

export {
  NofoFileInput,
  NofoFileInputTrigger,
  NofoFileInputList,
  NofoFileInputItem,
  NofoFileInputItemName,
  NofoFileInputItemSize,
  NofoFileInputItemRemove,
};
