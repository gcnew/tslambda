
import { parse } from './parser'
import { prelude } from './lambda_prelude'
import { show, evalExpr } from './tslambda'
import { infer } from './checker/checker'

import { fromJust, Nil } from './lang/prelude'

// infer(Nil, fromJust(parse('λtrue.λfalse.true (true false)'))); // (int -> int) -> int
console.log(infer(fromJust(parse('λf.f (f 1)')))); // (int -> int) -> int
console.log(infer(fromJust(parse('λf.f 1')))); // (int -> a) -> a
// infer(prelude, fromJust(parse('True (True False)')));
// infer(prelude, fromJust(parse('(λf.λx.f x) +'))); // ((a -> b) -> a -> b) (num -> num -> num) => num -> num -> num
// infer(prelude, fromJust(parse('λf.f 1'))); // (int -> a) -> a
// infer(prelude, fromJust(parse('λf.λx.f x'))); // (a -> b) -> a -> b
// infer(prelude, fromJust(parse('λt.λf.t'))); // a -> b -> a
// infer(prelude, fromJust(parse('(λf.λx.f x) + 1'))); // ((a -> b) -> a -> b) (num -> num -> num) num => num -> num
// infer(prelude, fromJust(parse('λx.λx.x'))); // a -> b -> b
// infer(prelude, fromJust(parse('λx.λxs.λcc.λcn.cc x xs')));
// infer(prelude, fromJust(parse(`head`)));
// infer(prelude, fromJust(parse(`Cons 3 Nil`)));
// infer(prelude, fromJust(parse(`head (Cons 3 Nil)`)));
// infer(prelude, fromJust(parse(`(λxs.xs (λx.λy.x) ⊥) ((λCons.λNil.λhead.head (Cons 3 Nil)) (λx.λxs.λcc.λcn.cc x xs) (λcc.λcn.cn))`)));
// infer(prelude, fromJust(parse(`(λCons.λNil.λhead (Cons 3 (Cons 4 Nil))) (λx.λxs.λcc.λcn.cc x xs) (λcc.λcn.cn) (λxs.xs (λx.λy.x) ⊥)`)));
// infer(prelude, fromJust(parse('(λf.f 1) 1'))); // Nothing
// infer(fromJust(parse('λx.x x'))); // Nothing

console.log(show(
    fromJust(parse('λf.f (λx.x) + 1'))
));

parse('λf.f λx.x + 1').kind === 'nothing' || fail('What a parser :d');

console.log(show(fromJust(parse(
    '(λf.λx.f x) + 1'
))));

console.log(show(evalExpr(prelude, fromJust(parse(
    '+ 3 (+ 4 5)'
)))));

console.log(show(evalExpr(Nil, fromJust(parse(
    `(λCons.λNil.λhead.head (Cons 3 Nil)) (λx.λxs.λcc.λcn.cc x xs) (λcc.λcn.cn) (λxs.xs (λx.λy.x) 0)`
)))));

console.log(show(evalExpr(prelude, fromJust(parse(
    '- 7 (/ 4 2)'
)))));

console.log(show(evalExpr(prelude, fromJust(parse(
    'head (Cons 123 Nil)'
)))));

console.log(show(evalExpr(prelude, fromJust(parse(
    'null'
)))));

console.log(show(evalExpr(prelude, fromJust(parse(
    'head Nil'
)))));

function fail(msg: string) {
    throw new Error(msg);
}
