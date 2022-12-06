import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";
import * as parseUtil from "./parseTools";

export function parse (confpath:string, defaultsPath:string, callback:any): void {
    let defaultObject = JSON.parse(fs.readFileSync(defaultsPath).toString());

    //define the $USER variable in defaultObject
    defaultObject.variables.USER = os.homedir();

    //create the readline interface
    let rl = readline.createInterface({
        input:fs.createReadStream(confpath)
    })

    
    //handle config line-by-line
    rl.on('line', (line:string): void => {


        //sub in all variable calls
        let defaultObjectVarKeys = Object.keys(defaultObject.variables);
        for(let i=0; i < defaultObjectVarKeys.length; i++) {
            let currentVar = defaultObjectVarKeys[i];
            line = parseUtil.replaceAll(line, `$${currentVar}`, defaultObject.variables[currentVar]);
        }


        //special handeling for accessrules
        if(parseUtil.selectUntil(line, parseUtil.charEquals([" ", "="])) === "accessRule") {
            //handle access rules
            let split:string[] = line.split(" ");
            defaultObject.accessRules.push(new accessRule(
                split[1],
                parseUtil.selectBetween(line, new parseUtil.SelectionParameter('"', '"')).replace(/"/g, ""),
                split[2]
            ))


        //handle defining variables in config
        } else {
            if(parseUtil.selectUntil(line, parseUtil.charEquals([" ", "="])) === "define") {
                //remove "define" from the line
                let lineWithoutInitialCommand:any = line.split(" ");
                lineWithoutInitialCommand.shift();
                lineWithoutInitialCommand = lineWithoutInitialCommand.join(" ");

                defaultObject.variables[parseUtil.selectUntil(lineWithoutInitialCommand, parseUtil.charEquals([" ", "="]))] = parseUtil.removeUntil(line.split("=")[1], function(char:string):boolean {return (char !== " ")});
                line = lineWithoutInitialCommand;
            }


            //other lines
            if(!line.startsWith("#") && !line.startsWith("\n")) {
                if(line.includes("=")) {
                    defaultObject[parseUtil.selectUntil(line, parseUtil.charEquals([" ", "="]))] = parseUtil.removeUntil(line.split("=")[1], function(char:string):boolean {return (char !== " ")});
                } else {
                    defaultObject[parseUtil.selectUntil(line, parseUtil.charEquals([" ", "="]))] = true;
                }
            }
        }
    })


    rl.on('close', function():void {
        callback(defaultObject);
    })
}


export class accessRule {
    host: string;
    path: string;
    policy: string;

    constructor (host:string, path:string, policy:string) {
        this.host = host;
        this.path = path;
        this.policy = policy;
    }
}