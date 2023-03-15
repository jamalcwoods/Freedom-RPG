// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');

const { populateInventoryControls, populateInventoryWindow } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"favoriteItem"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.type == "inventory"){
            
            if(session.session_data.inventory[session.session_data.selected].favorite){
                delete session.session_data.inventory[session.session_data.selected].favorite
            } else {
                session.session_data.inventory[session.session_data.selected].favorite = true
            }

            interaction.update({
                content: " ",
                components: populateInventoryControls(session),
                embeds: populateInventoryWindow(session),
                ephemeral: true,
            })
            
            callback({
                updateSession:session
            })
        }
    }
}