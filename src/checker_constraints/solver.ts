
import * as Map from '../lang/map'
import * as Set from '../lang/set'

import {
    Type, Constraint, Subst, Unifier,

    unifier, nullSubst, constr,

    unificationFail, infiniteType
} from './checker_types'

import {
    SolveM,

    bindM, returnM, failM
} from './solve_m'

import { Substitutable, SubstitutableType, SubstitutableList, apply, ftv } from './substitutable'

export { solver }

const SubstitutableConstraint: Substitutable<Constraint> = {
    apply(subst, [t1, t2]) {
        return constr(
            apply(SubstitutableType, subst, t1),
            apply(SubstitutableType, subst, t2)
        );
    },

    ftv([t1, t2]) {
        return Set.join(
            ftv(SubstitutableType, t1),
            ftv(SubstitutableType, t2)
        );
    }
}

const SubstitutableConstraintList = SubstitutableList(SubstitutableConstraint);

function compose(left: Subst, right: Subst): Subst {
    return Map.union(
        Map.map(right, t => apply(SubstitutableType, left, t)),
        left
    );
}

function solver({ subst, constraints }: Unifier): SolveM<Subst> {
    if (constraints.kind === 'nil') {
        return returnM(subst);
    }

    const [t1, t2] = constraints.val;
    return bindM(unify(t1, t2),   s2 => {
        const composedSubst = compose(s2, subst);
        const substConstrs = apply(SubstitutableConstraintList, s2, constraints.rest);

        return solver(unifier(composedSubst, substConstrs));
    });
}

function unify(left: Type, right: Type): SolveM<Subst> {
    if (left === right) {
        return returnM(nullSubst);
    }

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

    return failM(unificationFail(left, right));
}

function occursCheck<T>(dict: Substitutable<T>, name: string, x: T) {
    return Set.member(ftv(dict, x), name);
}

function bind(name: string, type: Type): SolveM<Subst> {
    if (type.kind === 'ty_var' && type.name === name) {
        return returnM(nullSubst);
    }

    if (occursCheck(SubstitutableType, name, type)) {
        return failM(infiniteType(name, type));
    }

    return returnM(Map.singleton(name, type));
}
