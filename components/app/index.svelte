<script>
import ToC from "../toc/index.svelte";
import List from "../list/index.svelte";
import Panel from "../panel/index.svelte";
import Field from "../field/index.svelte";
import Store from "../../src/models/store";
import httpRequest from "../../src/util/http";
import { onMount } from "svelte";

let HOME_ID = "panel-about";
let CONFIG = { id: "panel-config", title: "Settings" };

let store;
let metadata = {
	title: "Parson", // TODO: update `document.title` on change
	tagline: "simple lists"
};
let lists = [];

let onChange = ev => {
	console.log("[STORE] updated", store, JSON.stringify(store));
};

let updater = field => {
	if(!(field in metadata)) {
		throw new Error(`invalid field: \`${field}\``);
	}
	return ev => {
		store[field] = metadata[field] = ev.target.value; // XXX: redundancy smell
		onChange(); // XXX: excessive reuse?
	};
};

let ref; // XXX: dummy node is hacky
onMount(async () => {
	let container = ref.parentNode;
	container.removeChild(ref);

	let uri = container.getAttribute("data-url");
	let res = await httpRequest("GET", uri, null, null, { strict: true });
	res = await res.json();
	store = new Store(res);
	Object.keys(metadata).forEach(field => {
		let value = store[field];
		if(value !== undefined) {
			metadata[field] = value;
		}
	});
	lists = store.lists;
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
	<List title={title} items={items} home={HOME_ID} on:change={onChange} />
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
