declare module 'eval-estree-expression' {
  export function variables(input: import('@babel/parser').ParseResult<import('@babel/types').Expression>, options?: import('@babel/parser').ParserOptions): string[]
}