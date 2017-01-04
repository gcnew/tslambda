
import * as Map from './lang/map';
import { List, Nil, lookup, assertNever } from './lang/prelude';

export {
    /* Types */
    Expr, Value, Context,
    Application, LambdaDef, Reference, Literal,
    Lambda, Native,
    CtxEntry,

    /* Constructor Funcs */
    lam, ap, ref, lit, native, nativeBi,

    /* Data */
    // exported inline because of const..
    // CtxRoot,

    /* Utility functions */
    set, get, makeContext, ctxEntry, show,

    /* Interpreter */
    evalExpr
}

type Application = { kind: 'application', func:  Expr,   arg:  Expr }
type LambdaDef   = { kind: 'lambda_def',  param: string, body: Expr }
type Reference   = { kind: 'reference',   name:  string }
type Literal     = { kind: 'literal',     value: number }

type Lambda = { kind: 'lambda', ctx: Context, param: string, body: Expr }
type Native = { kind: 'native', apply: (ctx: Context) => Value }

type Expr = LambdaDef
          | Application
          | Reference
          | Literal
          | Native

type Value   = Literal | Lambda | LambdaDef

type Context = List<CtxEntry>
type CtxEntry = [string, Value]

export const CtxRoot = Nil;

function lam(param: string, body: Expr): LambdaDef {
    return { kind: 'lambda_def', param: param, body: body };
}

function ap(func: Expr, arg: Expr): Application {
    return { kind: 'application', func: func, arg: arg };
}

function ref(name: string): Reference {
    return { kind: 'reference', name: name };
}

function lit(value: number): Literal {
    return { kind: 'literal', value: value };
}

function isAtomic(expr: Expr) {
    switch (expr.kind) {
        case 'lambda_def':
        case 'application':
            return false;

        case 'reference':
        case 'literal':
        case 'native':
            return true;
    }
}

function show(expr: Expr|Value): string {
    switch (expr.kind) {
        case 'literal':
            return String(expr.value);

        case 'reference':
            return expr.name;

        case 'application': {
            // TODO: use precedence levels?
            const funcSource = isAtomic(expr.func) || (expr.func.kind === 'application')
                ? show (expr.func)
                : '(' + show(expr.func) + ')';

            const argSource = isAtomic(expr.arg)
                ? show(expr.arg)
                : '(' + show(expr.arg) + ')';

            return funcSource + ' ' + argSource;
        }

        case 'lambda':
        case 'lambda_def':
            return 'λ' + expr.param + '.' + show(expr.body);

        case 'native':
            return '<native>'
    }
}

function get(ctx: Context, key: string): Value {
    const res = lookup(ctx, key);
    if (res.kind === 'nothing') {
        throw new Error(`Key '${key}' not found!`);
    }

    return res.value;
}

function set(ctx: Context, key: string, value: Value) {
    return Map.insert(key, value, ctx);
}

function evalExpr(ctx: Context, expr: Expr): Value {
    switch (expr.kind) {
        case 'literal':     return expr;
        case 'reference':   return get(ctx, expr.name);

        case 'lambda_def':  return { kind: 'lambda', ctx: ctx, param: expr.param, body: expr.body };

        case 'native':
            return expr.apply(ctx);

        case 'application': {
            const func = evalExpr(ctx, expr.func);

            switch (func.kind) {
                case 'lambda': {
                    const arg = evalExpr(ctx, expr.arg);
                    const newCtx = set(func.ctx, func.param, arg);

                    return evalExpr(newCtx, func.body);
                }

                case 'lambda_def': {
                    const arg = evalExpr(ctx, expr.arg);
                    const newCtx = set(ctx, func.param, arg)

                    return evalExpr(newCtx, func.body);
                }

                case 'literal':
                    throw new Error(`Not a function: ${show(expr)}`);
            }

            return assertNever(func); // TYH: this should not be needed
        }
    }
}

function parameterNames(f: Function): string[] {
    var source = String(f);

    // remove comments
    source = source
        .replace(/\/\/.*?\n/g, '')
        .replace(/\/\*.*?\*\//g, '');

    var match = source.match(/^[^(]+\(([^)]+)\)/);
    var args = match && match[1].trim();

    return args ? args.split(/\s*,\s*/g) : [];
}

function native(name: string, f: (...values: Value[]) => Value): CtxEntry {
    const params = parameterNames(f);
    const curried = params.reduceRight<Expr>(
        (body, param) => {
            return { kind: 'lambda_def', param: param, body: body };
        },

        {
            kind: 'native',
            apply: (ctx: Context) => {
                const args = params.map(x => get(ctx, x));
                return f(...args);
            }
        }
    );

    if (curried.kind !== 'lambda_def') {
        throw new Error(`Invalid native function (should have one or more args): ${f}`);
    }

    return ctxEntry(name, curried);
}

function unboxNumber(x: Value): number {
    if (x.kind !== 'literal') {
        throw new Error(`Not a number: ${show(x)}`);
    }

    return x.value;
}

function boxNumber(x: number): Value {
    return { kind: 'literal', value: x };
}

function nativeBi(name: string, f: (x: number, y: number) => number) {
    return native(name, (x: Value, y: Value) => {
        const result = f(unboxNumber(x), unboxNumber(y));
        return boxNumber(result);
    });
}

function ctxEntry(key: string, value: Value): CtxEntry {
    return [key, value];
}

function makeContext(ctx: Context, entries: CtxEntry[]): Context {
    return entries.reduce((ctx, [key, val]) => set(ctx, key, val), ctx);
}
