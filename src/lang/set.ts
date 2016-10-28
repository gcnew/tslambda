import {
    List,

    Nil,

    cons, foldl, filter, elem
} from './prelude'

export {
    Set,

    insert, singleton,

    join, difference, elem as member, toList
}

type Set<T> = List<T>

export const empty = Nil;

function join<T>(left: Set<T>, right: Set<T>): Set<T> {
    return foldl(left, right, (res, x) => elem(right, x) ? res
                                                         : cons(x, res));
}

function difference<T>(left: Set<T>, right: Set<T>): Set<T> {
    const temp = foldl<T, Set<T>>(left, empty, (res, x) => elem(right, x) ? res
                                                                          : cons(x, res));

    return foldl(right, temp, (res, x) => elem(left, x) ? res
                                                        : cons(x, res));
}

function insert<T>(x: T, set: Set<T>) {
    return cons(
        x,
        filter(set, val => val === x)
    );
}

function singleton<T>(x: T) {
    return insert(x, empty);
}

function toList<T>(set: Set<T>): List<T> {
    return set;
}
