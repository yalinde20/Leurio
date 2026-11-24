import { imagesDePile } from './plantages';

describe('imagesDePile', () => {
  it('given une pile de navigateur, when on la convertit, then on obtient fonction, fichier et ligne', () => {
    const pile = 'Error: x\n    at f (https://leurio.test/main.js:10:5)\n    at https://leurio.test/a.js:3:1';
    expect(imagesDePile(pile)).toEqual([
      { functionName: 'f', fileName: 'https://leurio.test/main.js', lineNumber: 10 },
      { functionName: undefined, fileName: 'https://leurio.test/a.js', lineNumber: 3 },
    ]);
  });

  it('given une pile absente ou illisible, when on la convertit, then rien n\'est transmis', () => {
    expect(imagesDePile(undefined)).toBeUndefined();
    expect(imagesDePile('Error: x')).toBeUndefined();
  });
});

describe('imagesDePile, piles Safari et WKWebView', () => {
  it('given une pile iOS, when on la convertit, then on obtient fonction, fichier et ligne', () => {
    const pile = 'f@capacitor://localhost/main.js:10:5\ncapacitor://localhost/main.js:20:7\nglobal code@capacitor://localhost/a.js:3:1';
    expect(imagesDePile(pile)).toEqual([
      { functionName: 'f', fileName: 'capacitor://localhost/main.js', lineNumber: 10 },
      { functionName: undefined, fileName: 'capacitor://localhost/main.js', lineNumber: 20 },
      { functionName: 'global code', fileName: 'capacitor://localhost/a.js', lineNumber: 3 },
    ]);
  });
});
