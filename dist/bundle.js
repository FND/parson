(function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if (typeof $$scope.dirty === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        if (value != null || input.value) {
            input.value = value;
        }
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            callbacks.slice().forEach(fn => fn(event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined' ? window : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, value = ret) => {
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, detail));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev("SvelteDOMSetProperty", { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    /* components/toc/index.svelte generated by Svelte v3.16.7 */

    const file = "components/toc/index.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i].id;
    	child_ctx[2] = list[i].caption;
    	return child_ctx;
    }

    // (6:1) {#each entries as { id, caption }}
    function create_each_block(ctx) {
    	let li;
    	let a;
    	let t0_value = /*caption*/ ctx[2] + "";
    	let t0;
    	let a_href_value;
    	let t1;

    	const block = {
    		c: function create() {
    			li = element("li");
    			a = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			attr_dev(a, "href", a_href_value = `#${/*id*/ ctx[1]}`);
    			add_location(a, file, 7, 2, 101);
    			add_location(li, file, 6, 1, 94);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, a);
    			append_dev(a, t0);
    			append_dev(li, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*entries*/ 1 && t0_value !== (t0_value = /*caption*/ ctx[2] + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*entries*/ 1 && a_href_value !== (a_href_value = `#${/*id*/ ctx[1]}`)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(6:1) {#each entries as { id, caption }}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let ul;
    	let each_value = /*entries*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(ul, "class", "toc");
    			add_location(ul, file, 4, 0, 40);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*entries*/ 1) {
    				each_value = /*entries*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { entries } = $$props;
    	const writable_props = ["entries"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Toc> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("entries" in $$props) $$invalidate(0, entries = $$props.entries);
    	};

    	$$self.$capture_state = () => {
    		return { entries };
    	};

    	$$self.$inject_state = $$props => {
    		if ("entries" in $$props) $$invalidate(0, entries = $$props.entries);
    	};

    	return [entries];
    }

    class Toc extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { entries: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Toc",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || ({});

    		if (/*entries*/ ctx[0] === undefined && !("entries" in props)) {
    			console.warn("<Toc> was created without expected prop 'entries'");
    		}
    	}

    	get entries() {
    		throw new Error("<Toc>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set entries(value) {
    		throw new Error("<Toc>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* components/panel/index.svelte generated by Svelte v3.16.7 */

    const file$1 = "components/panel/index.svelte";
    const get_controls_slot_changes = dirty => ({});
    const get_controls_slot_context = ctx => ({});

    // (8:1) {#if title}
    function create_if_block(ctx) {
    	let header;
    	let h2;
    	let t0;
    	let t1;
    	let current;
    	let if_block = /*home*/ ctx[2] && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			header = element("header");
    			h2 = element("h2");
    			t0 = text(/*title*/ ctx[1]);
    			t1 = space();
    			if (if_block) if_block.c();
    			add_location(h2, file$1, 9, 2, 148);
    			add_location(header, file$1, 8, 1, 137);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, h2);
    			append_dev(h2, t0);
    			append_dev(header, t1);
    			if (if_block) if_block.m(header, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty & /*title*/ 2) set_data_dev(t0, /*title*/ ctx[1]);

    			if (/*home*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    					transition_in(if_block, 1);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(header, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(8:1) {#if title}",
    		ctx
    	});

    	return block;
    }

    // (11:2) {#if home}
    function create_if_block_1(ctx) {
    	let ul;
    	let t;
    	let li;
    	let a;
    	let svg;
    	let path0;
    	let path1;
    	let a_href_value;
    	let current;
    	const controls_slot_template = /*$$slots*/ ctx[4].controls;
    	const controls_slot = create_slot(controls_slot_template, ctx, /*$$scope*/ ctx[3], get_controls_slot_context);

    	const block = {
    		c: function create() {
    			ul = element("ul");
    			if (controls_slot) controls_slot.c();
    			t = space();
    			li = element("li");
    			a = element("a");
    			svg = svg_element("svg");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			attr_dev(path0, "d", "M20 9v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9");
    			add_location(path0, file$1, 19, 6, 423);
    			attr_dev(path1, "d", "M9 22V12h6v10M2 10.6L12 2l10 8.6");
    			add_location(path1, file$1, 20, 6, 483);
    			attr_dev(svg, "width", "48");
    			attr_dev(svg, "height", "48");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			add_location(svg, file$1, 18, 5, 368);
    			attr_dev(a, "href", a_href_value = `#${/*home*/ ctx[2]}`);
    			add_location(a, file$1, 16, 4, 289);
    			add_location(li, file$1, 15, 3, 280);
    			add_location(ul, file$1, 11, 2, 180);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);

    			if (controls_slot) {
    				controls_slot.m(ul, null);
    			}

    			append_dev(ul, t);
    			append_dev(ul, li);
    			append_dev(li, a);
    			append_dev(a, svg);
    			append_dev(svg, path0);
    			append_dev(svg, path1);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (controls_slot && controls_slot.p && dirty & /*$$scope*/ 8) {
    				controls_slot.p(get_slot_context(controls_slot_template, ctx, /*$$scope*/ ctx[3], get_controls_slot_context), get_slot_changes(controls_slot_template, /*$$scope*/ ctx[3], dirty, get_controls_slot_changes));
    			}

    			if (!current || dirty & /*home*/ 4 && a_href_value !== (a_href_value = `#${/*home*/ ctx[2]}`)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(controls_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(controls_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			if (controls_slot) controls_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(11:2) {#if home}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let article;
    	let t;
    	let current;
    	let if_block = /*title*/ ctx[1] && create_if_block(ctx);
    	const default_slot_template = /*$$slots*/ ctx[4].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);

    	const block = {
    		c: function create() {
    			article = element("article");
    			if (if_block) if_block.c();
    			t = space();
    			if (default_slot) default_slot.c();
    			attr_dev(article, "class", "panel");
    			attr_dev(article, "id", /*id*/ ctx[0]);
    			add_location(article, file$1, 6, 0, 91);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, article, anchor);
    			if (if_block) if_block.m(article, null);
    			append_dev(article, t);

    			if (default_slot) {
    				default_slot.m(article, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*title*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    					transition_in(if_block, 1);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(article, t);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (default_slot && default_slot.p && dirty & /*$$scope*/ 8) {
    				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[3], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[3], dirty, null));
    			}

    			if (!current || dirty & /*id*/ 1) {
    				attr_dev(article, "id", /*id*/ ctx[0]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(article);
    			if (if_block) if_block.d();
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { id = null } = $$props;
    	let { title = null } = $$props;
    	let { home = null } = $$props;
    	const writable_props = ["id", "title", "home"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Panel> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;

    	$$self.$set = $$props => {
    		if ("id" in $$props) $$invalidate(0, id = $$props.id);
    		if ("title" in $$props) $$invalidate(1, title = $$props.title);
    		if ("home" in $$props) $$invalidate(2, home = $$props.home);
    		if ("$$scope" in $$props) $$invalidate(3, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => {
    		return { id, title, home };
    	};

    	$$self.$inject_state = $$props => {
    		if ("id" in $$props) $$invalidate(0, id = $$props.id);
    		if ("title" in $$props) $$invalidate(1, title = $$props.title);
    		if ("home" in $$props) $$invalidate(2, home = $$props.home);
    	};

    	return [id, title, home, $$scope, $$slots];
    }

    class Panel extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { id: 0, title: 1, home: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Panel",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get id() {
    		throw new Error("<Panel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Panel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get title() {
    		throw new Error("<Panel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<Panel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get home() {
    		throw new Error("<Panel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set home(value) {
    		throw new Error("<Panel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* components/checklist/index.svelte generated by Svelte v3.16.7 */
    const file$2 = "components/checklist/index.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i];
    	child_ctx[14] = list;
    	child_ctx[15] = i;
    	return child_ctx;
    }

    // (39:1) <li slot="controls">
    function create_controls_slot(ctx) {
    	let li0;
    	let button0;
    	let svg0;
    	let polygon;
    	let li1;
    	let button1;
    	let svg1;
    	let circle;
    	let line0;
    	let line1;
    	let dispose;

    	const block = {
    		c: function create() {
    			li0 = element("li");
    			button0 = element("button");
    			svg0 = svg_element("svg");
    			polygon = svg_element("polygon");
    			li1 = element("li");
    			button1 = element("button");
    			svg1 = svg_element("svg");
    			circle = svg_element("circle");
    			line0 = svg_element("line");
    			line1 = svg_element("line");
    			attr_dev(polygon, "points", "16 3 21 8 8 21 3 21 3 16 16 3");
    			add_location(polygon, file$2, 34, 4, 790);
    			attr_dev(svg0, "width", "48");
    			attr_dev(svg0, "height", "48");
    			attr_dev(svg0, "viewBox", "0 0 24 24");
    			add_location(svg0, file$2, 33, 3, 737);
    			attr_dev(button0, "type", "button");
    			add_location(button0, file$2, 31, 2, 635);
    			attr_dev(li0, "slot", "controls");
    			add_location(li0, file$2, 30, 1, 612);
    			attr_dev(circle, "cx", "12");
    			attr_dev(circle, "cy", "12");
    			attr_dev(circle, "r", "10");
    			add_location(circle, file$2, 42, 4, 1047);
    			attr_dev(line0, "x1", "12");
    			attr_dev(line0, "y1", "8");
    			attr_dev(line0, "x2", "12");
    			attr_dev(line0, "y2", "16");
    			add_location(line0, file$2, 43, 4, 1085);
    			attr_dev(line1, "x1", "8");
    			attr_dev(line1, "y1", "12");
    			attr_dev(line1, "x2", "16");
    			attr_dev(line1, "y2", "12");
    			add_location(line1, file$2, 44, 4, 1129);
    			attr_dev(svg1, "width", "48");
    			attr_dev(svg1, "height", "48");
    			attr_dev(svg1, "viewBox", "0 0 24 24");
    			add_location(svg1, file$2, 41, 3, 994);
    			attr_dev(button1, "type", "button");
    			add_location(button1, file$2, 39, 2, 894);
    			attr_dev(li1, "slot", "controls");
    			add_location(li1, file$2, 38, 1, 871);

    			dispose = [
    				listen_dev(button0, "click", /*toggleEditMode*/ ctx[6], false, false, false),
    				listen_dev(button1, "click", /*onCreateItem*/ ctx[4], false, false, false)
    			];
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li0, anchor);
    			append_dev(li0, button0);
    			append_dev(button0, svg0);
    			append_dev(svg0, polygon);
    			insert_dev(target, li1, anchor);
    			append_dev(li1, button1);
    			append_dev(button1, svg1);
    			append_dev(svg1, circle);
    			append_dev(svg1, line0);
    			append_dev(svg1, line1);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li0);
    			if (detaching) detach_dev(li1);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_controls_slot.name,
    		type: "slot",
    		source: "(39:1) <li slot=\\\"controls\\\">",
    		ctx
    	});

    	return block;
    }

    // (66:3) {:else}
    function create_else_block(ctx) {
    	let label;
    	let input;
    	let t0;
    	let span;
    	let t1_value = /*item*/ ctx[13].caption + "";
    	let t1;
    	let dispose;

    	function input_change_handler() {
    		/*input_change_handler*/ ctx[12].call(input, /*item*/ ctx[13]);
    	}

    	const block = {
    		c: function create() {
    			label = element("label");
    			input = element("input");
    			t0 = space();
    			span = element("span");
    			t1 = text(t1_value);
    			attr_dev(input, "type", "checkbox");
    			add_location(input, file$2, 67, 4, 1849);
    			add_location(span, file$2, 68, 4, 1912);
    			add_location(label, file$2, 66, 3, 1837);

    			dispose = [
    				listen_dev(input, "change", input_change_handler),
    				listen_dev(input, "change", /*change_handler_1*/ ctx[9], false, false, false)
    			];
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, input);
    			input.checked = /*item*/ ctx[13].done;
    			append_dev(label, t0);
    			append_dev(label, span);
    			append_dev(span, t1);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*items*/ 4) {
    				input.checked = /*item*/ ctx[13].done;
    			}

    			if (dirty & /*items*/ 4 && t1_value !== (t1_value = /*item*/ ctx[13].caption + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(66:3) {:else}",
    		ctx
    	});

    	return block;
    }

    // (53:3) {#if editing}
    function create_if_block$1(ctx) {
    	let input;
    	let input_autofocus_value;
    	let t;
    	let button;
    	let svg;
    	let polyline;
    	let path;
    	let line0;
    	let line1;
    	let dispose;

    	function input_input_handler() {
    		/*input_input_handler*/ ctx[10].call(input, /*item*/ ctx[13]);
    	}

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[11](/*i*/ ctx[15], ...args);
    	}

    	const block = {
    		c: function create() {
    			input = element("input");
    			t = space();
    			button = element("button");
    			svg = svg_element("svg");
    			polyline = svg_element("polyline");
    			path = svg_element("path");
    			line0 = svg_element("line");
    			line1 = svg_element("line");
    			attr_dev(input, "type", "text");
    			input.autofocus = input_autofocus_value = /*item*/ ctx[13] === /*editing*/ ctx[3];
    			add_location(input, file$2, 54, 3, 1318);
    			attr_dev(polyline, "points", "3 6 5 6 21 6");
    			add_location(polyline, file$2, 59, 5, 1575);
    			attr_dev(path, "d", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2");
    			add_location(path, file$2, 60, 5, 1615);
    			attr_dev(line0, "x1", "10");
    			attr_dev(line0, "y1", "11");
    			attr_dev(line0, "x2", "10");
    			attr_dev(line0, "y2", "17");
    			add_location(line0, file$2, 61, 5, 1712);
    			attr_dev(line1, "x1", "14");
    			attr_dev(line1, "y1", "11");
    			attr_dev(line1, "x2", "14");
    			attr_dev(line1, "y2", "17");
    			add_location(line1, file$2, 62, 5, 1758);
    			attr_dev(svg, "width", "48");
    			attr_dev(svg, "height", "48");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			add_location(svg, file$2, 58, 4, 1521);
    			attr_dev(button, "type", "button");
    			add_location(button, file$2, 56, 3, 1411);

    			dispose = [
    				listen_dev(input, "input", input_input_handler),
    				listen_dev(input, "change", /*change_handler*/ ctx[8], false, false, false),
    				listen_dev(button, "click", click_handler, false, false, false)
    			];
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*item*/ ctx[13].caption);
    			insert_dev(target, t, anchor);
    			insert_dev(target, button, anchor);
    			append_dev(button, svg);
    			append_dev(svg, polyline);
    			append_dev(svg, path);
    			append_dev(svg, line0);
    			append_dev(svg, line1);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*items, editing*/ 12 && input_autofocus_value !== (input_autofocus_value = /*item*/ ctx[13] === /*editing*/ ctx[3])) {
    				prop_dev(input, "autofocus", input_autofocus_value);
    			}

    			if (dirty & /*items*/ 4 && input.value !== /*item*/ ctx[13].caption) {
    				set_input_value(input, /*item*/ ctx[13].caption);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(button);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(53:3) {#if editing}",
    		ctx
    	});

    	return block;
    }

    // (51:2) {#each items as item, i}
    function create_each_block$1(ctx) {
    	let li;
    	let t;

    	function select_block_type(ctx, dirty) {
    		if (/*editing*/ ctx[3]) return create_if_block$1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			li = element("li");
    			if_block.c();
    			t = space();
    			add_location(li, file$2, 51, 2, 1252);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			if_block.m(li, null);
    			append_dev(li, t);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(li, t);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(51:2) {#each items as item, i}",
    		ctx
    	});

    	return block;
    }

    // (29:0) <Panel id={list.id} title={list.title} home={home}>
    function create_default_slot(ctx) {
    	let t0;
    	let t1;
    	let ul;
    	let each_value = /*items*/ ctx[2];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			t0 = space();
    			t1 = space();
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(ul, "class", "checklist");
    			add_location(ul, file$2, 49, 1, 1200);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*editing, discardItem, items*/ 44) {
    				each_value = /*items*/ ctx[2];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(29:0) <Panel id={list.id} title={list.title} home={home}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let current;

    	const panel = new Panel({
    			props: {
    				id: /*list*/ ctx[0].id,
    				title: /*list*/ ctx[0].title,
    				home: /*home*/ ctx[1],
    				$$slots: {
    					default: [create_default_slot],
    					controls: [create_controls_slot]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(panel.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(panel, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const panel_changes = {};
    			if (dirty & /*list*/ 1) panel_changes.id = /*list*/ ctx[0].id;
    			if (dirty & /*list*/ 1) panel_changes.title = /*list*/ ctx[0].title;
    			if (dirty & /*home*/ 2) panel_changes.home = /*home*/ ctx[1];

    			if (dirty & /*$$scope, items, editing*/ 65548) {
    				panel_changes.$$scope = { dirty, ctx };
    			}

    			panel.$set(panel_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(panel.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(panel.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(panel, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { list } = $$props, { home } = $$props;
    	let items = list.items;
    	let editing;
    	let dispatch = createEventDispatcher();

    	function onCreateItem(ev) {
    		list.addItem("");
    		$$invalidate(2, items = list.items);
    		$$invalidate(3, editing = items[items.length - 1]);
    	}

    	function discardItem(index) {
    		list.removeItem(index);
    		$$invalidate(2, items = list.items);
    		dispatch("change");
    	}

    	function toggleEditMode() {
    		$$invalidate(3, editing = !editing);
    	}

    	const writable_props = ["list", "home"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Checklist> was created with unknown prop '${key}'`);
    	});

    	function change_handler(event) {
    		bubble($$self, event);
    	}

    	function change_handler_1(event) {
    		bubble($$self, event);
    	}

    	function input_input_handler(item) {
    		item.caption = this.value;
    		$$invalidate(2, items);
    	}

    	const click_handler = (i, ev) => discardItem(i);

    	function input_change_handler(item) {
    		item.done = this.checked;
    		$$invalidate(2, items);
    	}

    	$$self.$set = $$props => {
    		if ("list" in $$props) $$invalidate(0, list = $$props.list);
    		if ("home" in $$props) $$invalidate(1, home = $$props.home);
    	};

    	$$self.$capture_state = () => {
    		return { list, home, items, editing, dispatch };
    	};

    	$$self.$inject_state = $$props => {
    		if ("list" in $$props) $$invalidate(0, list = $$props.list);
    		if ("home" in $$props) $$invalidate(1, home = $$props.home);
    		if ("items" in $$props) $$invalidate(2, items = $$props.items);
    		if ("editing" in $$props) $$invalidate(3, editing = $$props.editing);
    		if ("dispatch" in $$props) dispatch = $$props.dispatch;
    	};

    	return [
    		list,
    		home,
    		items,
    		editing,
    		onCreateItem,
    		discardItem,
    		toggleEditMode,
    		dispatch,
    		change_handler,
    		change_handler_1,
    		input_input_handler,
    		click_handler,
    		input_change_handler
    	];
    }

    class Checklist extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { list: 0, home: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Checklist",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || ({});

    		if (/*list*/ ctx[0] === undefined && !("list" in props)) {
    			console.warn("<Checklist> was created without expected prop 'list'");
    		}

    		if (/*home*/ ctx[1] === undefined && !("home" in props)) {
    			console.warn("<Checklist> was created without expected prop 'home'");
    		}
    	}

    	get list() {
    		throw new Error("<Checklist>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set list(value) {
    		throw new Error("<Checklist>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get home() {
    		throw new Error("<Checklist>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set home(value) {
    		throw new Error("<Checklist>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* components/notification/index.svelte generated by Svelte v3.16.7 */

    const file$3 = "components/notification/index.svelte";

    // (16:0) {#if message || confirmation}
    function create_if_block$2(ctx) {
    	let div;

    	function select_block_type(ctx, dirty) {
    		if (/*message*/ ctx[1]) return create_if_block_1$1;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "class", "notification");
    			attr_dev(div, "aria-live", "polite");
    			toggle_class(div, "is-warning", /*type*/ ctx[0] === "warning");
    			toggle_class(div, "is-error", /*type*/ ctx[0] === "error");
    			add_location(div, file$3, 16, 0, 281);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_block.m(div, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}

    			if (dirty & /*type*/ 1) {
    				toggle_class(div, "is-warning", /*type*/ ctx[0] === "warning");
    			}

    			if (dirty & /*type*/ 1) {
    				toggle_class(div, "is-error", /*type*/ ctx[0] === "error");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(16:0) {#if message || confirmation}",
    		ctx
    	});

    	return block;
    }

    // (22:1) {:else}
    function create_else_block$1(ctx) {
    	let div;
    	let p;
    	let t0_value = /*confirmation*/ ctx[2].message + "";
    	let t0;
    	let t1;
    	let button0;
    	let t2_value = /*confirmation*/ ctx[2].prompt.caption + "";
    	let t2;
    	let t3;
    	let button1;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			p = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			button0 = element("button");
    			t2 = text(t2_value);
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "×";
    			add_location(p, file$3, 23, 2, 520);
    			attr_dev(button0, "type", "button");
    			add_location(button0, file$3, 24, 2, 552);
    			attr_dev(div, "class", "prompt");
    			add_location(div, file$3, 22, 1, 497);
    			attr_dev(button1, "type", "button");
    			add_location(button1, file$3, 28, 1, 682);

    			dispose = [
    				listen_dev(button0, "click", /*click_handler*/ ctx[5], false, false, false),
    				listen_dev(button1, "click", /*dismiss*/ ctx[4], false, false, false)
    			];
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, p);
    			append_dev(p, t0);
    			append_dev(div, t1);
    			append_dev(div, button0);
    			append_dev(button0, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, button1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*confirmation*/ 4 && t0_value !== (t0_value = /*confirmation*/ ctx[2].message + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*confirmation*/ 4 && t2_value !== (t2_value = /*confirmation*/ ctx[2].prompt.caption + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(button1);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(22:1) {:else}",
    		ctx
    	});

    	return block;
    }

    // (19:1) {#if message}
    function create_if_block_1$1(ctx) {
    	let p;
    	let t0;
    	let t1;
    	let button;
    	let dispose;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text(/*message*/ ctx[1]);
    			t1 = space();
    			button = element("button");
    			button.textContent = "×";
    			add_location(p, file$3, 19, 1, 417);
    			attr_dev(button, "type", "button");
    			add_location(button, file$3, 20, 1, 435);
    			dispose = listen_dev(button, "click", /*dismiss*/ ctx[4], false, false, false);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*message*/ 2) set_data_dev(t0, /*message*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(19:1) {#if message}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let if_block_anchor;
    	let if_block = (/*message*/ ctx[1] || /*confirmation*/ ctx[2]) && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*message*/ ctx[1] || /*confirmation*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { type = null } = $$props;
    	let { message = null } = $$props;
    	let { confirmation = null } = $$props;

    	function confirm(action) {
    		action();
    		dismiss();
    	}

    	function dismiss() {
    		$$invalidate(0, type = $$invalidate(1, message = $$invalidate(2, confirmation = null)));
    	}

    	const writable_props = ["type", "message", "confirmation"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Notification> was created with unknown prop '${key}'`);
    	});

    	const click_handler = ev => confirm(confirmation.prompt.action);

    	$$self.$set = $$props => {
    		if ("type" in $$props) $$invalidate(0, type = $$props.type);
    		if ("message" in $$props) $$invalidate(1, message = $$props.message);
    		if ("confirmation" in $$props) $$invalidate(2, confirmation = $$props.confirmation);
    	};

    	$$self.$capture_state = () => {
    		return { type, message, confirmation };
    	};

    	$$self.$inject_state = $$props => {
    		if ("type" in $$props) $$invalidate(0, type = $$props.type);
    		if ("message" in $$props) $$invalidate(1, message = $$props.message);
    		if ("confirmation" in $$props) $$invalidate(2, confirmation = $$props.confirmation);
    	};

    	return [type, message, confirmation, confirm, dismiss, click_handler];
    }

    class Notification extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { type: 0, message: 1, confirmation: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Notification",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get type() {
    		throw new Error("<Notification>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set type(value) {
    		throw new Error("<Notification>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get message() {
    		throw new Error("<Notification>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set message(value) {
    		throw new Error("<Notification>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get confirmation() {
    		throw new Error("<Notification>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set confirmation(value) {
    		throw new Error("<Notification>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* components/field/index.svelte generated by Svelte v3.16.7 */

    const file$4 = "components/field/index.svelte";

    function create_fragment$4(ctx) {
    	let label;
    	let b;
    	let t0;
    	let t1;
    	let input;
    	let dispose;

    	const block = {
    		c: function create() {
    			label = element("label");
    			b = element("b");
    			t0 = text(/*caption*/ ctx[1]);
    			t1 = space();
    			input = element("input");
    			add_location(b, file$4, 5, 1, 56);
    			attr_dev(input, "type", "text");
    			add_location(input, file$4, 6, 1, 74);
    			add_location(label, file$4, 4, 0, 47);

    			dispose = [
    				listen_dev(input, "input", /*input_input_handler*/ ctx[3]),
    				listen_dev(input, "change", /*change_handler*/ ctx[2], false, false, false)
    			];
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, b);
    			append_dev(b, t0);
    			append_dev(label, t1);
    			append_dev(label, input);
    			set_input_value(input, /*value*/ ctx[0]);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*caption*/ 2) set_data_dev(t0, /*caption*/ ctx[1]);

    			if (dirty & /*value*/ 1 && input.value !== /*value*/ ctx[0]) {
    				set_input_value(input, /*value*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { caption } = $$props, { value } = $$props;
    	const writable_props = ["caption", "value"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Field> was created with unknown prop '${key}'`);
    	});

    	function change_handler(event) {
    		bubble($$self, event);
    	}

    	function input_input_handler() {
    		value = this.value;
    		$$invalidate(0, value);
    	}

    	$$self.$set = $$props => {
    		if ("caption" in $$props) $$invalidate(1, caption = $$props.caption);
    		if ("value" in $$props) $$invalidate(0, value = $$props.value);
    	};

    	$$self.$capture_state = () => {
    		return { caption, value };
    	};

    	$$self.$inject_state = $$props => {
    		if ("caption" in $$props) $$invalidate(1, caption = $$props.caption);
    		if ("value" in $$props) $$invalidate(0, value = $$props.value);
    	};

    	return [value, caption, change_handler, input_input_handler];
    }

    class Field extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { caption: 1, value: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Field",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || ({});

    		if (/*caption*/ ctx[1] === undefined && !("caption" in props)) {
    			console.warn("<Field> was created without expected prop 'caption'");
    		}

    		if (/*value*/ ctx[0] === undefined && !("value" in props)) {
    			console.warn("<Field> was created without expected prop 'value'");
    		}
    	}

    	get caption() {
    		throw new Error("<Field>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set caption(value) {
    		throw new Error("<Field>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Field>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Field>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    class Record {
    	constructor(data) {
    		let ctor = this.constructor;
    		if(!ctor._normalized) { // generate accessors
    			ctor._normalized = Object.entries(ctor.slots).
    				reduce((memo, [slot, handler]) => {
    					makeAccessors(ctor.prototype, slot, handler);
    					return handler ? memo.concat(slot) : memo;
    				}, []);
    		}

    		this._data = data;
    	}

    	toJSON() {
    		let { _normalized } = this.constructor;
    		let { _data } = this;
    		if(!_normalized.length) {
    			return _data;
    		}
    		// ensure normalized values' `#toJSON` is used if present
    		return _normalized.reduce((memo, slot) => {
    			let value = this[slot];
    			memo[slot] = value && jsonify(value);
    			return memo;
    		}, Object.assign({}, _data));
    	}
    }

    function makeAccessors(proto, slot, handler) {
    	Object.defineProperty(proto, slot, {
    		get() {
    			let value = this._data[slot];
    			return handler ? handler(value) : value;
    		},
    		set(value) {
    			this._data[slot] = value; // XXX: asymmetrical; skips `handler` normalization
    		}
    	});
    }

    function jsonify(value) {
    	if(value.pop) {
    		return value.map(jsonify);
    	}
    	return value.toJSON ? value.toJSON() : value;
    }

    /* eslint-env browser */

    // adapted from uitil
    function httpRequest(method, uri, headers, body, { cors, strict } = {}) {
    	let options = {
    		method,
    		credentials: cors ? "include" : "same-origin"
    	};
    	if(headers) {
    		options.headers = headers;
    	}
    	if(body) {
    		options.body = body;
    	}

    	let res = fetch(uri, options);
    	return !strict ? res : res.then(res => {
    		if(!res.ok) {
    			throw new Error(`unexpected ${res.status} response at ${uri}`);
    		}
    		return res;
    	});
    }

    let idify = str => str.toLowerCase().replace(/ /g, "_"); // XXX: insufficient

    class Store extends Record {
    	static get slots() {
    		return {
    			title: null,
    			tagline: null,
    			lists: collection(List)
    		};
    	}

    	static async load(uri) {
    		let res = await httpRequest("GET", uri, null, null, { strict: true });
    		let etag = res.headers.get("ETag");
    		res = await res.json();
    		return new Store(res, uri, etag);
    	}

    	constructor(data, uri, etag) {
    		super(data);
    		this.unsafe = !etag;
    		this._origin = { uri, etag };
    	}

    	async save() {
    		let { uri, etag } = this._origin;
    		let headers = etag && {
    			"If-Match": etag
    		};
    		let payload = JSON.stringify(this);
    		await httpRequest("PUT", uri, headers, payload, { strict: true });
    	}
    }

    class List extends Record {
    	static get slots() {
    		return {
    			title: null,
    			items: collection(Item)
    		};
    	}

    	addItem(caption) {
    		let item = new Item({ caption });
    		this._data.items.push(item);
    	}

    	removeItem(index) {
    		this._data.items.splice(index, 1);
    	}

    	get id() {
    		return `list-${idify(this.title)}`;
    	}
    }

    class Item extends Record {
    	static get slots() {
    		return {
    			caption: null,
    			done: value => !!value
    		};
    	}

    	toJSON() {
    		// optimize payload by discarding implicit values
    		return this.done ? this._data : Object.assign({}, this._data, {
    			done: undefined
    		});
    	}
    }

    function collection(model) {
    	return items => items.map(item => new model(item)); // eslint-disable-line new-cap
    }

    // adapted from uitil
    function debounce(delay, fn) {
    	let timer;
    	return (...args) => {
    		if(timer) {
    			clearTimeout(timer);
    			timer = null;
    		}
    		timer = setTimeout(() => {
    			fn(...args);
    			timer = null;
    		}, delay);
    	};
    }

    /* components/app/index.svelte generated by Svelte v3.16.7 */

    const { Error: Error_1 } = globals;
    const file$5 = "components/app/index.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[15] = list[i];
    	return child_ctx;
    }

    // (99:0) <Panel id={HOME_ID}>
    function create_default_slot_1(ctx) {
    	let header;
    	let h1;
    	let t0_value = /*metadata*/ ctx[0].title + "";
    	let t0;
    	let t1;
    	let p;
    	let t2_value = /*metadata*/ ctx[0].tagline + "";
    	let t2;
    	let t3;
    	let current;

    	const toc = new Toc({
    			props: {
    				entries: /*lists*/ ctx[1].concat(/*CONFIG*/ ctx[5]).map(func)
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			header = element("header");
    			h1 = element("h1");
    			t0 = text(t0_value);
    			t1 = space();
    			p = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			create_component(toc.$$.fragment);
    			add_location(h1, file$5, 100, 2, 2329);
    			add_location(p, file$5, 101, 2, 2357);
    			add_location(header, file$5, 99, 1, 2318);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, h1);
    			append_dev(h1, t0);
    			append_dev(header, t1);
    			append_dev(header, p);
    			append_dev(p, t2);
    			insert_dev(target, t3, anchor);
    			mount_component(toc, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty & /*metadata*/ 1) && t0_value !== (t0_value = /*metadata*/ ctx[0].title + "")) set_data_dev(t0, t0_value);
    			if ((!current || dirty & /*metadata*/ 1) && t2_value !== (t2_value = /*metadata*/ ctx[0].tagline + "")) set_data_dev(t2, t2_value);
    			const toc_changes = {};
    			if (dirty & /*lists*/ 2) toc_changes.entries = /*lists*/ ctx[1].concat(/*CONFIG*/ ctx[5]).map(func);
    			toc.$set(toc_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(toc.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(toc.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			if (detaching) detach_dev(t3);
    			destroy_component(toc, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(99:0) <Panel id={HOME_ID}>",
    		ctx
    	});

    	return block;
    }

    // (108:0) {#each lists as list}
    function create_each_block_1(ctx) {
    	let current;

    	const checklist = new Checklist({
    			props: {
    				list: /*list*/ ctx[15],
    				home: /*HOME_ID*/ ctx[4]
    			},
    			$$inline: true
    		});

    	checklist.$on("change", function () {
    		if (is_function(/*save*/ ctx[3])) /*save*/ ctx[3].apply(this, arguments);
    	});

    	const block = {
    		c: function create() {
    			create_component(checklist.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(checklist, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const checklist_changes = {};
    			if (dirty & /*lists*/ 2) checklist_changes.list = /*list*/ ctx[15];
    			checklist.$set(checklist_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(checklist.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(checklist.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(checklist, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(108:0) {#each lists as list}",
    		ctx
    	});

    	return block;
    }

    // (114:2) {#each ["title", "tagline"] as field}
    function create_each_block$2(ctx) {
    	let current;

    	const field = new Field({
    			props: {
    				caption: /*field*/ ctx[12],
    				value: /*metadata*/ ctx[0][/*field*/ ctx[12]]
    			},
    			$$inline: true
    		});

    	field.$on("change", /*updater*/ ctx[6](/*field*/ ctx[12]));

    	const block = {
    		c: function create() {
    			create_component(field.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(field, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const field_changes = {};
    			if (dirty & /*metadata*/ 1) field_changes.value = /*metadata*/ ctx[0][/*field*/ ctx[12]];
    			field.$set(field_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(field.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(field.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(field, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(114:2) {#each [\\\"title\\\", \\\"tagline\\\"] as field}",
    		ctx
    	});

    	return block;
    }

    // (112:0) <Panel id={CONFIG.id} title={CONFIG.title} home={HOME_ID}>
    function create_default_slot$1(ctx) {
    	let form;
    	let current;
    	let each_value = ["title", "tagline"];
    	let each_blocks = [];

    	for (let i = 0; i < 2; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			form = element("form");

    			for (let i = 0; i < 2; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(form, file$5, 112, 1, 2645);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);

    			for (let i = 0; i < 2; i += 1) {
    				each_blocks[i].m(form, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*metadata, updater*/ 65) {
    				each_value = ["title", "tagline"];
    				let i;

    				for (i = 0; i < 2; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(form, null);
    					}
    				}

    				group_outros();

    				for (i = 2; i < 2; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < 2; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < 2; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(112:0) <Panel id={CONFIG.id} title={CONFIG.title} home={HOME_ID}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let span;
    	let t0;
    	let t1;
    	let t2;
    	let current;

    	const panel0 = new Panel({
    			props: {
    				id: /*HOME_ID*/ ctx[4],
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	let each_value_1 = /*lists*/ ctx[1];
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const panel1 = new Panel({
    			props: {
    				id: /*CONFIG*/ ctx[5].id,
    				title: /*CONFIG*/ ctx[5].title,
    				home: /*HOME_ID*/ ctx[4],
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			span = element("span");
    			t0 = space();
    			create_component(panel0.$$.fragment);
    			t1 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			create_component(panel1.$$.fragment);
    			span.hidden = true;
    			add_location(span, file$5, 96, 0, 2263);
    		},
    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			/*span_binding*/ ctx[11](span);
    			insert_dev(target, t0, anchor);
    			mount_component(panel0, target, anchor);
    			insert_dev(target, t1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, t2, anchor);
    			mount_component(panel1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const panel0_changes = {};

    			if (dirty & /*$$scope, lists, metadata*/ 262147) {
    				panel0_changes.$$scope = { dirty, ctx };
    			}

    			panel0.$set(panel0_changes);

    			if (dirty & /*lists, HOME_ID, save*/ 26) {
    				each_value_1 = /*lists*/ ctx[1];
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(t2.parentNode, t2);
    					}
    				}

    				group_outros();

    				for (i = each_value_1.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			const panel1_changes = {};

    			if (dirty & /*$$scope, metadata*/ 262145) {
    				panel1_changes.$$scope = { dirty, ctx };
    			}

    			panel1.$set(panel1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(panel0.$$.fragment, local);

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			transition_in(panel1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(panel0.$$.fragment, local);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			transition_out(panel1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			/*span_binding*/ ctx[11](null);
    			if (detaching) detach_dev(t0);
    			destroy_component(panel0, detaching);
    			if (detaching) detach_dev(t1);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t2);
    			destroy_component(panel1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const func = ({ id, title }) => ({ id, caption: title });

    function instance$5($$self, $$props, $$invalidate) {
    	let HOME_ID = "panel-about";
    	let CONFIG = { id: "panel-config", title: "Settings" };
    	let store;
    	let metadata = { title: "Parson", tagline: "simple lists" };
    	let lists = [];
    	let notification = new Notification({ target: document.body });
    	let ref;

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

    	async function save(force) {
    		if (store.unsafe && force !== true) {
    			notification.$set({
    				type: "warning",
    				confirmation: clobberingPrompt
    			});

    			return;
    		}

    		try {
    			await store.save();
    		} catch(err) {
    			notification.$set({
    				type: "error",
    				message: `failed to save: ${err}`
    			});

    			throw err;
    		}
    	}

    	

    	async function init(uri) {
    		try {
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

    			if (value !== undefined) {
    				$$invalidate(0, metadata[field] = value, metadata);
    			}
    		});

    		$$invalidate(1, lists = store.lists);
    	}

    	

    	function updater(field) {
    		if (!(field in metadata)) {
    			throw new Error(`invalid field: \`${field}\``);
    		}

    		return ev => {
    			store[field] = $$invalidate(0, metadata[field] = ev.target.value, metadata);
    			save();
    		};
    	}

    	

    	function span_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			$$invalidate(2, ref = $$value);
    		});
    	}

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ("HOME_ID" in $$props) $$invalidate(4, HOME_ID = $$props.HOME_ID);
    		if ("CONFIG" in $$props) $$invalidate(5, CONFIG = $$props.CONFIG);
    		if ("store" in $$props) store = $$props.store;
    		if ("metadata" in $$props) $$invalidate(0, metadata = $$props.metadata);
    		if ("lists" in $$props) $$invalidate(1, lists = $$props.lists);
    		if ("notification" in $$props) notification = $$props.notification;
    		if ("ref" in $$props) $$invalidate(2, ref = $$props.ref);
    		if ("clobberingPrompt" in $$props) clobberingPrompt = $$props.clobberingPrompt;
    	};

    	return [
    		metadata,
    		lists,
    		ref,
    		save,
    		HOME_ID,
    		CONFIG,
    		updater,
    		store,
    		notification,
    		clobberingPrompt,
    		init,
    		span_binding
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    new App({ // eslint-disable-line no-new
    	target: document.querySelector("#app")
    });

}());
//# sourceMappingURL=bundle.js.map
