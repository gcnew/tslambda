
export {
    /* Types */
    Maybe, List,

    Either, left, right,

    /* Data */
    // Nothing, Nil

    /* functions */
    just, fromJust, cons, concat, bindMb,

    /* Map-like */
    lookup,

    /* Set-like */
    elem,

    foldl, foldr, map, filter, zip, find,

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
        throw new Error(msg || 'Maybe.fromJust: Nothing');
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

type List<T> = { kind: 'nil' }
             | { kind: 'cons', val: T, rest: List<T> }

export const Nil = { kind: 'nil' as 'nil' }; // TYH

function cons<T>(x: T, xs: List<T>): List<T> {
    return { kind: 'cons', val: x, rest: xs };
}

function concat<T>(xs: List<T>, ys: List<T>): List<T> {
    return foldr(xs, ys, cons);
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

function filter<T>(list: List<T>, f: (x: T) => boolean): List<T> {
    if (list.kind === 'nil') {
        return list;
    }

    return f(list.val)
        ? cons(list.val, filter(list.rest, f))
        : filter(list.rest, f);
}

function elem<T>(list: List<T>, x: T): boolean {
    if (list.kind === 'nil') {
        return false;
    }

    return list.val === x || elem(list.rest, x);
}

function map<T, R>(list: List<T>, f: (x: T) => R): List<R> {
    if (list.kind === 'nil') {
        return list;
    }

    return cons(f(list.val), map(list.rest, f));
}

function foldl<T, A>(list: List<T>, initial: A, f: (acc: A, x: T) => A): A {
    if (list.kind === 'nil') {
        return initial;
    }

    return foldl(list.rest, f(initial, list.val), f);
}

function foldr<T, A>(list: List<T>, initial: A, f: (x: T, acc: A) => A): A {
    if (list.kind === 'nil') {
        return initial;
    }

    return f(list.val, foldr(list.rest, initial, f));
}

function zip<T, V>(left: List<T>, right: List<V>): List<[T, V]> {
    if (left.kind === 'nil' || right.kind === 'nil') {
        return Nil;
    }

    return cons<[T, V]>([left.val, right.val], zip(left.rest, right.rest));
}

function assertNever(x: never): never {
    throw new Error(`Assert: not never: ${x}`);
}
