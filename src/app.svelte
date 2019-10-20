<script>
import ToC from "./toc.svelte";
import List from "./list.svelte";
import Panel from "./panel.svelte";
import Field from "./field.svelte";
import httpRequest from "./util/http";
import { idify } from "./util";
import { onMount } from "svelte";

let HOME_ID = "panel-about";
let CONFIG = { id: "panel-config", title: "Settings" };

let metadata = {
	title: "Parson", // TODO: update `document.title` on change
	tagline: "simple lists"
};
let lists = [];
$: lists = lists.map(list => Object.assign({}, list, {
	id: `list-${idify(list.title)}`
}));

let updater = field => {
	if(!(field in metadata)) {
		throw new Error(`invalid field: \`${field}\``);
	}
	return ev => {
		metadata[field] = ev.target.value;
	};
};

let ref; // XXX: dummy node is hacky
onMount(async () => {
	let container = ref.parentNode;
	container.removeChild(ref);

	let uri = container.getAttribute("data-url");
	let res = await httpRequest("GET", uri, null, null, { strict: true });
	res = await res.json();
	Object.keys(metadata).forEach(field => {
		let value = res[field];
		if(value !== undefined) {
			metadata[field] = value;
		}
	});
	lists = res.lists;
});
</script>

<span bind:this={ref} hidden />

<Panel id={HOME_ID}>
	<header>
		<h1>{metadata.title}</h1>
		<p>{metadata.tagline}</p>
	</header>
	<ToC entries={lists.concat(CONFIG).
		map(({ id, title }) => ({ id, caption: title }))} />
</Panel>

{#each lists as { id, title, items }}
<Panel id={id}>
	<List title={title} items={items} home={HOME_ID} />
</Panel>
{/each}

<Panel id={CONFIG.id}>
	<h2>{CONFIG.title}</h2>
	<form>
		{#each ["title", "tagline"] as field}
		<Field caption={field} value={metadata[field]} on:change={updater(field)} />
		{/each}
	</form>
</Panel>
