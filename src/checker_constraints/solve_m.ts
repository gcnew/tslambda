
import { TypeError } from './checker_types'
import { List, Nil, cons, foldr, Either, left, right } from '../lang/prelude'

export {
    SolveM,

    bindM, returnM, failM, mapM
}

// type SolveM a = Either TypeError a
type SolveM<T> = Either<TypeError, T>

function bindM<T, R>(prev: SolveM<T>, f: (x: T) => SolveM<R>): SolveM<R> {
    if (prev.kind === 'left') {
        return prev;
    }

    return f(prev.value);
}

function returnM<T>(x: T): SolveM<T> {
    return right(x);
}

function failM(reason: TypeError): SolveM<any> {
    return left(reason);
}

function mapM<T, R>(list: List<T>, f: (x: T) => SolveM<R>): SolveM<List<R>> {
    return foldr(
        list,

        returnM<List<R>>(Nil),

        (x, acc) => bindM(f(x), val =>
                    bindM(acc,  res =>
                    returnM(cons(val, res))))
    );
}
