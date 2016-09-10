
import { parse } from './parser'
import { fromJust } from './prelude'
import { prelude } from './lambda_prelude'
import { show, evalExpr } from './tslambda'


console.log(show(
    fromJust(parse('(λf.λx.f x) + 1'))
));

console.log(show(
    evalExpr(
        prelude,
        fromJust(parse('+ 3 (+ 4 5)'))
    )
));

console.log(show(
    evalExpr(
        prelude,
        fromJust(parse('- 7 (/ 4 2)'))
    )
));

console.log(show(
    evalExpr(
        prelude,
        fromJust(parse('head (Cons 123 Nil)'))
    )
));

console.log(show(
    evalExpr(
        prelude,
        fromJust(parse('null'))
    )
));

console.log(show(
    evalExpr(
        prelude,
        fromJust(parse('head Nil'))
    )
));
