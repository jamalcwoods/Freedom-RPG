// const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { populateCloseInteractionMessage} = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true,
    },
    data:{
        name:"saveStats"
    },
    async execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.session_data.tutorial){
            let stats = session.session_data.stats
            let hpFlag = stats.hp >= 10
            let defFlag = stats.def >= 10
            let spdefFlag = stats.spdef >= 10
            let offensiveFlag = stats.atk >= 10 || stats.spatk
            if(hpFlag && defFlag && spdefFlag && offensiveFlag){
                let updates = [
                    {
                        id:session.user_ids[0],
                        path:"statpoints",
                        value:session.session_data.statpoints
                    },
                    {
                        id:session.user_ids[0],
                        path:"stats",
                        value:session.session_data.stats
                    },
                    {
                        id:session.user_ids[0],
                        path:"tutorial",
                        value:3
                    }
                ]
        
                interaction.update(populateCloseInteractionMessage("Stats Saved"))
                
                callback({
                    removeSession:session,
                    updatePlayer:updates
                })  
            }
        } else {
            let session = componentConfig.session

            let updates = [
                {
                    id:session.user_ids[0],
                    path:"statpoints",
                    value:session.session_data.statpoints
                },
                {
                    id:session.user_ids[0],
                    path:"stats",
                    value:session.session_data.stats
                }
            ]
    
            interaction.update(populateCloseInteractionMessage("Stats Saved"))
            
            callback({
                removeSession:session,
                updatePlayer:updates
            })
        }
    }
}