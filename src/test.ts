
import { parse } from './parser'
import { prelude } from './lambda_prelude'
import { Context, evalExpr, show } from './tslambda'
import { infer } from './checker/checker'

import { fromJust, Nil } from './lang/prelude'

testInfer('λtrue.λfalse.true (true false)', `(a -> a) -> a -> a`);
testInfer('λf.f (f 1)',                     `(int -> int) -> int`);
testInfer('λx.x x',                         `Infinite type: Cannot unify 'a' with 'a -> b'`, false);
testInfer('(λf.f 1) 1',                     `Cannot unify 'int -> c' with 'int'`,            false);
testInfer('λf.f 1',                         `(int -> a) -> a`);
testInfer('True (True False)',              `Unbound variable: True`,                        false);
testInfer('(λf.λx.f x) +',                  `int -> int -> int`);
testInfer('λf.λx.f x',                      `(a -> b) -> a -> b`);
testInfer('λt.λf.t',                        `b -> a -> b`);
testInfer('(λf.λx.f x) + 1',                `int -> int`);
testInfer('λx.λx.x',                        `a -> b -> b`);
testInfer('λx.λxs.λcc.λcn.cc x xs',         `b -> a -> (b -> a -> d) -> c -> d`);
testInfer(`head`,                           `Unbound variable: head`,                        false);
testInfer(`Cons 3 Nil`,                     `Unbound variable: Cons`,                        false);
testInfer(`head (Cons 3 Nil)`,              `Unbound variable: head`,                        false);
testInfer(`λf.(λg.f (g g)) (λg.f (g g))`,   `Infinite type: Cannot unify 'c' with 'c -> e'`, false);

testInfer(
    `(λxs.xs (λx.λy.x) ⊥) ((λCons.λNil.λhead.head (Cons 3 Nil)) (λx.λxs.λcc.λcn.cc x xs) (λcc.λcn.cn))`,
    `(int -> (a -> b -> b) -> d) -> c -> d`
);

// (\cons nil head -> head (cons 3 (cons 4 nil))) (\x xs cc cn -> cc x xs) (\cc cn -> cn) (\xs -> xs (\x y -> x) undefined)
testInfer(
    `(λCons.λNil.λhead.head (Cons 3 (Cons 4 Nil))) (λx.λxs.λcc.λcn.cc x xs) (λcc.λcn.cn) (λxs.xs (λx.λy.x) ⊥)`,
    `Infinite type: Cannot unify 'm' with '(int -> m -> p) -> o -> p'`,
    false
);


testParse('λf.f (λx.x) + 1', `λf.f (λx.x) + 1`);
testParse('(λf.λx.f x) + 1', `(λf.λx.f x) + 1`);
testParse('λf.f λx.x + 1',    undefined);


testEval(prelude, '+ 3 (+ 4 5)', '12');
testEval(prelude, '- 7 (/ 4 2)', '5');
testEval(prelude, 'head (Cons 123 Nil)', '123');
testEval(prelude, 'null', 'λxs.xs (True (True False)) True');
testEval(prelude, 'head Nil', 'λignored.<native>');

testEval(
    Nil,
    `(λCons.λNil.λhead.head (Cons 3 Nil)) (λx.λxs.λcc.λcn.cc x xs) (λcc.λcn.cn) (λxs.xs (λx.λy.x) 0)`,
    '3'
);


function testInfer(src: string, expected: string, isSuccess = true) {
    const res = infer(fromJust(parse(src)));

    if ((res.kind === 'right' !== isSuccess)
        || (res.kind === 'right' && res.value !== expected))
    {
        printDiff(src, expected, res.value);
    }
}

function testParse(src: string, expected: string|undefined) {
    const res = parse(src);

    if (res.kind === 'just') {
        const val = show(res.value);

        !expected                    && printDiff(src, "<Fail>", val);
        expected && expected !== val && printDiff(src, expected, val);
    } else {
        expected                     && printDiff(src, expected, "<Nothing>");
    }
}

function testEval(env: Context, src: string, expected: string) {
    const res = show(evalExpr(env, fromJust(parse(src))));
    res === expected || printDiff(src, expected, res);
}

function printDiff(input: string, expected: string, actual: string) {
    console.log(`Input:    ${input}`);
    console.log(`Actual:   ${actual}`);
    console.log(`Expected: ${expected}`);
    console.log();
}
