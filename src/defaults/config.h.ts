export type config = {
    updateRate:number;
    bias:number;
    rate:number;
    threshold:number;
    textEditor: string;
    useSmoothTransition:string;
    transitionType: "ease" | "linear";
    transitionTime:number;
    transitionRate:number;
    temporaryPath:string;
    ffmpegRelaunchAttempts:number;
}