import execa from "execa";
import structure from "./structure";
import path from "./path";

function parseRequireName(name: string) {
    const root = structure.root();
    const localName = name.startsWith('./') ? name.slice(2) : name;
    const localParts = localName.split('/');
    const absolutePath = path.join(path.rootPath, ...localParts);
    if (structure.find(root, { path: absolutePath, type: 'dir' })) {
        return absolutePath;
    }
    const relativePath = path.join(path.packagesPath, ...localParts);
    if (structure.find(root, { path: relativePath, type: 'dir' })) {
        return relativePath;
    }
    return name;
}

async function npmRequire(name:string): Promise<string | null> {
    try {
        const { stdout, stderr } = await execa('npm', ['view', name, 'version']);
        if (stderr) {
            return null;
        }
        return stdout.trim();
    }catch (e:any){
        if(!e.toString().includes('404')){
            return null;
        }
        throw e;
    }
}

async function localRequire(name:string):Promise<string|null>{
    const {root} = await structure.packageJsons();
    if(!root){
        return null;
    }
    const deps = {...root.dependencies,...root.devDependencies};
    const version = deps[name];
    if(!version){
        return null;
    }
    return version;
}

async function globalRequire(name:string):Promise<string|null>{
    const localVersion = await localRequire(name);
    if(!localVersion){
        return npmRequire(name);
    }
    return localVersion;
}

export {
    parseRequireName
}

export default {
    require:globalRequire,
    localRequire,
    npmRequire,
}
