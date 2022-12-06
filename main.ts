import * as fs from "fs";
import * as path from "path";
import * as process from "process";
import {exec} from 'child_process';
import * as jpeg from 'jpeg-js';

//requires ffmpeg and brightnessctl
//ffmpeg -f v4l2 -input_format mjpeg -i /dev/video0 -r:30 -update -filter:v fps=fps=${rate} output_%04d.png

//create template for user argument parsing
//only flags that require aditional arguments will be assigned here
let knownFlags:string[] = ["--help", "-h"];

//store process arguments
let args = {

}

//configs
const rate:number = 2;
const bias:number = 10;

//working vars
let processing:boolean = false;

//main function
Main();
function Main(): void {
    //parse process arguments
    for(let i:number = 0; i < process.argv.length; i++) {
        if(process.argv[i].startsWith("-") && !knownFlags.includes(process.argv[i])) {
            console.log(`[WARNING]: Unknown option "${process.argv[i]}"`);
        }
        switch(process.argv[i]) {
            case "--help":
            case "-h":
                console.log(fs.readFileSync(path.join(__dirname, "./src/HelpFile")).toString());
                process.exit(0);
            break;
        }
    }
    
    //make temp path if nessicary
    if(!fs.existsSync("/tmp/pseudolight")) {
        fs.mkdirSync("/tmp/pseudolight", {'recursive': true});
    } else {
        clearTmp();
    }

    fs.watch("/tmp/pseudolight", {}, function(event): void {
        //remove all except current
        if(!processing) {
            processing = true;
            filterTmp();
            let targetImage = fs.readdirSync("/tmp/pseudolight")[0];
            if(targetImage) {
                //console.log(`READ: ${targetImage}`);
                fs.readFile(`/tmp/pseudolight/${targetImage}`, function(err, imageData): void {
                    let image = jpeg.decode(imageData, {'formatAsRGBA': false, useTArray: true});
                    let splitArray:any[][] = splitToChunks([...Array.from(image.data)], 3);
                    //console.log(splitArray);
                    let averageBrightness:number = 0;

                    for(let i = 0; i < splitArray.length; i++) {
                        let thisArray:any[] = splitArray[i];
                        let thisAverage:number = 0;
                        for(let j = 0; j < thisArray.length; j++) {
                            thisAverage += thisArray[j];
                        }
                        thisAverage = thisAverage/3;
                        //console.log(thisAverage);
                        averageBrightness += thisAverage;
                    }

                    let finalAverage:number = (((averageBrightness/(splitArray.length))/225)*100);

                    //apply bias, limit and round
                    let filteredAverage:number = finalAverage;
                    filteredAverage += bias;
                    if(filteredAverage > 100) {
                        filteredAverage = 100;
                    }
                    filteredAverage = Math.round(filteredAverage);

                    console.log(filteredAverage);
                    exec(`brightnessctl set "${filteredAverage}%"`)

                    processing = false;
                })
            }
        }
    });

    exec(`ffmpeg -f v4l2 -input_format mjpeg -i /dev/video0 -r:30 -update -filter:v fps=fps=${rate} "/tmp/pseudolight/output_%04d.jpg"`);
}

function clearTmp(): void {
    let imageList:string[] = fs.readdirSync("/tmp/pseudolight");
    for(let i = 0; i < imageList.length; i++) {
        //console.log(`REMOVE: /tmp/pseudolight/${imageList[i]}`);
        fs.unlinkSync(`/tmp/pseudolight/${imageList[i]}`);
    }
}

function filterTmp(): void {
    let imageList:string[] = fs.readdirSync("/tmp/pseudolight");
    for(let i = 0; i < imageList.length - 1; i++) {
        //console.log(`REMOVE: /tmp/pseudolight/${imageList[i]}`);
        fs.unlinkSync(`/tmp/pseudolight/${imageList[i]}`);
    }
    //console.log(`REMAINING: ${fs.readdirSync("/tmp/pseudolight")[0]}`)
}


function splitToChunks(array:any[], amt:number): any[][] {
    let arrayArray:any[][] = [];
    let counter:number = 0;
    let bufferArray:any[] = [];

    for(let i = 0; i < array.length; i++) {
        if(counter !== 3) {
            bufferArray.push(array[i]);
            counter++;
        } else {
            if(bufferArray.length === 3) {
                arrayArray.push(bufferArray);
                bufferArray = [];
                counter = 0;
            } else {
                counter = 0;
            }
        }
    }

    return arrayArray;
}