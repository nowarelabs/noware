import { BaseView, content_for, yield_content, JSX } from 'nomo/views';

export class {{viewClassName}}View extends BaseView {
	render(): JSX.Element {
		const title = "{{pluralTypeName}} - Smash";
		return (
			<div class="{{tableName}}-view">
				{content_for(
					'head',
					<>
						<title>{title}</title>
						{this.stylesheet_link_tag("components/{{tableName}}-table.css")}
					</>,
				)}

				{content_for(
					'scripts',
					<>{this.javascript_include_tag("components/{{tableName}}-table.js")}</>,
				)}

				<h1>{title}</h1>
				<{{tableName}}-table>
					<template slot="blueprint-{{singularName}}-create-form">
						<form class="{{tableName}}-form" on-submit="create{{viewClassName}}">
{{createFormFields}}
							<button type="submit" className="btn btn-success">Create</button>
						</form>
					</template>

					<template slot="blueprint-{{singularName}}-edit-row">
						<tr>
							<td>{`{{id}}`}</td>
{{editRowFields}}
							<td className="actions">
								<button type="button" className="btn btn-success btn-sm" on-click="update{{viewClassName}}" data-id="{{id}}">Save</button>
								<button type="button" className="btn btn-secondary btn-sm" on-click="cancelUpdate{{viewClassName}}">Cancel</button>
							</td>
						</tr>
					</template>

					<template slot="blueprint-{{singularName}}-row">
						<tr>
							<td>{`{{id}}`}</td>
{{viewRowFields}}
							<td className="actions">
								<button className="btn btn-primary btn-sm" on-click="edit{{viewClassName}}" data-id="{{id}}">Edit</button>
								<button className="btn btn-danger btn-sm" on-click="delete{{viewClassName}}" data-id="{{id}}">Delete</button>
							</td>
						</tr>
					</template>
				</{{tableName}}-table>
			</div>
		);
	}
}