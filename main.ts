import * as fs from "fs";
import * as esprima from "esprima";

let inputPath = process.argv[2];
let source = fs.readFileSync(inputPath, 'utf8')

var edges = [];
var nodes = [];

function getNode(name: String) {
    let idx = nodes.indexOf(name);
    if (idx == -1) {
        idx = nodes.length;
        nodes.push(name);
        return idx;
    }
    return idx;
}

function freshNode(name: String) {
    let idx = nodes.length;
    nodes.push(name);
    return idx;
}

esprima.parseScript(source, {}, (node, _) => {
    if (node.type === 'CallExpression') {
        switch (node.callee.type) {
            case "MemberExpression":
                if (node.callee.property.type == "Identifier") {
                    var name = node.callee.property.name;
                    if (node.callee.object.type == "Identifier" && node.callee.object.name == "Buffer") { // HACK: we will use WALA to generalize this in future
                        name = node.callee.object.name + "." + name;
                    }
                    edges.push([getNode("__main__"), freshNode(name)]);
                }
                break;
        }
    }
});

fs.writeFileSync(inputPath + ".js2graph.json", JSON.stringify({nodes: nodes, edges: edges}));