import * as fs from "fs";
import * as os from 'os';
import * as path from "path";
import * as process from "process";
import {exec} from 'child_process';
import * as jpeg from 'jpeg-js';
import * as confparser from './src/modules/configParser';
import {config} from './src/defaults/config.h';
import {lerp} from './src/modules/interpolate';

//requires ffmpeg and brightnessctl
//ffmpeg -f v4l2 -input_format mjpeg -i /dev/video0 -r:30 -update -filter:v fps=fps=${global.config.updateRate} output_%04d.png

//create template for user argument parsing
//only flags that require aditional arguments will be assigned here
let knownFlags:string[] = ["--help", "-h", "--debug"];

//store process arguments
let args = {
    debug: false
}

//working vars
let processing:boolean = false;
let currentBrightness:number = 50;

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
            case "--debug":
                args.debug = true;
            break;
        }
    }

    //load configuration
    let configDirectory:string = path.join(os.homedir(), ".config/pseudolight");
    if(!fs.existsSync(configDirectory)) {
        fs.mkdirSync(configDirectory, {'recursive': true});
        fs.copyFileSync(path.join(__dirname, "./src/defaults/pseudolight.conf"), path.join(configDirectory, "./pseudolight.conf"));

        confparser.parse(path.join(configDirectory, "./pseudolight.conf"), path.join(__dirname, "./src/defaults/pseudolight.conf.defaults.json"), function(config:config): void {
            global.config = config as config;
            _start();
        });
    } else {
        confparser.parse(path.join(configDirectory, "./pseudolight.conf"), path.join(__dirname, "./src/defaults/pseudolight.conf.defaults.json"), function(config:config): void {
            global.config = config as config;
            _start();
        });
    }
    
    function _start(): void {
        if(args.debug) {
            console.log(global.config);
        }

        //make temp path if nessicary
        if(!fs.existsSync(`${config.temporaryPath}`)) {
            fs.mkdirSync(`${config.temporaryPath}`, {'recursive': true});
        } else {
            clearTmp();
        }

        fs.watch(`${config.temporaryPath}`, {}, function(event): void {
            //remove all except current
            if(!processing) {
                processing = true;
                filterTmp();
                let targetImage = fs.readdirSync(config.temporaryPath)[0];
                
                if(targetImage) {
                    fs.readFile(`${config.temporaryPath}/${targetImage}`, function(err, imageData): void {
                        let image = jpeg.decode(imageData, {'formatAsRGBA': false, useTArray: true});
                        let splitArray:any[][] = splitToChunks([...Array.from(image.data)], 3);
                        let averageBrightness:number = 0;

                        for(let i = 0; i < splitArray.length; i++) {
                            let thisArray:any[] = splitArray[i];
                            let thisAverage:number = 0;
                            for(let j = 0; j < thisArray.length; j++) {
                                thisAverage += thisArray[j];
                            }
                            thisAverage = thisAverage/3;
                            averageBrightness += thisAverage;
                        }

                        let finalAverage:number = (((averageBrightness/(splitArray.length))/225)*100);

                        //apply global.config.bias, limit and round
                        let filteredAverage:number = finalAverage;
                        filteredAverage += global.config.bias;
                        if(filteredAverage > 100) {
                            filteredAverage = 100;
                        }
                        filteredAverage = Math.round(filteredAverage);

                        //only change brightness if new brightness (finalAverage) is outside the range of the treshold
                        if(Math.abs(currentBrightness - filteredAverage) >= global.config.threshold) {
                            if(global.config.useSmoothTransition) {                            
                                let currentTime:number = 0;
                                let targetTime:number = Math.round(global.config.transitionTime);
                                let steps:number = Math.floor(global.config.transitionTime / global.config.updateRate);
                                let stepSize:number = (targetTime*(global.config.transitionTime/global.config.transitionRate)/100);
                                let currentStep:number = 0;
    
                                let animationInterval = setInterval(function(): void {
                                    if(args.debug) {
                                        console.log("[DEBUG]:", `Larp from ${currentBrightness} to ${finalAverage}`);
                                        console.log("[DEBUG]:", `Current larp time:`, currentTime, targetTime);
                                    };
                                    if(currentTime < targetTime) {
                                        if(args.debug) {console.log("[DEBUG]:", `Larp set: ${lerp(currentBrightness, finalAverage, (currentTime>targetTime)? 1 : currentTime)}`)};
                                        exec(`brightnessctl set "${lerp(currentBrightness, finalAverage, (currentTime>targetTime)? targetTime : currentTime)}%"`);
                                        currentTime = currentTime + global.config.transitionRate;
                                    } else {
                                        console.log("[DEBUG]:", "Close larp interval");
                                        clearInterval(animationInterval);
                                    }
                                }, global.config.transitionRate);
                            } else {
                                if(args.debug) {console.log("[DEBUG]:", `Set brightness: ${filteredAverage}`)};
                                exec(`brightnessctl set "${filteredAverage}%"`);
                            }
    
                            currentBrightness = filteredAverage;
                        } else {
                            if(args.debug) {console.log("[DEBUG]:", "Threshold not met")};
                        }

                        processing = false;
                    })
                }
            }
        });

        if(args.debug){console.log("[DEBUG]:", `ffmpeg -f v4l2 -input_format mjpeg -i /dev/video0 -r:30 -update -filter:v fps=fps=${global.config.updateRate} "${config.temporaryPath}/output_%04d.jpg"`)}
        exec(`ffmpeg -f v4l2 -input_format mjpeg -i /dev/video0 -r:30 -update -filter:v fps=fps=${global.config.updateRate} "${config.temporaryPath}/output_%04d.jpg"`);
    }
}

function clearTmp(): void {
    let imageList:string[] = fs.readdirSync(`${config.temporaryPath}`);
    for(let i = 0; i < imageList.length; i++) {
        fs.unlinkSync(`${config.temporaryPath}/${imageList[i]}`);
    }
}

function filterTmp(): void {
    let imageList:string[] = fs.readdirSync(`${config.temporaryPath}`);
    for(let i = 0; i < imageList.length - 1; i++) {
        fs.unlinkSync(`${config.temporaryPath}/${imageList[i]}`);
    }
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
