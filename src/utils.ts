import { minify } from "terser";

export async function clearCode(code: string, lang?: string) {
  let newCode = code;

  // ---
  // if code is a `js` file, try to minify it
  if(lang && ['js', 'javascript'].includes(lang)) {
    const cacheCode = newCode;
    try{
      newCode = (await minify(code, {
        mangle: false,
        keep_classnames: true,
        keep_fnames: true,
      })).code || '';
    } catch(e) {
      // restore the original code
      newCode = cacheCode;
      console.error(e);
    }
  }

  // ---
  // clear multi spacings
  if(lang && ['ts', 'tsx', 'typescript', 'typescriptreact', 'vue', 'json'].includes(lang)) {
    newCode = newCode.replace(/\s+/g, ' ');
  }

  // ---
  // clear the spacings brfore the end of line
  newCode = newCode.replace(/\s+(?=\r?\n)/g, '\n');

  // ---
  // clear blank lines
  newCode = newCode.replace(/[\r\n]+/g, '\n');

  // console.log({
  //   code,
  //   lang,
  //   newCode,
  // });

  return newCode.trim();
}
