import { Site } from "site-utils"
import loggerConfig from "./data/json/loggerConfig.json"
import modData from "./data/json/modData.json"
import fs from "fs"
import path from "path"
import os from "os"
import dns from "dns"

import { IPreAkiLoadModAsync } from "@spt-aki/models/external/IPreAkiLoadModAsync"
import { DependencyContainer } from "tsyringe"

import { ILogger } from "@spt-aki/models/spt/utils/ILogger"
import { ConfigServer } from "@spt-aki/servers/ConfigServer"
import { ConfigTypes } from "@spt-aki/models/enums/ConfigTypes"
import { ICoreConfig } from "../../10ScopesAndTypes/types/models/spt/config/ICoreConfig"
import { LogTextColor } from "@spt-aki/models/spt/logging/LogTextColor"
import { LogBackgroundColor } from "@spt-aki/models/spt/logging/LogBackgroundColor"

class EditGameVersion implements IPreAkiLoadModAsync {

    private async getGameVersion(logger: ILogger, hasEthernet: boolean): Promise<string> {
        let currentVersion = ""

        if (!hasEthernet) {
            return modData.OfflineGameVersion
        }

        // const { default: Site } = await import("site-utils") // Use dynamic import to load site-utils as ES module
        const url = "https://escapefromtarkov.fandom.com/wiki/Changelog"
        const document = await Site.getDocument(url)
        const getCurrentGameVersion = document.querySelector("strong.mw-selflink.selflink")?.textContent
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
        // Update the offlineGameVersion.json file with the latest version
        if (currentVersion) {
            this.updateOfflineGameVersion(currentVersion)
        }

        return currentVersion
    }

    private async updateOfflineGameVersion(newVersion: string) {
        const modDataPath = path.join(__dirname, "./data/json/modData.json")

        // Update the specific key
        modData.OfflineGameVersion = newVersion

        // Write the modified JSON data back to the file
        await fs.promises.writeFile(modDataPath, JSON.stringify(modData, null, 4))
    }



    private async checkModVersion(logger: ILogger, hasEthernet: boolean) {
        const modVersion = modData.ModVersion

        if (!hasEthernet) {
            return
        }

        // const { default: Site } = await import("site-utils") // Use dynamic import to load site-utils as ES module
        const url = "https://hub.sp-tarkov.com/files/file/1134-display-official-version/"
        const document = await Site.getDocument(url)
        const getCurrentModVersion = document.querySelector('.filebaseVersionNumber')?.textContent
        if (getCurrentModVersion === null || getCurrentModVersion === undefined) {
            if (loggerConfig.DevLogger) logger.warning("Could not find the current game version")
        } else {
            const parsedVersion = getCurrentModVersion.match(/\d\.*.*/g)?.[0]
            if (parsedVersion === undefined) {
                if (loggerConfig.DevLogger) logger.warning("Could not match the current game version with Regex")
            } else {
                if (loggerConfig.SuccessLogger && (modVersion != parsedVersion)) logger.success(`NEW MOD VERSION`)
            }
        }
    }

    private async hasResponseOk(logger: ILogger): Promise<boolean> {
        try {
            const response = await fetch('https://www.google.com', { method: 'HEAD' })
            if (response.ok) {
                if (loggerConfig.DevLogger) logger.info('Response: '+'Internet connection is available')
                return true
            } else {
                if (loggerConfig.DevLogger) logger.info('Response: '+'No internet connection')
                return false
            }
        } catch (error) {
            if (loggerConfig.DevLogger) logger.error('Response: '+'Error occurred while checking internet connectivity', error)
            return false
        }
    }

    private async dnsLookUpENOTFOUND(logger: ILogger): Promise<boolean> {
        return new Promise((resolve) => {
            dns.lookup('example.com', (err) => {
                if (err && err.code === 'ENOTFOUND') {
                    if (loggerConfig.DevLogger) logger.info('DNS: '+'No internet connection')
                    resolve(false) // No internet connection
                } else {
                    resolve(true) // Internet connection is available
                    if (loggerConfig.DevLogger) logger.info('DNS: '+'Internet connection is available')
                }
            })
        })
    }

    private hasActiveEthernetConnection(networkInterfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>) {
        const hasEthernet = Object.keys(networkInterfaces).some((interfaceName) => {
            const networkInterface = networkInterfaces[interfaceName]
            if (networkInterface) {
                return networkInterface.some((iface) => (iface.family === "IPv4" || iface.family === 'IPv6') && iface.internal === false)
            }
            return false
        })
        return hasEthernet
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

        // Check for an active internet connection
        let hasEthernet = false
        try {
            const hasDnsTrue = await this.dnsLookUpENOTFOUND(logger)
            const hasResponseTrue = await this.hasResponseOk(logger)
            if (hasDnsTrue || hasResponseTrue) {
                const networkInterfaces = os.networkInterfaces()
                hasEthernet = this.hasActiveEthernetConnection(networkInterfaces)
            }
        } catch (error) {
            logger.error('An error occurred while checking internet connectivity:', error)
        }

        // check for latest Mod Version
        await this.checkModVersion(logger, hasEthernet)

        // get to official version.
        const isBetaVersion = "Beta version"
        const getCurrentGameVersion = await this.getGameVersion(logger, hasEthernet)

        // change to current game version
        coreConfig.akiVersion = isBetaVersion
        coreConfig.projectName = getCurrentGameVersion

        // DevLogger checks new game version
        if (loggerConfig.DevLogger) logger.info(`here is the changed SPT: \nakiVersion: ${coreConfig.akiVersion} \nprojectName: ${coreConfig.projectName}`)
        if (loggerConfig.SuccessLogger) logger.log(`We changed the SPT-AKI version back to the latest version: ${coreConfig.projectName} ${coreConfig.akiVersion}`, LogTextColor.MAGENTA, LogBackgroundColor.BLACK)

        return
    }
}

module.exports = { mod: new EditGameVersion() }
