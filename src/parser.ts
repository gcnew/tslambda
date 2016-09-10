
import { lex, Token } from './lexer'
import { Expr, LambdaDef, Literal, Application, lit, lam, ref, ap } from './tslambda'
import { List, Maybe, Nothing, just } from './prelude'

export {
    /* Types */
    Parser,

    /* functions */
    parse
}


type Parser<T> = (tokens: List<Token>) => Maybe<[T, List<Token>]>

function ret<T>(val: T, rest: List<Token>) {
    return just<[T, List<Token>]>([val, rest]); // TYH
}

function parse(source: string): Maybe<Expr> {
    const tokens = lex(source);
    const parsed = parseExpr(tokens);

    if (parsed.kind === 'nothing') {
        return Nothing;
    }

    if (parsed.value[1].kind !== 'nil') {
        return Nothing;
    }

    return just(parsed.value[0]);
}

// Literal = <num>
const parseLiteral: Parser<Literal> = (tokens) => {
    if (tokens.kind === 'nil') {
        return Nothing;
    }

    if (tokens.val.kind !== 'num') {
        return Nothing;
    }

    return ret(lit(Number(tokens.val.value)), tokens.rest);
}

const parsePunct: (punct: string) => Parser<string> = punct => tokens => {
    if (tokens.kind === 'nil') {
        return Nothing;
    }

    if (tokens.val.kind !== 'punct') {
        return Nothing;
    }

    if (tokens.val.value !== punct) {
        return Nothing;
    }

    return ret(tokens.val.value, tokens.rest);
}

// Id = <id>
const parseId: Parser<string> = (tokens) => {
    if (tokens.kind === 'nil') {
        return Nothing;
    }

    if (tokens.val.kind !== 'id') {
        return Nothing;
    }

    return ret(tokens.val.value, tokens.rest);
}

const parseWs: Parser<string> = (tokens) => {
    if (tokens.kind === 'nil') {
        return Nothing;
    }

    if (tokens.val.kind !== 'ws') {
        return Nothing;
    }

    return ret(tokens.val.value, tokens.rest);
}

// Lambda = 'λ' Id '.' Expr
const parseLambda = parseCombine4(  // TYH -- : Parser<LambdaDef>
    parsePunct('λ'),
    parseId,
    parsePunct('.'),
    (tokens) => parseExpr(tokens),
    (_1, param, _2, body) => lam(param, body)
);

// ExprNoAp = Literal
//          | Ref           -- id <$> ref
//          | '(' Expr ')'
const parseExprNoAp: Parser<Expr> = parseAlt3(
    parseLiteral,
    parseMap(parseId, ref),
    parseCombine3(parsePunct('('), tokens => parseExpr(tokens), parsePunct(')'), (_1, e, _2) => e),
);

// Expr = Lambda
//      | ExprNoAp (' ' ExprNoAp)*
let parseExpr: Parser<Expr> = parseAlt(
    parseLambda,
    parseCombine(
        parseExprNoAp,
        parseMany(
            parseCombine(parseWs, parseExprNoAp, (_, expr) => expr)
        ),
        (head, rest) => rest.reduce(ap, head)
    )
);

function parseMap<A, B>(p: Parser<A>, f: (a: A) => B): Parser<B> {
    return (tokens) => {
        const res = p(tokens);
        if (res.kind === 'nothing') {
            return Nothing;
        }

        return ret(f(res.value[0]), res.value[1]);
    };
}

function parseAlt<A, B>(p1: Parser<A>, p2: Parser<B>): Parser<A|B> {
    return (tokens) => {
        const r1 = p1(tokens);
        if (r1.kind !== 'nothing') {
            return r1;
        }

        return p2(tokens);
    };
}

function parseAlt3<A, B, C>(p1: Parser<A>, p2: Parser<B>, p3: Parser<C>): Parser<A|B|C> {
    return parseAltAll([ p1, p2, p3 ]);
}

function parseAltAll<T>(parsers: Parser<any>[]): Parser<any> {
    return (tokens) => {
        for (const p of parsers) {
            const res = p(tokens);
            if (res.kind !== 'nothing') {
                return res;
            }
        }

        return Nothing;
    };
}

function parseCombine<A, B, C>(p1: Parser<A>, p2: Parser<B>, f: (a: A, b: B) => C): Parser<C> {
    return parseCombineAll([ p1, p2 ], f);
}

function parseCombine3<A, B, C, D>(p1: Parser<A>, p2: Parser<B>, p3: Parser<C>, f: (a: A, b: B, c: C) => D): Parser<D> {
    return parseCombineAll([ p1, p2, p3 ], f);
}

function parseCombine4<A, B, C, D, E>(
    p1: Parser<A>,
    p2: Parser<B>,
    p3: Parser<C>,
    p4: Parser<D>,
    f: (a: A, b: B, c: C, d: D) => E
): Parser<D> {
    return parseCombineAll([ p1, p2, p3, p4 ], f);
}

function parseCombineAll(parsers: Parser<any>[], f: (...parsers: any[]) => any): Parser<any> {
    return (tokens) => {
        let cur = tokens;
        const results: any[] = [];

        for (const p of parsers) {
            const res = p(cur);
            if (res.kind === 'nothing') {
                return Nothing;
            }

            cur = res.value[1];
            results.push(res.value[0]);
        }

        return ret(f(...results), cur);
    };
}

function parseMany<A>(p: Parser<A>): Parser<A[]> {
    return (tokens) => {
        let cur = tokens;
        const results: A[] = [];

        while (true) {
            const res = p(cur);

            if (res.kind === 'nothing') {
                break;
            }

            cur = res.value[1];
            results.push(res.value[0])
        }

        return ret(results, cur);
    };
}
