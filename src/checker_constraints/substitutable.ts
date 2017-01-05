
import * as Map from '../lang/map'
import * as Set from '../lang/set'

import { List, map, foldl } from '../lang/prelude'

import {
    Type, Scheme, TypeEnv,

    Subst,

    scheme, typeEnv, tyArrow
} from './checker_types'

export {
    Substitutable, SubstitutableList,

    apply, ftv
}


type Substitutable<T> = {
    apply(subst: Subst, x: T): T,
    ftv(x: T): Set.Set<string>
}

export const SubstitutableType: Substitutable<Type> = {
    apply(subst, x) {
        switch (x.kind) {
            case 'ty_con':
                return x;

            case 'ty_var': {
                const res = Map.lookup(subst, x.name);

                if (res.kind == 'nothing') {
                    return x;
                }

                return res.value;
            }

            case 'ty_arrow':
                return tyArrow(
                    apply(SubstitutableType, subst, x.from),
                    apply(SubstitutableType, subst, x.to)
                );
        }
    },

    ftv(x) {
        switch (x.kind) {
            case 'ty_con':
                return Set.empty;

            case 'ty_var':
                return Set.singleton(x.name);

            case 'ty_arrow':
                return Set.join(
                    ftv(SubstitutableType, x.from),
                    ftv(SubstitutableType, x.to)
                );
        }
    }
};

export const SubstitutableScheme: Substitutable<Scheme> = {
    apply(subst, x) {
        const newSubst = foldl(x.vars, subst, Map.unassoc);

        return scheme(
            x.vars,
            apply(SubstitutableType, newSubst, x.type)
        );
    },

    ftv(x) {
        return Set.difference(
            ftv(SubstitutableType, x.type),
            x.vars
        );
    }
};

function SubstitutableList<T>(tc: Substitutable<T>): Substitutable<List<T>> {
    return {
        apply(subst, xs) {
            return map(xs, x => tc.apply(subst, x));
        },

        ftv(xs) {
            return foldl<T, Set.Set<string>>(
                xs,
                Set.empty,
                (res, x) => Set.join(tc.ftv(x), res)
            ); // TYH
        }
    };
}

const SubstitutableSchemeList = SubstitutableList(SubstitutableScheme);

export const SubstitutableTypeEnv: Substitutable<TypeEnv> = {
    apply(subst, x) {
        return typeEnv(
            Map.map(x.typeMap, scheme => apply(SubstitutableScheme, subst, scheme))
        );
    },

    ftv(x) {
        return ftv(SubstitutableSchemeList, Map.elems(x.typeMap));
    }
};

function apply<T>(dict: Substitutable<T>, subst: Subst, val: T) {
    return dict.apply(subst, val);
}

function ftv<T>(dict: Substitutable<T>, val: T) {
    return dict.ftv(val);
}
