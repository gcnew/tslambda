import {
    List, Maybe,

    Nil,

    cons, filter, foldl, lookup, find, elem,
} from './prelude'

import * as Prelude from './prelude'

export {
    Map,

    lookup, set, removeAll, insert, unassoc, elems,

    fromList, fromObject, singleton,

    map,

    member, union
}


type Map<K, V> = List<[K, V]>

export const empty = Nil;

function set<K, V>(key: K, value: V, map: Map<K, V>): Map<K, V> {
    return insert(key, value, removeAll(map, key));
}

function removeAll<K, V>(map: Map<K, V>, key: K): Map<K, V> {
    return filter(map, ([x, _]) => x !== key);
}

function insert<K, V>(key: K, value: V, map: Map<K, V>): Map<K, V> {
    return cons<[K, V]>([key, value], map);
}

function unassoc<K, V>(map: Map<K, V>, key: K): Map<K, V> {
    if (map.kind === 'nil') {
        return empty;
    }

    return map.val[0] === key
        ? map.rest
        : cons(map.val, unassoc(map.rest, key));
}

function elems<K, V>(map: Map<K, V>): List<V> {
    return foldl<[K, V], List<V>>(map, empty, (acc, [_, v]) => cons(v, acc));
}

function map<K, V, V2>(map: Map<K,V>, f: (val: V) => V2): Map<K, V2> {
    return Prelude.map<[K, V], [K, V2]>(map, ([key, val]) => [key, f(val)]);
}

function member<K, V>(map: Map<K, V>, key: K) {
    return find(map, ([k, _]) => k == key).kind == 'just';
}

function union<K, V>(left: Map<K, V>, right: Map<K, V>) {
    return foldl(left, right, (res, [key, val]) => member(res, key) ? res
                                                                    : insert(key, val, res));
}

function singleton<K, V>(key: K, value: V): Map<K, V> {
    return insert(key, value, empty);
}

function fromList<K, V>(pairs: List<[K, V]>): Map<K, V> {
    return pairs;
}

function fromObject<V>(obj: { [key: string]: V }): Map<string, V> {
    return Object.keys(obj).reduceRight<Map<string, V>>((res, key) => {
        return insert(key, obj[key], res);
    }, Nil);
}
