import * as fs from "fs";
import * as esprima from "esprima";
import * as ESTree from "estree";
import { assert } from "console";

const {NodeVM} = require('vm2');
const vm = new NodeVM({
    wrapper: "none"
});

let loadedDefs = new Map();

function getFragment(sourceLines: string[], node: ESTree.Node) {
    if (node.loc) {
        let startLoc = node.loc.start;
        let endLoc = node.loc.end;
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
    throw new Error("node has no loc.")
}

function rewriteOnce(source: string) {
    let sourceLines = source.split("\n");

    let rewrites: { from: string, to: string }[] = [];

    function evalFragment(fragmentToRun: string) {
        try {
            return vm.run(fragmentToRun);
        } catch (error) {
            console.log("VM eval error:" + error);
            return undefined;
        }
    }

    function evalRewriteNode(node: ESTree.Node, withDefs: boolean = true) {
        let originalFragment = getFragment(sourceLines, node);
        var fragmentToRun;
        if (withDefs) {
            fragmentToRun = Array.from(loadedDefs.values()).join("\n") + "\nreturn " + originalFragment;
        } else {
            fragmentToRun = "return " + originalFragment;
            // console.log("---- Running Fragment ----\n" + fragmentToRun);
        }
       let result = evalFragment(fragmentToRun);
        if (result != undefined) {
            // console.log("---- Result ----\n", result);
            rewrites.push({
                from: originalFragment,
                to: JSON.stringify(result)
            })
        }
    }

    esprima.parseScript(source, {loc: true}, (node, _) => {
        if (node.type === 'CallExpression') {
            switch (node.callee.type) {
                case "Identifier":
                    if (loadedDefs.has(node.callee.name)) {
                        evalRewriteNode(node);
                    }
                    break;
            }
        }
        if (node.type === 'MemberExpression') {
            switch (node.object.type) {
                case "Identifier":
                    if (loadedDefs.has(node.object.name)) {
                        evalRewriteNode(node);
                    }
                    break;
            }
        }
        if (node.type === "BinaryExpression") {
            if (node.left.type === "Literal" &&
                node.right.type === "Literal") {
                evalRewriteNode(node, false);
            }
            if (node.left.type === "BinaryExpression" &&
                node.left.right.type === "Literal" &&
                node.right.type === "Literal" &&
                node.left.operator === "+" &&
                node.operator === "+") {
                let nodeFragment = getFragment(sourceLines, node);
                let nodeLLFragment = getFragment(sourceLines, node.left.left);
                let nodeLRFragment = getFragment(sourceLines, node.left.right);
                let nodeRFragment = getFragment(sourceLines, node.right);
                var fragmentToRun ="return " + nodeLRFragment + "+" + nodeRFragment;
                // console.log("---- Running Fragment ----\n" + fragmentToRun);
                let result = evalFragment(fragmentToRun);
                if (result != undefined) {
                    // console.log("---- Result ----\n", result);
                    rewrites.push({
                        from: nodeFragment,
                        to: nodeLLFragment + "+" + JSON.stringify(result)
                    })
                }
            }
        }
    });
    var outputSource = source;
    for (let rewrite of rewrites) {
        outputSource = outputSource.replace(rewrite.from, rewrite.to);
    }
    return {
        rewrites: rewrites,
        outputSource: outputSource
    };
}

let inputPath = process.argv[2];
var source = fs.readFileSync(inputPath, 'utf8')

let sourceLines = source.split("\n");
esprima.parseScript(source, {loc: true}, (node, _) => {
    if (node.type === 'AssignmentExpression') {
        let fragment = getFragment(sourceLines, node);
        if (node.right.type === 'Literal' && node.left.type === "Identifier") {
            // console.log("---- Loading assignment to literal " + node.left.name + " -----\n" + fragment);
            assert(!loadedDefs.has(node.left.name));
            loadedDefs.set(node.left.name, fragment);
        }
    }
    if (node.type === 'FunctionDeclaration' && node.id) {
        let fragment = getFragment(sourceLines, node);
        // console.log("---- Loading " + node.id.name + " -----\n" + fragment);
        assert(!loadedDefs.has(node.id.name));
        loadedDefs.set(node.id.name, fragment);
    }
});

let totalSteps = 1000000;
var step = 0;
for (; step < totalSteps; step++) {
    let result = rewriteOnce(source);
    if (result.rewrites.length === 0) break;
    console.log("--- Rewrite ---")
    source = result.outputSource;
}

console.log(source);

console.log("Run steps:", step);