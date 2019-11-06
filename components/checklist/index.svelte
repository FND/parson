<script>
import Panel from "../panel/index.svelte";
import { createEventDispatcher } from "svelte";

export let list, home;
let items = list.items;
let editing;

let dispatch = createEventDispatcher();

function onCreateItem(ev) {
	list.addItem("");
	items = list.items;
	editing = items[items.length - 1];
}

function discardItem(index) {
	// TODO: confirmation dialog
	list.removeItem(index);
	items = list.items;
	dispatch("change");
}

function toggleEditMode() {
	editing = !editing;
}
</script>

<Panel id={list.id} title={list.title} home={home}>
	<!-- XXX: `li` breaks encapsulation of both `Panel` -->
	<li slot="controls">
		<button type="button" on:click={toggleEditMode}>
			<!-- icon adapted from https://iconsvg.xyz -->
			<svg width="48" height="48" viewBox="0 0 24 24">
				<polygon points="16 3 21 8 8 21 3 21 3 16 16 3" />
			</svg>
		</button>
	</li>
	<li slot="controls">
		<button type="button" on:click={onCreateItem}>
			<!-- icon adapted from https://iconsvg.xyz -->
			<svg width="48" height="48" viewBox="0 0 24 24">
				<circle cx="12" cy="12" r="10" />
				<line x1="12" y1="8" x2="12" y2="16" />
				<line x1="8" y1="12" x2="16" y2="12" />
			</svg>
		</button>
	</li>

	<ul class="checklist">
		{#each items as item, i}
		<li>
			{#if editing}
			<!-- svelte-ignore a11y-autofocus -->
			<input type="text" bind:value={item.caption} on:change
					autofocus={item === editing}>
			<button type="button" on:click={ev => discardItem(i)}>
				<!-- icon adapted from https://iconsvg.xyz -->
				<svg width="48" height="48" viewBox="0 0 24 24">
					<polyline points="3 6 5 6 21 6" />
					<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
					<line x1="10" y1="11" x2="10" y2="17" />
					<line x1="14" y1="11" x2="14" y2="17" />
				</svg>
			</button>
			{:else}
			<label>
				<input type="checkbox" bind:checked={item.done} on:change>
				<span>{item.caption}</span>
			</label>
			{/if}
		</li>
		{/each}
	</ul>
</Panel>
