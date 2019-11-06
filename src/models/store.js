import Record from "./record.js";
import { idify } from "../util";

export default class Store extends Record {
	static get slots() {
		return {
			title: null,
			tagline: null,
			lists: collection(List)
		};
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
