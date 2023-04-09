import { Site } from "site-utils"
import loggerConfig from "./data/json/loggerConfig.json"

import { IPreAkiLoadModAsync } from "@spt-aki/models/external/IPreAkiLoadModAsync"
import { DependencyContainer } from "tsyringe"

import { ILogger } from "@spt-aki/models/spt/utils/ILogger"
import { ConfigServer } from "@spt-aki/servers/ConfigServer"
import { ConfigTypes } from "@spt-aki/models/enums/ConfigTypes"
import { ICoreConfig } from "../../10ScopesAndTypes/types/models/spt/config/ICoreConfig"
import { LogTextColor } from "@spt-aki/models/spt/logging/LogTextColor"
import { LogBackgroundColor } from "@spt-aki/models/spt/logging/LogBackgroundColor"

class EditGameVersion implements IPreAkiLoadModAsync {

    private async getGameVersion(logger: ILogger): Promise<string> {
        // const { default: Site } = await import("site-utils") // Use dynamic import to load site-utils as ES module
        const url = "https://escapefromtarkov.fandom.com/wiki/Changelog"
        const document = await Site.getDocument(url)
        const getCurrentGameVersion = document.querySelector("strong.mw-selflink.selflink")?.textContent
        let currentVersion = ""
        if (getCurrentGameVersion === null || getCurrentGameVersion === undefined) {
            if (loggerConfig.DevLogger) logger.warning("Could not find the current game version")
        } else {
            const parsedVersion = getCurrentGameVersion.match(/\d\.*.*/g)?.[0]
            if (parsedVersion === undefined) {
                if (loggerConfig.DevLogger) logger.warning("Could not match the current game version with Regex")
            } else {
                currentVersion = parsedVersion
                if (loggerConfig.SuccessLogger) logger.success(`Found latest game version by EFT-Wiki \nLatest version: ${currentVersion} Beta version`)
            }
        }
        return currentVersion
    }

    public async preAkiLoadAsync(container: DependencyContainer): Promise<void> {
        // get logger
        const logger = container.resolve<ILogger>("WinstonLogger")

        // get the config server
        const configServer = container.resolve<ConfigServer>("ConfigServer")

        // Request core config
        // Required - ConfigTypes.CORE is the enum of the config we want
        const coreConfig = configServer.getConfig<ICoreConfig>(ConfigTypes.CORE)

        // log the original Aki-Version + ProjectName
        if (loggerConfig.DevLogger) logger.info(`here is the original SPT: \nakiVersion: ${coreConfig.akiVersion} \nprojectName: ${coreConfig.projectName}`)

        //get to official version.
        const isBetaVersion = "Beta version"
        const getCurrentGameVersion = await this.getGameVersion(logger)

        //change to current game version
        coreConfig.akiVersion = isBetaVersion
        coreConfig.projectName = getCurrentGameVersion

        // DevLogger checks new game version
        if (loggerConfig.DevLogger) logger.info(`here is the changed SPT: \nakiVersion: ${coreConfig.akiVersion} \nprojectName: ${coreConfig.projectName}`)
        if (loggerConfig.SuccessLogger)  logger.log(`We changed the SPT-AKI version back to the latest verion: ${coreConfig.projectName} ${coreConfig.akiVersion}`, LogTextColor.MAGENTA, LogBackgroundColor.BLACK)

        return 
    }
}

module.exports = { mod: new EditGameVersion() }