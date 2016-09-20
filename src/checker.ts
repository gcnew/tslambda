
import { Expr, Reference, LambdaDef, Application, show } from './tslambda'
import {
    State, bindSt, returnSt, getSt, putSt,

    Maybe, Nothing, just, fromJust, bindMb,

    List, Nil, lookup, cons, find, unassoc,

    assertNever
} from './prelude'

export {
    pub_infer as infer
}

type TyPoly  = { kind: 'ty_poly',  id: number }
type TyMono  = { kind: 'ty_mono',  id: number, name?: string }
type TyArrow = { kind: 'ty_arrow', id: number, from: Type, to: Type }

type Type = TyMono
          | TyPoly
          | TyArrow

type InferCtx = {
    idCounter: number,
    bindMap: List<[string, number]>,
    typeMap: List<[number, Type]>
}

type TypeExt = { type: Type }
type InferRes = Maybe<[InferCtx, Type]>

// type MInfer a = StateT InferRes Maybe a
type MInfer<T> = (st: InferCtx) => Maybe<[T, InferCtx]>

function bindMi<T, R>(prev: MInfer<T>, f: (x: T) => MInfer<R>): MInfer<R> {
    return st => {
        const res = prev(st);
        return bindMb(res, ([x, newSt]) => f(x)(newSt));
    };
}

function returnMi<T>(x: T): MInfer<T> {
    return (st) => just<[T, InferCtx]>([x, st]);
}

const getMi: MInfer<InferCtx> = st => {
    return just<[InferCtx, InferCtx]>([st, st]);
};

function putMi(x: InferCtx): MInfer<{}> {
    return (_) => just<[{}, InferCtx]>([{}, x]);
}

const failMi = (x: any) => Nothing;

function mkType<T extends Type>(f: (id: number) => T): MInfer<T> {
    /**
         do st@{ idCounter, bindMap, typeMap } <- getMi

            let key = name || 'm' + st.idCounter
                type = { kind: 'ty_mono', name: key, id: idCounter }
                newCtx = {
                    idCountr: idCounter + 1,
                    bindMap: cons([key, idCounter], bindMap),
                    typeMap: cons([idCounter, type], typeMap)
                }

            putMi newCtx
            returnMi type
    **/

    return bindMi(getMi, ({idCounter, bindMap, typeMap}) => {
        const type = f(idCounter);
        const newContext = {
            bindMap: bindMap,

            idCounter: idCounter + 1,
            typeMap: cons<[number, Type]>([idCounter, type], typeMap)
        };

        return bindMi(
            putMi(newContext), (_) =>
            returnMi(type)
        );
    });
}

const poly: MInfer<TyPoly> = mkType(id => ({ kind: 'ty_poly', id: id }));

function mono(name?: string): MInfer<TyMono> {
    return mkType(id => ({ kind: 'ty_mono', id: id, name: name }));
}

function arrow(from: Type, to: Type): MInfer<TyArrow> {
    return mkType(id => ({ kind: 'ty_arrow', id: id, from: from, to: to }));
}

function bindVar(name: string, type: Type): MInfer<{}> {
    return bindMi(getMi, ({idCounter, bindMap, typeMap}) => {
        const newContext = {
            typeMap: typeMap,
            idCounter: idCounter,

            bindMap: cons<[string, number]>([name, type.id], bindMap)
        };

        return putMi(newContext);
    });
}

function unbindVar(name: string): MInfer<{}> {
    return bindMi(getMi, ({idCounter, bindMap, typeMap}) => {
        const newContext = {
            typeMap: typeMap,
            idCounter: idCounter,
            bindMap: unassoc(bindMap, name)
        };

        return putMi(newContext);
    });
}

