
import { TypeError, InferState } from './checker_types'
import { List, Nil, cons, foldr, Either, left, right } from '../lang/prelude'

export {
    InferM,

    bindM, returnM, /* getM, */ putM, failM, mapM
}

// type InferM a = StateT InferState (Either TypeError) a
type InferM<T> = (st: InferState) => Either<TypeError, [T, InferState]>

function bindM<T, R>(prev: InferM<T>, f: (x: T) => InferM<R>): InferM<R> {
    return st => {
        const res = prev(st);

        if (res.kind === 'left') {
            return res;
        }

        const [x, newSt] = res.value;
        return f(x)(newSt);
    };
}

function returnM<T>(x: T): InferM<T> {
    return (st) => right<[T, InferState]>([x, st]);
}

export const getM: InferM<InferState> = st => {
    return right<[InferState, InferState]>([st, st]);
};

function putM(x: InferState): InferM<void> {
    return _ => right<[void, InferState]>([undefined, x]);
}

function failM(reason: TypeError): InferM<any> {
    return _ => left(reason);
}

function mapM<T, R>(list: List<T>, f: (x: T) => InferM<R>): InferM<List<R>> {
    return foldr(
        list,

        returnM<List<R>>(Nil),

        (x, acc) => bindM(f(x), val =>
                    bindM(acc,  res =>
                    returnM(cons(val, res))))
    );
}
