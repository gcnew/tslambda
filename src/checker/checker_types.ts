
import * as Map from '../lang/map'

import {
    List
} from '../lang/prelude'


export {
    TyVar, TyCon, TyArrow,

    Type, Scheme, TypeEnv, Subst,

    InferState, TypeError,

    scheme, typeEnv,

    tyVar, tyCon, tyArrow,

    unboundVariable, unificationFail, infiniteType
}


type TyVar   = { kind: 'ty_var',   name: string }
type TyCon   = { kind: 'ty_con',   name: string }
type TyArrow = { kind: 'ty_arrow', from: Type, to: Type }

type Type = TyVar
          | TyCon
          | TyArrow

type Scheme = { kind: 'scheme', vars: List<string>, type: Type }

type TypeEnv = { kind: 'type_env', typeMap: Map.Map<string, Scheme> }

type Subst = Map.Map<string, Type>

type InferState = {
    idCounter: number
}

type TypeError = { kind: 'unbound_variable', name: string                 }
               | { kind: 'unification_fail', left: Type,      right: Type }
               | { kind: 'infinite_type',    typeVar: string, type: Type  }


export const nullSubst: Subst = Map.empty;

function scheme(vars: List<string>, type: Type): Scheme {
    return { kind: 'scheme', vars, type };
}

function typeEnv(typeMap: Map.Map<string, Scheme>): TypeEnv {
    return { kind: 'type_env', typeMap };
}

function tyVar(name: string): TyVar {
    return { kind: 'ty_var', name };
}

function tyCon(name: string): TyCon {
    return { kind: 'ty_con', name };
}

function tyArrow(from: Type, to: Type): TyArrow {
    return { kind: 'ty_arrow', from, to };
}

function unboundVariable(name: string): TypeError {
    return { kind: 'unbound_variable', name };
}

function unificationFail(left: Type, right: Type): TypeError {
    return { kind: 'unification_fail', left, right };
}

function infiniteType(name: string, type: Type): TypeError {
    return { kind: 'infinite_type', typeVar: name, type };
}
