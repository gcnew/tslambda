
import { List, Nil, cons } from './lang/prelude'

export {
    /* Types */
    Token,

    /* Functions */
    lex
}


type Token = { kind: 'id',    value: string }
           | { kind: 'num',   value: string }
           | { kind: 'ws',    value: string }
           | { kind: 'punct', value: string }

function lex(source: string): List<Token> {
    if (!source.length) {
        return Nil;
    }

    const ws = /^(?: |\t)+/.exec(source);
    if (ws) {
        return cons<Token>(
            { kind: 'ws', value: ws[0] }, // TYH
            lex(source.substr(ws[0].length))
        );
    }

    const num = /^[0-9]+/.exec(source);
    if (num) {
        return cons<Token>(
            { kind: 'num', value: num[0] },
            lex(source.substr(num[0].length))
        );
    }

    const id = /^[a-zA-Z]+/.exec(source);
    if (id) {
        return cons<Token>(
            { kind: 'id', value: id[0] },
            lex(source.substr(id[0].length))
        );
    }

    switch (source[0]) {
        case 'λ': case '.':
        case '(': case ')':
            return cons<Token>(
                { kind: 'punct', value: source[0] },
                lex(source.substr(1))
            );

        case '+': case '-': case '*': case '/': case '⊥':
            return cons<Token>(
                { kind: 'id', value: source[0] },
                lex(source.substr(1))
            );
    }

    throw new Error(`error: lex: '${source.substr(0, 16)} ...'`);
}
