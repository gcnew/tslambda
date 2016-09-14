
import { Expr, show } from './tslambda'
import { Maybe, Nothing, List, Nil, just, fromJust, lookup, cons, assertNever } from './prelude'

export {
    pub_infer as infer
}


type TyMono  = { kind: 'ty_mono', id: string }
type TyPoly  = { kind: 'ty_poly', id: string }
type TyArrow = { kind: 'ty_arrow', from: Type, to: Type }

type Type = TyMono
          | TyPoly
          | TyArrow

type InferCtx = List<[string, Type]>
type InferRes = Maybe<[InferCtx, Type]>

type TypeExt = { type: Type }

const int = mono('int');
let typeId = 0;

function mono(id: string): TyMono {
    return { kind: 'ty_mono', id: id };
}

function poly(id: string): TyPoly {
    return { kind: 'ty_poly', id: 'a' + ++typeId };
}

function arrow(from: Type, to: Type): TyArrow {
    return { kind: 'ty_arrow', from: from, to: to };
}

function showType(type: Type): string {
    switch (type.kind) {
        case 'ty_mono':
            return type.id;

        case 'ty_poly':
            return type.id;

        case 'ty_arrow': {
            const fromStr = type.from.kind !== 'ty_arrow'
                ? showType(type.from)
                : '(' + showType(type.from) + ')';

            return fromStr + ' -> ' + showType(type.to);
        }
    }
}

function printContext(ctx: InferCtx) {
    let str = '{\n';

    let c = ctx;
    while (c.kind !== 'nil') {
        str += pad(c.val[0] + ':', 5) + showType(c.val[1]) + ',\n';
        c = c.rest;
    }

    console.log(str + '}');
}

function pad(str: string, len: number): string {
    for (let i = str.length; i < len; ++i) {
        str += ' ';
    }
    return str;
}

function pub_infer(expr: Expr): void {
    const res = infer(initialCtx, expr);
    let type = res.kind === 'nothing'
        ? 'Nothing'
        : showType(res.value[1]);

    console.log(pad(show(expr), 25) + ' :: ' + type);
}

function setType(ctx: InferCtx, expr: Expr, type: Type): InferCtx {
    switch (expr.kind) {
        case 'native':
        case 'literal':
        case 'lambda_def':
            return ctx;

        case 'reference':
            return cons<[string, Type]>([expr.name, type], ctx);

        case 'application':
            if (type.kind !== 'ty_arrow') {
                throw new Error('WTF: ' + showType(type));
            }

            return setType(setType(ctx, expr.arg, type.to), expr.func, type.from);
    }
}

function infer(ctx: InferCtx, expr: Expr): InferRes {
    switch (expr.kind) {
        case 'literal':
            return ret(ctx, int);

        case 'native':
            return Nothing;

        case 'reference': {
            const res = lookup(ctx, expr.name);
            if (res.kind === 'nothing') {
                return Nothing;
            }

            return ret(ctx, res.value);
        }

        case 'application': {
            const argRes = infer(ctx, expr.arg);
            if (argRes.kind === 'nothing') {
                return Nothing;
            }

            const [argCtx, argType] = argRes.value;
            const funcRes = infer(argCtx, expr.func);
            if (funcRes.kind === 'nothing') {
                return Nothing;
            }


            const [funCtx, funType] = funcRes.value;
            if (funType.kind !== 'ty_arrow') {
                if (funType.kind === 'ty_mono') {
                    console.log(`Not a function: ${showType(funType)}`);
                    return Nothing;
                }

                const pType = poly('a');
                const rType = arrow(argType, pType);

                return ret(
                    setType(funCtx, expr.func, rType),
                    pType
                );
            }

            let rCtx: InferCtx;
            let applied: Maybe<Type>;
            if (argType.kind === 'ty_poly') {
                const frType = instantiate(funType, argType, funType.from);
                rCtx = setType(funCtx, expr.func, frType);
                applied = typeApply(frType, funType.from);
            } else {
                rCtx = funCtx;
                applied = typeApply(funType, argType)
            }

            if (applied.kind === 'nothing') {
                return Nothing;
            }

            return ret(rCtx, applied.value);
        }

        case 'lambda_def': {
            const newCtx = cons<[string, Type]>([expr.param, poly('a')], ctx);

            const bodyRes = infer(newCtx, expr.body);
            if (bodyRes.kind === 'nothing') {
                return Nothing;
            }

            const [bodyCtx, bodyType] = bodyRes.value;
            const paramType = fromJust(lookup(bodyCtx, expr.param));

            const resCtx = cons<[string, Type]>([expr.param, paramType], ctx);
            return ret(bodyCtx, arrow(paramType, bodyType));
        }
    }

    printContext(ctx);
    return null as any;;
}

