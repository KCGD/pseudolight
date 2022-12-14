import * as fs from "fs";
import * as os from 'os';
import * as path from "path";
import * as jpeg from 'jpeg-js';
import * as process from "process";
import {config} from './src/defaults/config.h';
import {exec, execSync, spawn, spawnSync} from 'child_process';
import {lerp, ease} from './src/modules/interpolate';
import * as confparser from './src/modules/configParser';
import {DetectInit} from './src/modules/bin/detect-init';

//requires ffmpeg and brightnessctl
//ffmpeg -f v4l2 -input_format mjpeg -i /dev/video0 -r:30 -update -filter:v fps=fps=${global.config.updateRate} output_%04d.png

//create template for user argument parsing
//only flags that require aditional arguments will be assigned here
let knownFlags:string[] = ["--help", "-h", "--debug", "--install-daemon", "--uninstall-daemon", "--edit-config", "--erase-config", "--purge"];

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

            //enable debugging
            case "--debug":
                args.debug = true;
            break;

            //install the daemon
            case "--install-daemon":
                args.mode = "installDaemon";
            break;

            //uninstall the daemon
            case "--uninstall-daemon":
                args.mode = "uninstallDaemon";
            break;

            //edit the config file
            case "--edit-config":
                args.mode = "edit";
            break;

            //erase pseudolight config
            case "--erase-config":
                args.mode = "eraseConfig";
            break;

            //purge pseudolight from the system
            case "--purge":
                args.mode = "purge";
            break;
        }
    }

    //load configuration
    //load configuration and start program's mode selection
    let configDirectory:string = path.join(os.homedir(), ".config/pseudolight");
    if(!fs.existsSync(configDirectory)) {
        fs.mkdirSync(configDirectory, {'recursive': true});
        fs.copyFileSync(path.join(__dirname, "./src/defaults/pseudolight.conf"), path.join(configDirectory, "./pseudolight.conf"));

        confparser.parse(path.join(configDirectory, "./pseudolight.conf"), path.join(__dirname, "./src/defaults/pseudolight.conf.defaults.json"), function(config:config): void {
            global.config = config as config;
            _mode();
        });
    } else {
        confparser.parse(path.join(configDirectory, "./pseudolight.conf"), path.join(__dirname, "./src/defaults/pseudolight.conf.defaults.json"), function(config:config): void {
            global.config = config as config;
            _mode();
        });
    }

    //switch mode
    //accepts a string to force the mode, otherwise takes mode from args object
    function _mode(forcedMode?:string): void {
        switch((forcedMode)? forcedMode : args.mode) {
            case "main":
                _start();
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
                                if(fs.existsSync("/etc/systemd/system/pseudolight-systemd.service")) {
                                    console.log(`[INFO]: Disabling pseudolight-systemd.service`);
                                    execSync(`systemctl stop pseudolight-systemd.service`);
                                    execSync(`systemctl disable pseudolight-systemd.service`);
                                    console.log(`[INFO]: Remove pseudolight-systemd.service`);
                                    fs.unlinkSync("/etc/systemd/system/pseudolight-systemd.service");
                                    console.log(`[INFO]: Reloading daemons`);
                                    execSync("systemctl reset-failed");
                                } else {
                                    console.log(`[ERROR]: Pseudolight daemon not installed! (checked for: "/etc/systemd/system/pseudolight-systemd.service")`);
                                }
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
    
            //edit the config file
            case "edit":
                let configPath:string = path.join(os.homedir(), "./.config/pseudolight/pseudolight.conf");
                if(fs.existsSync(configPath)) {
                    let editorCommand:string;
                    if(args.debug) {console.log(`[DEBUG]: Using editor "${global.config.textEditor}"`)};
                    if(global.config.textEditor === "auto") {
                        editorCommand = execSync(`${fs.readFileSync(path.join(__dirname, "./src/modules/bin/findEditor.sh")).toString()} 2> /dev/null`).toString().split('\n')[0];
                        if(args.debug) {console.log(`[DEBUG]: Found text editor: ${editorCommand}`)};
                    } else {
                        editorCommand = global.config.textEditor;
                    }
    
                    //run the text editor
                    if(args.debug) {console.log(`[DEBUG]: Run [${editorCommand} "${configPath}"]`)}
                    let editorProcess = spawn(editorCommand, [configPath], {'stdio':"inherit"});
                    editorProcess.on('close', function() {
                        process.exit(0);
                    })
                } else {
                    console.log(`[ERROR | FATAL]: Could not find pseudolight.conf (looked in: "${path.join(os.homedir(), "./.config/pseudolight/pseudolight.conf")}")`);
                    console.log(`Make sure you ran this command as the same user which is running the service!`);
                    process.exit(1);
                }
            break;
        
            //erase config
            case "eraseConfig":
                if(args.debug) {console.log(`[DEBUG]: Erasing config files`)}
                let m_configPath:string = path.join(os.homedir(), "./.config/pseudolight/pseudolight.conf");

                if(fs.existsSync(m_configPath)) {
                    if(args.debug) {console.log(`[DEBUG]: Removing [${path.dirname(m_configPath)}]`)};
                    fs.rmSync(path.dirname(m_configPath), {'recursive': true});
                } else {
                    console.log(`[ERROR | FATAL]: Could not find config path (looked in: "${m_configPath}")`);
                    process.exit(1);
                }
            break;
        
            //purge
            case "purge":
                _mode("eraseConfig");
                _mode("uninstallDaemon");
            break;
        }
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

                                        //ease or linear transition based on global config
                                        if(global.config.transitionType === "ease") {
                                            //eased transition
                                            if(args.debug) {console.log("[DEBUG]:", `Lerp set brightness: ${applyBias(lerp(currentBrightness, filteredAverage, ease(currentTime/1000)), Number(global.config.bias), 100)}`)};
                                            exec(`brightnessctl set "${applyBias(lerp(currentBrightness, filteredAverage, ease(currentTime/1000)), Number(global.config.bias), 100)}%"`);
                                        } else {
                                            //linear transition
                                            if(args.debug) {console.log("[DEBUG]:", `Lerp set brightness: ${applyBias(lerp(currentBrightness, filteredAverage, currentTime/1000), Number(global.config.bias), 100)}`)};
                                            exec(`brightnessctl set "${applyBias(lerp(currentBrightness, filteredAverage, currentTime/1000), Number(global.config.bias), 100)}%"`);
                                        }
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
