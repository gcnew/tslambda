
import { parse } from './parser'
import { Nothing, just, fromJust } from './prelude'

import {
    KVPair,

    /* Constructor Funcs */
    lam, ap, ref, lit, native, nativeBi,

    /* Data */
    Root,

    /* Utility functions */
    makeContext, pair
} from './tslambda'


export const natives = makeContext(Root, [
    nativeBi('+', (x, y) => x + y),
    nativeBi('-', (x, y) => x - y),
    nativeBi('*', (x, y) => x * y),
    nativeBi('/', (x, y) => x / y),

    native(
        '⊥', (ignored) => { throw Error('⊥'); }
    )
]);

const preludeDefs: string[] = [
    'id',    'λx.x',
    'True',  'λt.λf.t',
    'False', 'λt.λf.f',
    'Cons',  'λx.λxs.λcc.λcn.cc x xs',
    'Nil',   'λcc.λcn.cn Nil',
    'head',  'λxs.xs True ⊥',
    'tail',  'λxs.xs False ⊥',
    'null',  'λxs.xs (True (True False)) (True True)',
    'pair',  'λx.λy.λf.f x y'
];

export const prelude = makeContext(natives, fromJust(compileDefs(preludeDefs)));

function compileDefs(defs: string[]) {
    if (defs.length % 2) {
        return Nothing;
    }

    const pairs: KVPair[] = [];
    for (let i = 0; i < defs.length; i += 2) {
        const tag = defs[i];
        const source = defs[i + 1];
        const expr = parse(source);

        if (expr.kind === 'nothing') {
            return Nothing;
        }

        switch (expr.value.kind) {
            case 'literal':
            case 'lambda_def':
                pairs.push(pair(tag, expr.value));
                break;

            case 'application':
            case 'native':
            case 'reference':
                return Nothing;
        }
    }

    return just(pairs);
}
