import { join } from "path";
import { execSync } from "child_process";

type initSystem = "upstart" | "systemd" | "sysvinit";

export function DetectInit(): initSystem | undefined {
    let result = execSync("cat /sbin/init | awk 'match($0, /(upstart|systemd|sysvinit)/) { print toupper(substr($0, RSTART, RLENGTH));exit; }' 2> /dev/null")
        .toString()
        .toLowerCase()
        .normalize()
        .replace(/\r/g, "")
        .replace(/\n/g, "");
    let initSystem:initSystem;

    if(result === "upstart" || result === "systemd" || result === "sysvinit") {
        initSystem = result as initSystem;
        return initSystem;
    } else {
        return undefined;
    }
}