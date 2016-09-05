


/*
add x y = x + y
test = add 3 (add 4 5)

λx.λy.
*/

console.log(show(
    evalExpr(
        scope,
        ap(ap(ref('+'), lit(3)), ap(ap(ref('+'), lit(4)), lit(5)))
    )
));

console.log(show(
    evalExpr(
        scope,
        ap(ref('head'), ap(ap(ref('Cons'), lit(123)), ref('Nil')))
    )
));

console.log(show(
    evalExpr(
        scope,
        ap(ref('head'), ref('Nil'))
    )
));
