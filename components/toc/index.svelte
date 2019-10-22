<script>
export let entries;
</script>

<ul class="toc">
	{#each entries as { id, caption }}
	<li>
		<a href={`#${id}`}>{caption}</a>
	</li>
	{/each}
</ul>
