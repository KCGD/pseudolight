/**
 * selectUntil:
 *      accepts text<string>, condition<function>
 *      condition must be able to recieve a string parameter, and return true once a certain caracter (or set of characters) is met
 * 
 *          example for stopping selection once ";" is found: 
 *              selectUntil("some stuff;", (char) => {return (char === ";")})
 *              }))
 * 
 *          the slection would stop at ";", and "some stuff" will be returned
 *          if the condition function never fires, the whole string will be returned
 * 
 * removeUntil:
 *      accepts text<string>, condition<function>
 *      the opposite of selectuntil
 *      will ignore characters until the condition you provide returns true, after which, it will return the rest of the string
 *          example: removeUntil(
 *                      "1234abcd",
 *                      (char) => {return isNaN(char)}
 *                   )
 *                  returns: "abcd"
 * 
 * selectBetween:
 *      accepts text<string>, parameters<object>
 *      parameters must have two properties, start and end. these can be the same
 *          start and end must be what two things to select between, eg: properties = {start: "{", end: "}"}
 *              this will only select things in the string between { and }
 *          nesting is supported! so if you have, for example: string 1 {string 2 {string 3}}, the selectbetwen will return "string2 {string3}"
 * 
 *  presets:
 *      presets are pre-made functions you can use instead of writing out entire functions for each selector
 *      
 *      charEquals:
 *          accepts string array
 *          this will check if each individual character matches any of the caracters provided in the array, and return true if any do
 */

export function selectUntil(text:string, condition:any):string {
    let sum:string[] = [];
    let chars:string[] = text.split("");

    for(let i=0; i < chars.length; i++) {
        let char:string = chars[i];

        if(condition(char)) {
            return sum.join('');
        } else {
            sum.push(char);
        }
    }

    return sum.join('');
}


export function removeUntil (text:string, condition:any): string {
    let sum:string[] = [];
    let chars:string[] = text.split("");
    let initiated:boolean = false;

    for(var i = 0; i < chars.length; i++) {
        let char:string = chars[i];

        if(condition(char)) {
            initiated = true;
        }

        if(initiated) {
            sum.push(char);
        }
    }

    return sum.join('');
}


export function selectBetween (text:string, parameters:SelectionParameter):string {
    let sum:string[] = [];
    let chars:string[] = text.split("");
    let layers:number = 0;
    let selectionStarted:boolean = false;

    for(var i = 0; i < chars.length; i++) {
        let char:string = chars[i];

        if(char === parameters.start) {
            layers ++;
            if(!selectionStarted) {
                selectionStarted = true;
            };
        } else if(char === parameters.end) {
            layers --;
        }

        if(selectionStarted) {
            if(layers === 0) {
                return sum.join('');
            } else {
                sum.push(char);
            }
        }
    }

    return sum.join('');
}


export function charEquals (possibilities:string[]): any {
    return function(char:string): boolean {
        return possibilities.includes(char);
    }
}


export function replaceAll (line:string, searchTerm:string, newValue:string):string {
    let occurances:number = line.split(searchTerm).length - 1;

    for(let i=0; i < occurances; i++) {
        line = line.replace(searchTerm, newValue);
    }

    return line;
}


//parameter class
export class SelectionParameter {
    start: string;
    end: string;

    constructor(startString:string, endString:string) {
        this.start = startString;
        this.end = endString;
    }
}