<script>
export let title, items, home;
</script>

<header>
	<h2>{title}</h2>
	<ul>
		<li>
			<a href={`#${home}`}>
				<!-- icon adapted from https://iconsvg.xyz -->
				<svg width="48" height="48" viewBox="0 0 24 24">
					<path d="M20 9v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9" />
					<path d="M9 22V12h6v10M2 10.6L12 2l10 8.6" />
				</svg>
			</a>
		</li>
	</ul>
</header>

<ul class="list">
	{#each items as { caption, done }}
	<li>
		<label>
			<input type="checkbox" bind:checked={done} on:change>
			<span>{caption}</span>
		</label>
	</li>
	{/each}
</ul>
