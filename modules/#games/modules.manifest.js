module.exports = {
    config: {
        tetrix: require('./tetrix.config.json')
    },
    name: "Games",
    tag: "#games",
    interaction: {
        commands: [
            require('./commands/randomNumber'),
            require('./commands/tetrix'),
        ]
    }
}