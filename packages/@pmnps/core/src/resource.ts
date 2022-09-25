import {PackageJson} from "./type";

const prettier = {
    semi: true,
    singleQuote: true,
    tabWidth: 2,
    trailingComma: 'none',
    arrowParens: 'avoid'
};

const gitignore = `node_modules/
/.idea/
/.vscode/
/dist/
/bin/
/esm/
.pmnps.local.json
`;

const forbiddenNpmrc = 'registry=https://forbidden.manual.install';

const defaultPackageJson:PackageJson = {
    private:true,
    name:'workspace',
    version:'1.0.0',
    description: "project of monorepo platforms",
    devDependencies:{
        prettier:'^2.7.0'
    }
}

export {
    defaultPackageJson
}

export default {
    defaultPackageJson,
    prettier,
    gitignore,
    forbiddenNpmrc
}
