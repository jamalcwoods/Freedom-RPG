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

        let updates = [
            {
                id:session.user_ids[0],
                path:"skillpoints",
                value:session.session_data.skillpoints
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