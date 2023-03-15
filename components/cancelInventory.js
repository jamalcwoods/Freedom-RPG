// const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { getTownDBData } = require("../firebaseTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"cancelInventory"
    },
    async execute(interaction,componentConfig,callback){
        getTownDBData(interaction.guild.id,function(town){
            let session = componentConfig.session

            const embed = new MessageEmbed()
			.setColor('#00ff00')
			.setTitle("Inventory Changes Canceled")

            interaction.update({
                content: " ",
                components: [],
                embeds: [embed]
            })
            
            callback({
                removeSession:session
            })
        })
    }
}