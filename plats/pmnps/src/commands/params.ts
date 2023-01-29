import {PackageJson} from "@pmnps/core";

export function parseParam(
    pf: PackageJson,
    param?: string,
    fix?: 'before' | 'after'
): string | undefined {
    if (!param) {
        return undefined;
    }
    const trimParam = param.trim();
    if (!trimParam.startsWith('?')) {
        return trimParam;
    }
    const paramString = trimParam.slice(1);
    const parts = paramString.split('&');
    const entries = parts
        .map(part => {
            const [key, value] = part.split('=');
            if (!value || !value.trim()) {
                return undefined;
            }
            return [key, value];
        })
        .filter((d): d is [string, string] => !!d);
    const { name, pmnps = {} } = pf;
    const { alias } = pmnps;
    const map = Object.fromEntries(entries);
    const nameKey = fix ? `${name}.${fix}` : name;
    if (map[nameKey]) {
        return map[nameKey];
    }
    if (!alias) {
        return undefined;
    }
    const aliasKey = fix ? `${alias}.${fix}` : alias;
    if (map[aliasKey]) {
        return map[aliasKey];
    }
    const globalKey = fix ? `<global>.${fix}` : '<global>';
    if (map[globalKey]) {
        return map[globalKey];
    }
    return undefined;
}
