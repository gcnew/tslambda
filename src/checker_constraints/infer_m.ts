
import { List, Nil, append, Either, Left, left, right } from '../lang/prelude'
import { TypeError, InferState, TypeEnv, Constraint } from './checker_types'

export {
    InferM,

    bindM, returnM, /* getM, askM, */ putM, tellM, localM, failM
}

// type InferM a = RWST TypeEnv [Constraint] InferState (Either TypeError) a
type InferM<T> = (r: TypeEnv, st: InferState) => Either<TypeError, [T, InferState, List<Constraint>]>

function ret<T>(x: T, st: InferState, w: List<Constraint>) {
    return right<[T, InferState, List<Constraint>]>([x, st, w])
}

function bindM<T, R>(prev: InferM<T>, f: (x: T) => InferM<R>): InferM<R> {
    return (r, st) => {
        const res = prev(r, st);
        if (res.kind === 'left') {
            return res;
        }

        const [x, st2, w] = res.value;
        const res2 = f(x)(r, st2);
        if (res2.kind === 'left') {
            return res2;
        }

        const [x2, st3, w2] = res2.value;
        return ret(x2, st3, append(w, w2));
    };
}

function returnM<T>(x: T): InferM<T> {
    return (_, st) => ret(x, st, Nil);
}

export const getM: InferM<InferState> = (_, st) => {
    return ret(st, st, Nil);
};

function putM(x: InferState): InferM<void> {
    return (_r, _st) => ret(undefined, x, Nil);
}

function tellM(x: List<Constraint>): InferM<void> {
    return (_, st) => ret(undefined, st, x);
}

function localM<T>(f: (e: TypeEnv) => TypeEnv, m: InferM<T>): InferM<T> {
    return (r, st) => m(f(r), st);
}

export const askM: InferM<TypeEnv> = (r, st) => ret(r, st, Nil);

function failM(reason: TypeError): (r: TypeEnv, st: InferState) => Left<TypeError> {
    return (_r, _st) => left(reason);
}
