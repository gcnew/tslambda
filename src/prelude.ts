
export {
    /* Types */
    Maybe, List, State,

    Either, left, right,

    /* Data */
    // Nothing, Nil

    /* functions */
    just, fromJust, cons, bindMb,

    bindSt, returnSt, putSt,

    /* Map-like */
    lookup, assoc, set, unassoc,

    fold, map, filter, find,

    assertNever
}

type Maybe<T> = { kind: 'nothing' }
              | { kind: 'just', value: T }

export const Nothing = { kind: 'nothing' as 'nothing' }; // TYH

function just<T>(x: T): Maybe<T> {
    return { kind: 'just', value: x };
}

function fromJust<T>(x: Maybe<T>, msg?: string): T {
    if (x.kind === 'nothing') {
        throw new Error('Maybe.fromJust: Nothing');
    }

    return x.value;
}

function bindMb<T, R>(x: Maybe<T>, f: (x: T) => Maybe<R>): Maybe<R> {
    if (x.kind === 'nothing') {
        return x;
    }

    return f(x.value);
}

type Left<E>  = { kind: 'left',  value: E }
type Right<T> = { kind: 'right', value: T }
type Either<E, T> = Left<E> | Right<T>

function left<E>(x: E): Left<E> {
    return { kind: 'left', value: x };
}

function right<T>(x: T): Right<T> {
    return { kind: 'right', value: x };
}

type State<S, T> = (st: S) => [T, S]

function bindSt<S, T1, T2>(prev: State<S, T1>, f: (x: T1) => State<S, T2>): State<S, T2> {
    return (st) => {
        const [x, newSt] = prev(st);
        return f(x)(newSt);
    };
}

function returnSt<S, T>(val: T): State<S, T> {
    return (st) => [val, st];
}

export const getSt = <S>(st: S): [S, S] => [st, st]; // State<S, S>

function putSt<S>(newSt: S): State<S, {}> {
    return _ => {
        return [{}, newSt];
    };
}

type List<T> = { kind: 'nil' }
             | { kind: 'cons', val: T, rest: List<T> }

export const Nil = { kind: 'nil' as 'nil' }; // TYH

function cons<T>(x: T, xs: List<T>): List<T> {
    return { kind: 'cons', val: x, rest: xs };
}

function find<T>(list: List<T>, pred: (x: T) => boolean): Maybe<T> {
    if (list.kind === 'nil') {
        return Nothing;
    }

    if (pred(list.val)) {
        return just(list.val);
    }

    return find(list.rest, pred);
}

function lookup<K, V>(list: List<[K, V]>, x: K): Maybe<V> {
    return bindMb(
        find(list, ([key, _]) => key === x),
        ([_, val]) => just(val)
    );
}

function set<K, V>(list: List<[K, V]>, key: K, value: V): List<[K, V]> {
    return assoc(removeAll(list, key), key, value);
}

function removeAll<K, V>(list: List<[K, V]>, key: K): List<[K, V]> {
    return filter(list, ([x, _]) => x !== key);
}

// TODO: assoc key value list
// TODO: use assoc instead of cons (in checker)
function assoc<K, V>(list: List<[K, V]>, key: K, value: V): List<[K, V]> {
    return cons<[K, V]>([key, value], list);
}

function unassoc<K, V>(list: List<[K, V]>, key: K): List<[K, V]> {
    if (list.kind === 'nil') {
        return Nil;
    }

    return list.val[0] === key
        ? list.rest
        : cons(list.val, unassoc(list.rest, key));
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
