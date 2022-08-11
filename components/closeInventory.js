// const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { populateCloseInteractionMessage} = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true,
    },
    data:{
        name:"closeInventory"
    },
    async execute(interaction,componentConfig,callback){
        let session = componentConfig.session

        session.session_data.player.inventory = session.session_data.inventory

        let updates = [
            {
                id:session.user_ids[0],
                path:"",
                value:session.session_data.player
            }
        ]

        interaction.update(populateCloseInteractionMessage("Inventory Closed"))
        
        callback({
            removeSession:session,
            updatePlayer:updates
        })
    }
}