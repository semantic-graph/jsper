import * as fs from "fs";
import * as esprima from "esprima";
import * as ESTree from "estree";
import { start } from "repl";
import { assert } from "console";
import { NONAME } from "dns";

let inputPath = process.argv[2];
let source = fs.readFileSync(inputPath, 'utf8')

const {NodeVM} = require('vm2');
const vm = new NodeVM({
    wrapper: "none"
});

let sourceLines = source.split("\n")

let loadedFuncs = new Map();

let rewrites: { from: string, to: string }[] = [];

function getFragment(node: ESTree.Node) {
    let startLoc = node.loc.start
    let endLoc = node.loc.end
    var fragment = "";
    if (startLoc.line != endLoc.line) {
        fragment += sourceLines[startLoc.line - 1].slice(startLoc.column) + "\n";
        for (let line of sourceLines.slice(startLoc.line, endLoc.line - 1)) {
            fragment += line + "\n";
        }
        fragment += sourceLines[endLoc.line - 1].slice(0, endLoc.column);
    } else {
        fragment += sourceLines[startLoc.line - 1].slice(startLoc.column, endLoc.column);
    }
    return fragment;
}

esprima.parseScript(source, {loc: true}, (node, _) => {
    if (node.type === 'FunctionDeclaration') {
        let fragment = getFragment(node);
        console.log("---- Loading " + node.id.name + " -----\n" + fragment);
        vm.run(fragment);
        assert(!loadedFuncs.has(node.id.name));
        loadedFuncs.set(node.id.name, fragment);
    }
    if (node.type === 'CallExpression') {
        switch (node.callee.type) {
            case "Identifier":
                if (loadedFuncs.has(node.callee.name)) {
                    let fragment = getFragment(node);
                    let allFragments = Array.from(loadedFuncs.values()).join("\n") + "\nreturn " + fragment;
                    console.log("---- Running ----\n" + allFragments);
                    let result = vm.run(allFragments);
                    console.log("---- Result ----\n", result);
                    rewrites.push({
                        from: fragment,
                        to: JSON.stringify(result)
                    })
                }
                break;
            case "MemberExpression":
                if (node.callee.property.type == "Identifier") {
                    var name = node.callee.property.name;
                    if (node.callee.object.type == "Identifier" && node.callee.object.name == "Buffer") { // HACK: we will use WALA to generalize this in future
                        name = node.callee.object.name + "." + name;
                    }
                }
                break;
        }
    }
});

var outputSource = source;
for (let rewrite of rewrites) {
    outputSource = source.replace(rewrite.from, rewrite.to);
}
console.log("--- Rewritten source ---")
console.log(outputSource);