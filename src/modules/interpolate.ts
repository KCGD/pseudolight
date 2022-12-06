export function lerp(start:number, end:number, time:number): number {
    return (1 - time) * start + time * end;
}