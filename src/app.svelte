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

let title = "Parson";
let tagline = "simple lists";
let lists = [];
$: lists = lists.map(list => Object.assign({}, list, {
	id: `list-${idify(list.title)}`
}));

let ref; // XXX: dummy node is hacky
onMount(async () => {
	let container = ref.parentNode;
	container.removeChild(ref);

	let uri = container.getAttribute("data-url");
	let res = await httpRequest("GET", uri, null, null, { strict: true });
	res = await res.json();
	lists = res.lists;
});
</script>

<span bind:this={ref} hidden />

<Panel id={HOME_ID}>
	<header>
		<h1>{title}</h1>
		<p>{tagline}</p>
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
		<Field caption="title" value={title} />
		<Field caption="tagline" value={tagline} />
		<button type="button">save</button>
	</form>
</Panel>
