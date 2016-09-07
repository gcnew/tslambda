
export {
    /* Types */
    Expr, Value, Context,
    Application, LambdaDef, Reference, Literal,
    Lambda, Native,
    KVPair,

    /* Constructor Funcs */
    lam, ap, ref, lit, native, nativeBi,

    /* Data */
    // exported inline because of const..
    // Root,

    /* Utility functions */
    set, get, makeContext, pair, show,

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
type Context = { kind: 'root' }
             | { kind: 'entry', key: string, value: Value, next: Context }

type KVPair = { key: string, value: Value }

export const Root: Context = { kind: 'root' };

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

function show(expr: Expr|Value): string {
    switch (expr.kind) {
        case 'literal':
            return String(expr.value);

        case 'reference':
            return expr.name;

        case 'application':
            // TODO: precedence
            return show(expr.func) + ' ' + show(expr.arg);

        case 'lambda':
        case 'lambda_def':
            return 'λ' + expr.param + '.' + show(expr.body);

        case 'native':
            return '<native>'
    }
}

function get(ctx: Context, key: string): Value {
    if (ctx.kind === 'root') {
        throw new Error(`Key '${key}' not found!`);
    }

    if (ctx.key === key) {
        return ctx.value;
    }

    return get(ctx.next, key);
}

function set(ctx: Context, key: string, value: Value): Context {
    return { kind: 'entry', key: key, value: value, next: ctx };
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

function assertNever(x: never): never {
    throw new Error(`Assert: not never: ${x}`);
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

function native(name: string, f: (...values: Value[]) => Value): KVPair {
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

    return { key: name, value: curried };
}

function unboxNumber(x: Value): number {
    if (x.kind !== 'literal') {
        throw new Error(`Not a number: ${x}`);
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

function pair(key: string, value: Value): KVPair {
    return { key: key, value: value };
}

function makeContext(ctx: Context, entries: KVPair[]): Context {
    return entries.reduce<Context>((ctx, e) => set(ctx, e.key, e.value), ctx);
}
