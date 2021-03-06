const Debug = require('../../../utils/development/Debug');

module.exports = (config, events, client, databaseModel) => {
    setDatabase(databaseModel);
    const express = require('express');
    const bodyParser = require('body-parser');
    const cors = require('cors');

    const app = express();
    const debug = new Debug();

    debug.message = "#API";
    debug.createCategory();

    app.get('/clientUser', (req, res) => {
        res.status(200).json(client.user)
    })

    app.get('/getChannelGuild/:userToken/:guildID', (req, res) => {
        const {userToken, guildID} = req.params;
        const db = databaseModel.database;
        if (!db['#api']['tokenAccess'].includes(userToken)) return res.send({
            error: true,
            message: "TokeAccess is available !"
        });

        const guild = client.guilds.resolve(guildID);
        if (guild === null) return res.send({
            error: true,
            message: "The guild is available !"
        })

        const channels = [];
        guild.channels.cache.map(channel => {
            channels.push(
                {
                    id: channel.id,
                    name: channel.name,
                    topic: channel.topic,
                    type: channel.type,
                    parentId: channel.parentId,
                    nsfw: channel.nsfw,
                    ramPosition: channel.rawPosition
                }
            )
        })
        res.status(200).json(channels)
    })

    app.listen(config.port, (e) => {
        debug.message = `"$c#api$s" the api $clisten$s on the url : $chttp://localhost:${config.port}$s`;
        debug.create('modules');
    })
}

const setDatabase = (databaseModel) => {
    const db = databaseModel.database;
    if (!db['#api']) db['#api'] = {};
    if (!db['#api']['tokenAccess']) db['#api']['tokenAccess'] = [];
    saveData(databaseModel, db);
}

const saveData = (databaseModel, db) => {
    databaseModel.database = db;
    databaseModel.save();
}