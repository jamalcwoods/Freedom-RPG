const { MessageEmbed } = require('discord.js');
const { populateCloseInteractionMessage} = require("../sessionTools.js")
const { templates} = require("../data.json")
const { clone } = require("../tools.js")

module.exports = {
    config:{
        getSession:true,
    },
    data:{
        name:"ascendResponse"
    },
    async execute(interaction,componentConfig,callback){
        let session = componentConfig.session

        if(session.type == "ascend"){

            let resultText = "Ascension Completed"
            if(session.session_data.temp.choice > 0){
                session.session_data.player.signature = session.session_data.player.abilities[session.session_data.temp.choice - 1]    
                resultText += "\n" + session.session_data.player.signature.name + " is now " + session.session_data.player.name + " signature ability!"
            } else {
                session.session_data.town.level++
                session.session_data.town.dungeonClear = false
                resultText += "\n" + session.session_data.town.name + " is now level " + session.session_data.town.level + "!"
            }

            let emptyPlayer = clone(templates.emptyPlayerData)

            session.session_data.player.abilities = emptyPlayer.abilities
            session.session_data.player.stats = emptyPlayer.stats
            session.session_data.player.gold = emptyPlayer.gold
            session.session_data.player.level = emptyPlayer.level
            session.session_data.player.exp = emptyPlayer.exp
            session.session_data.player.expCap = emptyPlayer.expCap
            session.session_data.player.statpoints = emptyPlayer.statpoints
            session.session_data.player.inventory = emptyPlayer.inventory
            session.session_data.player.stances = emptyPlayer.stances
            session.session_data.player.weapon = null
            session.session_data.player.gear = null
            
            if(!session.session_data.player.ascends){
                session.session_data.player.ascends = 0
            }

            session.session_data.player.ascends++

            let townUpdates = [{
                id:session.session_data.town.id,
                path:"level",
                value:session.session_data.town.level
            },
            {
                id:session.session_data.town.id,
                path:"dungeonClear",
                value:false
            }]

            let updates = [{
                id:session.user_ids[0],
                path:"",
                value:session.session_data.player
            }]
            

            interaction.update(populateCloseInteractionMessage(resultText))
        
            callback({
                updatePlayer:updates,
                updateTown:townUpdates,
                removeSession:session
            })
        }
    }
}