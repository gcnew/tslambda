
// TypeScript version of Stephen Diehl's constraint type inferencer from
// http://dev.stephendiehl.com/fun/006_hindley_milner.html


import * as Map from '../lang/map'
import * as Set from '../lang/set'

import {
    fromJust,

    Either, left, right,

    Nil, cons, foldl
} from '../lang/prelude'

import { Expr, LambdaDef, Application } from '../tslambda'
import { SubstitutableType, SubstitutableTypeEnv, apply, ftv } from './substitutable'

import {
    InferM,

    bindM, returnM, getM, askM, putM, tellM, localM, failM
} from './infer_m'

import {
    Type, TypeError,

    TypeEnv, Scheme, Subst,

    scheme, constr, typeEnv, tyVar, tyCon, tyArrow,

    unifier, nullSubst,

    unboundVariable
} from './checker_types'

import { solver } from './solver'

export {
    pub_infer as infer
}

const int = tyCon('int');
const int2int = tyArrow(int, int);

const arithScheme  = scheme(Nil, tyArrow(int, int2int));
const bottomScheme = scheme(cons("a'", Nil), tyVar("a'"));

const nativeTypes = typeEnv(Map.fromObject({
    '+': arithScheme,
    '-': arithScheme,
    '/': arithScheme,
    '*': arithScheme,
    '⊥': bottomScheme
}));

function unify(x: Type, y: Type): InferM<void> {
    return tellM(cons(constr(x, y), Nil));
}

function inEnv<T>(varName: string, scheme: Scheme, m: InferM<T>): InferM<T> {
    const f = (e: TypeEnv) => replace(e, varName, scheme);
    return localM(f, m);
}

function extend(ctx: TypeEnv, varName: string, scheme: Scheme): TypeEnv {
    return typeEnv(Map.insert(varName, scheme, ctx.typeMap));
}

function remove(ctx: TypeEnv, varName: string): TypeEnv {
    return typeEnv(Map.unassoc(ctx.typeMap, varName));
}

function replace(ctx: TypeEnv, varName: string, scheme: Scheme): TypeEnv {
    return extend(remove(ctx, varName), varName, scheme);
}

function pub_infer(expr: Expr): Either<string, string> {
    const res = infer(expr)(nativeTypes, { idCounter: 0 });

    if (res.kind === 'left') {
        return left(showError(res.value));
    }

    const [inferred, _state, constrs] = res.value;
    const solverRes = solver(unifier(nullSubst, constrs));
    if (solverRes.kind === 'left') {
        return left(showError(solverRes.value));
    }

    const subst = solverRes.value;
    const scheme = closeOver([subst, inferred]);

    return right(showType(scheme.type));
}

function infer(expr: Expr): InferM<Type> {
    switch (expr.kind) {
        case 'literal':     return returnM(int);
        case 'native':      return failM(unboundVariable('$$native'));
        case 'reference':   return getVarType(expr.name);
        case 'lambda_def':  return inferLambda(expr);
        case 'application': return inferApplication(expr);
    }
}

function getVarType(name: string): InferM<Type> {
    return bindM(askM,        typeEnv => {
        const res = Map.lookup(typeEnv.typeMap, name);
        if (res.kind === 'nothing') {
            return failM(unboundVariable(name));
        }

        return returnM(res.value.type);
    });
}

function inferLambda(expr: LambdaDef): InferM<Type> {
    /*
        do a <- fresh
           r <- inEnv expr.param (scheme Nil a) (infer expr.body)
           returnM (tyArrow a r)
    */

    return bindM(fresh,                                               a =>
           bindM(inEnv(expr.param, scheme(Nil, a), infer(expr.body)), r =>

           returnM(tyArrow(a, r))));
}

function inferApplication(expr: Application): InferM<Type> {
    /*
        do funcType <- infer expr.func
           argType  <- infer expr.arg
           retType  <- fresh
           unify funcType (tyArrow argType retType)
           returnM retType
    */

    return bindM(infer(expr.func),                           funcType =>
           bindM(infer(expr.arg),                            argType  =>
           bindM(fresh,                                      retType  =>
           bindM(unify(funcType, tyArrow(argType, retType)), _        =>

           returnM(retType)))));
}

/* do { idCounter } <- getM
      putM { idCounter: idCounter + 1 }

      let name = mkName idCounter

      returnM (tyVar name)
*/
const fresh: InferM<Type> = bindM(getM,                               ({ idCounter }) =>
                            bindM(putM({ idCounter: idCounter + 1 }), _ => {
                                const name = mkName(idCounter);

                                return returnM(tyVar(name))
                            }));

function mkName(id: number) {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const idx = (id / alphabet.length) | 0;
    const suffix = idx !== 0 ? idx : '';

    return alphabet[id % alphabet.length] + suffix;
}

function showError(err: TypeError): string {
    switch (err.kind) {
        case 'unbound_variable':
            return `Unbound variable: ${err.name}`;

        case 'unification_fail':
            return `Cannot unify '${showType(err.left)}' with '${showType(err.right)}'`;

        case 'infinite_type':
            return `Infinite type: Cannot unify '${err.typeVar}' with '${showType(err.type)}'`;
    }
}

function showType(type: Type): string {
    switch (type.kind) {
        case 'ty_con':
            return type.name;

        case 'ty_var':
            return type.name;

        case 'ty_arrow': {
            const fromStr = type.from.kind === 'ty_arrow'
                ? '(' + showType(type.from) + ')'
                : showType(type.from);

            return fromStr + ' -> ' + showType(type.to);
        }
    }
}

function generalize(env: TypeEnv, type: Type): Scheme {
    const varsSet = Set.difference(
        ftv(SubstitutableType, type),
        ftv(SubstitutableTypeEnv, env)
    );

    return scheme(Set.toList(varsSet), type);
}

const emptyTypeEnv = typeEnv(Map.empty);

function closeOver([subst, type]: [Subst, Type]): Scheme {
    const newType = apply(SubstitutableType, subst, type);
    const generalized = generalize(emptyTypeEnv, newType);

    return rename(generalized);
}

function collectVars(type: Type): Set.Set<string> {
    switch (type.kind) {
        case 'ty_con':   return Set.empty;
        case 'ty_var':   return Set.singleton(type.name);
        case 'ty_arrow': return Set.join(
            collectVars(type.from),
            collectVars(type.to)
        );
    }
}

function renameType(varMap: Map.Map<string, string>, type: Type): Type {
    switch (type.kind) {
        case 'ty_con':   return type;

        case 'ty_var':   return tyVar(
            fromJust(
                Map.lookup(varMap, type.name),
                'ASSERT: typevar not found'
            )
        );

        case 'ty_arrow': return tyArrow(
            renameType(varMap, type.from),
            renameType(varMap, type.to)
        );
    }
}

function rename(s: Scheme): Scheme {
    const { res: varMap } = foldl(
        Set.toList(collectVars(s.type)),
        { idx: 0, res: Map.empty as Map.Map<string, string> },
        ({ idx, res }, x) => ({ idx: idx + 1, res: Map.insert(x, mkName(idx), res) })
    );

    return scheme(Map.elems(varMap), renameType(varMap, s.type));
}
