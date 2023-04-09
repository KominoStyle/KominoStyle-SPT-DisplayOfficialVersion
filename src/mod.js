"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const site_utils_1 = require("site-utils");
const loggerConfig_json_1 = __importDefault(require("./data/json/loggerConfig.json"));
const ConfigTypes_1 = require("C:/snapshot/project/obj/models/enums/ConfigTypes");
const LogTextColor_1 = require("C:/snapshot/project/obj/models/spt/logging/LogTextColor");
const LogBackgroundColor_1 = require("C:/snapshot/project/obj/models/spt/logging/LogBackgroundColor");
class EditGameVersion {
    async getGameVersion(logger) {
        // const { default: Site } = await import("site-utils") // Use dynamic import to load site-utils as ES module
        const url = "https://escapefromtarkov.fandom.com/wiki/Changelog";
        const document = await site_utils_1.Site.getDocument(url);
        const getCurrentGameVersion = document.querySelector("strong.mw-selflink.selflink")?.textContent;
        let currentVersion = "";
        if (getCurrentGameVersion === null || getCurrentGameVersion === undefined) {
            if (loggerConfig_json_1.default.DevLogger)
                logger.warning("Could not find the current game version");
        }
        else {
            const parsedVersion = getCurrentGameVersion.match(/\d\.*.*/g)?.[0];
            if (parsedVersion === undefined) {
                if (loggerConfig_json_1.default.DevLogger)
                    logger.warning("Could not match the current game version with Regex");
            }
            else {
                currentVersion = parsedVersion;
                if (loggerConfig_json_1.default.SuccessLogger)
                    logger.success(`Found latest game version by EFT-Wiki \nLatest version: ${currentVersion} Beta version`);
            }
        }
        return currentVersion;
    }
    async preAkiLoadAsync(container) {
        // get logger
        const logger = container.resolve("WinstonLogger");
        // get the config server
        const configServer = container.resolve("ConfigServer");
        // Request core config
        // Required - ConfigTypes.CORE is the enum of the config we want
        const coreConfig = configServer.getConfig(ConfigTypes_1.ConfigTypes.CORE);
        // log the original Aki-Version + ProjectName
        if (loggerConfig_json_1.default.DevLogger)
            logger.info(`here is the original SPT: \nakiVersion: ${coreConfig.akiVersion} \nprojectName: ${coreConfig.projectName}`);
        //get to official version.
        const isBetaVersion = "Beta version";
        const getCurrentGameVersion = await this.getGameVersion(logger);
        //change to current game version
        coreConfig.akiVersion = isBetaVersion;
        coreConfig.projectName = getCurrentGameVersion;
        // DevLogger checks new game version
        if (loggerConfig_json_1.default.DevLogger)
            logger.info(`here is the changed SPT: \nakiVersion: ${coreConfig.akiVersion} \nprojectName: ${coreConfig.projectName}`);
        if (loggerConfig_json_1.default.SuccessLogger)
            logger.log(`We changed the SPT-AKI version back to the latest verion: ${coreConfig.projectName} ${coreConfig.akiVersion}`, LogTextColor_1.LogTextColor.MAGENTA, LogBackgroundColor_1.LogBackgroundColor.BLACK);
        return;
    }
}
module.exports = { mod: new EditGameVersion() };