const { int, nativeContext } = (() => {
    /**
        do bottom    <- poly
           int       <- mono('int')
           int2int   <- arrow(int, int)
           arithType <- arrow(int, int2int)

           bindVar('+', arithType)
           bindVar('-', arithType)
           bindVar('/', arithType)
           bindVar('*', arithType)
           bindVar('⊥', bottom)

           ctx <- getMi
           return { int, nativeContext: ctx }
    */

    const initial = { idCounter: 0, bindMap: Nil, typeMap: Nil };
    const comp = bindMi(poly,                bottom =>
                 bindMi(mono('int'),         int =>
                 bindMi(arrow(int, int),     int2int =>
                 bindMi(arrow(int, int2int), arithType =>

                 bindMi(bindVar('+', arithType), _ =>
                 bindMi(bindVar('-', arithType), _ =>
                 bindMi(bindVar('/', arithType), _ =>
                 bindMi(bindVar('*', arithType), _ =>
                 bindMi(bindVar('⊥', bottom),    _ =>

                 bindMi(getMi,   ctx =>
                 returnMi({ int, nativeContext: ctx })

                 ))))))))));

    return fromJust(comp(initial))[0];
})();

function mkNameFromId(id: number) {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const idx = (id / alphabet.length) | 0;
    const suffix = idx !== 0 ? idx : '';

    return alphabet[id % alphabet.length] + suffix;
}

function showType(type: Type): string {
    switch (type.kind) {
        case 'ty_mono':
            return type.name || mkNameFromId(type.id);

        case 'ty_poly':
            return mkNameFromId(type.id);

        case 'ty_arrow': {
            const fromStr = type.from.kind !== 'ty_arrow'
                ? showType(type.from)
                : '(' + showType(type.from) + ')';

            return fromStr + ' -> ' + showType(type.to);
        }
    }
}

function getTypeById(ctx: InferCtx, typeId: number): Type {
    return fromJust(lookup(ctx.typeMap, typeId), 'ASSERT: Type not found');
}

function printContext(ctx: InferCtx) {
    let str = '';

    let c = ctx.bindMap;
    while (c.kind !== 'nil') {
        str += pad(c.val[0] + ':', 5) + showType(getTypeById(ctx, c.val[1])) + ',\n';
        c = c.rest;
    }

    console.log(str);
}

function pad(str: string, len: number): string {
    for (let i = str.length; i < len; ++i) {
        str += ' ';
    }
    return str;
}

function pub_infer(expr: Expr): void {
    // const res = infer(initialCtx, expr);
    // let type = res.kind === 'nothing'
    //     ? 'Nothing'
    //     : showType(res.value[1]);

    // console.log(pad(show(expr), 25) + ' :: ' + type);
    printContext(nativeContext);
}

function infer(expr: Expr): MInfer<Type> {
    switch (expr.kind) {
        case 'literal':     return returnMi(int);
        case 'native':      return failMi;
        case 'reference':   return inferReference(expr);
        case 'application': return inferApplication(expr);
        case 'lambda_def':  return inferLambda(expr);
    }
}

function inferReference(expr: Reference): MInfer<Type> {
    return bindMi(getMi, ctx => {
        const res = lookup(ctx.bindMap, expr.name);
        if (res.kind === 'nothing') {
            return failMi;
        }

        return returnMi(getTypeById(ctx, res.value));
    });
}

function inferApplication(exp: Application): MInfer<Type> {
    return null as any;
    // const argRes = infer(ctx, expr.arg);
    // if (argRes.kind === 'nothing') {
    //     return Nothing;
    // }

    // const [argCtx, argType] = argRes.value;
    // const funcRes = infer(argCtx, expr.func);
    // if (funcRes.kind === 'nothing') {
    //     return Nothing;
    // }


    // const [funCtx, funType] = funcRes.value;
    // if (funType.kind !== 'ty_arrow') {
    //     if (funType.kind === 'ty_mono') {
    //         console.log(`Not a function: ${showType(funType)}`);
    //         return Nothing;
    //     }

    //     const pType = poly();
    //     const rType = arrow(argType, pType);

    //     return ret(
    //         setType(funCtx, expr.func, rType),
    //         pType
    //     );
    // }

    // let rCtx: InferCtx;
    // let applied: Maybe<Type>;
    // if (argType.kind === 'ty_poly') {
    //     const frType = instantiate(funType, argType, funType.from);
    //     rCtx = setType(funCtx, expr.func, frType);
    //     applied = typeApply(frType, funType.from);
    // } else {
    //     rCtx = funCtx;
    //     applied = typeApply(funType, argType)
    // }

    // if (applied.kind === 'nothing') {
    //     return Nothing;
    // }

    // return ret(rCtx, applied.value);
}

