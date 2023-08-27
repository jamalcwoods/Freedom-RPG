const { helpMessages } = require("../data.json")
const { MessageEmbed } = require('discord.js');
module.exports = {
    config:{},
    data:{
        name:"help"
    },
    execute(interaction,componentConfig,callback){
        const embed = new MessageEmbed()
        embed.addField(
            "Info - " + helpMessages[componentConfig.args[0]].title,
            "```" + helpMessages[componentConfig.args[0]].info + "```"
        )
        
        interaction.reply({
            ephemeral:true,
            embeds:[embed]   
        })

        callback({})
    }
}