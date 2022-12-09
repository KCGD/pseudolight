import * as fs from "fs";
import * as os from 'os';
import * as path from "path";
import * as jpeg from 'jpeg-js';
import * as process from "process";
import {config} from './src/defaults/config.h';
import {exec, execSync, spawn} from 'child_process';
import {lerp, ease} from './src/modules/interpolate';
import * as confparser from './src/modules/configParser';
import {DetectInit} from './src/modules/bin/detect-init';

//requires ffmpeg and brightnessctl
//ffmpeg -f v4l2 -input_format mjpeg -i /dev/video0 -r:30 -update -filter:v fps=fps=${global.config.updateRate} output_%04d.png

//create template for user argument parsing
//only flags that require aditional arguments will be assigned here
let knownFlags:string[] = ["--help", "-h", "--debug", "--install-daemon", "--uninstall-daemon"];

//store process arguments
let args = {
    debug: false,
    mode: "main"
}

//working vars
let processing:boolean = false;
let currentBrightness:number = 0;

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
            case "--install-daemon":
                args.mode = "installDaemon";
            break;
            case "--uninstall-daemon":
                args.mode = "uninstallDaemon";
            break;
        }
    }

    //switch mode
    switch(args.mode) {
        case "main":
            //load configuration and start program's main route
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
        break;

        //install the daemon
        case "installDaemon":
            switch(DetectInit()) {
                //systemd
                case "systemd":
                    if(process.getuid) {
                        if(process.getuid() === 0) {
                            //install daemon
                            console.log(`[INFO]: Installing daemon`);
                            fs.copyFileSync(path.join(__dirname, "./src/defaults/service/pseudolight-systemd.service"), "/etc/systemd/system/pseudolight-systemd.service");
                            console.log(`[INFO]: Starting pseudolight-systemd.service`);
                            execSync(`systemctl enable --now pseudolight-systemd.service`);
                            process.exit(0);
                        } else {
                            console.log(`[ERROR | FATAL]: Cannot install daemon as a standard user. Please run as root.`);
                        }
                    } else {
                        console.log(`[ERROR | FATAL]: Could not get UID of current process.`);
                        process.exit(1);
                    }
                break;

                //svinit
                case "sysvinit":
                    console.log(`[ERROR | FATAL]: Sysvinit support not implemented yet!`);
                    process.exit(1);
                break;

                //upstart
                case "upstart":
                    console.log(`[ERROR | FATAL]: Upstart support not implemented yet!`);
                    process.exit(1);
                break;

                //unknown / unsupported
                default:
                    console.log(`[ERROR | FATAL]: Unsupported init system "${DetectInit()}"`);
                    process.exit(1);
            }
        break;

        //uninstall daemon
        case "uninstallDaemon":
            switch(DetectInit()) {
                //systemd
                case "systemd":
                    if(process.getuid) {
                        if(process.getuid() === 0) {
                            //install daemon
                            console.log(`[INFO]: Disabling pseudolight-systemd.service`);
                            execSync(`systemctl stop pseudolight-systemd.service`);
                            execSync(`systemctl disable pseudolight-systemd.service`);
                            console.log(`[INFO]: Remove pseudolight-systemd.service`);
                            fs.unlinkSync("/etc/systemd/system/pseudolight-systemd.service");
                            console.log(`[INFO]: Reloading daemons`);
                            execSync("systemctl reset-failed");
                            process.exit(0);
                        } else {
                            console.log(`[ERROR | FATAL]: Cannot uninstall daemon as a standard user. Please run as root.`);
                        }
                    } else {
                        console.log(`[ERROR | FATAL]: Could not get UID of current process.`);
                        process.exit(1);
                    }
                break;

                //svinit
                case "sysvinit":
                    console.log(`[ERROR | FATAL]: Sysvinit support not implemented yet!`);
                    process.exit(1);
                break;

                //upstart
                case "upstart":
                    console.log(`[ERROR | FATAL]: Upstart support not implemented yet!`);
                    process.exit(1);
                break;

                //unknown / unsupported
                default:
                    console.log(`[ERROR | FATAL]: Unsupported init system "${DetectInit()}"`);
                    process.exit(1);
            }
        break;
    }
    
    function _start(): void {
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
                
                        if(filteredAverage > 100) {
                            filteredAverage = 100;
                        }
                        filteredAverage = Math.round(filteredAverage);

                        //only change brightness if new brightness (finalAverage) is outside the range of the treshold
                        if(Math.abs(currentBrightness - filteredAverage) >= global.config.threshold) {
                            if(global.config.useSmoothTransition) {                            
                                let currentTime:number = 0;

                                //animation interval
                                let animationInterval = setInterval(function(){
                                    if(global.config.transitionTime / currentTime <= 1) {
                                        if(args.debug) {console.log("[DEBUG]:", "Lerp clear interval")};
                                        processing = false;
                                        currentBrightness = filteredAverage;
                                        clearInterval(animationInterval);
                                    } else {
                                        if(args.debug) {console.log("[DEBUG]:", `Lerp current time ${currentTime}`)};
                                        if(args.debug) {console.log("[DEBUG]:", `Lerp set brightness: ${applyBias(lerp(currentBrightness, filteredAverage, ease(currentTime/1000)), Number(global.config.bias), 100)}`)};
                                        exec(`brightnessctl set "${applyBias(lerp(currentBrightness, filteredAverage, ease(currentTime/1000)), Number(global.config.bias), 100)}%"`);
                                        currentTime += Number(global.config.transitionRate);
                                    }
                                }, global.config.transitionRate);
                            } else {
                                if(args.debug) {console.log("[DEBUG]:", `Set brightness: ${filteredAverage}`)};
                                exec(`brightnessctl set "${filteredAverage}%"`);
                                currentBrightness = filteredAverage;
                                processing = false;
                            }
                        } else {
                            if(args.debug) {console.log("[DEBUG]:", "Threshold not met")};
                            processing = false;
                        }
                    })
                }
            }
        });

        _launchFFmpeg();
        function _launchFFmpeg(_attempts?:number): void {
            //clear current processing
            processing = false;

            let attempts:number = (_attempts !== undefined)? _attempts : 0;

            if(attempts < Number(global.config.ffmpegRelaunchAttempts)) {
                if(args.debug){console.log("[DEBUG]:", `ffmpeg -f v4l2 -input_format mjpeg -i /dev/video0 -r:30 -update -filter:v fps=fps=${global.config.updateRate} "${config.temporaryPath}/output_%04d.jpg"`)}
                let ffmpegProcess = exec(`ffmpeg -f v4l2 -input_format mjpeg -i /dev/video0 -r:30 -update -filter:v fps=fps=${global.config.updateRate} "${config.temporaryPath}/output_%04d.jpg"`);

                ffmpegProcess.on('message', function(message): void {
                    if(args.debug) {console.log("[ERROR | INFO]:", message)};
                })
                ffmpegProcess.on('error', function(error): void {
                    if(args.debug) {console.log("[ERROR | FFMPEG]:", error)};
                })

                ffmpegProcess.on('close', _handleFFmpegClose);

                function _handleFFmpegClose(): void {
                    if(args.debug) {console.log("[ERROR]:", `ffmpeg closed unexpectedly, relaunching in 5 seconds...`)};
                    setTimeout(function() {
                        _launchFFmpeg(attempts + 1);
                    }, 5000);
                }
            } else {
                console.log("[ERROR | FATAL]:", `FFmpeg failed to launch ${attempts} times. Exiting.`);
                process.exit(14);
            }
        }
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

function applyBias(number:number, bias:number, max:number): number {
    return((number + bias > 100)? 100 : number+bias);
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
