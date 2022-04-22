const { MessageEmbed, MessageActionRow, MessageButton, Client, CommandInteraction } = require('discord.js')
const { EventEmitter } = require('events')

module.exports = {
    Data: {
        name: "tetrix",
        description: "Launch a new tetrix game"
    },
    /**
     * 
     * @param {Object} configs 
     * @param {EventEmitter} event 
     * @param {Client} client 
     * @param {CommandInteraction} interaction 
     * @returns 
     */
    async Commands(configs, event, client, interaction) {
        await interaction.deferReply()

        const Tetrix = {
            ...configs.tetrix, 
            currentPiece: null,
            speed_coef: 1,
            state: "playing"
        }
        const gameInformations = {
            score: 0,
            pieces: 0,
            time: {
                current: null,
                started: null
            },

        }

        await interaction.editReply({content: "The game is in preparation...", ephemeral: true})
        
        const emptyLine = Array.from({length: Tetrix.grid_size[0]}, () => Tetrix.blocks.empty)
        Tetrix.Grid = Array.from({length: Tetrix.grid_size[1]}, () => [...emptyLine])

        function normalizePiece(piece) {
            const maxLength = piece.sort((a, b) => b.length - a.length)[0].length
            for(let s of piece) if(s.length<maxLength) s+= Tetrix.blocks.empty * (maxLength - s.length)
            return piece
        }
        function genPiece() {
            const {shapes, grid_size} = Tetrix
            const shape = normalizePiece(shapes[Math.ceil(Math.random() * shapes.length-1)])
            
            const maxLength = shape.sort((a, b) => b.length - a.length)[0].length
            const x = Math.ceil(Math.random() * (grid_size[0] - maxLength))

            gameInformations.pieces++
            Tetrix.currentPiece = {
                y: 0,
                x, shape
            }
        }

        function getGameInformations() {
            let score = 0
            for(const line of Tetrix.Grid) score+= line.filter(c => c === Tetrix.blocks.filled).length
            gameInformations.score = score

            gameInformations.time.current = new Date()
            gameInformations.time.duration= new Date(gameInformations.time.current.getTime() - gameInformations.time.started.getTime())

            return gameInformations
        }

        function gridWithCurrentPiece() {
            const grid = JSON.parse(JSON.stringify(Tetrix.Grid))
            const {x, y, shape} = Tetrix.currentPiece

            for(const i in shape) {
                const ord = y + parseInt(i)
                if(isNaN(ord) || ord >= grid.length) continue

                for(const j in shape[i]) {
                    const abs = x + parseInt(j)
                    if( isNaN(abs) || !( 0 <= abs <= grid[0].length )
                        || shape[i][j] !== Tetrix.blocks.filled
                    ) continue

                    grid[ord][abs] = shape[i][j]
                }
            }
            
            return JSON.parse(JSON.stringify(grid))
        }
        
        function canGo(dirX, dirY) {
            const {x, y, shape} = Tetrix.currentPiece
            for(let i in shape) {
                const ord = y + parseInt(i)
                if(ord+dirY < 0 || ord+dirY >= Tetrix.Grid.length) return false
                
                for(let j in shape[i]) {
                    const abs = x + parseInt(j)
                    if( shape[i][j] === Tetrix.blocks.filled
                        && (
                            (abs + dirX < 0 || abs + dirX >= Tetrix.Grid[ord].length)
                            || Tetrix.Grid[ord + dirY][abs + dirX] === Tetrix.blocks.filled
                        )                        
                    ) return false
                }
            }
            return true
        }

        function processGrid() {
            if(!Tetrix.currentPiece?.shape) genPiece()
            else if(!canGo(0, 1)) {
                Tetrix.Grid = gridWithCurrentPiece()
                if(!Tetrix.currentPiece.y) return loose()
                else genPiece()
            }
            else Tetrix.currentPiece.y+= 1
            
            const line_killed = [] // Array like: [ [2,3,4,6,7], [9,10]] => y of killed lines
            for(const ord in Tetrix.Grid) {
                let line= Tetrix.Grid[ord]
                if(!line) continue
                const isFull = !line.find(c => c === Tetrix.blocks.blank || c === Tetrix.blocks.empty)

                if(isFull) {
                    Tetrix.Grid[ord] = [...emptyLine]
                    let i = line_killed.indexOf(line_killed.find(a => a.find(n => n == parseInt(ord)-1)))
                    if(i<0) {
                        line_killed.push([])
                        i = line_killed.length - 1
                    }

                    line_killed[i].push(parseInt(ord))
                }
            }

            let globalMovingLength = 0
            for(const index in line_killed) {
                const ords = line_killed[index]
                const min = ords[0]

                const newGrid = JSON.parse(JSON.stringify(Tetrix.Grid))
                const moveLength = ords.length

                newGrid.splice(min + globalMovingLength, moveLength)
                for(let i = 0; i < moveLength; i++) newGrid.unshift([...emptyLine])

                globalMovingLength+= moveLength + 1
                Tetrix.Grid = JSON.parse(JSON.stringify(newGrid))
            }
            
        }

        const Mouvements = {
            left() {
                if(canGo(-1,0)) Tetrix.currentPiece.x -= 1
            },
            right() {
                if(canGo(1,0)) Tetrix.currentPiece.x += 1
            },
            turnRight() {
                const {shape} = Tetrix.currentPiece
                const newPiece = []
                for(const line of shape) {
                    for(const i in line) {
                        if(!newPiece[i]) newPiece[i] = ""
                        newPiece[i]+= line[line.length - 1 - parseInt(i)]
                    }
                }
                Tetrix.currentPiece.shape = normalizePiece(newPiece)
            },
            turnLeft() {
                const {shape} = Tetrix.currentPiece
                const newPiece = []
                for(const lineNB in shape) {
                    const line = shape[shape.length - 1 - parseInt(lineNB)]
                    for(const i in line) {
                        if(!newPiece[i]) newPiece[i] = ""
                        newPiece[i]+= line[i]
                    }
                }
                Tetrix.currentPiece.shape = normalizePiece(newPiece)
            },
            pushToBottom() {
                while(canGo(0, 1)) Tetrix.currentPiece.y++
                processGrid()
            }
        }

        const buttonsActions = [
            {
                button: new MessageButton({
                    style: 1,
                    custom_id: "turn_left",
                    emoji: "↗️",
                    label: "Turn left"
                }),
                fct: Mouvements.turnLeft
            },
            {
                button: new MessageButton({
                    style: 1,
                    custom_id: "left",
                    emoji: "◀️",
                    label: "Move left"
                }),
                fct: Mouvements.left
            },
            {
                button: new MessageButton({
                    style: 2,
                    custom_id: "push_bottom",
                    emoji: "⏬",
                    label: "Next piece"
                }),
                fct: Mouvements.pushToBottom
            },
            {
                button: new MessageButton({
                    style: 1,
                    custom_id: "right",
                    emoji: "▶️",
                    label: "Move right"
                }),
                fct: Mouvements.right
            },
            {
                button: new MessageButton({
                    style: 1,
                    custom_id: "turn_right",
                    emoji: "↖️",
                    label: "Turn right"
                }),
                fct: Mouvements.turnRight
            }
        ]

        function gridToText() {
            let txt= ""
            for(const lines of gridWithCurrentPiece()) {
                if(!lines) continue
                if(txt) txt+= "\n"
                txt+= lines.join('').replace(new RegExp(Tetrix.blocks.empty, "g"), `${Tetrix.blocks.blank}`)
            }
            return txt
        }

        function getRaws() {
            const raw = new MessageActionRow()
            for(const {button} of buttonsActions) raw.addComponents(button)
            return raw
        }

        function getEmbed() {
            const txt= gridToText()

            const gameInfos = getGameInformations()
            return new MessageEmbed({
                color: interaction.member.displayColor || "AQUA",
                footer: {
                    text: "Delete this message to stop the game",
                },
                description: "```" + txt + "```",
                title: "Here is your current game:",
                fields: [
                    {
                        name: `🎯 Score: ${gameInfos.score}p.`,
                        value: "\u200b",
                        inline: true
                    },
                    {
                        name: `🧩 Pieces: ${gameInfos.pieces - 1}`,
                        value: "\u200b",
                        inline: true
                    },
                    {
                        name: `⏲️ Duration: ${gameInfos.time.duration.getMinutes()}min ${gameInfos.time.duration.getSeconds()}s`,
                        value: "\u200b"
                    }
                ]
            })
        }

        function getMessageComponent(customText) {
            return {
                content: customText || " ",
                embeds: [getEmbed()],
                components: [getRaws()]
            }
        }
        
        function loose() {
            Tetrix.state = "lost"
            const components = getMessageComponent(`Game by ${interaction.user.toString()}:`)
            components.components = []
            delete components.embeds[0].title
            delete components.embeds[0].footer

            components.embeds.push(new MessageEmbed({
                color: "RED",
                title: "Youps... You lost the game.",
                footer: "Launch a new one and try to beat your score!"
            }))
            try {
                interaction.editReply(components)
            } catch (e) {}
        }

        async function refreshDisplay() {
            if(Tetrix.state !== "playing") return
            try {
                var message = await interaction.editReply(getMessageComponent())
            } catch (e) { return }
            return message
        }
        
        async function awaitForInteraction() {
            const message = await refreshDisplay()

            if(message) {
                const collector = message.createMessageComponentCollector({
                    filter: i => i.isButton() && i.user?.id === interaction.user?.id,
                })
                collector.on('collect', async (buttonInteraction) => {
                    const {fct} = buttonsActions.find(b => b.button.customId === buttonInteraction.customId)
                    if(fct) fct();
                    const m = await refreshDisplay();
                    if(!m) return collector.stop()
                })
            }
        }
        async function gameProcess() {
            processGrid()
            const redo = await refreshDisplay()
            if(redo) setTimeout(gameProcess, Tetrix.refreshRate * Tetrix.speed_coef);
        }
        gameInformations.time.started = new Date()
        gameProcess()
        return awaitForInteraction()
    }
}