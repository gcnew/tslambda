
export {
    /* Types */
    Maybe, List,

    /* Data */
    // Nothing, Nil

    /* functions */
    just, fromJust, cons,

    /* Map-like */
    lookup, assoc, set, remove,

    fold, map, filter,

    assertNever
}

type Maybe<T> = { kind: 'nothing' }
              | { kind: 'just', value: T }

export const Nothing = { kind: 'nothing' as 'nothing' }; // TYH

function just<T>(x: T): Maybe<T> {
    return { kind: 'just', value: x };
}

function fromJust<T>(x: Maybe<T>): T {
    if (x.kind === 'nothing') {
        throw new Error('Maybe.fromJust: Nothing');
    }

    return x.value;
}

type List<T> = { kind: 'nil' }
             | { kind: 'cons', val: T, rest: List<T> }

export const Nil = { kind: 'nil' as 'nil' }; // TYH

function cons<T>(x: T, xs: List<T>): List<T> {
    return { kind: 'cons', val: x, rest: xs };
}

function lookup<K, V>(list: List<[K, V]>, x: K): Maybe<V> {
    if (list.kind === 'nil') {
        return Nothing;
    }

    if (list.val[0] === x) {
        return just(list.val[1]);
    }

    return lookup(list.rest, x);
}

function remove<K, V>(list: List<[K, V]>, key: K): List<[K, V]> {
    return filter(list, ([x, _]) => x === key);
}

function set<K, V>(list: List<[K, V]>, key: K, value: V): List<[K, V]> {
    return assoc(remove(list, key), key, value);
}

function assoc<K, V>(list: List<[K, V]>, key: K, value: V): List<[K, V]> {
    return cons<[K, V]>([key, value], list);
}

function filter<T>(list: List<T>, f: (x: T) => boolean): List<T> {
    if (list.kind === 'nil') {
        return list;
    }

    return f(list.val)
        ? cons(list.val, filter(list.rest, f))
        : filter(list.rest, f);
}

function map<T, R>(list: List<T>, f: (x: T) => R): List<R> {
    if (list.kind === 'nil') {
        return list;
    }

    return cons(f(list.val), map(list.rest, f));
}

function fold<T, A>(list: List<T>, initial: A, f: (acc: A, x: T) => A): A {
    if (list.kind === 'nil') {
        return initial;
    }

    return fold(list.rest, f(initial, list.val), f);
}

function assertNever(x: never): never {
    throw new Error(`Assert: not never: ${x}`);
}