function instantiate(type: Type, oldType: TyPoly, newType: Type): Type {
    switch (type.kind) {
        case 'ty_mono':
            return type;

        case 'ty_poly':
            return type === oldType ? newType : type;

        case 'ty_arrow': {
            const head = instantiate(type.from, oldType, newType);
            const rest = instantiate(type.to, oldType, newType);

            if (head === type.from && rest === type.to) {
                return type;
            }

            return arrow(head, rest);
        }
    }
}

function typeApply(to: Type, x: Type): Maybe<Type> {
    if (to.kind !== 'ty_arrow') {
        return Nothing;
    }

    if (x.kind === 'ty_mono') {
        switch (to.from.kind) {
            case 'ty_arrow':
                return Nothing;

            case 'ty_mono':
                if (x.id !== to.from.id) {
                    return Nothing;
                }

                return just(to.to);

            case 'ty_poly':
                return just(instantiate(to, to.from, x));
        }

        return assertNever(to.from);
    }

    if (x.kind === 'ty_poly') {
        switch (to.from.kind) {
            case 'ty_arrow':
            case 'ty_mono':
                return Nothing;

            case 'ty_poly':
                return just(instantiate(to, to.from, x));
        }

        return assertNever(to.from);
    }

    if (x.kind === 'ty_arrow') {
        switch (to.from.kind) {
            case 'ty_mono':
                return Nothing;

            case 'ty_poly':
                return just(instantiate(to, to.from, x));

            case 'ty_arrow': {
                let php = to.from;

                outer: while (true) {
                    let bbc = <Type> php;
                    let jjk: Type = x;
                    // console.log(showType(bbc));
                    // console.log(showType(jjk));

                    while (true) {
                        if (bbc === jjk) {
                            return just(php);
                        }

                        if (bbc.kind === 'ty_poly') {
                            php = <TyArrow> instantiate(php, bbc, jjk);
                            continue outer;
                        }

                        if (bbc.kind === 'ty_arrow' && jjk.kind === 'ty_arrow') {
                            if (bbc.from !== jjk.from) {
                                bbc = bbc.from;
                                jjk = jjk.from;
                            } else {
                                bbc = bbc.to;
                                jjk = jjk.to;
                            }

                            continue;
                        }

                        return Nothing;
                    }
                }
            }
        }

        return assertNever(to.from);
    }

    return assertNever(x);
}


const arithType = arrow(int, arrow(int, int)); // int -> int -> int
const bottomType = poly('a');

const nativeTypes = {
    '+': arithType,
    '-': arithType,
    '/': arithType,
    '*': arithType,
    '⊥': bottomType
};

const initialCtx = Object.keys(nativeTypes).reduce<InferCtx>(
    (ctx, k) => cons<[string, Type]>([k, (<any> nativeTypes)[k]], ctx),  // TYH
    Nil
);

function ret(ctx: InferCtx, type: Type): InferRes {
    return just<[InferCtx, Type]>([ctx, type]);
}

function withType(exp: Expr, type: Type): Expr & TypeExt {
    return extend(exp, { type: type });
}

function extend<T, U>(base: T, ext: U): T & U {
    const retval: any = {};

    for (const key of Object.keys(base)) {
        retval[key] = (<any> base)[key];
    }

    for (const key of Object.keys(ext)) {
        retval[key] = (<any> ext)[key];
    }

    return retval;
}

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
