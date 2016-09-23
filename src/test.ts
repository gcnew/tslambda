
import { parse } from './parser'
import { fromJust } from './prelude'
import { prelude } from './lambda_prelude'
import { show, evalExpr } from './tslambda'
import { infer } from './checker'

infer(fromJust(parse('λf.f 1'))); // (int -> a) -> a
infer(fromJust(parse('λf.f (f 1)'))); // (int -> int) -> int
infer(fromJust(parse('(λf.λx.f x) +'))); // ((a -> b) -> a -> b) (num -> num -> num) => num -> num -> num
infer(fromJust(parse('λf.λx.f x'))); // (a -> b) -> a -> b
infer(fromJust(parse('λt.λf.t'))); // a -> b -> a
infer(fromJust(parse('(λf.λx.f x) + 1'))); // ((a -> b) -> a -> b) (num -> num -> num) num => num -> num
infer(fromJust(parse('λx.λx.x'))); // a -> b -> b
infer(fromJust(parse('λx.λxs.λcc.λcn.cc x xs')));
infer(fromJust(parse('λx.x x'))); // Nothing
infer(fromJust(parse('(λf.f 1) 1'))); // Nothing

console.log(show(
    fromJust(parse('λf.f (λx.x) + 1'))
));

parse('λf.f λx.x + 1').kind === 'nothing' || fail('What a parser :d');

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

function fail(msg: string) {
    throw new Error(msg);
}
