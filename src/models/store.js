import Record from "./record.js";
import httpRequest from "../util/http";
import { idify } from "../util";

export default class Store extends Record {
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
