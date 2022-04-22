const events = require('events');
const { Client, Permissions } = require("discord.js");
const packagesJson = require('../package.json');
const { execSync } = require('child_process')

const { readdirSync, existsSync } = require('fs');
const Debug = require('./development/Debug');
const Interaction = require('./Interaction');
const DeployCommands = require('./DeployCommands');

class ModulesClass {
    /**
     * @type module:events.EventEmitter
     * @private
     */
    _events;
    /**
     * @type Client
     * @private
     */
    _client;
    /**
     * @type Debug
     * @private
     */
    _debug;
    _databaseModel;

    _modules;

    /**
     * @param {module:events.EventEmitter} Events
     * @param {Client} client
     * @param databaseModel
     */
    constructor(Events, client, databaseModel) {
        this._events = Events;
        this._client = client;
        this._debug = new Debug();
        this._modules = [];
        this._databaseModel = databaseModel;
        this.main();
    }

    main() {
        this._debug.message = "Mapping Modules";
        this._debug.createCategory();
        this.setBaseVarInClient();
        this.mapping();
        this._client.on('ready', () => DeployCommands(this._client.user.id, this._client.interaction.commands))
    }

    setBaseVarInClient() {
        this._client['interaction'] = {};
        this._client.interaction['commands'] = [];
        this._client.interaction['buttons'] = [];
    }

    /**
     * @private
     * @returns {Promise<void>}
     */
    async mapping() {
        let modulesDir = readdirSync(`${process.mainModule.path}/modules`).filter(data => data.startsWith('#'))
        if (!modulesDir[0]) return this.error('Missing $cModules$s in the $cfolder$s "modules" !')
        modulesDir.map(folderName => {
            if (!this.verifyManifestExist(folderName)) {
                this.error(`($c${folderName}$s) the "modules.manifest.js" $cdoes exist$s in root !`);
            } else {
                const manifest = require(`${process.mainModule.path}/modules/${folderName}/modules.manifest`);
                this.modulesController(manifest);
            }
        })
        await this.addNewPackages();
        this.startEvents();
        this.saveInteraction();
        new Interaction(this._client, events, this._modules, this._databaseModel);
    }

    /**
     * @private
     * @param manifest
     */
    modulesController(manifest) {
        const {name, tag, config, events, interaction, packages} = manifest;
        if (!name) return this.error('Missing $cname$s in "modules.manifest.js" !');
        if (!tag) return this.error('Missing $ctag$s in "modules.manifest.js" !');
        if (events) {
            if (!this.eventsController(events)) return;
        }
        this._modules.push({
            name,
            tag,
            config: config ? config : {},
            events,
            interaction,
            packages
        })
    }

    /**
     * @private
     */
    startEvents() {
        this._modules.map(module => {
            this._debug.message = this._debug.config["debug.start_modules"].message.replace('{{ module.tag }}', module.tag)
            this._debug.create('start_modules')
            if (!module['events']) return;
            module.events.map(e => {
                e.functions.map(func => {
                    if (e.type === "ready") return this._client.on(e.type, func.bind(this, module.config, this._events, this._client, this._databaseModel));
                    this._client.on(e.type, func.bind(this, module.config, this._events, this._client, this._databaseModel));
                })
            })
        });

    }

    /**
     * @private
     * @param events
     * @returns {boolean}
     */
    eventsController(events) {
        let notError = true;
        events.map(e => {
            const {type, functions} = e;
            if (!type) {notError = false;return this.error('Missing $ctype$s of events !');}
            if (!functions || !functions[0]) {notError = false;return this.error('Missing $cfunctions$s of events !');}
        })
        return notError;
    }

    initializeDefaultCommands() {
        const commandsFiles = readdirSync(`${__dirname}/commands/`)
        commandsFiles.map(fileName => {
            const commands = require(`${__dirname}/commands/${fileName}`);
            this._client.interaction.commands.push(commands);
        })
    }

    saveInteraction() {
        this.initializeDefaultCommands();
        this._modules.map(module => {
            if (!module['interaction']) return;
            if (module['interaction']['commands']) {
                module['interaction']['commands'].map(commands => {
                    if (!commands['Data']) return this.error(`Missing $cData$s "${module.tag}/" in $cCommands$s`);
                    if (!commands['Data']['name']) return this.error(`Missing $cname$s of commands "${module.tag}/"`);
                    if (!commands['Data']['description']) return this.error(`Missing $cdescription$s of commands "${module.tag}/${commands['Data']['name']}"`);
                    if (commands['Data']['permission'] && isNaN(parseInt(commands['Data']['permission'])) && !Permissions.FLAGS[commands['Data']['permission']]) return this.error(`The $cPermission$s "$c${commands['Data']['permission']}$s" is not available !`)
                    commands['Data']['modulesParent'] = module.tag;
                    this._client.interaction.commands.push(commands);
                })
            }

            if (module['interaction']['buttons']) {
                module['interaction']['buttons'].map(button => {
                    if (!button['Data']) return this.error(`Missing $cData$s "${module.tag}/" in $cButton$s`);
                    if (!button['Data']['custom_id']) return this.error(`Missing $ccustom_id$s "${module.tag}/" in $cButton$s`);
                    if (!button['Data']['style']) return this.error(`Missing $ctype$s "${module.tag}/${button.Data.custom_id}" in $cButton$s`);
                    if (!button['Data']['label']) return this.error(`Missing $clabel$s "${module.tag}/${button.Data.custom_id}" in $cButton$s`);
                    button['Data']['modulesParent'] = module.tag;
                    this._client.interaction.buttons.push(button);
                })
            }
        })
    }

    error(message) {
        this._debug.message = message
        this._debug.create('error');
    }

    /**
     * @private
     * @param {String} folderName
     * @returns {boolean}
     */
    verifyManifestExist(folderName) {
        return existsSync(`${process.mainModule.path}/modules/${folderName}/modules.manifest.js`);
    }

    async addNewPackages() {
        const packages = [];
        const allPackages = [];
        let finalLineCommandsInstall = "npm add"
        await this._modules.map(module => {
            if (!module['packages']) return false;
            module.packages.map(pkg => {
                allPackages.push(pkg)
                if (packages.includes(pkg)) return;
                else return packages.push(pkg);
            })
        })
        packages.map(pkg => {
            if (!this.verifyInstallPackage(pkg)) return finalLineCommandsInstall += ` ${pkg}`
        })
        if (finalLineCommandsInstall !== "npm add") await execSync(finalLineCommandsInstall, {cwd: process.mainModule.path});
        this.cleanPackageJson(allPackages);
    }

    verifyInstallPackage(pkg) {
        return !!packagesJson.dependencies[pkg];
    }

    cleanPackageJson(packages) {
        let finalLineCommandsInstall = "npm remove"
        const packagesDefault = ['@discordjs/rest', 'discord-api-types', 'discord.js', 'dotenv'];
        Object.keys(packagesJson.dependencies).map(pkg => {
            if (packagesDefault.includes(pkg)) return;
            if (packages.includes(pkg)) return;
            return finalLineCommandsInstall += ` ${pkg}`;
        })
        if (finalLineCommandsInstall === "npm remove") return;
        execSync(finalLineCommandsInstall, {cwd: process.mainModule.path})
    }
}

module.exports = ModulesClass;