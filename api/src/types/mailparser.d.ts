declare module 'mailparser' {
  export function simpleParser(input: Buffer | NodeJS.ReadableStream): Promise<any>;
}


