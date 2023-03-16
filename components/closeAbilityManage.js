// const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateCloseInteractionMessage} = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true,
    },
    data:{
        name:"closeAbilityManage"
    },
    async execute(interaction,componentConfig,callback){
        let session = componentConfig.session

        let updates = [
            {
                id:session.user_ids[0],
                path:"abilities",
                value:session.session_data.player.abilities
            }            
        ]

        

        if(session.session_data.player.abilityMemory){
            updates.push({
                id:session.user_ids[0],
                path:"abilityMemory",
                value:session.session_data.player.abilityMemory
            })
        }

        interaction.update(populateCloseInteractionMessage("Abilities Saved"))
        
        callback({
            removeSession:session,
            updatePlayer:updates
        })
    }
}