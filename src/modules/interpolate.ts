export function lerp(p1:number, p2:number, t:number): number {
    return p1 + (p2 - p1) * t;
}

export function ease(t:number): number {
    return t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1;
}