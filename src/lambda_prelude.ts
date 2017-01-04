
import { parse } from './parser'
import { Nothing, just, fromJust } from './lang/prelude'

import {
    CtxEntry,

    /* Constructor Funcs */
    native, nativeBi,

    /* Data */
    CtxRoot,

    /* Utility functions */
    makeContext, ctxEntry
} from './tslambda'


export const natives = makeContext(CtxRoot, [
    nativeBi('+', (x, y) => x + y),
    nativeBi('-', (x, y) => x - y),
    nativeBi('*', (x, y) => x * y),
    nativeBi('/', (x, y) => x / y),

    native(
        '⊥', (_ignored) => { throw Error('⊥'); }
    )
]);

const preludeDefs: string[] = [
    'id',    'λx.x',
    'True',  'λt.λf.t',
    'False', 'λt.λf.f',
    'Cons',  'λx.λxs.λcc.λcn.cc x xs',
    'Nil',   'λcc.λcn.cn',
    'head',  'λxs.xs True ⊥',
    'tail',  'λxs.xs False ⊥',
    'null',  'λxs.xs (True (True False)) True',
    'pair',  'λx.λy.λf.f x y',
    'fst',   'λp.p True',
    'snd',   'λp.p False'
];

export const prelude = makeContext(natives, fromJust(compileDefs(preludeDefs)));

function compileDefs(defs: string[]) {
    if (defs.length % 2) {
        return Nothing;
    }

    const pairs: CtxEntry[] = [];
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
                pairs.push(ctxEntry(tag, expr.value));
                break;

            case 'application':
            case 'native':
            case 'reference':
                return Nothing;
        }
    }

    return just(pairs);
}
