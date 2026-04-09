import { Migration } from "nomo/migrations";

export default class {{className}} extends Migration {
  readonly version = "{{timestamp}}";
{{#if durableObjectClass}}
  readonly durableObjectClass = '{{durableObjectClass}}';
{{/if}}

  async change() {
    const options = { location: "{{location}}" as const{{#if durableObjectClass}}, durableObject: '{{durableObjectClass}}'{{/if}} };
    await this.createTable("{{tableName}}", options, (t) => {
{{#if isDurableObject}}
      t.id({ autoincrement: true });
{{else}}
      t.text('id', { primaryKey: true, notNull: true });
{{/if}}
{{fields}}
      t.timestamps();
{{#if lifecycle}}
      t.lifecycle();
{{/if}}
{{relationships}}
{{#if doType}}
      t.doType('{{doType}}');
{{/if}}
{{#if populateFrom}}
      t.populateFrom({{populateFromArgs}});
{{/if}}
    });
  }
}
