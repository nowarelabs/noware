import { NofoElement } from "../../index.js";

class NofoPagination extends NofoElement {
  static props = {
    total: 0,
    page: 1,
    pageSize: 10,
    siblingCount: 1,
    showFirstLast: false,
  };

  onMount() {
    this.sync().attr("page").toDataAttr("page");
  }

  handlePageClick(e) {
    const button = e.target.closest("button");
    if (!button || button.disabled) return;

    const action = button.dataset.action;
    const totalPages = Math.ceil(this.state.total / this.state.pageSize);
    let newPage = this.state.page;

    if (action === "first") newPage = 1;
    else if (action === "prev") newPage = Math.max(1, this.state.page - 1);
    else if (action === "next") newPage = Math.min(totalPages, this.state.page + 1);
    else if (action === "last") newPage = totalPages;
    else if (action === "page") newPage = parseInt(button.dataset.page);

    if (newPage === this.state.page) return;

    this.state.page = newPage;
    this.dispatchEvent(
      new CustomEvent("page-change", {
        detail: { page: newPage },
        bubbles: true,
        composed: true,
      }),
    );
  }

  getPageNumbers() {
    const { total, pageSize, page: currentPage, siblingCount } = this.state;
    const totalPages = Math.ceil(total / pageSize);

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = [];
    pages.push(1);

    const leftSiblingIndex = Math.max(1, currentPage - siblingCount);
    const rightSiblingIndex = Math.min(totalPages, currentPage + siblingCount);

    if (leftSiblingIndex > 2) pages.push("ellipsis-left");
    for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
      if (i !== 1 && i !== totalPages) pages.push(i);
    }
    if (rightSiblingIndex < totalPages - 1) pages.push("ellipsis-right");
    if (totalPages > 1) pages.push(totalPages);

    return pages;
  }

  template() {
    const { total, pageSize, page, showFirstLast } = this.state;
    const totalPages = Math.ceil(total / pageSize);
    const pageNumbers = this.getPageNumbers();

    return `
      <nav aria-label="Pagination" on-click="handlePageClick">
        <div class="root">
          ${
            showFirstLast
              ? `
            <button type="button" class="btn" data-action="first" ${page === 1 ? "disabled" : ""}>
              <nofo-icon name="chevron-double-left" size="sm"></nofo-icon>
            </button>
          `
              : ""
          }
          
          <button type="button" class="btn" data-action="prev" ${page === 1 ? "disabled" : ""}>
            <nofo-icon name="chevron-left" size="sm"></nofo-icon>
          </button>

          ${pageNumbers
            .map((n) => {
              if (typeof n === "string") return `<span class="ellipsis">...</span>`;
              return `
              <button type="button" class="btn" data-action="page" data-page="${n}" ${n === page ? "data-active" : ""}>
                ${n}
              </button>
            `;
            })
            .join("")}

          <button type="button" class="btn" data-action="next" ${page === totalPages ? "disabled" : ""}>
            <nofo-icon name="chevron-right" size="sm"></nofo-icon>
          </button>

          ${
            showFirstLast
              ? `
            <button type="button" class="btn" data-action="last" ${page === totalPages ? "disabled" : ""}>
              <nofo-icon name="chevron-double-right" size="sm"></nofo-icon>
            </button>
          `
              : ""
          }
        </div>
      </nav>
    `;
  }

  styles() {
    return `
      :host { display: block; box-sizing: border-box; }
      .root {
        display: flex;
        align-items: center;
        gap: var(--space-1);
      }
      .btn {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--gray-6);
        background-color: var(--color-panel-solid);
        border-radius: var(--radius-2);
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: var(--font-size-2);
        color: var(--gray-11);
        min-width: 2.5rem;
      }
      .btn:hover:not(:disabled) { background-color: var(--gray-2); border-color: var(--gray-7); }
      .btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .btn[data-active] {
        background-color: var(--accent-9);
        color: white;
        border-color: var(--accent-9);
      }
      .ellipsis {
        padding: 0 0.5rem;
        color: var(--gray-9);
        user-select: none;
      }
    `;
  }
}

customElements.define("nofo-pagination", NofoPagination);
export { NofoPagination };
