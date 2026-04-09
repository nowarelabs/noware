import { NofoElement } from 'nomo/nofo';

class {{componentClassName}}Table extends NofoElement {
  static props = { 
    {{tableName}}: [],
    editingId: null,
    showForm: false,
    total: 0,
    page: { default: 1, url: true, parse: Number },
    perPage: { default: 10, url: true, parse: Number }
  };

  static rpc = {
    baseUrl: '/v1/rpc',
    endpoints: [
      { name: '{{tableName}}', path: '/{{tableName}}' }
    ]
  };

  async onMount() {
    await this.load{{pluralTypeName}}();
  }

  onUrlChange() {
    this.load{{pluralTypeName}}();
  }

  async load{{pluralTypeName}}() {
    return this.withLoading('{{tableName}}', async () => {
      const result = await this.rpc.{{tableName}}.list({
        page: this.state.page,
        perPage: this.state.perPage
      });
      if (result.error) {
        this.syncResponse({ {{tableName}}: [], total: 0 });
        return;
      }
      this.syncResponse({
        {{tableName}}: result.data?.items || [],
        total: result.data?.total || 0,
        page: result.data?.page,
        perPage: result.data?.perPage
      });
    });
  }

  async create{{componentClassName}}(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
{{jsCreateData}}
    };
    await this.rpc.{{tableName}}.create(data);
    this.state.showForm = false;
    await this.load{{pluralTypeName}}();
  }

  async edit{{componentClassName}}(e) {
    const id = e.currentTarget.dataset.id;
    this.state.editingId = id;
  }

  async update{{componentClassName}}(e) {
    const row = e.currentTarget.closest('tr');
    const data = {
{{jsUpdateData}}
    };
    await this.rpc.{{tableName}}.update(this.state.editingId, data);
    this.state.editingId = null;
    await this.load{{pluralTypeName}}();
  }

  cancelUpdate{{componentClassName}}() {
    this.state.editingId = null;
  }

  async delete{{componentClassName}}(e) {
    const id = e.currentTarget.dataset.id;
    await this.rpc.{{tableName}}.delete(id);
    await this.load{{pluralTypeName}}();
  }

  toggleForm() {
    this.state.showForm = !this.state.showForm;
  }

  template() {
    return `
      <div class="{{tableName}}-table-container">
        <div class="header">
          <h2>{{pluralTypeName}}</h2>
          <button class="btn btn-primary" on-click="toggleForm">
            \${this.state.showForm ? 'Cancel' : 'Add {{typeName}}'}
          </button>
        </div>

        \${this.state.showForm ? this.renderForm('{{singularName}}-create-form') : ''}

        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
{{tableHeadFields}}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            \${this.loading['{{tableName}}'] ? '<tr><td colspan="{{colCount}}">Loading...</td></tr>' : this.renderBody()}
          </tbody>
        </table>
      </div>
    `;
  }

  renderBody() {
    return this.renderList(this.state.{{tableName}}, '{{singularName}}-row', {
      empty: () => '<tr><td colspan="{{colCount}}">No {{tableName}} found</td></tr>',
      branch: [
        {
          test: (item) => this.state.editingId == item.id,
          slot: '{{singularName}}-edit-row'
        }
      ]
    });
  }
}

customElements.define('{{tableName}}-table', {{componentClassName}}Table);
