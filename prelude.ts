
export {
    /* Types */
    Maybe, List,

    /* Data */
    // Nothing, Nil

    /* functions */
    cons, just, fromJust
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
