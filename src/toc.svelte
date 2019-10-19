<script>
export let entries;
</script>

<style>
ul {
	padding: 0;
	list-style-type: none;
}

li:before {
	content: "▸\0000a0";
}
</style>

<ul>
	{#each entries as { id, caption }}
	<li>
		<a href={`#${id}`}>{caption}</a>
	</li>
	{/each}
</ul>
