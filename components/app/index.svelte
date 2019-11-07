<script>
import ToC from "../toc/index.svelte";
import CheckList from "../checklist/index.svelte";
import Panel from "../panel/index.svelte";
import Notification from "../notification/index.svelte";
import Field from "../field/index.svelte";
import Store from "../../src/models/store";
import debounce from "../../src/util/debounce";
import { onMount } from "svelte";

let HOME_ID = "panel-about";
let CONFIG = { id: "panel-config", title: "Settings" };

let store;
let metadata = {
	title: "Parson", // TODO: update `document.title` on change
	tagline: "simple lists"
};
let lists = [];
let notification = new Notification({ target: document.body }); // XXX: hacky
let ref; // XXX: dummy node is hacky

let clobberingPrompt = {
	message: "server does not support clobbering protection: existing changes might be overwritten",
	prompt: {
		caption: "continue",
		action: () => save(true)
	}
};

save = debounce(500, save);

onMount(() => {
	let container = ref.parentNode;
	container.removeChild(ref);

	let uri = container.getAttribute("data-url");
	init(uri);
});

async function save(force) { // NB: doubles as event handler
	if(store.unsafe && force !== true) {
		// TODO:
		// * remember choice?
		// * fall back to `HEAD` or `GET` request (⇒ race condition, but acceptable?)
		notification.$set({
			type: "warning",
			confirmation: clobberingPrompt
		});
		return;
	}

	try {
		await store.save();
	} catch(err) {
		// TODO: conflict resolution
		notification.$set({
			type: "error",
			message: `failed to save: ${err}`
		});
		throw err;
	}
};

async function init(uri) {
	try {
		// NB: `store` access elsewhere is not prone to race condition because
		//     without a store the application is effectively inert
		store = await Store.load(uri);
	} catch(err) {
		notification.$set({
			type: "error",
			message: "failed to retrieve data"
		});
		throw err;
	}
	Object.keys(metadata).forEach(field => {
		let value = store[field];
		if(value !== undefined) {
			metadata[field] = value;
		}
	});
	lists = store.lists;
};

function updater(field) {
	if(!(field in metadata)) {
		throw new Error(`invalid field: \`${field}\``);
	}
	return ev => {
		store[field] = metadata[field] = ev.target.value; // XXX: redundancy smell
		save();
	};
};
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

{#each lists as list}
<CheckList list={list} home={HOME_ID} on:change={save} />
{/each}

<Panel id={CONFIG.id} title={CONFIG.title} home={HOME_ID}>
	<form>
		{#each ["title", "tagline"] as field}
		<Field caption={field} value={metadata[field]} on:change={updater(field)} />
		{/each}
	</form>
</Panel>
