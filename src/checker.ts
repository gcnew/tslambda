
import { Expr, LambdaDef, Application, show } from './tslambda'
import {
    Maybe, Nothing, just, fromJust, bindMb,

    Either, left, right,

    List, Nil, lookup, assoc, set, unassoc, map,
} from './prelude'

export {
    pub_infer as infer
}

type TyPoly  = { kind: 'ty_poly',  id: number }
type TyMono  = { kind: 'ty_mono',  id: number, name?: string }
type TyArrow = { kind: 'ty_arrow', id: number, from: number, to: number }

type Type = TyMono
          | TyPoly
          | TyArrow

type InferCtx = {
    idCounter: number,
    bindMap: List<[string, number]>,
    typeMap: List<[number, Either<number, Type>]>
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
         do { idCounter, bindMap, typeMap } <- getMi

            let type = f idCounter
            let newCtx = {
                    bindMap: bindMap,

                    idCounter: idCounter + 1,
                    typeMap: assoc typeMap idCounter (right type)
                }

            putMi newCtx
            returnMi type
    **/

    return bindMi(getMi, ({idCounter, bindMap, typeMap}) => {
        const type = f(idCounter);
        const newContext = {
            bindMap: bindMap,

            idCounter: idCounter + 1,
            typeMap: assoc(typeMap, idCounter, right(type))
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
    return mkType(id => ({ kind: 'ty_arrow', id: id, from: from.id, to: to.id }));
}

function bindVar(name: string, type: Type): MInfer<{}> {
    return bindMi(getMi, ({idCounter, bindMap, typeMap}) => {
        const newContext = {
            typeMap: typeMap,
            idCounter: idCounter,

            bindMap: assoc(bindMap, name, type.id)
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

function getVarType(name: string): MInfer<Type> {
    /**
        do ctx    <- getMi

           let res = lookup ctx.bindMap expr.name
           guard (res.kind === 'just')

           getType ctx res.value
    */

    return bindMi(getMi, ctx => {
        const res = lookup(ctx.bindMap, name);
        if (res.kind === 'nothing') {
            return failMi;
        }

        return getType(res.value);
    });
}

function updateType(oldType: Type, newType: Type): MInfer<Type> {
    return bindMi(getMi, ({idCounter, bindMap, typeMap}) => {
        const newContext: InferCtx = {
            typeMap: set(typeMap, oldType.id, left(newType.id)),
            idCounter: idCounter,
            bindMap: bindMap
        };

        return bindMi(putMi(newContext), _ =>
                      returnMi(newType));
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

function showType(type: Type): MInfer<string> {
    switch (type.kind) {
        case 'ty_mono':
            return returnMi(type.name || mkNameFromId(type.id));

        case 'ty_poly':
            return returnMi(mkNameFromId(type.id));

        case 'ty_arrow': {
            return bindMi(getType(type.from), fromType =>
                   bindMi(showType(fromType), fromStr0 =>
                   bindMi(getType(type.to),   toType =>
                   bindMi(showType(toType),   toStr => {
                       let fromStr = fromType.kind !== 'ty_arrow'
                           ? fromStr0
                           : '(' + fromStr0 + ')';

                       return returnMi(fromStr + ' -> ' + toStr);
                   }))));
        }
    }
}

function getType(typeId: number): MInfer<Type> {
    return bindMi(getMi, ({typeMap}) => {
        const res = lookup(typeMap, typeId);
        if (res.kind === 'nothing') {
            return failMi;
        }

        if (res.value.kind === 'right') {
            return returnMi(res.value.value);
        }

        return getType(res.value.value);
    });
}

function pub_infer(expr: Expr): void {
    const mres = bindMi(infer(expr), type => showType(type));
    const res = mres(nativeContext);

    let type = res.kind === 'nothing'
        ? 'Nothing'
        : res.value[0];

    console.log(pad(show(expr), 25) + ' :: ' + type);
    // printContext(nativeContext);
}

function infer(expr: Expr): MInfer<Type> {
    switch (expr.kind) {
        case 'literal':     return returnMi(int);
        case 'native':      return failMi;
        case 'reference':   return getVarType(expr.name);
        case 'lambda_def':  return inferLambda(expr);
        case 'application': return inferApplication(expr);
    }
}

function inferLambda(expr: LambdaDef): MInfer<Type> {
    /**
        do a <- poly

           bindVar expr.param a
           bodyType <- infer expr.body
           unbindVar expr.param

           arrow a bodyType
    */

    return bindMi(poly,                   a =>
           bindMi(bindVar(expr.param, a), _ =>
           bindMi(infer(expr.body),       bodyType =>
           bindMi(unbindVar(expr.param),  _ =>
               arrow(a, bodyType)
           ))));
}

function inferApplication(expr: Application): MInfer<Type> {
    /**
        do argType  <- infer expr.arg
           funcType <- infer expr.func

           case funcType.kind of
               'ty_mono'  -> failMi

               'ty_poly'  -> do a       <- poly
                                newType <- arrow argType a

                                updateType funcType newType
                                returnMi a

               'ty_arrow' -> do newType <- applyType funcType argType
                                getType newType.to
    */

    return bindMi(infer(expr.arg), argType =>
           bindMi(infer(expr.func), funcType => {
               switch (funcType.kind) {
                   case 'ty_mono':
                       return failMi;

                   case 'ty_poly':
                       // TODO: generalise?
                       return bindMi(poly,              a =>
                              bindMi(arrow(argType, a), newType =>

                              bindMi(updateType(funcType, newType), _ =>
                              returnMi(a))));

                   case 'ty_arrow':
                       return bindMi(applyType(funcType, argType), newType =>
                              getType(newType.to));
               }
           }));
}

function applyType(func: TyArrow, arg: Type): MInfer<TyArrow> {
    return bindMi(getType(func.from), fromType =>
           applyType0(func, fromType, arg));
}

function applyType0(func: TyArrow, from: Type, arg: Type): MInfer<TyArrow> {
    return bindMi(typeEq(from, arg),  eq => {
        if (eq) {
            return returnMi(func);
        }

        if (from.kind === 'ty_mono') {
            if (arg.kind === 'ty_poly') {
                // TODO: should we update here?
                return bindMi(updateType(arg, from), _ =>
                       returnMi(func));
            }

            return failMi;
        }

        if (from.kind === 'ty_poly') {
            return bindMi(instantiate(func, from, arg), newType =>
                   newType.kind !== 'ty_arrow'
                       ? failMi
                       : returnMi(newType));
        }

        if (arg.kind !== 'ty_arrow') {
            return failMi;
        }

        return bindMi(getType(from.from),                    leftFrom  =>
               bindMi(getType(arg.from),                     rightFrom =>
               bindMi(applyType0(func, leftFrom, rightFrom), newFunc   =>

               bindMi(getType(from.to), leftTo  =>
               bindMi(getType(arg.to),  rightTo =>
               applyType0(newFunc, leftTo, rightTo))))));
    });
}

function typeEq(t1: Type, t2: Type): MInfer<boolean> {
    if (t1.id === t2.id) {
        return returnMi(true);
    }

    return bindMi(getType(t1.id), realT1 =>
           bindMi(getType(t2.id), realT2 =>
               returnMi(realT1.id === realT2.id)
           ));
}

function instantiate(type: Type, oldType: TyPoly, newType: Type): MInfer<Type> {
    switch (type.kind) {
        case 'ty_mono':
            return returnMi(type);

        case 'ty_poly':
            return bindMi(typeEq(type, oldType), eq =>
                   returnMi(eq ? newType : type));

        case 'ty_arrow': {
            return bindMi(getType(type.from), fromType =>
                   bindMi(getType(type.to),   toType =>

                   bindMi(instantiate(fromType, oldType, newType), head =>
                   bindMi(instantiate(toType, oldType, newType),   rest =>

                   bindMi(typeEq(head, fromType), eqHead =>
                   bindMi(typeEq(rest, toType),   eqRest =>
                       eqHead && eqRest
                           ? returnMi(type)
                           : arrow(head, rest)
                   ))))));
        }
    }
}

/***** Debug utilities *****/

function pad(str: string, len: number): string {
    for (let i = str.length; i < len; ++i) {
        str += ' ';
    }
    return str;
}

function showTypeUnsafe(ctx: InferCtx, typeId: number): string {
    const mres = bindMi(getType(typeId), type => showType(type));
    return fromJust(mres(ctx))[0];
}

const printContext: MInfer<void> = bindMi(getMi, st => {
    let str = '';

    let c = st.bindMap;
    while (c.kind !== 'nil') {
        str += pad(c.val[0] + ':', 5) + showTypeUnsafe(st, c.val[1]) + ',\n';
        c = c.rest;
    }

    console.log(str);
    return returnMi(undefined);
});

const printTypes: MInfer<void> = bindMi(getMi, st => {
    let str = '';

    let c = st.typeMap;
    while (c.kind !== 'nil') {
        str += pad(c.val[0] + ':', 5) + showTypeUnsafe(st, c.val[0]) + ',\n';
        c = c.rest;
    }

    console.log(str);
    return returnMi(undefined);
});

function printType(type: Type): MInfer<void> {
    return bindMi(showType(type), typeStr =>
           returnMi(console.log(typeStr)));
}
