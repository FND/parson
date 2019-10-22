<script>
export let items;
</script>

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