function inferLambda(expr: LambdaDef): MInfer<Type> {
    return bindMi(poly,                   a =>
           bindMi(bindVar(expr.param, a), _ =>
           bindMi(infer(expr.body),       bodyType =>
           bindMi(unbindVar(expr.param),  _ =>
               arrow(a, bodyType)
           ))));
}

// function instantiate(type: Type, oldType: TyPoly, newType: Type): Type {
//     switch (type.kind) {
//         case 'ty_mono':
//             return type;

//         case 'ty_poly':
//             return type === oldType ? newType : type;

//         case 'ty_arrow': {
//             const head = instantiate(type.from, oldType, newType);
//             const rest = instantiate(type.to, oldType, newType);

//             if (head === type.from && rest === type.to) {
//                 return type;
//             }

//             return arrow(head, rest);
//         }
//     }
// }

// function typeApply(to: Type, x: Type): Maybe<Type> {
//     if (to.kind !== 'ty_arrow') {
//         return Nothing;
//     }

//     if (x.kind === 'ty_mono') {
//         switch (to.from.kind) {
//             case 'ty_arrow':
//                 return Nothing;

//             case 'ty_mono':
//                 if (x.id !== to.from.id) {
//                     return Nothing;
//                 }

//                 return just(to.to);

//             case 'ty_poly':
//                 return just(instantiate(to, to.from, x));
//         }

//         return assertNever(to.from);
//     }

//     if (x.kind === 'ty_poly') {
//         switch (to.from.kind) {
//             case 'ty_arrow':
//             case 'ty_mono':
//                 return Nothing;

//             case 'ty_poly':
//                 return just(instantiate(to, to.from, x));
//         }

//         return assertNever(to.from);
//     }

//     if (x.kind === 'ty_arrow') {
//         switch (to.from.kind) {
//             case 'ty_mono':
//                 return Nothing;

//             case 'ty_poly':
//                 return just(instantiate(to, to.from, x));

//             case 'ty_arrow': {
//                 let php = to.from;

//                 outer: while (true) {
//                     let bbc = <Type> php;
//                     let jjk: Type = x;
//                     // console.log(showType(bbc));
//                     // console.log(showType(jjk));

//                     while (true) {
//                         if (bbc === jjk) {
//                             return just(php);
//                         }

//                         if (bbc.kind === 'ty_poly') {
//                             php = <TyArrow> instantiate(php, bbc, jjk);
//                             continue outer;
//                         }

//                         if (bbc.kind === 'ty_arrow' && jjk.kind === 'ty_arrow') {
//                             if (bbc.from !== jjk.from) {
//                                 bbc = bbc.from;
//                                 jjk = jjk.from;
//                             } else {
//                                 bbc = bbc.to;
//                                 jjk = jjk.to;
//                             }

//                             continue;
//                         }

//                         return Nothing;
//                     }
//                 }
//             }
//         }

//         return assertNever(to.from);
//     }

//     return assertNever(x);
// }

// function ret(ctx: InferCtx, type: Type): InferRes {
//     return just<[InferCtx, Type]>([ctx, type]);
// }

/*

infer function => x: param
infer return => typeof x
=> x: a
=> a -> a

function f(x) {
    return x;
}

infer function => x: param, y: param
infer return => int
  infer x + y => x: int, y: int
=> x: int, y: int
=> int -> int -> int

function g(x, y) {
    return x + y;
}

*/
