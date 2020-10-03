import * as fs from "fs";
import * as esprima from "esprima";

let inputPath = process.argv[2];
let source = fs.readFileSync(inputPath, 'utf8')

esprima.parseScript(source, {}, (node, _) => {
    if (node.type === 'CallExpression') {
        console.log(node);
        switch (node.callee.type) {
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
