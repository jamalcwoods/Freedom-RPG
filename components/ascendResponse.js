const { MessageEmbed } = require('discord.js');
const { populateCloseInteractionMessage} = require("../sessionTools.js")
const { templates} = require("../data.json")

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

            session.session_data.player.abilities = templates.emptyPlayerData.abilities
            session.session_data.player.stats = templates.emptyPlayerData.stats
            session.session_data.player.gold = templates.emptyPlayerData.gold
            session.session_data.player.level = templates.emptyPlayerData.level
            session.session_data.player.exp = templates.emptyPlayerData.exp
            session.session_data.player.expCap = templates.emptyPlayerData.expCap
            session.session_data.player.statpoints = templates.emptyPlayerData.statpoints
            session.session_data.player.inventory = templates.emptyPlayerData.inventory
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