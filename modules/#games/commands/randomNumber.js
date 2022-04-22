const { Client, CommandInteraction, MessageEmbed } = require("discord.js");
const { EventEmitter } = require('events')

module.exports = {
    Data: {
        name: "random-number",
        description: "Get a random number",
        options: [
            {
                name: "minimum",
                description: "The minimum number you can optain",
                type: 10,
                required: true
            },
            {
                name: "maximum",
                description: "The maximum number you can optain",
                type: 10,
                required: true
            },
            {
                name: "round",
                description: "The number of decimal value (default: 0)",
                type: 10
            }
        ]
    },
    /**
     * 
     * @param {Object} config 
     * @param {EventEmitter} event 
     * @param {Client} client 
     * @param {CommandInteraction} interaction 
     */
    Commands(config, event, client, interaction) {
        const   min = interaction.options.getNumber('minimum'),
                max = interaction.options.getNumber('maximum'),
                round = interaction.options.getNumber('round') || 0
        ;
        
        if(min > max) return interaction.reply({content: "The minimum number must lower that the maximum number! (that's the maths' logic)", ephemeral: true})
        const nb = (Math.random() * (max - min)) + min
        const FixedNB = nb.toFixed(round)

        return interaction.reply({content: " ", embeds: [
            new MessageEmbed({
                title: `${min} ⩽ number ⩽ ${max}`,
                description: `The choosen number is \`${FixedNB}\``,
                color: "RANDOM",
                author: {
                    icon_url: interaction.user.displayAvatarURL({dynamic: true}),
                    name: interaction.user.tag,
                    url: 'https://flymeth.net'
                }
            })
        ]})
    }
}