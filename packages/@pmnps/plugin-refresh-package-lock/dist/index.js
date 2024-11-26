"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  default: () => src_default
});
module.exports = __toCommonJS(src_exports);
var import_tools = require("@pmnps/tools");
function omitBy(obj, call) {
  const es = Object.entries(obj).filter(([key, value]) => !call(value, key));
  return Object.fromEntries(es);
}
function checkLock(name, lockContent, packs) {
  const packMap = new Map(packs.map((p) => [p.name, p]));
  const currentPack = packMap.get(name);
  if (currentPack == null || currentPack.packageJson == null) {
    return null;
  }
  try {
    const lockJson = JSON.parse(lockContent || "");
    if (lockJson.lockfileVersion !== 2) {
      return null;
    }
    const packagesObj = lockJson.packages;
    const dependenciesObj = lockJson.dependencies;
    if (!packagesObj || !dependenciesObj) {
      return null;
    }
    const entries = Object.entries(packagesObj);
    const notExistPackNames = entries.map(([prefix, value]) => {
      const prefixName = function computeName() {
        const independentPackagePrefix = "../../packages/";
        const independentPlatformPrefix = "../../platforms/";
        const packagePrefix = "packages/";
        const platformPrefix = "platforms/";
        if (prefix.startsWith(independentPackagePrefix)) {
          return prefix.slice(independentPackagePrefix.length);
        }
        if (prefix.startsWith(independentPlatformPrefix)) {
          return prefix.slice(independentPlatformPrefix.length);
        }
        if (prefix.startsWith(packagePrefix)) {
          return prefix.slice(packagePrefix.length);
        }
        if (prefix.startsWith(platformPrefix)) {
          return prefix.slice(platformPrefix.length);
        }
        return null;
      }();
      if (prefixName == null) {
        return null;
      }
      const [packageName] = prefixName.split("/node_modules/");
      return packMap.has(packageName) ? null : packageName;
    }).filter((packageName) => packageName != null);
    const notExistPackNameSet = new Set(notExistPackNames);
    const shouldRemovePackNameSet = new Set(
      [...notExistPackNameSet].flatMap((name2) => {
        return [
          "../../packages/",
          "../../platforms/",
          "../../node_modules/",
          "packages/",
          "platforms/",
          "node_modules/"
        ].map((prefix) => prefix + name2);
      })
    );
    const notExistPackNameArray = [...notExistPackNameSet];
    const packRestEntries = entries.filter(([key]) => {
      return !shouldRemovePackNameSet.has(key);
    }).filter(([key]) => notExistPackNameArray.every((n) => !key.includes(n)));
    const packEntries = packRestEntries.map((p) => {
      const [k, v] = p;
      const val = v;
      if (typeof val === "object" && val != null && val.dependencies) {
        const newDeps = omitBy(
          val.dependencies,
          (v2, k2) => notExistPackNameSet.has(k2)
        );
        return [k, { ...val, dependencies: newDeps }];
      }
      return [k, v];
    });
    const dependenciesEntries = Object.entries(dependenciesObj).filter(
      ([k]) => !notExistPackNameSet.has(k)
    );
    const depEntries = dependenciesEntries.map(([k, v]) => {
      const val = v;
      if (val != null && typeof val === "object" && val.requires != null) {
        const newRequires = omitBy(
          val.requires,
          (v2, key) => notExistPackNameSet.has(key)
        );
        return [k, { ...val, requires: newRequires }];
      }
      return [k, v];
    });
    if (packEntries.length === entries.length && depEntries.length === Object.entries(dependenciesObj).length) {
      return null;
    }
    return {
      lock: {
        ...lockJson,
        packages: Object.fromEntries(packEntries),
        dependencies: Object.fromEntries(depEntries)
      },
      path: currentPack.path
    };
  } catch (e) {
    return null;
  }
}
var refreshPackageLock = function refreshPackageLock2(query) {
  const slot = (0, import_tools.createPluginCommand)("refresh");
  return slot.action(async (state) => {
    const config = state.getConfig();
    const project = state.getProject();
    const dynamicState = state.getLockState();
    if ((config == null ? void 0 : config.core) && (config == null ? void 0 : config.core) !== "npm") {
      return {
        type: "warning",
        content: "This plugin only support npm core manager."
      };
    }
    if (config == null ? void 0 : config.usePerformanceFirst) {
      return {
        type: "warning",
        content: "This plugin can not work in a performance first mode."
      };
    }
    if ((query == null ? void 0 : query.lockfileVersion) != null && (query == null ? void 0 : query.lockfileVersion) !== 2) {
      return {
        type: "warning",
        content: "This plugin only support npm lockfileVersion 2"
      };
    }
    const { packages = [], platforms = [], workspace } = (project == null ? void 0 : project.project) || {};
    if (workspace == null || config.projectType !== "monorepo") {
      return {
        type: "warning",
        content: "This plugin only support monorepo usage."
      };
    }
    const locks = Object.entries(dynamicState).map(([name, value]) => ({
      name,
      ...value
    })).filter((d) => d.hasLockFile);
    const packs = [...packages, ...platforms, workspace];
    locks.forEach((lock) => {
      const { name, lockContent, lockFileName } = lock;
      const res = checkLock(name, lockContent || "", packs);
      if (res == null) {
        return;
      }
      const { path: p, lock: lockObj } = res;
      state.task.write(p, lockFileName, lockObj);
    });
    return {
      type: "success",
      content: "Refresh package-locks success..."
    };
  });
};
var src_default = refreshPackageLock;
