<script>
import Panel from "../panel/index.svelte";

export let list, home;
let items = list.items;

function onCreateItem(ev) {
	list.addItem("--");
	items = list.items;
}
</script>

<Panel id={list.id} title={list.title} home={home}>
	<!-- XXX: `li` breaks encapsulation of both `Panel` -->
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
		{#each items as { caption, done }}
		<li>
			<label>
				<input type="checkbox" bind:checked={done} on:change>
				<span>{caption}</span>
			</label>
		</li>
		{/each}
	</ul>
</Panel>
