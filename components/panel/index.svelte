<script>
export let id = null;
export let title = null;
export let home = null;
</script>

<article class="panel" id={id}>
	{#if title}
	<header>
		<h2>{title}</h2>
		{#if home}
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
		{/if}
	</header>
	{/if}

	<slot />
</article>
