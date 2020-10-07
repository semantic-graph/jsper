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

/**
 * for node @callee.[property](...) --> match @callee
 */
function calleeObjectProperty(node: ESTree.Node, property: string) {
    if (node.type == "CallExpression" && node.callee.type == "MemberExpression") {
        if (node.callee.property.type == "Identifier" && node.callee.property.name == property) {
            return node.callee.object;
        }
    }
    return null;
}

/**
 * for @node identifierName.*(...) --> match @node
 */
function callIdentifierName(node: ESTree.Node, identifierName: string) {
    if (node.type == "CallExpression" && node.callee.type == "MemberExpression") {
        if (node.callee.object.type == "Identifier" && node.callee.object.name == identifierName) {
            return node;
        }
    }
    return null;
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
            if (node.callee.type == "Identifier") {
                if (loadedDefs.has(node.callee.name)) {
                    evalRewriteNode(node);
                }
            }
        }
        // Unfold built-in function call
        // node: Buffer.X("...").toString
        let toStringOfObject = calleeObjectProperty(node, "toString");
        if (toStringOfObject) {
            let call = callIdentifierName(toStringOfObject, "Buffer");
            if (call) {
                if (call.arguments.every((argNode, _index, _array) => {
                    if (argNode.type == "Literal") {
                        return true;
                    }
                    if (argNode.type == "Identifier" && loadedDefs.has(argNode.name)) {
                        return true;
                    }
                    return false;
                })) {
                    evalRewriteNode(node);
                }
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
            let nodeL = node.left;
            if (nodeL.type === "BinaryExpression" &&
                nodeL.right.type === "Literal" &&
                node.right.type === "Literal" &&
                nodeL.operator === "+" &&
                node.operator === "+") {
                let nodeFragment = getFragment(sourceLines, node);
                let nodeLLFragment = getFragment(sourceLines, nodeL.left);
                let nodeLRFragment = getFragment(sourceLines, nodeL.right);
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

function loadAssign(lhs: ESTree.Pattern, rhs: ESTree.Expression, node: ESTree.Node) {
    if (rhs.type === 'Literal' && lhs.type === "Identifier") {
        // console.log("---- Loading assignment to literal " + node.left.name + " -----\n" + fragment);
        assert(!loadedDefs.has(lhs.name));
        let fragment = getFragment(sourceLines, node);
        loadedDefs.set(lhs.name, fragment);
    }
}

esprima.parseScript(source, {loc: true}, (node, _) => {
    if (node.type === 'AssignmentExpression') {
        loadAssign(node.left, node.right, node);
    }
    // TODO: node.declarations.length > 1
    if (node.type === "VariableDeclaration" && node.declarations.length == 1) {
        let lhs = node.declarations[0].id
        let rhs = node.declarations[0].init
        if (rhs) {
            loadAssign(lhs, rhs, node);
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