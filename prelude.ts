import {
    /* Constructor Funcs */
    lam, ap, ref, lit, native, nativeBi,

    /* Data */
    Root,

    /* Utility functions */
    makeContext, pair
} from './tslambda'

const scope = makeContext(Root, [
    nativeBi('+', (x, y) => x + y),
    nativeBi('-', (x, y) => x - y),
    nativeBi('*', (x, y) => x * y),
    nativeBi('/', (x, y) => x / y),

    native(
        '⊥', (ignored) => { throw Error('⊥'); }
    ),

    // λx.x
    pair(
        'id', lam('x', ref('x'))
    ),

    // λt.λf.t
    pair(
        'True', lam('t', lam('f', ref('t')))
    ),

    // λt.λf.t
    pair(
        'False', lam('t', lam('f', ref('f')))
    ),

    // λx.λxs.λcc.λcn.cc x xs
    pair(
        'Cons', lam('x', lam('xs', lam('cc', lam('cn', ap(ap(ref('cc'), ref('x')), ref('xs'))))))
    ),

    // λcc.λcn.cn Nil
    pair(
        'Nil',
        lam('cc', lam('cn', ap(ref('cn'), ref('Nil'))))
    ),

    // λxs.xs True ⊥
    pair(
        'head',
        lam('xs', ap(ap(ref('xs'), ref('True')), ref('⊥')))
    ),

    // λxs.xs False ⊥
    pair(
        'tail',
        lam('xs', ap(ap(ref('xs'), ref('False')), ref('⊥')))
    ),

    // λxs.xs (True (True False)) (True True)
    pair(
        'null',
        lam('xs',
            ap(
                ap(
                    ref('xs'),
                    ap(ref('True'), ap(ref('True'), ref('False')))
                ),
                ap(ref('True'), ref('True'))
            )
        )
    )
]);
