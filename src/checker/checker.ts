
// TypeScript version of Stephen Diehl's type inferencer from
// http://dev.stephendiehl.com/fun/006_hindley_milner.html


import * as Map from '../lang/map'
import * as Set from '../lang/set'

import {
    fromJust,

    Either, left, right,

    Nil, cons,

    foldl, zip
} from '../lang/prelude'

import { Expr, LambdaDef, Application } from '../tslambda'
import { Substitutable, SubstitutableType, SubstitutableTypeEnv, apply, ftv } from './substitutable'

import {
    InferM,

    bindM, returnM, getM, putM, failM, mapM
} from './infer_m'

import {
    Type, TyArrow, TypeError,

    TypeEnv, Scheme, Subst,

    nullSubst, scheme, typeEnv, tyVar, tyCon, tyArrow,

    unificationFail, unboundVariable, infiniteType
} from './checker_types'

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

function extend(ctx: TypeEnv, varName: string, scheme: Scheme): TypeEnv {
    return typeEnv(Map.insert(varName, scheme, ctx.typeMap));
}

function compose(left: Subst, right: Subst): Subst {
    return Map.union(
        Map.map(right, t => apply(SubstitutableType, left, t)),
        left
    );
}

function mkName(id: number) {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const idx = (id / alphabet.length) | 0;
    const suffix = idx !== 0 ? idx : '';

    return alphabet[id % alphabet.length] + suffix;
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

function occursCheck<T>(dict: Substitutable<T>, name: string, x: T) {
    return Set.member(ftv(dict, x), name);
}

function bind(name: string, type: Type): InferM<Subst> {
    if (type.kind === 'ty_var' && type.name === name) {
        return returnM(nullSubst);
    }

    if (occursCheck(SubstitutableType, name, type)) {
        return failM(infiniteType(name, type));
    }

    return returnM(Map.singleton(name, type));
}

function unify(left: Type, right: Type): InferM<Subst> {
    if (left.kind === 'ty_var') {
        return bind(left.name, right);
    }

    if (right.kind === 'ty_var') {
        return bind(right.name, left);
    }

    if (left.kind === 'ty_arrow' && right.kind === 'ty_arrow') {
        return bindM(unify(left.from, right.from),          s1 =>
               bindM(unify(
                   apply(SubstitutableType, s1, left.to),
                   apply(SubstitutableType, s1, right.to)), s2 =>
               returnM(compose(s2, s1))
               ));
    }

    if (left.kind === 'ty_con' && right.kind === 'ty_con') {
        if (left.name === right.name) {
            return returnM(nullSubst);
        }
    }

    return failM(unificationFail(left, right));
}

function instantiate(scheme: Scheme): InferM<Type> {
    /* do as <- mapM scheme.vars (\_ -> fresh)

          let s = Map.fromList (zip scheme.vars as)

          returnM (apply SubstitutableType s scheme.type)
    */

    return bindM(mapM(scheme.vars, _ => fresh), as => {
               const s = Map.fromList(zip(scheme.vars, as));

               return returnM(apply(SubstitutableType, s, scheme.type));
           });
}

function generalize(env: TypeEnv, type: Type): Scheme {
    const varsSet = Set.difference(
        ftv(SubstitutableType, type),
        ftv(SubstitutableTypeEnv, env)
    );

    return scheme(Set.toList(varsSet), type);
}

function ret(subst: Subst, type: Type): [Subst, Type] {
    return [subst, type];
}

function infer(env: TypeEnv, expr: Expr): InferM<[Subst, Type]> {
    switch (expr.kind) {
        case 'literal':     return returnM(ret(nullSubst, int));
        case 'native':      return failM(unboundVariable('$$native'));
        case 'reference':   return getVarType(env, expr.name);
        case 'lambda_def':  return inferLambda(env, expr);
        case 'application': return inferApplication(env, expr);

    }
}

function getVarType(env: TypeEnv, name: string): InferM<[Subst, Type]> {
    const res = Map.lookup(env.typeMap, name);

    if (res.kind === 'nothing') {
        return failM(unboundVariable(name));
    }

    return bindM(instantiate(res.value),  type =>
           returnM(ret(nullSubst, type)));
}

function inferLambda(env: TypeEnv, expr: LambdaDef): InferM<[Subst, Type]> {
    /**
        do a <- fresh

           let s      = scheme Nil a
           let newEnv = extend env expr.param s

           [subst, type] <- infer(newEnv, expr.body)

           returnM (ret subst (tyArrow (apply SubstitutableType subst a) type))
    */

    return bindM(fresh, a => {
               const s = scheme(Nil, a);
               const newEnv = extend(env, expr.param, s);

               return bindM(infer(newEnv, expr.body), ([subst, type]) =>
                      returnM(ret(subst, tyArrow(apply(SubstitutableType, subst, a), type))));
           });
}

function inferApplication(env: TypeEnv, expr: Application): InferM<[Subst, Type]> {
    let newEnv: TypeEnv, newT1: Type, tArr: TyArrow, subst: Subst, type: Type;

    return bindM(fresh,                    a =>
           bindM(infer(env, expr.func),    ([s1, t1]) =>

           (newEnv = apply(SubstitutableTypeEnv, s1, env),
           bindM(infer(newEnv, expr.arg),  ([s2, t2]) =>

           (newT1 = apply(SubstitutableType, s2, t1),
           (tArr  = tyArrow(t2, a),
           bindM(unify(newT1, tArr),       s3 =>

           (subst = compose(s3, compose(s2, s1)),
           (type = apply(SubstitutableType, s3, a),
           returnM(ret(subst, type)))))))))));
}

const emptyTypeEnv = typeEnv(Map.empty);

function pub_infer(expr: Expr): Either<string, string> {
    const res = infer(nativeTypes, expr)({ idCounter: 0 });

    if (res.kind === 'left') {
        return left(showError(res.value));
    }

    const [inferred, _state] = res.value;
    const scheme = closeOver(inferred);

    return right(showType(scheme.type));
}

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
